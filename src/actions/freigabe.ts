"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { AuthError, requireRole } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import { sendeMail, vornameAus } from "@/lib/mail";
import { pruefeVeroeffentlichung } from "@/lib/validation/fortbildung";
import type { FormularState } from "@/lib/validation/fortbildung";
import { bearbeitenLink, oeffentlicherLink } from "@/lib/queries";
import { T } from "@/texte/de";

/**
 * Freigabe von Fortbildungen.
 *
 * Referentinnen und Referenten reichen ein (Status EINGEREICHT), die
 * Administration gibt frei oder weist mit Begründung zurück. Alle Aktionen
 * hier sind ausschließlich ADMINs vorbehalten — die Prüfung steht in jeder
 * Funktion, weil Server Actions eigene Endpunkte sind.
 */

/**
 * Vergleicht den vom Formular mitgeschickten `updatedAt`-Stand (den die
 * Admin-Person zuletzt gesehen hat) mit dem aktuellen Datenbankwert.
 *
 * Fehlt das Feld (altes oder manipuliertes Formular) gilt der Stand als
 * abweichend — die Sperre lässt sich so nicht lautlos umgehen.
 */
function gesehenerStandStimmt(formData: FormData, aktuellerStand: Date): boolean {
  const gesehenRoh = formData.get("updatedAt");
  if (typeof gesehenRoh !== "string" || !gesehenRoh) return false;
  const gesehen = new Date(gesehenRoh);
  if (Number.isNaN(gesehen.getTime())) return false;
  return gesehen.getTime() === aktuellerStand.getTime();
}

function alleFrischMachen() {
  revalidatePath("/admin");
  revalidatePath("/admin/freigaben");
  revalidatePath("/fortbildungen");
  revalidatePath("/kalender");
}

export async function freigeben(
  id: string,
  _bisher: FormularState,
  formData: FormData,
): Promise<FormularState> {
  const user = await requireRole("ADMIN");

  const fortbildung = await prisma.fortbildung.findUnique({
    where: { id },
    select: {
      titel: true,
      status: true,
      updatedAt: true,
      niveaustufe: true,
      kompetenzen: { select: { kompetenzCode: true } },
      referenten: { select: { referentId: true } },
    },
  });
  // Die Aktion ist ein echter Statusübergang, keine allgemeine
  // Veröffentlichungs-API: nur eingereichte Fortbildungen dürfen diesen Weg
  // durchlaufen. Das schützt auch gegen direkt aufgerufene Server Actions.
  if (!fortbildung || fortbildung.status !== "EINGEREICHT") {
    return { fehler: { _: T.maske.actionsFreigabe.wartetNichtMehr } };
  }

  // Der Admin gibt frei, was er zuletzt gesehen hat — nicht zwingend den
  // aktuellsten Stand. Weicht der mitgeschickte Zeitpunkt ab (Freigabeleiste
  // oder Freigabeseite mit veraltetem Formular), wird nichts freigegeben.
  if (!gesehenerStandStimmt(formData, fortbildung.updatedAt)) {
    return { fehler: { _: T.maske.actionsFreigabe.zwischenzeitlichGeaendert } };
  }

  // Dieselben Vollständigkeitsregeln wie beim direkten Veröffentlichen —
  // sonst käme über die Freigabe eine lückenhafte Ausschreibung ins Frontend.
  const luecken = pruefeVeroeffentlichung({
    status: "VEROEFFENTLICHT",
    niveaustufe: fortbildung.niveaustufe,
    kompetenzen: fortbildung.kompetenzen.map((k) => k.kompetenzCode),
    referenten: fortbildung.referenten.map((r) => r.referentId),
  });

  if (luecken) {
    // Was fehlt, sind Redaktionsfelder (Niveaustufe, DigCompEdu). Die trägt
    // die Administration nach, deshalb geht nichts an die einreichende
    // Person zurück. Stattdessen öffnet sich die Bearbeitung mit Hinweis.
    redirect(`/admin/fortbildungen/${id}?fehlt=redaktion`);
  }

  const veroeffentlicht = await prisma.fortbildung.updateMany({
    where: { id, status: "EINGEREICHT" },
    data: {
      status: "VEROEFFENTLICHT",
      freigegebenAm: new Date(),
      freigegebenVonId: user.id,
      freigabeNotiz: null,
    },
  });

  if (veroeffentlicht.count === 0) {
    return { fehler: { _: T.maske.actionsFreigabe.wartetNichtMehr } };
  }

  await auditLog({
    userId: user.id,
    aktion: "UPDATE",
    entitaet: "Fortbildung",
    entitaetId: id,
    details: { freigegeben: true, titel: fortbildung.titel },
  });

  // Erst veröffentlicht, dann versendet — ein Mailfehler darf die Freigabe
  // nie rückgängig machen.
  await sendeFreigabeMail(id, user.id);

  alleFrischMachen();
  return { erfolg: true };
}

