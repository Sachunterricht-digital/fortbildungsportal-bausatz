// ============================================================================
// WARTUNGSHINWEIS
// ----------------------------------------------------------------------------
// Die bayerischen SCHULFERIEN werden je Schuljahr behördlich festgelegt und
// sind deshalb NICHT berechenbar. Die Liste unten ist gepflegt bis
// einschließlich Schuljahr 2029/2030, also bis zum 09.09.2030 (Ende der
// Sommerferien 2030).
//
// Sobald das Staatsministerium Termine ab 2030/2031 veröffentlicht hat,
// hier ergänzen:
//   https://www.km.bayern.de/termine/ferien-und-feiertage
//
// Für Daten außerhalb des gepflegten Zeitraums liefert ferienStatus() bewusst
// `unbekannt` statt "keine Ferien" — die Oberfläche zeigt dann einen Hinweis
// statt einer stillen Falschaussage.
//
// Amtliche Grundlage: BayMBl. 2022 Nr. 747; abgeglichen am 01.09.2026.
//
// Die gesetzlichen FEIERTAGE werden dagegen algorithmisch berechnet und gelten
// unbegrenzt in die Zukunft.
// ============================================================================

import { berlinIsoDatum } from "@/lib/datetime";

interface Ferienzeitraum {
  start: string;
  ende: string;
  label: string;
}

const FERIEN_NACH_SCHULJAHR: Record<string, Ferienzeitraum[]> = {
  "2025/2026": [
    { start: "2025-11-03", ende: "2025-11-07", label: "Herbstferien" },
    { start: "2025-12-22", ende: "2026-01-05", label: "Weihnachtsferien" },
    { start: "2026-02-16", ende: "2026-02-20", label: "Frühjahrsferien" },
    { start: "2026-03-30", ende: "2026-04-10", label: "Osterferien" },
    { start: "2026-05-26", ende: "2026-06-05", label: "Pfingstferien" },
    { start: "2026-08-03", ende: "2026-09-14", label: "Sommerferien" },
  ],
  "2026/2027": [
    { start: "2026-11-02", ende: "2026-11-06", label: "Herbstferien" },
    { start: "2026-12-24", ende: "2027-01-08", label: "Weihnachtsferien" },
    { start: "2027-02-08", ende: "2027-02-12", label: "Frühjahrsferien" },
    { start: "2027-03-22", ende: "2027-04-02", label: "Osterferien" },
    { start: "2027-05-18", ende: "2027-05-28", label: "Pfingstferien" },
    { start: "2027-08-02", ende: "2027-09-13", label: "Sommerferien" },
  ],
  "2027/2028": [
    { start: "2027-11-02", ende: "2027-11-05", label: "Herbstferien" },
    { start: "2027-12-24", ende: "2028-01-07", label: "Weihnachtsferien" },
    { start: "2028-02-28", ende: "2028-03-03", label: "Frühjahrsferien" },
    { start: "2028-04-10", ende: "2028-04-21", label: "Osterferien" },
    { start: "2028-06-06", ende: "2028-06-16", label: "Pfingstferien" },
    { start: "2028-07-31", ende: "2028-09-11", label: "Sommerferien" },
  ],
  "2028/2029": [
    { start: "2028-10-30", ende: "2028-11-03", label: "Herbstferien" },
    { start: "2028-12-23", ende: "2029-01-05", label: "Weihnachtsferien" },
    { start: "2029-02-12", ende: "2029-02-16", label: "Frühjahrsferien" },
    { start: "2029-03-26", ende: "2029-04-06", label: "Osterferien" },
    { start: "2029-05-22", ende: "2029-06-01", label: "Pfingstferien" },
    { start: "2029-07-30", ende: "2029-09-10", label: "Sommerferien" },
  ],
  "2029/2030": [
    { start: "2029-10-29", ende: "2029-11-02", label: "Herbstferien" },
    { start: "2029-12-24", ende: "2030-01-04", label: "Weihnachtsferien" },
    { start: "2030-03-04", ende: "2030-03-08", label: "Frühjahrsferien" },
    { start: "2030-04-15", ende: "2030-04-26", label: "Osterferien" },
    { start: "2030-06-11", ende: "2030-06-21", label: "Pfingstferien" },
    { start: "2030-07-29", ende: "2030-09-09", label: "Sommerferien" },
  ],
};

