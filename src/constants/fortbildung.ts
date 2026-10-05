/**
 * Zentrale Werteliste für alle aufzählbaren Felder einer Fortbildung.
 *
 * Die Datenbank speichert diese Werte als String (siehe Kommentar in
 * prisma/schema.prisma). Hier — und nur hier — werden sie gepflegt; zod,
 * Formular, Filter und Export leiten sich davon ab.
 */

import { AUSGEGRAUT } from "./funktionen";

/** Hilfstyp: aus einer `as const`-Liste den Union-Typ der `value`s ziehen. */
type ValueOf<T extends ReadonlyArray<{ value: string }>> = T[number]["value"];

// ---------------------------------------------------------------------------

/**
 * Die drei Ebenen der bayerischen Lehrerfortbildung.
 *
 * Der Datenbankwert `REGIONAL` bleibt aus Rücksicht auf bestehende Einträge
 * unverändert — nach außen heißt diese Ebene RLFB.
 */
export const ORGANISATIONSFORMEN = [
  {
    value: "SCHILF",
    label: "SchiLf",
    kurz: "SchiLf",
    beschreibung: "Schulinterne Lehrerfortbildung für das Kollegium einer Schule. Termin und Ort nach Absprache.",
  },
  {
    value: "REGIONAL",
    label: "RLFB (regional)",
    kurz: "RLFB",
    beschreibung:
      "Regionale Lehrerfortbildung des Schulamts, ausgeschrieben über FIBS.",
  },
  {
    value: "ALP",
    label: "ALP Dillingen",
    kurz: "ALP",
    beschreibung:
      "Zentrale Lehrerfortbildung der Akademie für Lehrerfortbildung und Personalführung.",
  },
] as const;

export type Organisationsform = ValueOf<typeof ORGANISATIONSFORMEN>;

/** Reihenfolge für Berichte und Exporte: SchiLf, RLFB, ALP. */
export const ORGANISATIONSFORM_REIHENFOLGE: Organisationsform[] = [
  "SCHILF",
  "REGIONAL",
  "ALP",
];

/** Kurzform für Tabellen und PDF-Überschriften. */
export function organisationsformKurz(wert: string): string {
  return ORGANISATIONSFORMEN.find((o) => o.value === wert)?.kurz ?? wert;
}

/**
 * Auswahlliste für Formular und Filter.
 *
 * ALP ist vorübergehend gesperrt (siehe `src/constants/funktionen.ts`) und
 * wird hier nicht mehr zur Neuauswahl angeboten. Die Werteliste selbst bleibt
 * unverändert — vorhandene ALP-Datensätze behalten ihr Label. `aktuellerWert`
 * hält eine bereits gesetzte ALP-Zuordnung in der Auswahl sichtbar, damit ein
 * bestehender Datensatz beim Bearbeiten nicht als leer erscheint.
 */
export function organisationsformenAuswahl(
  aktuellerWert?: string | null,
): typeof ORGANISATIONSFORMEN[number][] {
  if (!AUSGEGRAUT.alp) return [...ORGANISATIONSFORMEN];
  return ORGANISATIONSFORMEN.filter(
    (o) => o.value !== "ALP" || o.value === aktuellerWert,
  );
}

/**
 * Farbklassen je Ebene.
 *
 * Als vollständige Klassennamen hinterlegt, weil Tailwind zusammengesetzte
 * Namen wie `bg-${wert}` nicht findet. Die Farben selbst stehen als Token in
 * globals.css und stammen aus den Wappen der Region.
 *
 *   flaeche — kräftig gefüllt, für Etiketten
 *   weich   — zurückhaltend, für größere Flächen wie Kalendereinträge
 *   kante   — linker Balken einer Listenzeile
 */
