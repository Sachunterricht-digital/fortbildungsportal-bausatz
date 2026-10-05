/**
 * Datenstrukturen der FIBS-Anbindung.
 *
 * Die Schicht ist bewusst als Adapter geschnitten: `client` holt Rohdaten,
 * `parser` macht daraus `FibsRohLehrgang`, `mapper` übersetzt in unser Modell.
 * Stellt FIBS irgendwann eine echte Schnittstelle bereit, wird nur `client`
 * und `parser` ausgetauscht — Mapping, Import und Oberfläche bleiben.
 */

/** Ein Lehrgang, so wie er aus FIBS gelesen wurde — noch ungeprüft. */
export interface FibsRohLehrgang {
  /** Lehrgangsnummer, z. B. "E123-4/56/7" — dient als stabiler Schlüssel. */
  lehrgangsnummer: string;
  titel: string;
  beschreibung?: string;
  /** Roh, wie auf der Seite: "15.09.2026 14:00" */
  beginn?: string;
  ende?: string;
  ort?: string;
  format?: string;
  maxTn?: string;
  zielgruppe?: string;
  detailUrl?: string;
}

export interface FibsImportOptionen {
  /** true = nur anzeigen, nichts schreiben. Voreinstellung. */
  dryRun?: boolean;
  /** Überschreibt die Suchbegriffe aus den Schlagworten. */
  suchbegriffe?: string[];
  /** Obergrenze, damit ein Fehlgriff nicht Hunderte Einträge anlegt. */
  maxTreffer?: number;
}

export interface FibsVorschauZeile {
  lehrgangsnummer: string;
  titel: string;
  beginn: string | null;
  ende: string | null;
  ort: string | null;
  /** Was der Import mit diesem Datensatz täte. */
  aktion: "neu" | "aktualisiert" | "uebersprungen";
  /** Warum übersprungen bzw. was fehlt. */
  hinweis?: string;
}

export interface FibsImportErgebnis {
  jobId: string;
  dryRun: boolean;
  suchbegriffe: string[];
  gefunden: number;
  neu: number;
  aktualisiert: number;
  uebersprungen: number;
  zeilen: FibsVorschauZeile[];
  fehler?: string;
}
