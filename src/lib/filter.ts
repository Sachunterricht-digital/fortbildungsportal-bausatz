import type { Prisma } from "@prisma/client";

import {
  formatDatum,
  fromDatetimeLocalValue,
  schuljahrZeitraum,
} from "@/lib/datetime";
import {
  FORMAT_VALUES,
  NIVEAUSTUFE_VALUES,
  ORGANISATIONSFORM_VALUES,
  SCHULART_VALUES,
  STATUS_VALUES,
  formatLabel,
  niveaustufeLabel,
  organisationsformLabel,
  schulartLabel,
} from "@/constants/fortbildung";

/**
 * Filter aus der URL.
 *
 * Alle Filter leben in den Suchparametern, nicht im Client-State: Damit ist
 * jede Filterkombination ein teilbarer Link, der Zurück-Knopf funktioniert,
 * und die Liste kann als Server Component ohne JavaScript gerendert werden.
 */
export interface FortbildungFilter {
  q?: string;
  von?: string;
  bis?: string;
  organisationsform?: string;
  format?: string;
  schulart?: string;
  niveaustufe?: string;
  /** Kompetenzbereich, z. B. "3" — trifft auch alle Unterkompetenzen. */
  kb?: string;
  schlagwort?: string;
  status?: string;
  /**
   * FIBS-Stand. "offen" bleibt als Sammelfilter kompatibel; die genaueren
   * Werte trennen reguläre Ausschreibungen vom SchiLf-Nachtrag.
   */
  fibs?: string;
  /** Schuljahr in der Form "2026/2027". Leer bedeutet alle Jahrgänge. */
  schuljahr?: string;
}

export type SuchParameter = Record<string, string | string[] | undefined>;

export function leseFilter(params: SuchParameter): FortbildungFilter {
  const einzeln = (name: string): string | undefined => {
    const wert = params[name];
    const text = Array.isArray(wert) ? wert[0] : wert;
    return text?.trim() || undefined;
  };

  return {
    q: einzeln("q"),
    von: einzeln("von"),
    bis: einzeln("bis"),
    organisationsform: erlaubt(einzeln("organisationsform"), ORGANISATIONSFORM_VALUES),
    format: erlaubt(einzeln("format"), FORMAT_VALUES),
    schulart: erlaubt(einzeln("schulart"), SCHULART_VALUES),
    niveaustufe: erlaubt(einzeln("niveaustufe"), NIVEAUSTUFE_VALUES),
    kb: /^[1-6]$/.test(einzeln("kb") ?? "") ? einzeln("kb") : undefined,
    schlagwort: einzeln("schlagwort"),
    status: erlaubt(einzeln("status"), STATUS_VALUES),
    fibs: erlaubt(einzeln("fibs"), [
      "offen",
      "offen-ausschreibung",
      "schilf-nachtrag",
      "erledigt",
    ]),
    schuljahr: /^\d{4}\/\d{4}$/.test(einzeln("schuljahr") ?? "")
      ? einzeln("schuljahr")
      : undefined,
  };
}

function erlaubt(wert: string | undefined, werte: readonly string[]): string | undefined {
  return wert && werte.includes(wert) ? wert : undefined;
}

