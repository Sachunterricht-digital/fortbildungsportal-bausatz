import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Lädt das Logo des Schulamts für die PDF-Ausgabe.
 *
 * Erwartet wird `public/logo.png` (oder .jpg). Fehlt die Datei, wird ohne
 * Logo gezeichnet — der QR-Code bleibt vollständig und lesbar, der Aushang
 * sieht nur nüchterner aus. Bewusst kein Platzhalterbild: Ein falsches Logo
 * auf einem amtlichen Aushang wäre schlimmer als gar keins.
 */

export interface GeladenesLogo {
  daten: string;
  format: "PNG" | "JPEG";
  /** Breite geteilt durch Höhe. */
  seitenverhaeltnis: number;
}

let zwischenspeicher: GeladenesLogo | null | undefined;

export async function ladeLogo(): Promise<GeladenesLogo | null> {
  if (zwischenspeicher !== undefined) return zwischenspeicher;

  for (const datei of ["logo.png", "logo.jpg", "logo.jpeg"] as const) {
    try {
      const pfad = path.join(process.cwd(), "public", datei);
      const inhalt = await readFile(pfad);
      const format = datei.endsWith(".png") ? "PNG" : "JPEG";
      const masse = format === "PNG" ? pngMasse(inhalt) : jpegMasse(inhalt);

      zwischenspeicher = {
        daten: `data:image/${format === "PNG" ? "png" : "jpeg"};base64,${inhalt.toString("base64")}`,
        format,
        seitenverhaeltnis: masse ? masse.breite / masse.hoehe : 1,
      };
      return zwischenspeicher;
    } catch {
      // nächste Endung versuchen
    }
  }

  zwischenspeicher = null;
  return null;
}

/** Breite und Höhe aus dem IHDR-Block einer PNG-Datei. */
function pngMasse(daten: Buffer): { breite: number; hoehe: number } | null {
  if (daten.length < 24 || daten.toString("ascii", 12, 16) !== "IHDR") return null;
  return { breite: daten.readUInt32BE(16), hoehe: daten.readUInt32BE(20) };
}

/** Breite und Höhe aus dem SOF-Segment einer JPEG-Datei. */
function jpegMasse(daten: Buffer): { breite: number; hoehe: number } | null {
  let i = 2;
  while (i < daten.length - 9) {
    if (daten[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = daten[i + 1]!;
    // SOF0–SOF15, ohne die Marker ohne Bildmaße
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { hoehe: daten.readUInt16BE(i + 5), breite: daten.readUInt16BE(i + 7) };
    }
    i += 2 + daten.readUInt16BE(i + 2);
  }
  return null;
}
