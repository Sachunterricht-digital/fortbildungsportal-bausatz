import { z } from "zod";

import { parseDatumZeitEingabe } from "@/lib/datetime";
import { istLeer } from "@/lib/sanitize";
import {
  FORMAT_VALUES,
  NIVEAUSTUFE_VALUES,
  ORGANISATIONSFORM_VALUES,
  SCHULART_VALUES,
  STATUS_VALUES,
  terminOptional,
} from "@/constants/fortbildung";
import { AUSGEGRAUT } from "@/constants/funktionen";
import { normalisiereSchlagwort, normalisiereSchlagwortListe } from "@/lib/schlagwort";
import { T } from "@/texte/de";

/**
 * Ein Schema für Formular und Server Action.
 *
 * Die Server Action ist ein eigener HTTP-Endpunkt — sie muss jede Regel selbst
 * prüfen, unabhängig davon, was das Formular im Browser bereits verhindert.
 * Deshalb liegt die Wahrheit hier und nicht in der Komponente.
 */

const datumFeld = (feldname: string) =>
  z
    .string()
    .min(1, T.maske.validation.feldPflicht(feldname))
    .transform((wert, ctx) => {
      const datum = parseDatumZeitEingabe(wert);
      if (!datum) {
        ctx.addIssue({
          code: "custom",
          message: T.maske.validation.datumUnvollstaendig(feldname),
        });
        return z.NEVER;
      }
      return datum;
    });

/** Leere Formularwerte ("" oder fehlend) werden zu null. */
const leerZuNull = (wert: unknown) =>
  wert === "" || wert === undefined || wert === null ? null : wert;

/**
 * Termin, Ort und Teilnehmerzahl sind hier zunächst freiwillig. Ob sie Pflicht
 * sind, hängt von Organisationsform und Format ab (terminOptional()), das
 * prüft superRefine() unten.
 */
export const FortbildungSchema = z
  .object({
    titel: z
      .string()
      .trim()
      .min(3, T.maske.validation.titelZuKurz)
      .max(200, T.maske.validation.titelZuLang),

    kurztitel: z
      .string()
      .trim()
      .max(100, T.maske.validation.kurztitelZuLang)
      .optional()
      .transform((wert) => wert || null),

    beschreibungHtml: z
      .string()
      .max(50_000, T.maske.validation.beschreibungZuLang),

    organisationsform: z.enum(ORGANISATIONSFORM_VALUES, {
      message: T.maske.validation.organisationsformPflicht,
    }),

    maxTn: z.preprocess(
      leerZuNull,
      z.coerce
        .number({ message: T.maske.validation.maxTnKeineZahl })
        .int(T.maske.validation.maxTnGanzzahl)
        .min(1, T.maske.validation.maxTnMindestens)
        .max(1000, T.maske.validation.maxTnZuGross)
        .nullable(),
    ),

    format: z.enum(FORMAT_VALUES, {
      message: T.maske.validation.formatPflicht,
    }),

    beginn: z.preprocess(leerZuNull, datumFeld(T.maske.abschnitte.beginnLabel).nullable()),
    ende: z.preprocess(leerZuNull, datumFeld(T.maske.abschnitte.endeLabel).nullable()),

    ortText: z
      .string()
      .trim()
      .max(150, T.maske.validation.ortZuLang)
      .optional()
      .transform((wert) => wert || null),

    schularten: z.array(z.enum(SCHULART_VALUES)),

    fach: z
      .string()
      .trim()
      .max(100, T.maske.validation.fachZuLang)
      .optional()
      .transform((wert) => wert || null),

    niveaustufe: z
      .enum(NIVEAUSTUFE_VALUES)
      .nullish()
      .catch(null),

    /** Codes aus DigCompKompetenz, z. B. ["1", "1.2", "3.4"] */
    kompetenzen: z.array(z.string().regex(/^\d(\.\d+)?$/)).default([]),

    /** Freie Schlagwort-Namen; Pflicht-Tags kommen in der Action dazu. */
    schlagworte: z
      .array(
        z
          .string()
          .transform(normalisiereSchlagwort)
          .pipe(
            z
              .string()
              .min(2, T.maske.validation.schlagwortZuKurz)
              .max(60, T.maske.validation.schlagwortZuLang),
          ),
      )
      .max(30, T.maske.validation.schlagworteZuViele)
      .default([])
      .transform(normalisiereSchlagwortListe),

    referenten: z.array(z.string().uuid()).default([]),

    fibsLehrgangsnummer: z
      .string()
      .trim()
      .max(50)
      .optional()
      .transform((wert) => wert || null),

    fibsUrl: z
      .string()
      .trim()
      .optional()
      .transform((wert) => wert || null)
      .refine(
        (wert) => wert === null || /^https:\/\/[^\s]+$/i.test(wert),
        T.maske.validation.fibsUrlUngueltig,
      ),

    status: z.enum(STATUS_VALUES).default("ENTWURF"),
  })
  .superRefine((daten, ctx) => {
    const fehlt = (pfad: string, meldung: string) =>
      ctx.addIssue({ code: "custom", message: meldung, path: [pfad] });

    // ALP ist vorübergehend gesperrt — bestehende ALP-Datensätze bleiben
    // lesbar, lassen sich aber ohne Wechsel der Organisationsform nicht mehr
    // speichern (siehe src/constants/funktionen.ts).
    if (AUSGEGRAUT.alp && daten.organisationsform === "ALP") {
      fehlt("organisationsform", T.maske.validation.organisationsformAlpGesperrt);
    }

    // Ein Entwurf ist ein Zwischenstand: Beschreibung, Schulart, Termin und
    // Ort dürfen noch fehlen. Pflicht werden sie erst beim Einreichen.
    const entwurf = daten.status === "ENTWURF";
    if (!entwurf && istLeer(daten.beschreibungHtml)) fehlt("beschreibungHtml", T.maske.validation.beschreibungLeer);
    if (!entwurf && daten.schularten.length === 0) fehlt("schularten", T.maske.validation.schulartenPflicht);

    if (!entwurf && !terminOptional(daten.organisationsform, daten.format)) {
      if (!daten.beginn) fehlt("beginn", T.maske.validation.feldPflicht(T.maske.abschnitte.beginnLabel));
      if (!daten.ende) fehlt("ende", T.maske.validation.feldPflicht(T.maske.abschnitte.endeLabel));
      if (!daten.ortText) fehlt("ortText", T.maske.validation.ortPflicht);
      if (daten.maxTn === null) fehlt("maxTn", T.maske.validation.maxTnKeineZahl);
    }

    // Bei SchiLf und Video-Tutorial wird ein mitgeschickter Termin verworfen,
    // die Reihenfolge muss dann nicht geprüft werden.
    if (terminOptional(daten.organisationsform, daten.format)) return;

    if (daten.beginn && daten.ende) {
      if (daten.ende <= daten.beginn) fehlt("ende", T.maske.validation.endeVorBeginn);
      else if (daten.ende.getTime() - daten.beginn.getTime() > 1000 * 60 * 60 * 24 * 30)
        fehlt("ende", T.maske.validation.zeitraumZuLang);
    }
  })
  // SchiLf und Video-Tutorial speichern nie einen Termin, auch wenn einer mitkommt.
  .transform((daten) =>
    terminOptional(daten.organisationsform, daten.format)
      ? { ...daten, beginn: null, ende: null }
      : daten,
  );

