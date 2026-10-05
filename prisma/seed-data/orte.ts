/**
 * Veranstaltungsorte: Grund- und Mittelschulen im Landkreis Unterallgäu und
 * in der Stadt Memmingen, dazu der Sonderfall "ViKo (online)" für eSessions.
 *
 * Quelle: Schulverzeichnis des Staatlichen Schulamts, abgerufen am 31.07.2026
 *   https://schulamt.unterallgaeu.de/schulamt/schulverzeichnis/grundschulen-und-mittelschulen/im-landkreis-unterallgaeu
 *   https://schulamt.unterallgaeu.de/schulamt/schulverzeichnis/grundschulen-und-mittelschulen/in-der-stadt-memmingen
 *
 * Namen und Anschriften sind unverändert übernommen. Ändert sich etwas
 * (Zusammenlegung, Umbenennung, Umzug), lässt sich das entweder hier pflegen
 * und neu seeden oder direkt unter /admin/orte bearbeiten — der Seed arbeitet
 * mit upsert und überschreibt bestehende Einträge nicht destruktiv.
 */

export interface OrtSeed {
  name: string;
  ort?: string;
  strasse?: string;
  istOnline?: boolean;
  sortOrder?: number;
}

/** Sortierung: Online zuerst, dann Schulamt, dann Memmingen, dann Landkreis. */
const SORT_ONLINE = 0;
const SORT_SCHULAMT = 1;
const SORT_MEMMINGEN = 10;
const SORT_LANDKREIS = 20;

/** Grund- und Mittelschulen in der Stadt Memmingen. */
const MEMMINGEN: OrtSeed[] = [
  { name: "Bismarckschule, Mittelschule Memmingen", strasse: "St.-Josefs-Kirchplatz 1", ort: "Memmingen" },
  { name: "Edith-Stein-Schule, Grundschule Memmingen", strasse: "Kneippstraße 22", ort: "Memmingen" },
  { name: "Elsbethenschule, Grundschule Memmingen", strasse: "St.-Josefs-Kirchplatz 3", ort: "Memmingen" },
  { name: "Lindenschule, Mittelschule Memmingen", strasse: "Maserstraße 2", ort: "Memmingen" },
  { name: "Theodor-Heuss-Schule, Grundschule Memmingen", strasse: "Machnigstraße 8", ort: "Memmingen" },
  { name: "Grundschule Memmingen-Amendingen", strasse: "Waimerstraße 10", ort: "Memmingen" },
  { name: "Mittelschule Memmingen-Amendingen", strasse: "Waimerstraße 10", ort: "Memmingen" },
  { name: "Grundschule Memmingen-Dickenreishausen", strasse: "Oberdorfstraße 34", ort: "Memmingen" },
  { name: "Grundschule Memmingen-Steinheim", strasse: "Schulweg 2", ort: "Memmingen" },
  { name: "Grundschule St. Aloysius, Privatschule Memmingen", strasse: "Pfarrhofstraße 6", ort: "Memmingen" },
];