/** Übersetzt die Filter in eine Prisma-Bedingung. */
export function filterZuWhere(filter: FortbildungFilter): Prisma.FortbildungWhereInput {
  const und: Prisma.FortbildungWhereInput[] = [];

  // Mehrere Wörter werden UND-verknüpft, jedes darf in einem beliebigen Feld
  // stehen. Ohne diese Aufteilung ginge der ganze Eingabetext als ein
  // Teilstring in die Abfrage — „ipad grundschule" fände dann nichts, obwohl
  // beide Begriffe vorkommen, nur eben in Titel und Beschreibung.
  for (const begriff of suchbegriffe(filter.q)) {
    und.push({
      OR: [
        { titel: { contains: begriff, mode: "insensitive" } },
        { kurztitel: { contains: begriff, mode: "insensitive" } },
        { beschreibungText: { contains: begriff, mode: "insensitive" } },
        { fach: { contains: begriff, mode: "insensitive" } },
        { ortText: { contains: begriff, mode: "insensitive" } },
        { veranstaltungsort: { name: { contains: begriff, mode: "insensitive" } } },
        // Schlagworte gehören dazu: Wer „Medienkonzept" sucht, meint das
        // Thema — auch wenn das Wort im Titel gar nicht vorkommt.
        {
          schlagworte: {
            some: { schlagwort: { name: { contains: begriff, mode: "insensitive" } } },
          },
        },
      ],
    });
  }

  const von = tagesGrenze(filter.von, "start");
  const bis = tagesGrenze(filter.bis, "ende");

  // Ein Zeitraumfilter meint "findet in diesem Zeitraum statt", nicht "beginnt
  // darin" — ein mehrtägiger Lehrgang soll auch am zweiten Tag gefunden werden.
  if (von) und.push({ ende: { gte: von } });
  if (bis) und.push({ beginn: { lte: bis } });

  if (filter.organisationsform) und.push({ organisationsform: filter.organisationsform });
  if (filter.format) und.push({ format: filter.format });
  if (filter.niveaustufe) und.push({ niveaustufe: filter.niveaustufe });
  if (filter.status) und.push({ status: filter.status });
  if (filter.schulart) und.push({ schularten: { has: filter.schulart } });

  if (filter.kb) {
    // "3" trifft den Bereich selbst und jede Unterkompetenz "3.x".
    und.push({
      kompetenzen: {
        some: { kompetenzCode: { startsWith: filter.kb } },
      },
    });
  }

  if (filter.schuljahr) {
    const { start, ende: schluss } = schuljahrZeitraum(filter.schuljahr);
    // Ein Termin gehört zum Schuljahr, wenn er darin beginnt.
    und.push({ beginn: { gte: start, lte: schluss } });
  }

  if (filter.fibs === "offen") und.push({ inFibs: false });
  if (filter.fibs === "offen-ausschreibung") {
    und.push({
      inFibs: false,
      organisationsform: { not: "SCHILF" },
      // Der Kennzahl-Link soll exakt dieselben noch anstehenden Fälle zeigen.
      ende: { gte: new Date() },
    });
  }
  if (filter.fibs === "schilf-nachtrag") {
    und.push({ inFibs: false, organisationsform: "SCHILF" });
  }
  if (filter.fibs === "erledigt") und.push({ inFibs: true });

  if (filter.schlagwort) {
    und.push({
      schlagworte: { some: { schlagwort: { name: filter.schlagwort } } },
    });
  }

  return und.length > 0 ? { AND: und } : {};
}

/**
 * Archiv beim Export ausblenden, außer die Administration filtert ausdrücklich
 * danach.
 *
 * `filterZuWhere()` setzt einen Status nur, wenn er explizit in der URL
 * steht — ohne Statusfilter fehlt sonst jede Grenze, und ein Excel- oder
 * PDF-Export würde stillschweigend auch archivierte Vorjahre mitnehmen. Für
 * die Fortbildungsübersicht selbst ist das kein Thema: Dort steht das
 * Archiv immer in der eigenen, eingeklappten Gruppe "Abgeschlossen".
 */
export function archivAusblenden(
  filter: FortbildungFilter,
): Prisma.FortbildungWhereInput[] {
  return filter.status === "ARCHIVIERT" ? [] : [{ status: { not: "ARCHIVIERT" } }];
}

/** Höchstzahl an Suchbegriffen — schützt vor absurd langen Eingaben. */
const MAX_BEGRIFFE = 8;

/**
 * Zerlegt die Sucheingabe in einzelne Begriffe.
 *
 * Einzelne Buchstaben fliegen raus: Sie treffen fast jeden Datensatz und
 * kosten nur Rechenzeit. Bleibt dadurch nichts übrig — jemand sucht nach
 * „3D" oder „KI" —, wird die Eingabe als Ganzes verwendet.
 */
export function suchbegriffe(eingabe: string | undefined): string[] {
  if (!eingabe) return [];

  const alle = eingabe.trim().split(/\s+/).filter(Boolean);
  const brauchbar = alle.filter((wort) => wort.length >= 2);

  return (brauchbar.length > 0 ? brauchbar : alle).slice(0, MAX_BEGRIFFE);
}

