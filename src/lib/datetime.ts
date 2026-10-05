import { T } from "@/texte/de";
/**
 * Datum und Uhrzeit — deutsch formatiert, immer in Europe/Berlin.
 *
 * In der Datenbank steht alles als UTC. Jede Anzeige und jede Eingabe läuft
 * über diese Funktionen, damit es keine Zeitzonen-Verschiebung zwischen
 * Server-Rendering und Browser gibt (der Server läuft je nach Hosting in UTC).
 */

const ZEITZONE = "Europe/Berlin";

const datumFormat = new Intl.DateTimeFormat("de-DE", {
  timeZone: ZEITZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const datumZeitFormat = new Intl.DateTimeFormat("de-DE", {
  timeZone: ZEITZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const zeitFormat = new Intl.DateTimeFormat("de-DE", {
  timeZone: ZEITZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const langFormat = new Intl.DateTimeFormat("de-DE", {
  timeZone: ZEITZONE,
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const monatJahrFormat = new Intl.DateTimeFormat("de-DE", {
  timeZone: ZEITZONE,
  month: "long",
  year: "numeric",
});

/** Montag bis Sonntag — als gemeinsame Grundlage aller Monatsraster. */
export const WOCHENTAGE_KURZ = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

/** "31.07.2026" */
export function formatDatum(date: Date | null | undefined): string {
  if (!date) return T.allgemein.aufAbruf;
  return datumFormat.format(date);
}

/** "31.07.2026, 14:30" */
export function formatDatumZeit(date: Date | null | undefined): string {
  if (!date) return T.allgemein.aufAbruf;
  return datumZeitFormat.format(date);
}

/** "14:30" */
export function formatZeit(date: Date | null | undefined): string {
  if (!date) return "";
  return zeitFormat.format(date);
}

/** "Freitag, 31. Juli 2026" */
export function formatDatumLang(date: Date | null | undefined): string {
  if (!date) return T.allgemein.aufAbruf;
  return langFormat.format(date);
}

/** "Juli 2026" */
export function formatMonatJahr(date: Date): string {
  return monatJahrFormat.format(date);
}

/** "31.07.2026 14:30" für sichtbare Datums-/Zeit-Eingabefelder. */
export function formatDatumZeitEingabe(date: Date | null | undefined): string {
  return date ? `${formatDatum(date)} ${formatZeit(date)}` : "";
}

/**
 * Zeitraum kompakt: am selben Tag "31.07.2026, 14:30 – 17:00",
 * sonst "31.07.2026, 14:30 – 01.08.2026, 12:00".
 */
/** Ohne Termin (SchiLf auf Abruf, Video-Tutorial) steht "auf Abruf". */
export function formatZeitraum(
  beginn: Date | null | undefined,
  ende: Date | null | undefined,
): string {
  if (!beginn || !ende) return T.allgemein.aufAbruf;
  const gleicherTag = formatDatum(beginn) === formatDatum(ende);
  return gleicherTag
    ? `${formatDatumZeit(beginn)} – ${formatZeit(ende)} Uhr`
    : `${formatDatumZeit(beginn)} – ${formatDatumZeit(ende)} Uhr`;
}

/**
 * Wert für `<input type="datetime-local">`: "2026-07-31T14:30".
 *
 * Das Input-Element kennt keine Zeitzonen, es zeigt exakt die Ziffern, die es
 * bekommt. Deshalb werden hier die Berliner Wanduhr-Werte gebildet, nicht
 * `toISOString()` (das wäre UTC und im Sommer zwei Stunden zu früh).
 */
export function toDatetimeLocalValue(date: Date | null | undefined): string {
  if (!date) return "";

  const teile = new Intl.DateTimeFormat("sv-SE", {
    timeZone: ZEITZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  // sv-SE liefert "2026-07-31 14:30" — das Input erwartet ein "T".
  return teile.replace(" ", "T");
}

/**
 * Gegenstück: der String aus `<input type="datetime-local">` ist Berliner
 * Ortszeit ohne Zeitzonen-Angabe und wird hier nach UTC umgerechnet.
 */
export function fromDatetimeLocalValue(value: string): Date | null {
  const treffer = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (!treffer) return null;

  return berlinNachUtc(
    Number(treffer[1]),
    Number(treffer[2]),
    Number(treffer[3]),
    Number(treffer[4]),
    Number(treffer[5]),
  );
}

/**
 * Liest die sichtbare deutsche Schreibweise `TT.MM.JJJJ HH:MM`.
 *
 * Im Gegensatz zu `parseDeDateTime()` ist eine Uhrzeit hier Pflicht: Ein
 * Fortbildungstermin ohne Uhrzeit darf nicht stillschweigend um Mitternacht
 * gespeichert werden. Ein Komma zwischen Datum und Zeit akzeptieren wir als
 * freundliche Variante der vom Browser kopierten Darstellung.
 */
export function parseDatumZeitEingabe(value: string): Date | null {
  const bereinigt = value.trim();
  if (!/^\d{1,2}\.\d{1,2}\.\d{4}(?:[\s,]+)\d{1,2}[:.]\d{2}$/.test(bereinigt)) {
    return null;
  }
  return parseDeDateTime(bereinigt);
}

/**
 * Parst deutsche Schreibweise "31.07.2026 14:30" bzw. "31.07.2026".
 * Gebraucht für den FIBS-Import und für Tabellen-Importe.
 */
export function parseDeDateTime(value: string): Date | null {
  const treffer =
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[,\s]+(\d{1,2})[:.](\d{2}))?/.exec(value.trim());
  if (!treffer) return null;

  const tag = Number(treffer[1]);
  const monat = Number(treffer[2]);
  const jahr = Number(treffer[3]);
  const stunde = treffer[4] ? Number(treffer[4]) : 0;
  const minute = treffer[5] ? Number(treffer[5]) : 0;

  if (monat < 1 || monat > 12 || tag < 1 || tag > 31) return null;
  if (stunde > 23 || minute > 59) return null;

  const datum = berlinNachUtc(jahr, monat, tag, stunde, minute);

  // Rundlauf-Prüfung fängt Eingaben wie "31.02.2026" ab, die JS sonst
  // klaglos auf den 3. März weiterdreht.
  return formatDatum(datum) ===
    `${String(tag).padStart(2, "0")}.${String(monat).padStart(2, "0")}.${jahr}`
    ? datum
    : null;
}

/**
 * Berliner Wanduhrzeit → UTC-Date.
 *
 * Der Versatz (CET/CEST) hängt vom Datum selbst ab, deshalb wird er über eine
 * Probe ermittelt: erst als UTC annehmen, dann messen, wie weit Berlin an
 * diesem Zeitpunkt davon abweicht, und korrigieren.
 */
function berlinNachUtc(
  jahr: number,
  monat: number,
  tag: number,
  stunde: number,
  minute: number,
): Date {
  const alsUtc = Date.UTC(jahr, monat - 1, tag, stunde, minute);
  const versatz = zeitzonenVersatz(new Date(alsUtc));

  // Zweiter Durchlauf: an Umstellungstagen kann der erste Versatz noch der
  // der alten Zeit sein.
  const korrigiert = alsUtc - versatz;
  const versatz2 = zeitzonenVersatz(new Date(korrigiert));

  return new Date(alsUtc - versatz2);
}

/** Versatz von Europe/Berlin gegenüber UTC in Millisekunden. */
function zeitzonenVersatz(zeitpunkt: Date): number {
  const berlin = new Date(
    zeitpunkt.toLocaleString("en-US", { timeZone: ZEITZONE }),
  );
  const utc = new Date(zeitpunkt.toLocaleString("en-US", { timeZone: "UTC" }));
  return berlin.getTime() - utc.getTime();
}

/**
 * Datum als "2026-09-15" — nach Berliner Ortszeit.
 *
 * Nicht `toISOString().slice(0,10)` verwenden: Ein Termin am 15.09. um 01:00
 * Berliner Zeit ist in UTC noch der 14.09. und landete sonst im falschen
 * Kalendertag.
 */
export function berlinIsoDatum(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: ZEITZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Kalendertag aus "2026-11-09" als Date (Mittag UTC), geeignet für Spalten
 * vom Typ `@db.Date`. Gibt null zurück, wenn der Text kein echter Tag ist
 * (etwa "2026-02-30").
 */
export function kalendertagAusIso(iso: string): Date | null {
  const treffer = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!treffer) return null;
  const [jahr, monat, tag] = [Number(treffer[1]), Number(treffer[2]), Number(treffer[3])];
  const datum = new Date(Date.UTC(jahr, monat - 1, tag, 12));
  const echt =
    datum.getUTCFullYear() === jahr &&
    datum.getUTCMonth() === monat - 1 &&
    datum.getUTCDate() === tag;
  return echt ? datum : null;
}

/** Kurzform für Tabellenköpfe: "Mo 09.11." */
export function formatKalendertagKurz(date: Date): string {
  const [, monat, tag] = berlinIsoDatum(date).split("-");
  return `${WOCHENTAGE_KURZ[montagIndex(date)]} ${tag}.${monat}.`;
}

/** Wochentag nach europäischer Konvention: Montag = 0, Sonntag = 6. */
export function montagIndex(date: Date): number {
  return (new Date(`${berlinIsoDatum(date)}T12:00:00Z`).getUTCDay() + 6) % 7;
}

/** Monatsanfang/-wechsel für Kalender, als zeitzonenunabhängiger Mittagsanker. */
export function kalenderMonat(date: Date, versatz = 0): Date {
  const [jahr, monat] = berlinIsoDatum(date).split("-").map(Number);
  return new Date(Date.UTC(jahr, monat - 1 + versatz, 1, 12));
}

/** Sechs volle Wochen, immer Montag zuerst; Datumsanker liegen mittags UTC. */
export function kalenderTage(monat: Date): Date[] {
  const anfang = kalenderMonat(monat);
  const start = 1 - montagIndex(anfang);
  return Array.from({ length: 42 }, (_, index) =>
    new Date(Date.UTC(anfang.getUTCFullYear(), anfang.getUTCMonth(), start + index, 12)),
  );
}

/** ISO-8601-Kalenderwoche nach Berliner Kalendertag. */
export function isoKalenderwoche(date: Date): number {
  const donnerstag = new Date(`${berlinIsoDatum(date)}T12:00:00Z`);
  donnerstag.setUTCDate(donnerstag.getUTCDate() - montagIndex(date) + 3);

  const ersterDonnerstag = new Date(Date.UTC(donnerstag.getUTCFullYear(), 0, 4));
  ersterDonnerstag.setUTCDate(
    ersterDonnerstag.getUTCDate() - ((ersterDonnerstag.getUTCDay() + 6) % 7) + 3,
  );

  return 1 + Math.round((donnerstag.getTime() - ersterDonnerstag.getTime()) / 604_800_000);
}

/** Beginn des Tages (00:00 Berliner Zeit) als UTC-Date. */
export function tagesBeginn(date: Date): Date {
  const teile = new Intl.DateTimeFormat("sv-SE", {
    timeZone: ZEITZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .split("-");

  return berlinNachUtc(
    Number(teile[0]),
    Number(teile[1]),
    Number(teile[2]),
    0,
    0,
  );
}

/**
 * Aktuelles Schuljahr in bayerischer Schreibweise, z. B. "2026/2027".
 * Wechsel zum 1. August.
 */
export function aktuellesSchuljahr(heute: Date = new Date()): string {
  const jahr = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: ZEITZONE, year: "numeric" }).format(
      heute,
    ),
  );
  const monat = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: ZEITZONE, month: "numeric" }).format(
      heute,
    ),
  );

  return monat >= 8 ? `${jahr}/${jahr + 1}` : `${jahr - 1}/${jahr}`;
}

/**
 * Aktuelles Schuljahr in der Kurzform für Überschriften, z. B. "2026/27".
 * Wechsel wie bei `aktuellesSchuljahr()` zum 1. August.
 */
export function aktuellesSchuljahrKurz(heute: Date = new Date()): string {
  const [von, bis] = aktuellesSchuljahr(heute).split("/");
  return `${von}/${bis.slice(2)}`;
}

/** Zeitraum eines Schuljahres: 1. August bis 31. Juli. */
export function schuljahrZeitraum(schuljahr: string): { start: Date; ende: Date } {
  const start = Number(schuljahr.slice(0, 4));
  return {
    start: berlinNachUtc(start, 8, 1, 0, 0),
    ende: berlinNachUtc(start + 1, 7, 31, 23, 59),
  };
}