export type FortbildungEingabe = z.infer<typeof FortbildungSchema>;

/**
 * Zusätzliche Anforderungen an eine Fortbildung, die veröffentlicht werden soll.
 *
 * Bewusst nur beim Veröffentlichen, nicht beim Speichern: Ein Entwurf muss
 * jederzeit zwischenspeicherbar sein, sonst geht angefangene Arbeit verloren,
 * wenn eine Angabe noch fehlt. Der Wizard führt ohnehin durch alle Schritte.
 */
/**
 * Nur die Felder, auf die es beim Veröffentlichen ankommt — so lässt sich die
 * Prüfung sowohl auf ein Formular als auch auf einen Datenbankdatensatz
 * anwenden (siehe freigeben() in src/actions/freigabe.ts).
 */
export interface VeroeffentlichungsDaten {
  status: string;
  niveaustufe?: string | null;
  kompetenzen: string[];
  referenten: string[];
}

export const VEROEFFENTLICHUNGS_PFLICHTEN: Array<{
  feld: string;
  pruefe: (daten: VeroeffentlichungsDaten) => boolean;
  meldung: string;
  /** Trägt erst die Redaktion nach, gilt also nicht schon beim Einreichen. */
  redaktion?: boolean;
}> = [
  {
    feld: "niveaustufe",
    pruefe: (d) => Boolean(d.niveaustufe),
    meldung: T.maske.validation.veroeffentlichenNiveaustufe,
    redaktion: true,
  },
  {
    feld: "kompetenzen",
    pruefe: (d) => d.kompetenzen.length > 0,
    meldung: T.maske.validation.veroeffentlichenKompetenzen,
    redaktion: true,
  },
  {
    feld: "referenten",
    pruefe: (d) => d.referenten.length > 0,
    meldung: T.maske.validation.veroeffentlichenReferenten,
  },
];