/** "2026-09-15" aus einem <input type="date"> zu Berliner Tagesgrenze. */
function tagesGrenze(wert: string | undefined, kante: "start" | "ende"): Date | null {
  if (!wert || !/^\d{4}-\d{2}-\d{2}$/.test(wert)) return null;
  return fromDatetimeLocalValue(
    `${wert}T${kante === "start" ? "00:00" : "23:59"}`,
  );
}

/** Zählt die aktiven Filter — für den "Filter zurücksetzen"-Hinweis. */
export function anzahlAktiverFilter(filter: FortbildungFilter): number {
  return Object.values(filter).filter(Boolean).length;
}

/**
 * Ein gesetzter Filter in lesbarer Form.
 *
 * Wird an zwei Stellen gebraucht: für die Chips über der Trefferliste und für
 * den Leerzustand, der anbietet, einzelne Filter fallen zu lassen. Beide
 * müssen dieselbe Bezeichnung zeigen, deshalb steht die Übersetzung hier und
 * nicht in den Komponenten.
 */
export interface FilterChip {
  /** Name des Suchparameters, etwa "schulart". */
  param: string;
  /** Was gefiltert wird, etwa "Schulart". */
  art: string;
  /** Worauf gefiltert wird, etwa "Grundschule". */
  wert: string;
}

export function beschreibeFilter(
  params: SuchParameter,
  kompetenzbereiche: Array<{ code: string; titel: string }> = [],
): FilterChip[] {
  const filter = leseFilter(params);
  const chips: FilterChip[] = [];

  if (filter.q) chips.push({ param: "q", art: "Suche", wert: `„${filter.q}“` });
  if (filter.schulart) {
    chips.push({
      param: "schulart",
      art: "Schulart",
      wert: schulartLabel(filter.schulart),
    });
  }
  if (filter.format) {
    chips.push({ param: "format", art: "Format", wert: formatLabel(filter.format) });
  }
  if (filter.organisationsform) {
    chips.push({
      param: "organisationsform",
      art: "Art",
      wert: organisationsformLabel(filter.organisationsform),
    });
  }
  if (filter.kb) {
    const bereich = kompetenzbereiche.find((k) => k.code === filter.kb);
    chips.push({
      param: "kb",
      art: "Kompetenzbereich",
      wert: bereich ? `${bereich.code} · ${bereich.titel}` : `KB ${filter.kb}`,
    });
  }
  if (filter.niveaustufe) {
    chips.push({
      param: "niveaustufe",
      art: "Niveaustufe",
      wert: niveaustufeLabel(filter.niveaustufe),
    });
  }
  if (filter.schlagwort) {
    chips.push({ param: "schlagwort", art: "Schlagwort", wert: filter.schlagwort });
  }
  if (filter.schuljahr) {
    chips.push({ param: "schuljahr", art: "Schuljahr", wert: filter.schuljahr });
  }

  const von = tagesGrenze(filter.von, "start");
  const bis = tagesGrenze(filter.bis, "ende");
  if (von) chips.push({ param: "von", art: "Ab", wert: formatDatum(von) });
  if (bis) chips.push({ param: "bis", art: "Bis", wert: formatDatum(bis) });

  const vergangene = params.vergangene;
  if ((Array.isArray(vergangene) ? vergangene[0] : vergangene) === "1") {
    chips.push({ param: "vergangene", art: "Zeitraum", wert: "auch vergangene" });
  }

  return chips;
}

/** Dieselben Suchparameter, aber ohne den genannten. */
export function ohneFilter(params: SuchParameter, param: string): SuchParameter {
  const kopie = { ...params };
  delete kopie[param];
  return kopie;
}

/** Baut eine URL mit geänderten Parametern, leere Werte fallen raus. */
export function baueUrl(
  basis: string,
  bisher: SuchParameter,
  aenderungen: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();

  for (const [key, wert] of Object.entries(bisher)) {
    const text = Array.isArray(wert) ? wert[0] : wert;
    if (text) params.set(key, text);
  }

  for (const [key, wert] of Object.entries(aenderungen)) {
    if (wert) params.set(key, wert);
    else params.delete(key);
  }

  const query = params.toString();
  return query ? `${basis}?${query}` : basis;
}