const EBENE_KLASSEN = {
  SCHILF: {
    text: "text-schilf",
    flaeche: "bg-schilf text-white",
    weich: "bg-schilf-weich text-schilf",
    balken: "bg-schilf",
    kante: "border-l-schilf",
  },
  REGIONAL: {
    text: "text-regional",
    flaeche: "bg-regional text-white",
    weich: "bg-regional-weich text-regional",
    balken: "bg-regional",
    kante: "border-l-regional",
  },
  ALP: {
    text: "text-alp",
    flaeche: "bg-alp text-white",
    weich: "bg-alp-weich text-alp",
    balken: "bg-alp",
    kante: "border-l-alp",
  },
} as const;

export function ebeneKlassen(wert: string) {
  return EBENE_KLASSEN[wert as keyof typeof EBENE_KLASSEN] ?? EBENE_KLASSEN.REGIONAL;
}

// ---------------------------------------------------------------------------

/**
 * Formate. Video-Tutorials brauchen weder Ort noch Termin (siehe
 * terminOptional()); welcher Ort sonst passt, entscheiden Schule und
 * Referent selbst — der Ort ist seit dem Freitext-Feld keine feste Auswahl mehr.
 */
export const VERANSTALTUNGSFORMATE = [
  { value: "PRAESENZ", label: "Präsenz" },
  { value: "ESESSION", label: "Online-Fortbildung" },
  { value: "MICRO_SCHILF", label: "Micro-SchiLf" },
  { value: "VIDEO_TUTORIAL", label: "Video-Tutorial" },
] as const;

export type Veranstaltungsformat = ValueOf<typeof VERANSTALTUNGSFORMATE>;

/**
 * Termin, Ort und Teilnehmerzahl sind freiwillig bei SchiLf (Angebot auf
 * Abruf) und bei Video-Tutorials. Überall sonst Pflicht.
 */
export function terminOptional(organisationsform: string, format: string): boolean {
  return organisationsform === "SCHILF" || format === "VIDEO_TUTORIAL";
}

/**
 * Anzeigename für den Ort: der freie Ortstext hat Vorrang, sonst der alte,
 * strukturierte Veranstaltungsort (Archiv, FIBS-Import). `null`, wenn beides
 * fehlt — die aufrufende Stelle zeigt dann selbst "nach Absprache" o. Ä.
 */
export function ortAnzeige(
  ortText: string | null | undefined,
  veranstaltungsort?: { name: string; ort?: string | null } | null,
): string | null {
  if (ortText && ortText.trim()) return ortText.trim();
  if (!veranstaltungsort) return null;
  return veranstaltungsort.ort && !veranstaltungsort.name.includes(veranstaltungsort.ort)
    ? `${veranstaltungsort.name}, ${veranstaltungsort.ort}`
    : veranstaltungsort.name;
}

/**
 * Ort für kompakte Karten: der Ortstext, bei Online-Angeboten oder ohne Ort
 * das Format („Online-Fortbildung“, „Präsenz“).
 */
export function ortFuerKarte(f: {
  format: string;
  ortText: string | null;
  veranstaltungsort: { name: string; ort: string | null; istOnline: boolean } | null;
}): string {
  const ort = ortAnzeige(f.ortText, f.veranstaltungsort);
  return f.veranstaltungsort?.istOnline || !ort ? formatLabel(f.format) : ort;
}

/**
 * Etikett für Karten: Micro-SchiLf und Video-Tutorial heißen nach ihrem
 * Format, alles andere nach der Organisationsform („SchiLf“, „RLFB“).
 */
export function angebotsEtikett(f: { format: string; organisationsform: string }): string {
  return f.format === "MICRO_SCHILF" || f.format === "VIDEO_TUTORIAL"
    ? formatLabel(f.format)
    : organisationsformKurz(f.organisationsform);
}

// ---------------------------------------------------------------------------

/**
 * Schularten. `standard: true` wird im Formular vorausgewählt — das Schulamt
 * Memmingen-Unterallgäu ist für Grund- und Mittelschulen zuständig, alles
 * andere ist der Ausnahmefall.
 */
