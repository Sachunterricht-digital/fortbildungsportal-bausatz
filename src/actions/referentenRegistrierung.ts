"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { AuthError, requireRole, setSessionCookie, signToken } from "@/lib/auth";
import { createRateLimiter, getClientIp } from "@/lib/rateLimit";
import { REGISTRIERUNG_STANDARD_NUTZUNGEN } from "@/constants/registrierung";
import { FUNKTION_VALUES } from "@/constants/fortbildung";
import {
  erzeugeReferentenRegistrierungslink,
  hashRegistrierungsToken,
  pruefeReferentenRegistrierungslink,
  referentenRegistrierungsLink,
} from "@/lib/referentenRegistrierung";
import type { FormularState } from "@/lib/validation/fortbildung";
import { AUSGEGRAUT } from "@/constants/funktionen";
import { T } from "@/texte/de";

const RegistrierungsSchema = z.object({
  vorname: z.string().trim().min(2, T.zugang.registrierungAktionen.vornameFehlt).max(80),
  nachname: z.string().trim().min(2, T.zugang.registrierungAktionen.nachnameFehlt).max(80),
  organisation: z.string().trim().min(2, T.profil.stammschuleFehlt).max(120),
  funktion: z.enum(FUNKTION_VALUES, { message: T.profil.funktionFehlt }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine(
      (wert) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(wert),
      T.zugang.registrierungAktionen.emailUngueltig,
    ),
  passwort: z
    .string()
    .min(12, T.zugang.registrierungAktionen.passwortZuKurz)
    .max(200, T.zugang.registrierungAktionen.passwortZuLang),
  wiederholung: z.string(),
  token: z.string().min(40).max(200),
});

/** Getrennte Limits für den öffentlichen, wiederverwendbaren Link. */
const proIp = createRateLimiter(10, 15 * 60);
const proLink = createRateLimiter(30, 15 * 60);

export interface ReferentenRegistrierungslinkState extends FormularState {
  link?: string;
  gueltigBis?: string;
}

const LinkSchema = z.object({
  maxNutzungen: z.coerce
    .number()
    .int()
    .min(1, T.zugang.registrierungAktionen.mindEineRegistrierung)
    .max(100, T.zugang.registrierungAktionen.hoechstensHundert),
});

/**
 * Erzeugt den einen aktuell gültigen allgemeinen Registrierungslink.
 * Die Berechtigung wird in der Action selbst geprüft, nicht nur in der UI.
 */
export async function generiereReferentenRegistrierungslink(
  _bisher: ReferentenRegistrierungslinkState,
  formData: FormData,
): Promise<ReferentenRegistrierungslinkState> {
  if (AUSGEGRAUT.registrierungslink) return { fehler: { _: T.aussen.registrierung.ungueltigTitel } };

  let user;
  try {
    user = await requireRole("ADMIN", "REDAKTEUR");
  } catch (error) {
    if (error instanceof AuthError) return { fehler: { _: error.message } };
    throw error;
  }

  const eingabe = LinkSchema.safeParse({
    maxNutzungen:
      formData.get("maxNutzungen") ?? REGISTRIERUNG_STANDARD_NUTZUNGEN,
  });
  if (!eingabe.success) {
    return {
      fehler: { maxNutzungen: eingabe.error.issues[0]?.message ?? T.zugang.registrierungAktionen.eingabeUngueltig },
    };
  }

  const { maxNutzungen } = eingabe.data;
  const { token, gueltigBis } = await erzeugeReferentenRegistrierungslink(
    user.id,
    maxNutzungen,
  );

  await auditLog({
    userId: user.id,
    aktion: "CREATE",
    entitaet: "ReferentenRegistrierungslink",
    details: { gueltigBis: gueltigBis.toISOString(), maxNutzungen },
  });
  revalidatePath("/admin/referenten");

  return {
    erfolg: true,
    meldung: T.zugang.registrierungAktionen.linkErzeugt,
    link: referentenRegistrierungsLink(token),
    gueltigBis: gueltigBis.toISOString(),
  };
}

/**
 * Öffentliche Registrierung. Hier ist der gültige, nicht erratbare Link die
 * Berechtigung; daher gibt es bewusst kein requireRole().
 */
export async function registriereReferent(
  _bisher: FormularState,
  formData: FormData,
): Promise<FormularState> {
  if (AUSGEGRAUT.registrierungslink) return { fehler: { _: T.aussen.registrierung.ungueltigTitel } };

  const geparst = RegistrierungsSchema.safeParse({
    vorname: formData.get("vorname")?.toString() ?? "",
    nachname: formData.get("nachname")?.toString() ?? "",
    organisation: formData.get("organisation")?.toString() ?? "",
    funktion: formData.get("funktion")?.toString() ?? "",
    email: formData.get("email")?.toString() ?? "",
    passwort: formData.get("passwort")?.toString() ?? "",
    wiederholung: formData.get("wiederholung")?.toString() ?? "",
    token: formData.get("token")?.toString() ?? "",
  });
  if (!geparst.success) {
    const issue = geparst.error.issues[0];
    return { fehler: { [issue?.path[0]?.toString() ?? "_"]: issue?.message ?? T.zugang.registrierungAktionen.eingabeUngueltig } };
  }

  const { vorname, nachname, organisation, funktion, email, passwort, wiederholung, token } =
    geparst.data;
  if (passwort !== wiederholung) {
    return { fehler: { wiederholung: T.zugang.registrierungAktionen.eingabenUngleich } };
  }

  const ip = getClientIp(await headers());
  const ipLimit = proIp.pruefen(ip);
  const linkLimit = proLink.pruefen(hashRegistrierungsToken(token));
  if (!ipLimit.erlaubt || !linkLimit.erlaubt) {
    const warten = Math.max(ipLimit.wartesekunden, linkLimit.wartesekunden);
    return {
      fehler: {
        _: T.zugang.registrierungAktionen.zuVieleVersuche(Math.ceil(warten / 60)),
      },
    };
  }

  // Vor dem rechenintensiven bcrypt-Hashing prüfen. Im Commit unten wird die
  // Gültigkeit erneut bedingt aktualisiert, damit ein gerade entzogener Link
  // auch bei parallelen Requests keine Registrierung mehr erlaubt.
  if (!(await pruefeReferentenRegistrierungslink(token))) {
    return { fehler: { _: T.zugang.registrierungAktionen.linkNichtGueltig } };
  }

  const passwordHash = await bcrypt.hash(passwort, 12);
  const jetzt = new Date();

  try {
    const ergebnis = await prisma.$transaction(async (tx) => {
      const link = await tx.referentenRegistrierungslink.findUnique({
        where: { tokenHash: hashRegistrierungsToken(token) },
        select: { id: true, maxNutzungen: true },
      });
      if (!link) return { art: "ungueltig" as const };

      // Kein Konto und keinen zweiten Verzeichniseintrag mit derselben Adresse
      // anlegen. Die Prüfung bleibt im Commit, damit die Antwort robust gegen
      // parallele Formulareingaben ist.
      const [konto, vorhandeneReferenten] = await Promise.all([
        tx.user.findUnique({ where: { email }, select: { id: true } }),
        // E-Mail-Adressen in älteren Verzeichniseinträgen sind nicht durch
        // einen Datenbank-Unique-Index geschützt. Daher normalisieren wir für
        // den Vergleich auch historisch gespeicherte Schreibweisen.
        tx.referent.findMany({
          where: { email: { not: null } },
          select: { email: true },
        }),
      ]);
      const vorhandenerReferent = vorhandeneReferenten.some(
        (referent) => referent.email?.trim().toLowerCase() === email,
      );
      if (konto || vorhandenerReferent) return { art: "emailBelegt" as const };

      const verwendet = await tx.referentenRegistrierungslink.updateMany({
        where: {
          id: link.id,
          aktiv: true,
          expiresAt: { gt: jetzt },
          nutzungen: { lt: link.maxNutzungen },
        },
        data: { nutzungen: { increment: 1 }, letzteNutzungAm: jetzt },
      });
      if (verwendet.count !== 1) return { art: "ungueltig" as const };

      const user = await tx.user.create({
        data: {
          email,
          name: `${vorname} ${nachname}`,
          passwordHash,
          role: "REFERENT",
          referent: {
            create: {
              vorname,
              nachname,
              organisation,
              funktion,
              email,
              // Jede aktive Person erscheint im Teambereich (festgelegt am
              // 05.10.2026). Die Redaktion kann den Haken als Notbremse
              // in der Referentenverwaltung herausnehmen.
              oeffentlichSichtbar: true,
            },
          },
        },
        select: { id: true, sessionVersion: true },
      });
      return { art: "erfolg" as const, user };
    });

    if (ergebnis.art === "ungueltig") {
      return { fehler: { _: T.zugang.registrierungAktionen.linkNichtGueltig } };
    }
    if (ergebnis.art === "emailBelegt") {
      return {
        fehler: {
          email: T.zugang.registrierungAktionen.emailBesteht,
        },
      };
    }

    // Erfolgreiche Registrierungen zählen weiter gegen das Limit. Sonst könnte
    // jemand mit einem weitergegebenen Link beliebig viele Konten nacheinander
    // anlegen und den Zähler nach jedem Erfolg wieder auf null setzen.
    await auditLog({
      userId: ergebnis.user.id,
      aktion: "CREATE",
      entitaet: "Referent",
      entitaetId: ergebnis.user.id,
      details: { selbstregistrierung: true },
    });
    revalidatePath("/admin/referenten");
    await setSessionCookie(await signToken(ergebnis.user.id, ergebnis.user.sessionVersion));
  } catch (error) {
    // Der Unique-Index der User-Tabelle ist die verbindliche letzte Absicherung
    // gegen eine parallele Registrierung mit derselben E-Mail-Adresse.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return {
        fehler: {
          email: T.zugang.registrierungAktionen.emailBesteht,
        },
      };
    }
    throw error;
  }

  redirect("/admin?willkommen=1");
}