/**
 * Prüft die Veröffentlichungs-Pflichten. Gibt die Feldfehler zurück, oder
 * null, wenn alles vollständig ist.
 */
export function pruefeVeroeffentlichung(
  daten: VeroeffentlichungsDaten,
): Record<string, string> | null {
  if (daten.status === "ENTWURF") return null;

  const fehler: Record<string, string> = {};
  for (const pflicht of VEROEFFENTLICHUNGS_PFLICHTEN) {
    // Referenten sehen Niveaustufe und DigCompEdu nicht. Beim Einreichen
    // zählt deshalb nur, was sie selbst ausfüllen können.
    if (pflicht.redaktion && daten.status === "EINGEREICHT") continue;
    if (!pflicht.pruefe(daten)) fehler[pflicht.feld] = pflicht.meldung;
  }

  return Object.keys(fehler).length > 0 ? fehler : null;
}

/**
 * Meldet Referenten-IDs, die nach dem Abgleich mit der Datenbank fehlen.
 *
 * Die Auswahl aus dem Formular ist nicht vertrauenswürdig: Eine formal
 * gültige UUID kann trotzdem auf keinen Referenteneintrag zeigen. Der Abgleich
 * muss vor der Veröffentlichungsprüfung stattfinden, damit eine nicht
 * existierende ID nicht als erfüllte Referentenpflicht zählt.
 */
export function fehlendeReferentIds(
  angefragt: string[],
  vorhanden: string[],
): string[] {
  const bekannteIds = new Set(vorhanden);
  return [...new Set(angefragt)].filter((id) => !bekannteIds.has(id));
}

/**
 * Ergebnis einer Formular-Aktion.
 * `fehler` ist nach Feldnamen sortiert, damit das Formular die Meldung direkt
 * am betroffenen Feld — und den Fehler-Punkt am betroffenen Tab — anzeigen kann.
 */
export interface FormularState {
  erfolg?: boolean;
  meldung?: string;
  fehler?: Record<string, string>;
}

/** Wandelt zod-Fehler in die flache Feld → Meldung-Struktur. */
export function zuFeldFehlern(error: z.ZodError): Record<string, string> {
  const fehler: Record<string, string> = {};
  for (const issue of error.issues) {
    const feld = issue.path.join(".") || "_";
    // Nur die erste Meldung pro Feld — mehr überfordert beim Korrigieren.
    fehler[feld] ??= issue.message;
  }
  return fehler;
}

/** Liest die Formulardaten in die Struktur, die das Schema erwartet. */
export function formDataZuEingabe(formData: FormData) {
  const text = (name: string) => (formData.get(name) as string | null)?.toString() ?? "";
  const liste = (name: string) =>
    formData.getAll(name).map((wert) => wert.toString()).filter(Boolean);

  return {
    titel: text("titel"),
    kurztitel: text("kurztitel"),
    beschreibungHtml: text("beschreibungHtml"),
    organisationsform: text("organisationsform"),
    maxTn: text("maxTn"),
    format: text("format"),
    beginn: text("beginn"),
    ende: text("ende"),
    ortText: text("ortText"),
    schularten: liste("schularten"),
    fach: text("fach"),
    niveaustufe: text("niveaustufe") || null,
    kompetenzen: liste("kompetenzen"),
    schlagworte: liste("schlagworte"),
    referenten: liste("referenten"),
    fibsLehrgangsnummer: text("fibsLehrgangsnummer"),
    fibsUrl: text("fibsUrl"),
    status: text("status") || "ENTWURF",
  };
}

/**
 * Zuordnung Feld → Tab, damit das Formular am richtigen Reiter einen
 * Fehlerpunkt setzen kann. Ein Fehler in einem geschlossenen Tab wäre sonst
 * unsichtbar und das Formular ließe sich scheinbar grundlos nicht speichern.
 */
export const FELD_ZU_TAB: Record<string, string> = {
  titel: "eckdaten",
  kurztitel: "eckdaten",
  organisationsform: "eckdaten",
  maxTn: "eckdaten",
  format: "eckdaten",
  beginn: "eckdaten",
  ende: "eckdaten",
  ortText: "eckdaten",
  status: "eckdaten",
  fibsLehrgangsnummer: "eckdaten",
  fibsUrl: "eckdaten",
  beschreibungHtml: "beschreibung",
  schularten: "zielgruppe",
  fach: "zielgruppe",
  schlagworte: "zielgruppe",
  niveaustufe: "digcomp",
  kompetenzen: "digcomp",
  referenten: "referenten",
};

/** Auch Listenfehler wie „schlagworte.0“ gehören zum jeweiligen Abschnitt. */
export function fehlerTab(feld: string): string | undefined {
  return FELD_ZU_TAB[feld.split(".")[0]!];
}
