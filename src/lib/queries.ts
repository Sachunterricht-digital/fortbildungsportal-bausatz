import type { Prisma } from "@prisma/client";
import { STATUS_OEFFENTLICH } from "@/constants/fortbildung";
import { berlinIsoDatum } from "@/lib/datetime";

/**
 * Filter für alles, was Lehrkräfte zu sehen bekommen.
 *
 * An genau einer Stelle definiert und in Liste, Kalender, Detailseite und
 * ICS-Feed wiederverwendet. Würde jede Ansicht ihre eigene Bedingung
 * mitbringen, wäre ein vergessener Status-Filter irgendwann unvermeidlich —
 * und damit ein Entwurf öffentlich.
 */
export function oeffentlicheFortbildungWhere(): Prisma.FortbildungWhereInput {
  return { status: { in: STATUS_OEFFENTLICH } };
}

/**
 * Filter für Personen, die öffentlich erscheinen: jede aktive Person, solange
 * der Haken „Öffentlich sichtbar“ in der Referentenverwaltung gesetzt ist.
 *
 * Neue Personen kommen mit gesetztem Haken an (Prisma-Default, Admin-Formular,
 * Registrierung). Der Haken bleibt als Notbremse der Administration.
 * Teambereich, Steckbrief, Porträt und die Referentenzeilen der Angebote
 * nutzen alle genau diesen Filter.
 */
export function oeffentlicheReferentWhere(): Prisma.ReferentWhereInput {
  return { aktiv: true, oeffentlichSichtbar: true };
}

/**
 * Auswahl für Karten und Steckbrief im Teambereich. Nur Name, Stammschule,
 * Funktion, Profiltexte und Foto-Zeitstempel. Kontaktdaten und interne
 * Notizen werden hier nie geladen.
 */
export const oeffentlicherReferentSelect = {
  id: true,
  vorname: true,
  nachname: true,
  organisation: true,
  funktion: true,
  kurzprofil: true,
  schwerpunkte: true,
  portraetAm: true,
} satisfies Prisma.ReferentSelect;

export type OeffentlicherReferent = Prisma.ReferentGetPayload<{
  select: typeof oeffentlicherReferentSelect;
}>;

/**
 * Auswahl für öffentliche Ansichten.
 *
 * DSGVO: Von Referentinnen und Referenten werden hier nur Name und
 * Organisation geladen, und nur wenn sie der Veröffentlichung zugestimmt
 * haben. E-Mail, Telefon und interne Notizen verlassen den Redaktionsbereich
 * damit gar nicht erst — auch nicht versehentlich über die Serialisierung
 * einer Server Component.
 */
export const oeffentlicheFortbildungSelect = {
  id: true,
  slug: true,
  titel: true,
  kurztitel: true,
  beschreibungHtml: true,
  organisationsform: true,
  maxTn: true,
  format: true,
  beginn: true,
  ende: true,
  ortText: true,
  schularten: true,
  fach: true,
  niveaustufe: true,
  fibsLehrgangsnummer: true,
  fibsUrl: true,
  inFibs: true,
  status: true,
  veranstaltungsort: {
    select: { id: true, name: true, ort: true, istOnline: true },
  },
  schlagworte: {
    select: { schlagwort: { select: { id: true, name: true } } },
  },
  kompetenzen: {
    select: {
      kompetenz: {
        select: { code: true, titel: true, parentCode: true },
      },
    },
  },
  referenten: {
    where: { referent: oeffentlicheReferentWhere() },
    select: {
      rolle: true,
      referent: {
        select: { id: true, vorname: true, nachname: true, organisation: true },
      },
    },
  },
} satisfies Prisma.FortbildungSelect;

export type OeffentlicheFortbildung = Prisma.FortbildungGetPayload<{
  select: typeof oeffentlicheFortbildungSelect;
}>;

/** Kompakte Auswahl für Listen- und Kalenderkacheln. */
export const fortbildungKachelSelect = {
  id: true,
  slug: true,
  titel: true,
  kurztitel: true,
  organisationsform: true,
  format: true,
  beginn: true,
  ende: true,
  ortText: true,
  schularten: true,
  status: true,
  // Die Liste kommuniziert nicht nur, dass ein Angebot existiert, sondern auch,
  // ob die verbindliche Anmeldung bereits offen ist.
  inFibs: true,
  fibsUrl: true,
  veranstaltungsort: { select: { name: true, ort: true, istOnline: true } },
  schlagworte: { select: { schlagwort: { select: { id: true, name: true } } } },
} satisfies Prisma.FortbildungSelect;

export type FortbildungKachel = Prisma.FortbildungGetPayload<{
  select: typeof fortbildungKachelSelect;
}>;

/**
 * Auswahl für die Angebote auf der Startseite (Reiter „SchiLf“): die Kachel
 * plus Referentinnen und Referenten (nur mit Zustimmung zur Veröffentlichung)
 * und die DigCompEdu-Bereiche.
 */
export const startAngebotSelect = {
  ...fortbildungKachelSelect,
  kompetenzen: {
    select: {
      kompetenz: {
        select: { code: true, titel: true, parentCode: true, parent: { select: { titel: true } } },
      },
    },
  },
  referenten: {
    where: { referent: oeffentlicheReferentWhere() },
    select: { referent: { select: { id: true, vorname: true, nachname: true, organisation: true } } },
  },
} satisfies Prisma.FortbildungSelect;

export type StartAngebot = Prisma.FortbildungGetPayload<{
  select: typeof startAngebotSelect;
}>;

/**
 * Slug aus Titel und Beginn (ohne Termin "auf-abruf"). Enthält eine Kurz-ID, damit zwei gleichnamige
 * Termine am selben Tag kollisionsfrei bleiben.
 */
export function bildeSlug(titel: string, beginn: Date | null, id: string): string {
  const basis = titel
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  const datum = beginn ? berlinIsoDatum(beginn) : "auf-abruf";
  return `${basis || "fortbildung"}-${datum}-${id.slice(0, 6)}`;
}

/** Vollständiger Link auf die Bearbeitungsseite eines Themas, für Mails. */
export function bearbeitenLink(fortbildungId: string): string {
  const basis = process.env.APP_BASE_URL ?? "http://localhost:3000";
  return `${basis.replace(/\/+$/, "")}/admin/fortbildungen/${fortbildungId}`;
}

/** Vollständiger Link auf die öffentliche Detailseite eines Themas, für Mails. */
export function oeffentlicherLink(slug: string): string {
  const basis = process.env.APP_BASE_URL ?? "http://localhost:3000";
  return `${basis.replace(/\/+$/, "")}/fortbildungen/${slug}`;
}