const ZurueckweisenSchema = z
  .string()
  .trim()
  .min(5, T.maske.actionsFreigabe.notizZuKurz)
  .max(1000, T.maske.actionsFreigabe.notizZuLang);

export async function zurueckweisen(
  id: string,
  _bisher: FormularState,
  formData: FormData,
): Promise<FormularState> {
  let user;
  try {
    user = await requireRole("ADMIN");
  } catch (error) {
    if (error instanceof AuthError) return { fehler: { _: error.message } };
    throw error;
  }

  const notiz = ZurueckweisenSchema.safeParse(formData.get("notiz") ?? "");
  if (!notiz.success) {
    return { fehler: { notiz: notiz.error.issues[0]!.message } };
  }

  const bisheriger = await prisma.fortbildung.findUnique({
    where: { id },
    select: { status: true, updatedAt: true },
  });
  if (!bisheriger || bisheriger.status !== "EINGEREICHT") {
    return { fehler: { _: T.maske.actionsFreigabe.wartetNichtMehr } };
  }
  if (!gesehenerStandStimmt(formData, bisheriger.updatedAt)) {
    return { fehler: { _: T.maske.actionsFreigabe.zwischenzeitlichGeaendert } };
  }

  const zurueckgewiesen = await prisma.fortbildung.updateMany({
    where: { id, status: "EINGEREICHT" },
    data: {
      status: "ENTWURF",
      freigabeNotiz: notiz.data,
      // eingereichtAm bleibt: Die Person hat eingereicht und gehört nicht in
      // die Liste „noch nichts eingereicht“.
    },
  });

  if (zurueckgewiesen.count === 0) {
    return { fehler: { _: T.maske.actionsFreigabe.wartetNichtMehr } };
  }

  await auditLog({
    userId: user.id,
    aktion: "UPDATE",
    entitaet: "Fortbildung",
    entitaetId: id,
    details: { zurueckgewiesen: true },
  });

  // Erst gespeichert, dann versendet — ein Mailfehler darf die Zurückweisung
  // nie rückgängig machen.
  await sendeZurueckweisungMail(id, notiz.data, user.id);

  alleFrischMachen();
  return { erfolg: true, meldung: T.maske.actionsFreigabe.zurueckAnEinreichende };
}

interface EmpfaengerBasis {
  titel: string;
  slug: string;
  empfaenger: Array<{ vorname: string; email: string }>;
}

/**
 * Einreichende Person und alle zugeordneten Referentinnen und Referenten mit
 * hinterlegter Mailadresse — dieselbe Empfängerliste für Rückweisung und
 * Freigabe, damit beide Mails an genau dieselben Personen gehen. Ohne
 * Mailadresse (Referent.email ist nur intern gepflegt) bleibt die Person
 * unbenachrichtigt, es gibt keinen Fehlerfall.
 */
async function ladeEmpfaengerBasis(
  fortbildungId: string,
): Promise<EmpfaengerBasis | null> {
  const fortbildung = await prisma.fortbildung.findUnique({
    where: { id: fortbildungId },
    select: {
      titel: true,
      slug: true,
      ersteller: { select: { name: true, email: true } },
      referenten: {
        select: { referent: { select: { vorname: true, email: true } } },
      },
    },
  });
  if (!fortbildung) return null;

  const empfaenger: Array<{ vorname: string; email: string }> = [];
  const gesehen = new Set<string>();
  const hinzufuegen = (vorname: string, email: string | null) => {
    const schluessel = email?.trim().toLowerCase();
    if (!schluessel || gesehen.has(schluessel)) return;
    gesehen.add(schluessel);
    empfaenger.push({ vorname, email: email!.trim() });
  };

  if (fortbildung.ersteller) {
    hinzufuegen(
      vornameAus(fortbildung.ersteller.name, fortbildung.ersteller.email),
      fortbildung.ersteller.email,
    );
  }
  for (const { referent } of fortbildung.referenten) {
    hinzufuegen(referent.vorname, referent.email);
  }

  return { titel: fortbildung.titel, slug: fortbildung.slug, empfaenger };
}

