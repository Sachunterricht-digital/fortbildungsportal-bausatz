import { parseDeDateTime } from "@/lib/datetime";
import { sanitizeBeschreibung, htmlZuText } from "@/lib/sanitize";
import { SCHULARTEN_STANDARD } from "@/constants/fortbildung";

import type { FibsRohLehrgang } from "./types";

/** Ergebnis des Mappings — entweder verwertbar oder mit Begründung verworfen. */
export type MappingErgebnis =
  | { ok: true; daten: GemappteFortbildung }
  | { ok: false; grund: string };

export interface GemappteFortbildung {
  externalId: string;
  fibsLehrgangsnummer: string;
  fibsUrl: string | null;
  titel: string;
  beschreibungHtml: string;
  beschreibungText: string;
  beginn: Date;
  ende: Date;
  format: string;
  maxTn: number;
  schularten: string[];
  /** Name des Ortes aus FIBS — die Zuordnung passiert im Importer. */
  ortName: string | null;
  ortIstOnline: boolean;
}

/**
 * Übersetzt einen FIBS-Rohdatensatz in unser Modell.
 *
 * Alles, was FIBS nicht liefert (Organisationsform, DigCompEdu-Zuordnung,
 * Schlagworte über die Pflicht-Tags hinaus), bleibt bewusst leer — der Import
 * ist eine Vorlage, keine fertige Ausschreibung. Die Redaktion ergänzt das im
 * Formular.
 */
export function mapFibsLehrgang(
  roh: FibsRohLehrgang,
  basisUrl: string,
): MappingErgebnis {
  const beginn = roh.beginn ? parseDeDateTime(roh.beginn) : null;
  if (!beginn) {
    return { ok: false, grund: `Beginn nicht lesbar ("${roh.beginn ?? "fehlt"}")` };
  }

  // Fehlt das Ende, wird ein Standard-Zeitfenster angenommen und die Redaktion
  // korrigiert es — besser als den Datensatz ganz zu verwerfen.
  const ende =
    (roh.ende ? parseDeDateTime(roh.ende) : null) ??
    new Date(beginn.getTime() + 2 * 60 * 60 * 1000);

  if (ende <= beginn) {
    return { ok: false, grund: "Ende liegt nicht nach dem Beginn" };
  }

  const beschreibungHtml = sanitizeBeschreibung(
    roh.beschreibung ? `<p>${escapeHtml(roh.beschreibung)}</p>` : "",
  );

  const online = istOnline(roh.format, roh.ort);

  return {
    ok: true,
    daten: {
      externalId: `fibs:${roh.lehrgangsnummer}`,
      fibsLehrgangsnummer: roh.lehrgangsnummer,
      fibsUrl: roh.detailUrl ? absolut(roh.detailUrl, basisUrl) : null,
      titel: roh.titel.slice(0, 200),
      beschreibungHtml,
      beschreibungText: htmlZuText(beschreibungHtml),
      beginn,
      ende,
      format: online ? "ESESSION" : "PRAESENZ",
      maxTn: leseZahl(roh.maxTn) ?? 20,
      schularten: leseSchularten(roh.zielgruppe),
      ortName: roh.ort?.trim() || null,
      ortIstOnline: online,
    },
  };
}

function istOnline(format: string | undefined, ort: string | undefined): boolean {
  const text = `${format ?? ""} ${ort ?? ""}`.toLowerCase();
  return /esession|online|webinar|virtuell/.test(text);
}

function leseZahl(wert: string | undefined): number | null {
  if (!wert) return null;
  const treffer = /\d{1,4}/.exec(wert);
  if (!treffer) return null;
  const zahl = Number(treffer[0]);
  return zahl >= 1 && zahl <= 1000 ? zahl : null;
}

/** Erkennt Schularten in der Zielgruppen-Angabe; sonst der Standard GS/MS. */
function leseSchularten(zielgruppe: string | undefined): string[] {
  if (!zielgruppe) return [...SCHULARTEN_STANDARD];

  const text = zielgruppe.toLowerCase();
  const treffer: string[] = [];

  if (/grundschul/.test(text)) treffer.push("GRUNDSCHULE");
  if (/mittelschul|hauptschul/.test(text)) treffer.push("MITTELSCHULE");
  if (/förderschul|foerderschul|förderzentrum/.test(text)) treffer.push("FOERDERSCHULE");
  if (/realschul/.test(text)) treffer.push("REALSCHULE");
  if (/gymnasi/.test(text)) treffer.push("GYMNASIUM");
  if (/berufsschul|berufliche/.test(text)) treffer.push("BERUFLICHE_SCHULE");
  if (/schulartübergreifend|schulartuebergreifend/.test(text)) {
    treffer.push("SCHULARTUEBERGREIFEND");
  }

  return treffer.length > 0 ? treffer : [...SCHULARTEN_STANDARD];
}

function absolut(href: string, basisUrl: string): string {
  try {
    return new URL(href, basisUrl).toString();
  } catch {
    return href;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
