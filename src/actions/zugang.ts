"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { AuthError, requireRole, requireUser, setSessionCookie, signToken } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import { sendeMail } from "@/lib/mail";
import {
  erzeugeZugangstoken,
  pruefeZugangstoken,
  sichergestelltesKontoFuerReferent,
  verbraucheTokenUndSetzePasswort,
  zugangsLink,
  type Zweck,
} from "@/lib/zugang";
import type { FormularState } from "@/lib/validation/fortbildung";
import { T } from "@/texte/de";

/** Mindestanforderung an ein Passwort. */
const PasswortSchema = z
  .string()
  .min(12, T.zugang.zugangAktionen.passwortZuKurz)
  .max(200, T.zugang.zugangAktionen.passwortZuLang);

// ---------------------------------------------------------------------------
// Zugang einrichten (durch die Administration)
// ---------------------------------------------------------------------------

export interface EinladungState extends FormularState {
  /** Der erzeugte Link — wird einmalig angezeigt und muss kopiert werden. */
  link?: string;
  gueltigBis?: string;
}

/**
 * Hebt ein bestehendes Referentenkonto zur Administration hoch.
 *
 * Die Aktion ist bewusst kein frei editierbares Rollenfeld: Nur ein bereits
 * aktives, mit einem Referenteneintrag verknüpftes REFERENT-Konto mit
 * eingerichtetem Passwort kommt in Frage. Zusätzlich muss die Administration
 * die E-Mail-Adresse der Person eintippen. Der Versionssprung beendet vorhandene Sitzungen des Zielkontos,
 * damit es die neuen Rechte erst nach einer frischen Anmeldung verwenden kann.
 */
export async function stufeReferentZuAdministrationHoch(
  userId: string,
  _bisher: FormularState,
  formData: FormData,
): Promise<FormularState> {
  let admin;
  try {
    admin = await requireRole("ADMIN");
  } catch (error) {
    if (error instanceof AuthError) return { fehler: { _: error.message } };
    throw error;
  }

  const bestaetigung = (formData.get("bestaetigung") ?? "")
    .toString()
    .trim()
    .toLowerCase();
  const ziel = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      passwordHash: true,
      referent: { select: { id: true, aktiv: true } },
    },
  });

  if (
    !ziel ||
    ziel.role !== "REFERENT" ||
    !ziel.referent ||
    !ziel.isActive ||
    !ziel.referent.aktiv ||
    !ziel.passwordHash
  ) {
    return {
      fehler: {
        _: T.zugang.zugangAktionen.hochstufenNurAktiv,
      },
    };
  }

  if (bestaetigung !== ziel.email.trim().toLowerCase()) {
    return {
      fehler: {
        bestaetigung: T.zugang.zugangAktionen.hochstufenBestaetigung,
      },
    };
  }

  const hochgestuft = await prisma.user.updateMany({
    where: {
      id: ziel.id,
      role: "REFERENT",
      isActive: true,
      passwordHash: { not: null },
    },
    data: { role: "ADMIN", sessionVersion: { increment: 1 } },
  });
  if (hochgestuft.count === 0) {
    return {
      fehler: {
        _: T.zugang.zugangAktionen.zugangGeaendert,
      },
    };
  }

  await auditLog({
    userId: admin.id,
    aktion: "UPDATE",
    entitaet: "User",
    entitaetId: ziel.id,
    details: { rollenwechsel: "REFERENT_ZU_ADMIN", referentId: ziel.referent.id },
  });

  revalidatePath("/admin/referenten");
  revalidatePath("/admin");
  return {
    erfolg: true,
    meldung: T.zugang.zugangAktionen.hochstufenErfolg(ziel.email),
  };
}

/**
 * Richtet für eine Referentin oder einen Referenten ein Anmeldekonto ein und
 * gibt einen Einladungslink zurück.
 *
 * Kein Mailversand: Für diese Anwendung ist kein Mailserver eingerichtet. Der
 * Link wird angezeigt, kopiert und auf dem üblichen Dienstweg weitergegeben.
 */
