/**
 * Reine Hilfen für den Teambereich (Karten, Steckbrief). Ohne Datenbank, damit
 * `npm test` sie prüfen kann. Die Abfragen stehen in `mitgliederDaten.ts`.
 */
import { T } from "@/texte/de";

/** Eine Person, wie Raster und Slider sie als Karte brauchen. */
export type MitgliedKarte = {
  id: string;
  name: string;
  initialen: string;
  /** Zeitpunkt des Foto-Uploads in Millisekunden, null ohne Foto. */
  fotoVersion: number | null;
  schule: string | null;
  funktion: string;
  schwerpunkte: string[];
  anzahlSchilf: number;
  anzahlFortbildungen: number;
};

/** Erster Buchstabe von Vor- und Nachname, groß. */
export function initialen(vorname: string, nachname: string): string {
  return `${[...vorname.trim()][0] ?? ""}${[...nachname.trim()][0] ?? ""}`.toUpperCase() || "?";
}

/**
 * Schwerpunkte stehen im Profil als Freitext, mit Komma getrennt. Leere
 * Einträge fallen weg, doppelte auch (ohne Rücksicht auf Groß- und Kleinschreibung).
 */
export function schwerpunkteListe(roh: string | null | undefined, hoechstens = Infinity): string[] {
  if (!roh) return [];
  const gesehen = new Set<string>();
  const liste: string[] = [];
  for (const eintrag of roh.split(",")) {
    const text = eintrag.trim();
    const schluessel = text.toLowerCase();
    if (!text || gesehen.has(schluessel)) continue;
    gesehen.add(schluessel);
    liste.push(text);
  }
  return liste.slice(0, hoechstens);
}

/** Drei Farbvarianten für die Initialen, je Person stabil. */
export function portraetVariante(id: string): 0 | 1 | 2 {
  let summe = 0;
  for (let i = 0; i < id.length; i += 1) summe += id.charCodeAt(i);
  return (summe % 3) as 0 | 1 | 2;
}

/** „2 SchiLf · 1 Fortbildung“. Leer, wenn es nichts zu zählen gibt. */
export function angebotsZaehler(anzahlSchilf: number, anzahlFortbildungen: number): string {
  const teile: string[] = [];
  if (anzahlSchilf > 0) teile.push(T.referenten.anzahlSchilf(anzahlSchilf));
  if (anzahlFortbildungen > 0) teile.push(T.referenten.anzahlFortbildungen(anzahlFortbildungen));
  return teile.join(" · ");
}

/** Beschriftung der Funktion. Alles außer Fachfunktion gilt als Referent. */
export function funktionsEtikett(funktion: string): string {
  return funktion === "FACHFUNKTION" ? T.referenten.funktion.FACHFUNKTION : T.referenten.funktion.REFERENT;
}

/** Kurzprofil für die Anzeige: Zeilenwechsel vereinheitlichen, mehr als eine Leerzeile kürzen. */
export function profilText(roh: string | null | undefined): string {
  return (roh ?? "").replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