/** Grund- und Mittelschulen im Landkreis Unterallgäu. */
const LANDKREIS: OrtSeed[] = [
  { name: "Grundschule Babenhausen", strasse: "Pestalozzistraße 10", ort: "Babenhausen" },
  { name: "Mittelschule Babenhausen", strasse: "Pestalozzistraße 7", ort: "Babenhausen" },
  { name: "Sebastian-Kneipp-Grundschule Bad Grönenbach", strasse: "Kemptener Straße 7", ort: "Bad Grönenbach" },
  { name: "Sebastian-Kneipp-Mittelschule Bad Grönenbach", strasse: "Kemptener Straße 7", ort: "Bad Grönenbach" },
  { name: "Pfarrer-Kneipp-Grundschule Bad Wörishofen", strasse: "Kaufbeurer Straße 12", ort: "Bad Wörishofen" },
  { name: "Pfarrer-Kneipp-Mittelschule Bad Wörishofen", strasse: "Kaufbeurer Straße 12", ort: "Bad Wörishofen" },
  { name: "Grundschule Benningen-Lachen", strasse: "Hawanger Straße 2", ort: "Benningen" },
  { name: "Dominikus-Hertel-Grundschule Boos", strasse: "Jahnstraße 7", ort: "Boos" },
  { name: "Grundschule Buxheim", strasse: "Wiesenstraße 7", ort: "Buxheim" },
  { name: "Grundschule Dirlewang", strasse: "Marktstraße 23", ort: "Dirlewang" },
  { name: "Grundschule Egg a.d. Günz", strasse: "Dr.-Eck-Platz 1", ort: "Egg a.d. Günz" },
  { name: "Grundschule Erkheim", strasse: "Schulweg 1", ort: "Erkheim" },
  { name: "Mittelschule Erkheim", strasse: "Schulweg 1", ort: "Erkheim" },
  { name: "Albert-Schweitzer-Grundschule Ettringen", strasse: "Schulstraße 10", ort: "Ettringen" },
  { name: "Albert-Schweitzer-Mittelschule Ettringen", strasse: "Schulstraße 10", ort: "Ettringen" },
  { name: "Grundschule Heimertingen", strasse: "Sechsbaumweg 5", ort: "Heimertingen" },
  { name: "Grundschule Illerbeuren", strasse: "Anton-Hohl-Straße 2", ort: "Kronburg-Illerbeuren" },
  { name: "Grundschule Kammlach", strasse: "Obere Hauptstraße 56", ort: "Kammlach" },
  { name: "Grundschule Kettershausen", strasse: "Schulstraße 4", ort: "Kettershausen" },
  { name: "Grundschule Kirchheim", strasse: "Angerweg 10", ort: "Kirchheim i. Schw." },
  { name: "Mittelschule Kirchheim", strasse: "Angerweg 10", ort: "Kirchheim i. Schw." },
  { name: "Grundschule Legau", strasse: "Altusrieder Straße 13", ort: "Legau" },
  { name: "Mittelschule Legau", strasse: "Altusrieder Straße 13", ort: "Legau" },
  { name: "Grundschule Markt Rettenbach", strasse: "Schulstraße 26", ort: "Markt Rettenbach" },
  { name: "Mittelschule Markt Rettenbach", strasse: "Schulstraße 26", ort: "Markt Rettenbach" },
  { name: "Christoph-Scheiner-Grundschule Markt Wald", strasse: "Schnerzhofer Straße 18", ort: "Markt Wald" },
  { name: "Grund- und Mittelschule Memmingerberg", strasse: "August-Hederer-Straße 11", ort: "Memmingerberg" },
  { name: "Grundschule Mindelheim", strasse: "Brennerstraße 3", ort: "Mindelheim" },
  { name: "Mittelschule Mindelheim", strasse: "Brennerstraße 5", ort: "Mindelheim" },
  { name: "St.-Josef-Schule, Kath. Freie Grundschule Mindelheim", strasse: "Champagnatplatz 1", ort: "Mindelheim" },
  { name: "Grundschule Ottobeuren", strasse: "Bergstraße 78", ort: "Ottobeuren" },
  { name: "Mittelschule Ottobeuren", strasse: "Bergstraße 80", ort: "Ottobeuren" },
  { name: "Grundschule Pfaffenhausen", strasse: "Schulstraße 9", ort: "Pfaffenhausen" },
  { name: "Mittelschule Pfaffenhausen", strasse: "Schulstraße 9", ort: "Pfaffenhausen" },
  { name: "Grundschule Sontheim", strasse: "Hauptstraße 41", ort: "Sontheim" },
  { name: "Grundschule Türkheim", strasse: "Wörishofer Straße 5", ort: "Türkheim" },
  { name: "Ludwig-Aurbacher-Mittelschule Türkheim", strasse: "Oberjägerstraße 7", ort: "Türkheim" },
  { name: "Grundschule Tussenhausen", strasse: "Marktplatz 4", ort: "Tussenhausen" },
  { name: "Grundschule Westerheim", strasse: "Bahnhofstraße 2", ort: "Westerheim" },
  { name: "Grundschule Wiedergeltingen", strasse: "Mindelheimer Straße 26", ort: "Wiedergeltingen" },
  { name: "Grundschule Wolfertschwenden", strasse: "Am Sportplatz 7", ort: "Wolfertschwenden" },
  { name: "Grundschule Woringen", strasse: "Kempter Straße 10", ort: "Woringen" },
];

export const ORTE_SEED: OrtSeed[] = [
  { name: "ViKo (online)", istOnline: true, sortOrder: SORT_ONLINE },
  {
    name: "Staatliches Schulamt Memmingen-Unterallgäu",
    ort: "Mindelheim",
    sortOrder: SORT_SCHULAMT,
  },
  ...MEMMINGEN.map((o) => ({ ...o, sortOrder: SORT_MEMMINGEN })),
  ...LANDKREIS.map((o) => ({ ...o, sortOrder: SORT_LANDKREIS })),
];