export async function richteZugangEin(
  referentId: string,
  _bisher: EinladungState,
  _formData: FormData,
): Promise<EinladungState> {
  let admin;
  try {
    admin = await requireRole("ADMIN");
  } catch (error) {
    if (error instanceof AuthError) return { fehler: { _: error.message } };
    throw error;
  }

  const konto = await sichergestelltesKontoFuerReferent(referentId);
  if (!konto.ok) {
    if (konto.grund === "PERSON_FEHLT") {
      return { fehler: { _: T.zugang.zugangAktionen.personNichtMehr } };
    }
    if (konto.grund === "OHNE_MAIL") {
      return { fehler: { _: T.zugang.zugangAktionen.emailFuerZugangNoetig } };
    }
    return { fehler: { _: T.zugang.zugangAktionen.emailBelegt(konto.email) } };
  }

  const zweck: Zweck = "EINLADUNG";
  const { token, gueltigBis } = await erzeugeZugangstoken(konto.userId, zweck);

  await auditLog({
    userId: admin.id,
    aktion: "CREATE",
    entitaet: "Zugang",
    entitaetId: konto.userId,
    details: { referentId, zweck },
  });

  revalidatePath("/admin/referenten");

  return {
    erfolg: true,
    link: zugangsLink(token),
    gueltigBis: gueltigBis.toISOString(),
    meldung: T.zugang.zugangAktionen.eingerichtet(konto.email),
  };
}

/** Erzeugt einen neuen Link, wenn der alte abgelaufen oder verloren ist. */
export async function neuerZugangslink(
  userId: string,
  _bisher: EinladungState,
  _formData: FormData,
): Promise<EinladungState> {
  let admin;
  try {
    admin = await requireRole("ADMIN");
  } catch (error) {
    if (error instanceof AuthError) return { fehler: { _: error.message } };
    throw error;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, passwordHash: true },
  });
  if (!user) return { fehler: { _: T.zugang.zugangAktionen.kontoNichtMehr } };

  const zweck: Zweck = user.passwordHash ? "PASSWORT_RESET" : "EINLADUNG";
  const { token, gueltigBis } = await erzeugeZugangstoken(user.id, zweck);

  await auditLog({
    userId: admin.id,
    aktion: "UPDATE",
    entitaet: "Zugang",
    entitaetId: user.id,
    details: { zweck },
  });

  return {
    erfolg: true,
    link: zugangsLink(token),
    gueltigBis: gueltigBis.toISOString(),
    meldung:
      zweck === "EINLADUNG"
        ? T.zugang.zugangAktionen.neuerEinladungslink(user.email)
        : T.zugang.zugangAktionen.neuerResetLink(user.email),
  };
}

export interface EinladungMailState extends FormularState {
  /** Nur zum Kopieren als Rückfallebene — bei ausgeschaltetem Mailversand
   *  oder einem fehlgeschlagenen Sendeversuch. */
  link?: string;
  gueltigBis?: string;
  /** SMTP_HOST ist leer, wie live gerade absichtlich. Kein Versand, nur Link. */
  mailAus?: boolean;
}

/**
 * Sendet die Einladung bzw. den Zugangslink direkt per Mail, mit Betreff und
 * Text aus dem Zugangs-Dialog (dort vorausgefüllt, für diese eine Mail
 * änderbar).
 *
 * Nutzt dieselbe Konto- und Token-Logik wie `richteZugangEin` /
 * `neuerZugangslink` — ein neuer Link entwertet einen älteren offenen Link
 * derselben Person wie gehabt. Der Platzhalter `{Link}` im übergebenen Text
 * wird erst hier durch den frisch erzeugten Link ersetzt, weil der Link vor
 * dem Absenden noch nicht existiert.
 *
 * Ohne `SMTP_HOST` (Testinstanz, aktuell auch live) wird nichts verschickt —
 * der Dialog zeigt das klar an, statt einen Erfolg vorzutäuschen.
 */
