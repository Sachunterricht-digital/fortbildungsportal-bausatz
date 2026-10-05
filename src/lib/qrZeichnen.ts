import "server-only";

import type { jsPDF } from "jspdf";

import { qrMatrix } from "@/lib/qr";

/**
 * Zeichnet einen QR-Code gestaltet in ein PDF.
 *
 * Statt harter schwarzer Quadrate: abgerundete Datenpunkte und Sucher mit
 * abgerundeten Ecken, in der Hausfarbe. Das ist keine Spielerei — ein Aushang
 * im Lehrerzimmer konkurriert mit zwanzig anderen Zetteln.
 *
 * Die Gestaltung bleibt dabei innerhalb dessen, was die Norm erlaubt:
 * Modulform und Farbe sind frei, solange der Kontrast stimmt und die
 * Ruhezone frei bleibt. Die Fehlerkorrektur steht auf H (rund 30 %), damit
 * das Logo in der Mitte nichts kaputt macht.
 */

export interface QrGestaltung {
  /** Linke obere Ecke in Millimetern. */
  x: number;
  y: number;
  /** Kantenlänge des Codes ohne Ruhezone, in Millimetern. */
  groesse: number;
  /** Modulfarbe als RGB 0–255. */
  farbe: [number, number, number];
  /** Optionales Logo für die Mitte. */
  logo?: { daten: string; format: "PNG" | "JPEG"; seitenverhaeltnis: number };
}

export function zeichneQr(doc: jsPDF, text: string, stil: QrGestaltung): void {
  const { module, groesse: n } = qrMatrix(text, "H");
  const modulGroesse = stil.groesse / n;

  doc.setFillColor(...stil.farbe);

  // Die drei Sucher werden eigens gezeichnet — als Ring mit abgerundeten
  // Ecken statt als Klotz aus 49 Einzelmodulen.
  const sucherEcken: Array<[number, number]> = [
    [0, 0],
    [0, n - 7],
    [n - 7, 0],
  ];

  const imSucher = (zeile: number, spalte: number): boolean =>
    sucherEcken.some(
      ([z0, s0]) => zeile >= z0 && zeile < z0 + 7 && spalte >= s0 && spalte < s0 + 7,
    );

  // Aussparung für das Logo: nur so groß, dass die Fehlerkorrektur sie
  // sicher ausgleicht (siehe Nachweis in scripts/pruefungen.ts).
  const logoFeld = stil.logo ? Math.round(n * 0.22) : 0;
  const logoVon = Math.floor((n - logoFeld) / 2);
  const imLogo = (zeile: number, spalte: number): boolean =>
    logoFeld > 0 &&
    zeile >= logoVon &&
    zeile < logoVon + logoFeld &&
    spalte >= logoVon &&
    spalte < logoVon + logoFeld;

  // --- Datenmodule als abgerundete Punkte ---------------------------------
  const punkt = modulGroesse * 0.86;
  const versatz = (modulGroesse - punkt) / 2;

  for (let zeile = 0; zeile < n; zeile += 1) {
    for (let spalte = 0; spalte < n; spalte += 1) {
      if (!module[zeile]![spalte]) continue;
      if (imSucher(zeile, spalte) || imLogo(zeile, spalte)) continue;

      doc.roundedRect(
        stil.x + spalte * modulGroesse + versatz,
        stil.y + zeile * modulGroesse + versatz,
        punkt,
        punkt,
        punkt * 0.35,
        punkt * 0.35,
        "F",
      );
    }
  }

  // --- Sucher ------------------------------------------------------------
  for (const [z0, s0] of sucherEcken) {
    const x = stil.x + s0 * modulGroesse;
    const y = stil.y + z0 * modulGroesse;
    const kante = 7 * modulGroesse;

    // Äußerer Ring: gefülltes Quadrat, dann weiß ausgestanzt
    doc.setFillColor(...stil.farbe);
    doc.roundedRect(x, y, kante, kante, modulGroesse * 1.6, modulGroesse * 1.6, "F");

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(
      x + modulGroesse,
      y + modulGroesse,
      kante - 2 * modulGroesse,
      kante - 2 * modulGroesse,
      modulGroesse * 1.1,
      modulGroesse * 1.1,
      "F",
    );

    doc.setFillColor(...stil.farbe);
    doc.roundedRect(
      x + 2 * modulGroesse,
      y + 2 * modulGroesse,
      3 * modulGroesse,
      3 * modulGroesse,
      modulGroesse * 0.9,
      modulGroesse * 0.9,
      "F",
    );
  }

  // --- Logo --------------------------------------------------------------
  if (stil.logo && logoFeld > 0) {
    const feld = logoFeld * modulGroesse;
    const x = stil.x + logoVon * modulGroesse;
    const y = stil.y + logoVon * modulGroesse;

    // Weißer Grund mit etwas Luft, damit das Logo nicht in den Modulen klebt
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(
      x - modulGroesse * 0.4,
      y - modulGroesse * 0.4,
      feld + modulGroesse * 0.8,
      feld + modulGroesse * 0.8,
      modulGroesse,
      modulGroesse,
      "F",
    );

    // Seitenverhältnis wahren, damit das Logo nicht verzerrt
    const breite = stil.logo.seitenverhaeltnis >= 1 ? feld : feld * stil.logo.seitenverhaeltnis;
    const hoehe = stil.logo.seitenverhaeltnis >= 1 ? feld / stil.logo.seitenverhaeltnis : feld;

    doc.addImage(
      stil.logo.daten,
      stil.logo.format,
      x + (feld - breite) / 2,
      y + (feld - hoehe) / 2,
      breite,
      hoehe,
    );
  }
}