const ALLE_FERIEN = Object.values(FERIEN_NACH_SCHULJAHR).flat();

/** Zeitraum, für den die Ferientermine tatsächlich gepflegt sind. */
const GEPFLEGT = ALLE_FERIEN.reduce(
  (bereich, f) => ({
    frueheste: f.start < bereich.frueheste ? f.start : bereich.frueheste,
    spaeteste: f.ende > bereich.spaeteste ? f.ende : bereich.spaeteste,
  }),
  { frueheste: ALLE_FERIEN[0]!.start, spaeteste: ALLE_FERIEN[0]!.ende },
);

// ---------------------------------------------------------------------------
// Feiertage (berechnet)
// ---------------------------------------------------------------------------

/** Gaußsche Osterformel, gregorianischer Kalender. */
function osterSonntag(jahr: number): Date {
  const a = jahr % 19;
  const b = Math.floor(jahr / 100);
  const c = jahr % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31); // 3 = März, 4 = April
  const tag = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(jahr, monat - 1, tag));
}

function plusTage(datum: Date, tage: number): Date {
  return new Date(datum.getTime() + tage * 24 * 60 * 60 * 1000);
}

function iso(datum: Date): string {
  return berlinIsoDatum(datum);
}

/**
 * Bayerische gesetzliche Feiertage eines Kalenderjahres, dazu der
 * unterrichtsfreie Buß- und Bettag.
 */
function feiertageFuerJahr(jahr: number): Map<string, string> {
  const ostern = osterSonntag(jahr);

  const eintraege: Array<[Date, string]> = [
    [new Date(Date.UTC(jahr, 0, 1)), "Neujahr"],
    [new Date(Date.UTC(jahr, 0, 6)), "Heilige Drei Könige"],
    [plusTage(ostern, -2), "Karfreitag"],
    [ostern, "Ostersonntag"],
    [plusTage(ostern, 1), "Ostermontag"],
    [new Date(Date.UTC(jahr, 4, 1)), "Tag der Arbeit"],
    [plusTage(ostern, 39), "Christi Himmelfahrt"],
    [plusTage(ostern, 49), "Pfingstsonntag"],
    [plusTage(ostern, 50), "Pfingstmontag"],
    [plusTage(ostern, 60), "Fronleichnam"],
    [new Date(Date.UTC(jahr, 7, 15)), "Mariä Himmelfahrt"],
    [new Date(Date.UTC(jahr, 9, 3)), "Tag der Deutschen Einheit"],
    [new Date(Date.UTC(jahr, 10, 1)), "Allerheiligen"],
    [bussUndBettag(jahr), "Buß- und Bettag (unterrichtsfrei)"],
    [new Date(Date.UTC(jahr, 11, 25)), "1. Weihnachtstag"],
    [new Date(Date.UTC(jahr, 11, 26)), "2. Weihnachtstag"],
  ];

  return new Map(eintraege.map(([datum, name]) => [iso(datum), name]));
}

/** Mittwoch vor dem 23. November. */
function bussUndBettag(jahr: number): Date {
  const nov23 = new Date(Date.UTC(jahr, 10, 23));
  const wochentag = nov23.getUTCDay(); // 0 = So … 3 = Mi
  let zurueck = (wochentag - 3 + 7) % 7;
  if (zurueck === 0) zurueck = 7; // "vor" dem 23.
  return plusTage(nov23, -zurueck);
}

// Feiertage werden je Jahr einmal berechnet und gemerkt — der Kalender fragt
// sie sonst für jeden der ~35 sichtbaren Tage neu ab.
const feiertagsCache = new Map<number, Map<string, string>>();

function feiertage(jahr: number): Map<string, string> {
  let treffer = feiertagsCache.get(jahr);
  if (!treffer) {
    treffer = feiertageFuerJahr(jahr);
    feiertagsCache.set(jahr, treffer);
  }
  return treffer;
}

// ---------------------------------------------------------------------------
// Öffentliche API
// ---------------------------------------------------------------------------

export type FerienArt = "ferien" | "feiertag" | "wochenende" | "unterrichtstag";