export async function sendeEinladungPerMail(
  referentId: string,
  _bisher: EinladungMailState,
  formData: FormData,
): Promise<EinladungMailState> {
  let admin;
  try {
    admin = await requireRole("ADMIN");
  } catch (error) {
    if (error instanceof AuthError) return { fehler: { _: error.message } };
    throw error;
  }

  const betreff = (formData.get("betreff") ?? "").toString().trim();
  const textRoh = (formData.get("text") ?? "").toString();
  if (!betreff || !textRoh.trim()) {
    return { fehler: { _: T.zugang.zugangAktionen.einladungMailUnvollstaendig } };
  }

  // Ohne {Link} bekäme die Person eine Mail ohne ihren persönlichen Zugang.
  // Serverseitig geprüft, weil ein manipuliertes Formular die Browser-Prüfung
  // umgehen könnte.
  if (!textRoh.includes("{Link}")) {
    return { fehler: { text: T.zugang.zugangAktionen.einladungMailLinkFehlt } };
  }

  const konto = await sichergestelltesKontoFuerReferent(referentId);
  if (!konto.ok) {
    if (konto.grund === "PERSON_FEHLT") {
      return { fehler: { _: T.zugang.zugangAktionen.personNichtMehr } };
    }
    if (konto.grund === "OHNE_MAIL") {
      return { fehler: { _: T.zugang.zugangAktionen.emailFuerZugangNoetig } };
    }
    return { fehler: { _: T.zugang.zugangAktionen.emailBelegt(konto.email) } };
  }

  const bestehenderNutzer = await prisma.user.findUnique({
    where: { id: konto.userId },
    select: { passwordHash: true },
  });
  const zweck: Zweck = bestehenderNutzer?.passwordHash ? "PASSWORT_RESET" : "EINLADUNG";
  const { token, gueltigBis } = await erzeugeZugangstoken(konto.userId, zweck);
  const link = zugangsLink(token);
  const text = textRoh.replaceAll("{Link}", link);

  await auditLog({
    userId: admin.id,
    aktion: "CREATE",
    entitaet: "Zugang",
    entitaetId: konto.userId,
    details: { referentId, zweck, mailversand: true },
  });

  revalidatePath("/admin/referenten");

  const mailEingerichtet = Boolean(process.env.SMTP_HOST);
  const versendet = await sendeMail({ an: konto.email, betreff, text });

  if (!mailEingerichtet) {
    return {
      erfolg: true,
      link,
      gueltigBis: gueltigBis.toISOString(),
      mailAus: true,
      meldung: T.zugang.zugangAktionen.mailversandAus,
    };
  }

  if (!versendet) {
    return {
      fehler: { _: T.zugang.zugangAktionen.einladungMailFehlgeschlagen },
      link,
      gueltigBis: gueltigBis.toISOString(),
    };
  }

  return {
    erfolg: true,
    meldung: T.zugang.zugangAktionen.einladungMailGesendet(konto.email),
  };
}

/** Nimmt einer Person den Zugang, ohne den Referenteneintrag zu löschen. */
export async function zugangEntziehen(userId: string): Promise<void> {
  const admin = await requireRole("ADMIN");

  await prisma.$transaction([
    prisma.zugangstoken.deleteMany({ where: { userId } }),
    prisma.user.update({ where: { id: userId }, data: { isActive: false } }),
  ]);

  await auditLog({
    userId: admin.id,
    aktion: "DELETE",
    entitaet: "Zugang",
    entitaetId: userId,
  });

  revalidatePath("/admin/referenten");
}

// ---------------------------------------------------------------------------
// Passwort setzen (durch die eingeladene Person)
// ---------------------------------------------------------------------------