async function sendeZurueckweisungMail(
  fortbildungId: string,
  begruendung: string,
  adminUserId: string,
): Promise<void> {
  const basis = await ladeEmpfaengerBasis(fortbildungId);
  if (!basis) return;

  const link = bearbeitenLink(fortbildungId);
  const betreff = T.mails.rueckweisung.betreff(basis.titel);

  for (const person of basis.empfaenger) {
    const versendet = await sendeMail({
      an: person.email,
      betreff,
      text: T.mails.rueckweisung.text({
        vorname: person.vorname,
        titel: basis.titel,
        begruendung,
        link,
      }),
    });

    if (!versendet) {
      await auditLog({
        userId: adminUserId,
        aktion: "MAIL_FEHLER",
        entitaet: "Fortbildung",
        entitaetId: fortbildungId,
        details: { anlass: "zurueckweisung", an: person.email },
      });
    }
  }
}

/**
 * Mail an dieselben Empfänger wie die Rückweisung, sobald ein Thema
 * freigegeben ist — der Link führt auf die öffentliche Detailseite, nicht
 * auf die Bearbeitung.
 *
 * Exportiert, weil `saveFortbildung()` (src/actions/fortbildung.ts) denselben
 * Versand auslöst, wenn die Administration den Status direkt im normalen
 * Bearbeitungsformular auf „Veröffentlicht“ setzt — eine Wahrheit für beide Wege.
 */
export async function sendeFreigabeMail(
  fortbildungId: string,
  adminUserId: string,
): Promise<void> {
  const basis = await ladeEmpfaengerBasis(fortbildungId);
  if (!basis) return;

  const link = oeffentlicherLink(basis.slug);
  const betreff = T.mails.freigabe.betreff(basis.titel);

  for (const person of basis.empfaenger) {
    const versendet = await sendeMail({
      an: person.email,
      betreff,
      text: T.mails.freigabe.text({
        vorname: person.vorname,
        titel: basis.titel,
        link,
      }),
    });

    if (!versendet) {
      await auditLog({
        userId: adminUserId,
        aktion: "MAIL_FEHLER",
        entitaet: "Fortbildung",
        entitaetId: fortbildungId,
        details: { anlass: "freigabe", an: person.email },
      });
    }
  }
}

/**
 * Markiert, ob die Fortbildung tatsächlich in FIBS ausgeschrieben ist.
 *
 * Bewusst ein eigener Schritt und nicht aus der Lehrgangsnummer abgeleitet:
 * Eine Nummer kann vorgemerkt sein, lange bevor der Eintrag in FIBS steht.
 */
export async function fibsStatusSetzen(id: string, inFibs: boolean): Promise<void> {
  const user = await requireRole("ADMIN");

  const aktualisiert = await prisma.fortbildung.updateMany({
    where: {
      id,
      status: "VEROEFFENTLICHT",
      // Teilnahmebestätigungen dokumentieren einen bereits erfolgten
      // FIBS-Vorgang. Solange einer dieser Vermerke besteht, darf auch über
      // die allgemeine Detailansicht kein widersprüchlicher Status entstehen.
      ...(inFibs
        ? {}
        : {
            teilnahmebestaetigungenReferentenVersandtAm: null,
            teilnahmebestaetigungenTeilnehmendeVersandtAm: null,
          }),
    },
    data: {
      inFibs,
      fibsEingetragenAm: inFibs ? new Date() : null,
      fibsEingetragenVonId: inFibs ? user.id : null,
    },
  });

  if (aktualisiert.count === 0) return;

  await auditLog({
    userId: user.id,
    aktion: "UPDATE",
    entitaet: "Fortbildung",
    entitaetId: id,
    details: { inFibs },
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/fortbildungen/${id}`);
}