export const SCHULARTEN = [
  { value: "GRUNDSCHULE", label: "Grundschule", standard: true },
  { value: "MITTELSCHULE", label: "Mittelschule", standard: true },
  { value: "FOERDERSCHULE", label: "Förderschule", standard: false },
  { value: "REALSCHULE", label: "Realschule", standard: false },
  { value: "GYMNASIUM", label: "Gymnasium", standard: false },
  { value: "BERUFLICHE_SCHULE", label: "Berufliche Schule", standard: false },
  { value: "SCHULARTUEBERGREIFEND", label: "Schulartübergreifend", standard: false },
] as const;

export type Schulart = ValueOf<typeof SCHULARTEN>;

/** Auswahl in Maske und Filtern: nur Grund- und Mittelschule. Weitere Werte bleiben gültig für alte Daten. */
export const SCHULARTEN_AUSWAHL = SCHULARTEN.filter((s) => s.value === "GRUNDSCHULE" || s.value === "MITTELSCHULE");

export const SCHULARTEN_STANDARD: Schulart[] = SCHULARTEN.filter(
  (s) => s.standard,
).map((s) => s.value);

// ---------------------------------------------------------------------------

export const NIVEAUSTUFEN = [
  { value: "NIVEAU_I_II", label: "Einsteiger (Niveaustufe I/II)" },
  { value: "NIVEAU_III_IV", label: "Fortgeschrittene (Niveaustufe III/IV)" },
  { value: "NIVEAU_V_VI", label: "Experten (Niveaustufe V/VI)" },
] as const;

export type Niveaustufe = ValueOf<typeof NIVEAUSTUFEN>;

// ---------------------------------------------------------------------------

export const STATUS = [
  {
    value: "ENTWURF",
    label: "Entwurf",
    beschreibung: "In Arbeit. Nur intern sichtbar.",
  },
  {
    value: "EINGEREICHT",
    label: "Zur Freigabe eingereicht",
    beschreibung:
      "Wartet auf Freigabe. Noch nicht öffentlich.",
  },
  {
    value: "VEROEFFENTLICHT",
    label: "Veröffentlicht",
    beschreibung: "Öffentlich sichtbar, auch im Kalender und im ICS-Feed.",
  },
  {
    value: "ABGESAGT",
    label: "Abgesagt",
    beschreibung: "Bleibt sichtbar und ist als abgesagt markiert.",
  },
  {
    value: "ARCHIVIERT",
    label: "Archiviert",
    beschreibung: "Nicht mehr öffentlich. In der Verwaltung weiter auffindbar.",
  },
] as const;

export type FortbildungStatus = ValueOf<typeof STATUS>;

/** Im öffentlichen Frontend sichtbare Status. */
export const STATUS_OEFFENTLICH: FortbildungStatus[] = [
  "VEROEFFENTLICHT",
  "ABGESAGT",
];

/**
 * Status, die Referentinnen und Referenten selbst setzen dürfen.
 *
 * Veröffentlichen ist ausdrücklich der Administration vorbehalten — eine
 * Ausschreibung auf der Seite des Schulamts soll niemand ohne Gegenlesen
 * online stellen können.
 */
export const STATUS_FUER_REFERENTEN: FortbildungStatus[] = [
  "ENTWURF",
  "EINGEREICHT",
];

/**
 * Status, in denen Referentinnen und Referenten ein Thema inhaltlich noch
 * bearbeiten dürfen (nicht: selbst setzen dürfen, siehe STATUS_FUER_REFERENTEN).
 *
 * Ein bereits veröffentlichtes Thema bleibt für sie offen — die Änderung geht
 * sofort online, ohne neue Freigabe. Abgesagt und archiviert
 * bleiben gesperrt, ein Statuswechsel bleibt in jedem Fall der Administration
 * vorbehalten.
 */
export const STATUS_REFERENT_BEARBEITBAR: FortbildungStatus[] = [
  ...STATUS_FUER_REFERENTEN,
  "VEROEFFENTLICHT",
];

