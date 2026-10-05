import * as cheerio from "cheerio";

import type { FibsRohLehrgang } from "./types";

/**
 * Zerlegt eine FIBS-Suchergebnisseite in einzelne Lehrgänge.
 *
 * ACHTUNG: Die Selektoren unten sind eine begründete Annahme, keine geprüfte
 * Tatsache — die tatsächliche Seitenstruktur von FIBS lag bei der Entwicklung
 * nicht vor. Sie sind deshalb an einer Stelle gebündelt und über die
 * Fixture-Datei `fixtures/suchergebnis.html` testbar.
 *
 * Vorgehen beim Scharfschalten:
 *   1. Eine echte Suchergebnisseite als fixtures/suchergebnis.html speichern.
 *   2. `npm run fibs:parser-test` laufen lassen.
 *   3. SELEKTOREN unten anpassen, bis die erwarteten Felder herausfallen.
 *
 * Die Alternative — eine offizielle Schnittstelle — bleibt vorzuziehen,
 * siehe Hinweis in client.ts.
 */

const SELEKTOREN = {
  /** Container eines Treffers in der Ergebnisliste. */
  treffer: "[data-lehrgang], .lehrgang-treffer, .search-result, tr.lehrgang",
  lehrgangsnummer: ".lehrgangsnummer, [data-lehrgangsnummer], td.nummer",
  titel: ".lehrgang-titel, h3, td.titel, a.titel",
  beschreibung: ".lehrgang-beschreibung, .beschreibung, td.beschreibung",
  beginn: ".lehrgang-beginn, [data-beginn], td.beginn",
  ende: ".lehrgang-ende, [data-ende], td.ende",
  ort: ".lehrgang-ort, [data-ort], td.ort",
  format: ".lehrgang-format, td.format",
  maxTn: ".lehrgang-maxtn, td.maxtn",
  zielgruppe: ".lehrgang-zielgruppe, td.zielgruppe",
  detailLink: "a[href*='lehrgang']",
} as const;

/** Erkennt eine Lehrgangsnummer auch dann, wenn kein passender Container greift. */
const NUMMER_MUSTER = /\b([A-Z]\d{2,4}[-/][\w/.-]{2,20})\b/;

export function parseSuchergebnis(html: string): FibsRohLehrgang[] {
  const $ = cheerio.load(html);
  const lehrgaenge: FibsRohLehrgang[] = [];

  $(SELEKTOREN.treffer).each((_, element) => {
    const $treffer = $(element);

    const text = (selektor: string): string | undefined => {
      const wert = $treffer.find(selektor).first().text().trim();
      return wert || undefined;
    };

    const nummer =
      text(SELEKTOREN.lehrgangsnummer) ??
      NUMMER_MUSTER.exec($treffer.text())?.[1];

    const titel = text(SELEKTOREN.titel);

    // Ohne Nummer und Titel ist der Eintrag wertlos: Die Nummer ist der
    // Schlüssel für das Deduplizieren, der Titel das Pflichtfeld.
    if (!nummer || !titel) return;

    const href = $treffer.find(SELEKTOREN.detailLink).first().attr("href");

    lehrgaenge.push({
      lehrgangsnummer: nummer,
      titel,
      beschreibung: text(SELEKTOREN.beschreibung),
      beginn: text(SELEKTOREN.beginn),
      ende: text(SELEKTOREN.ende),
      ort: text(SELEKTOREN.ort),
      format: text(SELEKTOREN.format),
      maxTn: text(SELEKTOREN.maxTn),
      zielgruppe: text(SELEKTOREN.zielgruppe),
      detailUrl: href,
    });
  });

  return lehrgaenge;
}