export interface FerienStatus {
  art: FerienArt;
  /** "Pfingstferien", "Fronleichnam" … */
  label: string | null;
  /**
   * false, wenn das Datum außerhalb des gepflegten Ferienzeitraums liegt.
   * Dann ist `art: "unterrichtstag"` keine belastbare Aussage.
   */
  ferienGepflegt: boolean;
}

/** Status eines Datums — nach Berliner Ortszeit ausgewertet. */
export function ferienStatus(datum: Date): FerienStatus {
  const tag = berlinIsoDatum(datum);
  const jahr = Number(tag.slice(0, 4));
  const gepflegt = tag >= GEPFLEGT.frueheste && tag <= GEPFLEGT.spaeteste;

  // Ferien zuerst: Ein Feiertag innerhalb der Ferien ist für die Frage
  // "kann hier eine Fortbildung stattfinden?" ohnehin ein Ferientag.
  for (const f of ALLE_FERIEN) {
    if (tag >= f.start && tag <= f.ende) {
      return { art: "ferien", label: f.label, ferienGepflegt: true };
    }
  }

  const feiertag = feiertage(jahr).get(tag);
  if (feiertag) {
    return { art: "feiertag", label: feiertag, ferienGepflegt: gepflegt };
  }

  const wochentag = new Date(`${tag}T12:00:00Z`).getUTCDay();
  if (wochentag === 0 || wochentag === 6) {
    return {
      art: "wochenende",
      label: wochentag === 0 ? "Sonntag" : "Samstag",
      ferienGepflegt: gepflegt,
    };
  }

  return { art: "unterrichtstag", label: null, ferienGepflegt: gepflegt };
}

/**
 * Warnung für einen Termin. Prüft den gesamten Zeitraum, nicht nur den
 * Beginn — ein zweitägiger Lehrgang kann in die Ferien hineinlaufen.
 *
 * Gibt null zurück, wenn alles unauffällig ist.
 */
export function terminWarnung(
  beginn: Date | null,
  ende: Date | null,
): { art: FerienArt | "unbekannt"; text: string } | null {
  if (!beginn || !ende) return null;
  const tage = tageZwischen(beginn, ende);
  const befunde = tage.map(ferienStatus);

  const ferien = befunde.find((b) => b.art === "ferien");
  if (ferien) {
    return {
      art: "ferien",
      text:
        tage.length > 1
          ? `Der Zeitraum fällt teilweise in die bayerischen ${ferien.label}.`
          : `Dieser Termin liegt in den bayerischen ${ferien.label}.`,
    };
  }

  const feiertag = befunde.find((b) => b.art === "feiertag");
  if (feiertag) {
    return {
      art: "feiertag",
      text: `Dieser Termin fällt auf einen Feiertag (${feiertag.label}).`,
    };
  }

  const wochenende = befunde.find((b) => b.art === "wochenende");
  if (wochenende) {
    return {
      art: "wochenende",
      text: "Dieser Termin liegt am Wochenende.",
    };
  }

  if (befunde.some((b) => !b.ferienGepflegt)) {
    return {
      art: "unbekannt",
      text: `Für diesen Zeitraum sind die bayerischen Schulferien noch nicht hinterlegt (gepflegt bis ${GEPFLEGT.spaeteste.split("-").reverse().join(".")}). Bitte selbst gegen den Ferienkalender prüfen.`,
    };
  }

  return null;
}

/** Alle Kalendertage von Beginn bis Ende, je 12:00 Uhr UTC als Stichprobe. */
function tageZwischen(beginn: Date, ende: Date): Date[] {
  const tage: Date[] = [];
  const start = berlinIsoDatum(beginn);
  const schluss = berlinIsoDatum(ende);

  let aktuell = new Date(`${start}T12:00:00Z`);
  const grenze = new Date(`${schluss}T12:00:00Z`);

  // Deckel gegen Endlosschleifen bei absurden Eingaben.
  for (let i = 0; aktuell <= grenze && i < 400; i += 1) {
    tage.push(aktuell);
    aktuell = plusTage(aktuell, 1);
  }

  return tage.length > 0 ? tage : [new Date(`${start}T12:00:00Z`)];
}

/** Bis wann die Ferientermine gepflegt sind — für Hinweistexte. */
export const FERIEN_GEPFLEGT_BIS = GEPFLEGT.spaeteste;