export async function setzePasswort(
  _bisher: FormularState,
  formData: FormData,
): Promise<FormularState> {
  const token = (formData.get("token") ?? "").toString();
  const passwort = (formData.get("passwort") ?? "").toString();
  const wiederholung = (formData.get("wiederholung") ?? "").toString();

  const geprueft = PasswortSchema.safeParse(passwort);
  if (!geprueft.success) {
    return { fehler: { passwort: geprueft.error.issues[0]!.message } };
  }

  if (passwort !== wiederholung) {
    return { fehler: { wiederholung: T.zugang.zugangAktionen.eingabenUngleich } };
  }

  // Vorprüfung vermeidet die teure Passwort-Hashing-Arbeit für beliebige,
  // ungültige Links. Verbindlich ist trotzdem erst das atomare Verbrauchen
  // darunter; zwischen beiden Schritten kann ein paralleler Request den
  // Token bereits genutzt haben.
  if (!(await pruefeZugangstoken(token))) {
    return {
      fehler: {
        _: T.zugang.zugangAktionen.linkAbgelaufen,
      },
    };
  }

  const passwordHash = await bcrypt.hash(passwort, 12);
  const eintrag = await verbraucheTokenUndSetzePasswort(token, passwordHash);
  if (!eintrag) {
    return {
      fehler: {
        _: T.zugang.zugangAktionen.linkAbgelaufen,
      },
    };
  }

  await auditLog({
    userId: eintrag.userId,
    aktion: "UPDATE",
    entitaet: "User",
    entitaetId: eintrag.userId,
    details: { passwortGesetzt: true, zweck: eintrag.zweck },
  });

  // Direkt anmelden — die Person hat sich gerade ausgewiesen.
  await setSessionCookie(
    await signToken(eintrag.userId, eintrag.sessionVersion),
  );

  // Einladung: Wer neu dazukommt, landet im eigenen Profil (Visitenkarte).
  // Beim Passwort-Reset bleibt es bei „Meine Fortbildungen“.
  redirect(eintrag.zweck === "EINLADUNG" ? "/admin/konto?willkommen=1#profil" : "/admin");
}

// ---------------------------------------------------------------------------
// Eigenes Passwort ändern
// ---------------------------------------------------------------------------

export async function aenderePasswort(
  _bisher: FormularState,
  formData: FormData,
): Promise<FormularState> {
  const user = await requireUser();

  const bisheriges = (formData.get("bisheriges") ?? "").toString();
  const neues = (formData.get("neues") ?? "").toString();
  const wiederholung = (formData.get("wiederholung") ?? "").toString();

  const konto = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  if (!konto?.passwordHash || !(await bcrypt.compare(bisheriges, konto.passwordHash))) {
    return { fehler: { bisheriges: T.zugang.zugangAktionen.bisherigesFalsch } };
  }

  const geprueft = PasswortSchema.safeParse(neues);
  if (!geprueft.success) {
    return { fehler: { neues: geprueft.error.issues[0]!.message } };
  }

  if (neues === bisheriges) {
    return { fehler: { neues: T.zugang.zugangAktionen.neuesWieBisheriges } };
  }

  if (neues !== wiederholung) {
    return { fehler: { wiederholung: T.zugang.zugangAktionen.eingabenUngleich } };
  }

  const aktualisiert = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(neues, 12),
      sessionVersion: { increment: 1 },
    },
    select: { sessionVersion: true },
  });

  // Die aktuelle Sitzung erhält die neue Version; alle anderen Sitzungen
  // desselben Kontos werden beim nächsten Zugriff abgewiesen.
  await setSessionCookie(await signToken(user.id, aktualisiert.sessionVersion));

  await auditLog({
    userId: user.id,
    aktion: "UPDATE",
    entitaet: "User",
    entitaetId: user.id,
    details: { passwortGeaendert: true },
  });

  return { erfolg: true, meldung: T.zugang.zugangAktionen.passwortGeaendert };
}