/**
 * Veröffentlichen und Freigaben sind ein administrativer Schritt: Nur die
 * Administration kann eine Ausschreibung ins öffentliche Angebot überführen.
 */
export function darfFreigeben(rolle: Rolle): boolean {
  return rolle === "ADMIN";
}

// ---------------------------------------------------------------------------

export const QUELLEN = [
  { value: "MANUELL", label: "Manuell erfasst" },
  { value: "FIBS_IMPORT", label: "Aus FIBS importiert" },
  { value: "ARCHIV_IMPORT", label: "Aus Archiv übernommen" },
] as const;

export type Quelle = ValueOf<typeof QUELLEN>;

// ---------------------------------------------------------------------------

export const ROLLEN = [
  {
    value: "ADMIN",
    label: "Administration",
    beschreibung: "Alle Rechte, inklusive Benutzerverwaltung und Systemtexten.",
  },
  {
    value: "REDAKTEUR",
    label: "Redaktion",
    beschreibung: "Darf Fortbildungen, Referenten, Orte und Schlagworte pflegen.",
  },
  {
    value: "REFERENT",
    label: "Referent",
    beschreibung:
      "Darf eigene Fortbildungen anlegen und pflegen sowie Teilnehmerzahlen für eigene SchiLf nachtragen.",
  },
] as const;

export type Rolle = ValueOf<typeof ROLLEN>;

// ---------------------------------------------------------------------------

/**
 * Funktion einer Person im Digiteam. Referenten tragen Themen ein, bei einer
 * Fachfunktion ist die Themenmaske nur ein Angebot.
 */
export const FUNKTIONEN = [
  { value: "REFERENT", label: "Referent" },
  { value: "FACHFUNKTION", label: "Fachfunktion im Digiteam" },
] as const;

export type Funktion = ValueOf<typeof FUNKTIONEN>;

export const FUNKTION_VALUES = FUNKTIONEN.map((f) => f.value) as [Funktion, ...Funktion[]];

// ---------------------------------------------------------------------------


/** Zeitraum, in dem vergangene Fortbildungen aktiv nachbereitet werden. */
export const NACHBEREITUNG_RUECKBLICK_TAGE = 400;

// ---------------------------------------------------------------------------
// Hilfsfunktionen für Labels

function labelLookup<T extends ReadonlyArray<{ value: string; label: string }>>(
  list: T,
) {
  return (value: string | null | undefined): string => {
    if (!value) return "—";
    return list.find((entry) => entry.value === value)?.label ?? value;
  };
}

export const organisationsformLabel = labelLookup(ORGANISATIONSFORMEN);
export const formatLabel = labelLookup(VERANSTALTUNGSFORMATE);
export const schulartLabel = labelLookup(SCHULARTEN);
export const niveaustufeLabel = labelLookup(NIVEAUSTUFEN);
export const statusLabel = labelLookup(STATUS);
export const rolleLabel = labelLookup(ROLLEN);
export const funktionLabel = labelLookup(FUNKTIONEN);

/** Reine Werte-Arrays, wie zod sie für `z.enum()` erwartet. */
export const ORGANISATIONSFORM_VALUES = ORGANISATIONSFORMEN.map((o) => o.value) as [
  Organisationsform,
  ...Organisationsform[],
];
export const FORMAT_VALUES = VERANSTALTUNGSFORMATE.map((f) => f.value) as [
  Veranstaltungsformat,
  ...Veranstaltungsformat[],
];
export const SCHULART_VALUES = SCHULARTEN.map((s) => s.value) as [
  Schulart,
  ...Schulart[],
];
export const NIVEAUSTUFE_VALUES = NIVEAUSTUFEN.map((n) => n.value) as [
  Niveaustufe,
  ...Niveaustufe[],
];
export const STATUS_VALUES = STATUS.map((s) => s.value) as [
  FortbildungStatus,
  ...FortbildungStatus[],
];
export const ROLLE_VALUES = ROLLEN.map((r) => r.value) as [Rolle, ...Rolle[]];
