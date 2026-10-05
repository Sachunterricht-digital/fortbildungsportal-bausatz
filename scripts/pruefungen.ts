/**
 * Leichtgewichtige Prüfungen der Kernlogik ohne Test-Framework.
 *
 *   npm test
 *
 * Abgedeckt ist, was still und unbemerkt falsch sein kann: das Filtern von
 * HTML, die Zeitzonen-Umrechnung und der Ferienkalender. Die Oberfläche wird
 * hier bewusst nicht geprüft.
 */
import { sanitizeBeschreibung, htmlZuText, istLeer } from "@/lib/sanitize";
import {
  formatDatumZeit,
  fromDatetimeLocalValue,
  formatDatumZeitEingabe,
  isoKalenderwoche,
  parseDatumZeitEingabe,
  parseDeDateTime,
  toDatetimeLocalValue,
  aktuellesSchuljahr,
  aktuellesSchuljahrKurz,
  berlinIsoDatum,
  kalenderMonat,
  kalenderTage,
  montagIndex,
} from "@/lib/datetime";
import { kompetenzAuswahlUmschalten } from "@/lib/formularauswahl";
import { ferienStatus, terminWarnung } from "@/lib/ferien";
import { bildeSlug, oeffentlicherReferentSelect, oeffentlicheReferentWhere } from "@/lib/queries";
import { filterZuWhere, leseFilter, suchbegriffe } from "@/lib/filter";
import { mapFibsLehrgang } from "@/lib/fibs/mapper";
import { parseSuchergebnis } from "@/lib/fibs/parser";
import {
  bestimmeFibsAnmeldestatus,
  fibsStatusText,
} from "@/lib/fibs/status";
import { fehlendeReferentIds, pruefeVeroeffentlichung, FortbildungSchema, formDataZuEingabe, fehlerTab } from "@/lib/validation/fortbildung";
import { sichereWeiterleitung } from "@/lib/weiterleitung";
import {
  angebotsZaehler,
  funktionsEtikett,
  initialen,
  portraetVariante,
  profilText,
  schwerpunkteListe,
} from "@/lib/mitglieder";
import { readFileSync } from "node:fs";
import jsQR from "jsqr";
import { qrMatrix } from "@/lib/qr";
import { liesSessionVersion, sitzungsCookieSicher } from "@/constants/session";
import { DIGCOMP_BAUM } from "../prisma/seed-data/digcomp";
import { NIVEAUSTUFEN, ortAnzeige } from "@/constants/fortbildung";
import {
  normalisiereSchlagwort,
  normalisiereSchlagwortListe,
  schlagwortSchluessel,
} from "@/lib/schlagwort";

let fehler = 0;

function pruefe(name: string, ist: unknown, soll: unknown) {
  const ok = JSON.stringify(ist) === JSON.stringify(soll);
  if (!ok) fehler += 1;
  console.log(
    `${ok ? "  ok  " : "  FEHL"} ${name}` +
      (ok
        ? ""
        : `\n         ist:  ${JSON.stringify(ist)}\n         soll: ${JSON.stringify(soll)}`),
  );
}

console.log("\nFormularauswahl");
pruefe("Unterkompetenz setzt nicht den gesamten Bereich", kompetenzAuswahlUmschalten([], "3.2", true), ["3.2"]);
pruefe("Unterkompetenz abwählen lässt expliziten Bereich stehen", kompetenzAuswahlUmschalten(["3", "3.2"], "3.2", false), ["3"]);
pruefe("Bereich abwählen lässt Unterkompetenz stehen", kompetenzAuswahlUmschalten(["3", "3.2"], "3", false), ["3.2"]);
pruefe("Weitere Unterkompetenz unabhängig ergänzen", kompetenzAuswahlUmschalten(["3.2"], "3.3", true), ["3.2", "3.3"]);
const september = new Date("2026-09-15T22:30:00Z");
const septemberRaster = kalenderTage(september);
pruefe("Kalenderraster beginnt mit Montag", montagIndex(septemberRaster[0]), 0);
pruefe("Septemberraster beginnt am 31. August", berlinIsoDatum(septemberRaster[0]), "2026-08-31");
pruefe("Kalender zeigt sechs volle Wochen", septemberRaster.length, 42);
pruefe("Monatswechsel über Jahresgrenze", berlinIsoDatum(kalenderMonat(new Date("2026-12-15T12:00:00Z"), 1)), "2027-01-01");
pruefe("Monatswechsel rückwärts", berlinIsoDatum(kalenderMonat(new Date("2027-01-15T12:00:00Z"), -1)), "2026-12-01");
pruefe("Berliner Datum bestimmt Kalendermonat", berlinIsoDatum(kalenderMonat(new Date("2026-08-31T23:00:00Z"))), "2026-09-01");
pruefe("Schaltjahr zeigt 29. Februar", kalenderTage(new Date("2028-02-15T12:00:00Z")).some((tag) => berlinIsoDatum(tag) === "2028-02-29"), true);
pruefe("Kompetenzbereichsfilter findet auch Unterkompetenzen", JSON.stringify(filterZuWhere(leseFilter({ kb: "3" }))).includes('"startsWith":"3"'), true);

console.log("\nHTML-Filterung");
pruefe("script wird entfernt", sanitizeBeschreibung("<p>Hallo</p><script>alert(1)</script>"), "<p>Hallo</p>");
pruefe("Event-Attribut wird entfernt", sanitizeBeschreibung('<p onclick="alert(1)">Hallo</p>'), "<p>Hallo</p>");
pruefe(
  "javascript:-Link wird entschärft",
  sanitizeBeschreibung('<a href="javascript:alert(1)">x</a>'),
  '<a target="_blank" rel="noopener noreferrer nofollow">x</a>',
);
pruefe(
  "erlaubtes Markup bleibt",
  sanitizeBeschreibung("<p><strong>fett</strong> und <em>kursiv</em></p>"),
  "<p><strong>fett</strong> und <em>kursiv</em></p>",
);
pruefe("Klartext trennt Blöcke", htmlZuText("<p>Ende</p><p>Anfang</p>"), "Ende Anfang");
pruefe("leerer Editor erkannt", istLeer("<p></p>"), true);

console.log("\nDatum und Zeitzone");
pruefe("Sommerzeit (MESZ, +2)", parseDeDateTime("15.10.2026 14:00")?.toISOString(), "2026-10-15T12:00:00.000Z");
pruefe("Winterzeit (MEZ, +1)", parseDeDateTime("15.01.2027 09:30")?.toISOString(), "2027-01-15T08:30:00.000Z");
pruefe("ungültiges Datum abgelehnt", parseDeDateTime("31.02.2026"), null);
pruefe("Hin- und Rückweg stabil", toDatetimeLocalValue(fromDatetimeLocalValue("2026-10-15T14:00")!), "2026-10-15T14:00");
pruefe(
  "deutsche Datumseingabe wird gelesen",
  parseDatumZeitEingabe("15.10.2026 14:00")?.toISOString(),
  "2026-10-15T12:00:00.000Z",
);
pruefe("Datumseingabe bleibt deutsch", formatDatumZeitEingabe(new Date("2026-10-15T12:00:00Z")), "15.10.2026 14:00");
pruefe("Datumseingabe braucht Uhrzeit", parseDatumZeitEingabe("15.10.2026"), null);
for (const eingabe of ["16.9.2026 9:00", "16.09.2026 09.00", "16.09.2026, 09:00", " 16.09.2026 09:00 "]) {
  pruefe(`Deutsche Eingabevariante: ${eingabe}`, parseDatumZeitEingabe(eingabe)?.toISOString(), "2026-09-16T07:00:00.000Z");
}
for (const eingabe of ["31.02.2026 09:00", "16.09.2026 24:00", "16.09.2026 09:60"]) {
  pruefe(`Ungültige Eingabe: ${eingabe}`, parseDatumZeitEingabe(eingabe), null);
}

console.log("\nSchiLf-Formular: Entwurf und Einreichung");
for (const status of ["ENTWURF", "EINGEREICHT"]) {
  const formular = new FormData();
  for (const [feld, wert] of Object.entries({
    titel: "SchiLf Formularprüfung",
    beschreibungHtml: "<p>Eine schulinterne Fortbildung.</p>",
    organisationsform: "SCHILF",
    maxTn: "20",
    format: "PRAESENZ",
    beginn: "16.9.2026 9:00",
    ende: "16.9.2026 11.00",
    ortText: "GS Amendingen",
    schularten: "GRUNDSCHULE",
    niveaustufe: "NIVEAU_I_II",
    kompetenzen: "1.1",
    referenten: "00000000-0000-4000-8000-000000000002",
    status,
  })) formular.append(feld, wert);
  const ergebnis = FortbildungSchema.safeParse(formDataZuEingabe(formular));
  pruefe(`${status}: Kurzdatum und leere FIBS-Felder sind zulässig`, ergebnis.success, true);
  if (ergebnis.success) pruefe(`${status}: Einreichungspflichten erfüllt`, pruefeVeroeffentlichung(ergebnis.data), null);
  // Eine SchiLf hat nie einen festen Termin: Ein mitgeschickter wird verworfen.
  if (ergebnis.success) pruefe(`${status}: SchiLf speichert keinen Termin`, ergebnis.data.beginn, null);

  // Dieselbe Eingabe als regionale Fortbildung: dort zählt der Termin.
  formular.set("organisationsform", "REGIONAL");
  formular.set("ende", "16.9.2026 8:00");
  pruefe(`${status}: Ende vor Beginn bleibt verboten`, FortbildungSchema.safeParse(formDataZuEingabe(formular)).success, false);
  formular.set("ende", "16.9.2026 11.00");
  pruefe(`${status}: regionale Fortbildung behält den Termin`, FortbildungSchema.safeParse(formDataZuEingabe(formular)).success, true);

  // Ort ist Freitext: bei RLFB weiterhin Pflicht außer im Entwurf.
  formular.set("ortText", "");
  const ohneOrt = FortbildungSchema.safeParse(formDataZuEingabe(formular));
  pruefe(
    `${status}: RLFB ohne Ort ${status === "ENTWURF" ? "bleibt zulässig" : "wird abgelehnt"}`,
    ohneOrt.success,
    status === "ENTWURF",
  );
}

console.log("\nOrt-Anzeige (Freitext mit Rückfall auf Veranstaltungsort)");
pruefe("Freitext hat Vorrang", ortAnzeige("GS Musterdorf, Raum 12", { name: "Alte Schule" }), "GS Musterdorf, Raum 12");
pruefe("Leerer Freitext fällt auf den Veranstaltungsort zurück", ortAnzeige("", { name: "GS Amendingen", ort: "Memmingen" }), "GS Amendingen, Memmingen");
pruefe("Ort im Namen wird nicht doppelt angehängt", ortAnzeige(null, { name: "GS Amendingen Memmingen", ort: "Memmingen" }), "GS Amendingen Memmingen");
pruefe("Ohne Freitext und ohne Veranstaltungsort", ortAnzeige(null, null), null);

pruefe("Listenfehler führt zum Schlagwort-Abschnitt", fehlerTab("schlagworte.0"), "zielgruppe");
pruefe("Listenfehler führt zum Referenten-Abschnitt", fehlerTab("referenten.0"), "referenten");
pruefe("Datumsfehler führt zu den Eckdaten", fehlerTab("beginn"), "eckdaten");
pruefe("Allgemeiner Fehler hat keinen falschen Abschnitt", fehlerTab("_"), undefined);
pruefe("ISO-Kalenderwoche beginnt montags", isoKalenderwoche(new Date("2026-01-01T12:00:00Z")), 1);
pruefe("Anzeige auf Deutsch", formatDatumZeit(new Date("2026-10-15T12:00:00Z")), "15.10.2026, 14:00");
pruefe("Schuljahr wechselt im August", aktuellesSchuljahr(new Date("2026-08-01T10:00:00Z")), "2026/2027");
pruefe("Schuljahr im Juli", aktuellesSchuljahr(new Date("2026-07-31T10:00:00Z")), "2025/2026");

console.log("\nSitzungstoken");
pruefe("gültige Sitzungsversion", liesSessionVersion(7), 7);
pruefe("fehlende Sitzungsversion wird verworfen", liesSessionVersion(undefined), null);
pruefe("ungültige Sitzungsversion wird verworfen", liesSessionVersion(-1), null);
pruefe("Secure-Cookie ist in Produktion Standard", sitzungsCookieSicher(undefined, true), true);
pruefe("HTTP im LAN muss ausdrücklich erlaubt werden", sitzungsCookieSicher("false", true), false);
pruefe("HTTPS lässt sich ausdrücklich erzwingen", sitzungsCookieSicher("true", false), true);

console.log("\nSchlagworte");
pruefe(
  "Leerzeichen werden vereinheitlicht",
  normalisiereSchlagwort("  Digitale\u00a0\u00a0Medien  "),
  "Digitale Medien",
);
pruefe(
  "Schlüssel ignoriert deutsche Groß-/Kleinschreibung",
  schlagwortSchluessel("KÜNSTLICHE INTELLIGENZ ẞ"),
  "künstliche intelligenz ß",
);
pruefe(
  "Doppelte Schlagworte werden zusammengeführt",
  normalisiereSchlagwortListe(["Digital", "  digital ", "iPad"]),
  ["Digital", "iPad"],
);

console.log("\nFerien und Feiertage (Bayern)");
pruefe("Sommerferien 2026", ferienStatus(new Date("2026-08-10T12:00:00Z")).label, "Sommerferien");
pruefe("normaler Schultag", ferienStatus(new Date("2026-10-15T12:00:00Z")).art, "unterrichtstag");
pruefe("Allerheiligen 2026", ferienStatus(new Date("2026-11-01T12:00:00Z")).label, "Allerheiligen");
pruefe(
  "Tag der Deutschen Einheit schlägt Wochenende",
  ferienStatus(new Date("2026-10-03T12:00:00Z")).label,
  "Tag der Deutschen Einheit",
);
// Fronleichnam 2026 (04.06.) liegt in den Pfingstferien. Für die Frage
// "kann hier eine Fortbildung stattfinden?" ist das ein Ferientag — die
// Ferienauskunft hat deshalb absichtlich Vorrang vor dem Feiertag.
pruefe("Ferien schlagen Feiertag", ferienStatus(new Date("2026-06-04T12:00:00Z")).label, "Pfingstferien");
pruefe("Buß- und Bettag 2026", ferienStatus(new Date("2026-11-18T12:00:00Z")).label, "Buß- und Bettag (unterrichtsfrei)");
pruefe("Samstag", ferienStatus(new Date("2026-10-17T12:00:00Z")).art, "wochenende");
pruefe("Warnung bei Ferien", terminWarnung(new Date("2026-08-10T12:00:00Z"), new Date("2026-08-10T14:00:00Z"))?.art, "ferien");
pruefe("keine Warnung am Schultag", terminWarnung(new Date("2026-10-15T12:00:00Z"), new Date("2026-10-15T14:00:00Z")), null);
pruefe(
  "mehrtägiger Termin läuft in die Ferien",
  terminWarnung(new Date("2026-10-30T12:00:00Z"), new Date("2026-11-03T12:00:00Z"))?.art,
  "ferien",
);
pruefe(
  "Osterferien 2028 sind gepflegt",
  ferienStatus(new Date("2028-04-12T12:00:00Z")).label,
  "Osterferien",
);
pruefe(
  "Sommerferien 2030 sind gepflegt",
  ferienStatus(new Date("2030-09-09T12:00:00Z")).label,
  "Sommerferien",
);
pruefe(
  "außerhalb des gepflegten Zeitraums",
  terminWarnung(new Date("2031-05-12T12:00:00Z"), new Date("2031-05-12T14:00:00Z"))?.art,
  "unbekannt",
);

console.log("\nDigCompEdu Bavaria");
const teilkompetenzen = DIGCOMP_BAUM.flatMap((bereich) => bereich.children);
pruefe("sechs Kompetenzbereiche", DIGCOMP_BAUM.length, 6);
pruefe("22 amtliche Teilkompetenzen", teilkompetenzen.length, 22);
pruefe(
  "keine vorläufige Teilkompetenz",
  teilkompetenzen.some((kompetenz) => kompetenz.istPlatzhalter),
  false,
);
pruefe(
  "amtliche Bezeichnung 4.2",
  teilkompetenzen.find((kompetenz) => kompetenz.code === "4.2")?.titel,
  "Analyse der Lernevidenz",
);
pruefe(
  "amtliche Bezeichnung Bereich 6",
  DIGCOMP_BAUM.find((bereich) => bereich.code === "6")?.titel,
  "Förderung der Medienkompetenz der Lernenden",
);
pruefe(
  "FIBS-Niveaustufen vollständig",
  NIVEAUSTUFEN.map((stufe) => stufe.label),
  [
    "Einsteiger (Niveaustufe I/II)",
    "Fortgeschrittene (Niveaustufe III/IV)",
    "Experten (Niveaustufe V/VI)",
  ],
);

console.log("\nFIBS-Anmeldung und SchiLf-Nachtrag");
pruefe(
  "vorgemerkter Link öffnet die FIBS-Anmeldung noch nicht",
  bestimmeFibsAnmeldestatus({
    organisationsform: "REGIONAL",
    inFibs: false,
    fibsUrl: "https://fibs.example/termin",
  }),
  "FIBS_FOLGT",
);
pruefe(
  "bestätigter FIBS-Eintrag mit Link öffnet die Anmeldung",
  bestimmeFibsAnmeldestatus({
    organisationsform: "REGIONAL",
    inFibs: true,
    fibsUrl: "https://fibs.example/termin",
  }),
  "FIBS_OFFEN",
);
pruefe(
  "SchiLf ohne aktiven Link bleibt schulinterne Teilnahme",
  bestimmeFibsAnmeldestatus({
    organisationsform: "SCHILF",
    inFibs: true,
    fibsUrl: null,
  }),
  "SCHILF_INTERN",
);
pruefe(
  "kommende SchiLf erhält den Nachtrag erst nach dem Termin",
  fibsStatusText({
    organisationsform: "SCHILF",
    inFibs: false,
    ende: new Date("2026-10-01T14:00:00Z"),
    status: "VEROEFFENTLICHT",
    jetzt: new Date("2026-09-01T12:00:00Z"),
  }),
  "Nachtrag nach Termin",
);
pruefe(
  "vergangene SchiLf weist auf offenen Nachtrag hin",
  fibsStatusText({
    organisationsform: "SCHILF",
    inFibs: false,
    ende: new Date("2026-08-01T14:00:00Z"),
    status: "VEROEFFENTLICHT",
    jetzt: new Date("2026-09-01T12:00:00Z"),
  }),
  "Nachtrag offen",
);
pruefe(
  "SchiLf-Entwurf erzeugt noch keine Nachbereitungsaufgabe",
  fibsStatusText({
    organisationsform: "SCHILF",
    inFibs: false,
    ende: new Date("2026-08-01T14:00:00Z"),
    status: "ENTWURF",
    jetzt: new Date("2026-09-01T12:00:00Z"),
  }),
  "noch nicht vorgesehen",
);

console.log("\nSlug");
pruefe(
  "Umlaute werden umgeschrieben",
  bildeSlug("Künstliche Intelligenz für Anfänger", new Date("2026-10-15T12:00:00Z"), "abcdef123"),
  "kuenstliche-intelligenz-fuer-anfaenger-2026-10-15-abcdef",
);
pruefe(
  "Slug verwendet den Berliner Kalendertag",
  bildeSlug("Abendtermin", new Date("2026-10-14T22:30:00Z"), "abcdef123"),
  "abendtermin-2026-10-15-abcdef",
);

console.log("\nSuche");
pruefe("ein Begriff", suchbegriffe("ipad"), ["ipad"]);
pruefe("zwei Begriffe werden getrennt", suchbegriffe("ipad grundschule"), [
  "ipad",
  "grundschule",
]);
pruefe("Mehrfach-Leerzeichen", suchbegriffe("  ipad   grundschule "), [
  "ipad",
  "grundschule",
]);
pruefe("Einzelbuchstaben fliegen raus", suchbegriffe("a ipad"), ["ipad"]);
pruefe("kurze Eingabe bleibt erhalten", suchbegriffe("KI"), ["KI"]);
pruefe("leere Eingabe", suchbegriffe(undefined), []);
pruefe(
  "höchstens acht Begriffe",
  suchbegriffe("a1 a2 a3 a4 a5 a6 a7 a8 a9 a10").length,
  8,
);

{
  // Jeder Begriff wird zu einer eigenen UND-Bedingung; innerhalb davon darf
  // er in einem beliebigen Feld stehen.
  const wo = filterZuWhere({ q: "ipad grundschule" }) as {
    AND: Array<{ OR?: unknown[] }>;
  };
  pruefe("zwei Begriffe ergeben zwei Bedingungen", wo.AND.length, 2);
  pruefe(
    "jede Bedingung durchsucht sieben Felder",
    wo.AND.every((teil) => teil.OR?.length === 7),
    true,
  );
}

{
  pruefe(
    "genauer FIBS-Ausschreibungsfilter wird gelesen",
    leseFilter({ fibs: "offen-ausschreibung" }).fibs,
    "offen-ausschreibung",
  );
  pruefe(
    "SchiLf-Nachtragsfilter wird gelesen",
    leseFilter({ fibs: "schilf-nachtrag" }).fibs,
    "schilf-nachtrag",
  );

  const ausschreibung = filterZuWhere({ fibs: "offen-ausschreibung" }) as {
    AND: Array<{
      inFibs?: boolean;
      organisationsform?: { not: string };
      ende?: { gte: Date };
    }>;
  };
  pruefe(
    "offene Ausschreibung schließt SchiLf aus",
    ausschreibung.AND.some(
      (teil) =>
        teil.inFibs === false &&
        teil.organisationsform?.not === "SCHILF" &&
        teil.ende?.gte instanceof Date,
    ),
    true,
  );

  const schilf = filterZuWhere({ fibs: "schilf-nachtrag" }) as {
    AND: Array<{ inFibs?: boolean; organisationsform?: string }>;
  };
  pruefe(
    "SchiLf-Nachtrag bleibt ein eigener FIBS-Fall",
    schilf.AND,
    [{ inFibs: false, organisationsform: "SCHILF" }],
  );
}

console.log("\nVeröffentlichung und Referenten");
pruefe(
  "unbekannte Referenten-ID wird erkannt",
  fehlendeReferentIds(["referent-a", "referent-b", "referent-a"], ["referent-b"]),
  ["referent-a"],
);
pruefe(
  "vollständig aufgelöste Referenten bestehen die Veröffentlichungspflicht",
  pruefeVeroeffentlichung({
    status: "VEROEFFENTLICHT",
    niveaustufe: "NIVEAU_III_IV",
    kompetenzen: ["1.1"],
    referenten: ["referent-a"],
  }),
  null,
);
pruefe(
  "ohne aufgelösten Referenten ist Veröffentlichung nicht möglich",
  pruefeVeroeffentlichung({
    status: "VEROEFFENTLICHT",
    niveaustufe: "NIVEAU_III_IV",
    kompetenzen: ["1.1"],
    referenten: [],
  }),
  {
    referenten:
      "Vor dem Veröffentlichen bitte mindestens eine Referentin oder einen Referenten zuordnen.",
  },
);

console.log("\nQR-Code (gegen einen echten Decoder gelesen)");
{
  // Der Encoder ist selbst geschrieben (src/lib/qr.ts). Ohne Gegenprobe wäre
  // das fahrlässig: Ein Fehler in der Reed-Solomon-Rechnung oder der
  // Maskierung fällt sonst erst auf, wenn im Lehrerzimmer niemand den Aushang
  // scannen kann. jsqr ist reine Entwicklungs-Abhängigkeit.
  const proben = [
    "https://fortbildungen.schulamt-uamm.de/fortbildungen/ki-2026-10-15-abc123",
    "https://example.org/f/x",
    "https://fortbildungen.schulamt-uamm.de/fortbildungen/kuenstliche-intelligenz-im-grundschulunterricht-2026-10-15-f2a91d",
    "Umlaute prüfen: Grundschule Wörishofen, Buß- und Bettag, 30 Plätze",
  ];

  for (const text of proben) {
    const { module, groesse, version } = qrMatrix(text, "H");

    // jsqr erwartet RGBA-Pixel. Vier Module Ruhezone ringsum sind
    // vorgeschrieben — ohne sie findet kein Lesegerät den Code.
    const rand = 4;
    const skala = 4;
    const kante = (groesse + rand * 2) * skala;
    const pixel = new Uint8ClampedArray(kante * kante * 4).fill(255);

    for (let z = 0; z < groesse; z += 1) {
      for (let s = 0; s < groesse; s += 1) {
        if (!module[z]![s]) continue;
        for (let dz = 0; dz < skala; dz += 1) {
          for (let ds = 0; ds < skala; ds += 1) {
            const y = (z + rand) * skala + dz;
            const x = (s + rand) * skala + ds;
            const i = (y * kante + x) * 4;
            pixel[i] = 0;
            pixel[i + 1] = 0;
            pixel[i + 2] = 0;
          }
        }
      }
    }

    const gelesen = jsQR(pixel, kante, kante);
    pruefe(
      `Version ${version} liest sich zurück (${text.length} Zeichen)`,
      gelesen?.data,
      text,
    );
  }

  // Das Logo in der Mitte verdeckt echte Module. Fehlerkorrektur H verkraftet
  // rund 30 % Verlust — hier wird nachgewiesen, dass die tatsächlich genutzte
  // Fläche (22 % der Kantenlänge, also knapp 5 % der Module) unkritisch ist.
  const text = "https://fortbildungen.schulamt-uamm.de/fortbildungen/ki-2026-10-15-abc123";
  const { module, groesse } = qrMatrix(text, "H");

  const rand = 4;
  const skala = 4;
  const kante = (groesse + rand * 2) * skala;
  const pixel = new Uint8ClampedArray(kante * kante * 4).fill(255);

  for (let z = 0; z < groesse; z += 1) {
    for (let s = 0; s < groesse; s += 1) {
      if (!module[z]![s]) continue;
      for (let dz = 0; dz < skala; dz += 1) {
        for (let ds = 0; ds < skala; ds += 1) {
          const i = (((z + rand) * skala + dz) * kante + (s + rand) * skala + ds) * 4;
          pixel[i] = 0;
          pixel[i + 1] = 0;
          pixel[i + 2] = 0;
        }
      }
    }
  }

  // Weißes Feld in der Mitte, wie es das Logo hinterlässt
  const feld = Math.round(groesse * 0.22);
  const von = Math.floor((groesse - feld) / 2) + rand;
  for (let z = von; z < von + feld; z += 1) {
    for (let s = von; s < von + feld; s += 1) {
      for (let dz = 0; dz < skala; dz += 1) {
        for (let ds = 0; ds < skala; ds += 1) {
          const i = ((z * skala + dz) * kante + s * skala + ds) * 4;
          pixel[i] = 255;
          pixel[i + 1] = 255;
          pixel[i + 2] = 255;
        }
      }
    }
  }

  pruefe(
    `mit ${feld}×${feld} Modulen Logo-Aussparung noch lesbar`,
    jsQR(pixel, kante, kante)?.data,
    text,
  );
}

console.log("\nFIBS-Import (gegen die Beispieldatei)");
const html = readFileSync("src/lib/fibs/fixtures/suchergebnis.html", "utf8");
const lehrgaenge = parseSuchergebnis(html);
pruefe("drei Treffer erkannt", lehrgaenge.length, 3);
pruefe("Lehrgangsnummer gelesen", lehrgaenge[0]?.lehrgangsnummer, "E123-4/26/1");

const ersteres = mapFibsLehrgang(lehrgaenge[0]!, "https://fibs.example");
pruefe("Präsenztermin gemappt", ersteres.ok && ersteres.daten.format, "PRAESENZ");
pruefe(
  "Beginn in UTC umgerechnet",
  ersteres.ok && ersteres.daten.beginn.toISOString(),
  "2026-10-15T12:00:00.000Z",
);
pruefe("Zielgruppe erkannt", ersteres.ok && ersteres.daten.schularten, ["GRUNDSCHULE"]);

const zweites = mapFibsLehrgang(lehrgaenge[1]!, "https://fibs.example");
pruefe("eSession erkannt", zweites.ok && zweites.daten.format, "ESESSION");
pruefe("Online-Ort erkannt", zweites.ok && zweites.daten.ortIstOnline, true);

const drittes = mapFibsLehrgang(lehrgaenge[2]!, "https://fibs.example");
pruefe("unvollständiger Datensatz wird verworfen", drittes.ok, false);

console.log("\nWeiterleitung nach dem Login (Open Redirect)");
pruefe("interner Pfad mit Hash bleibt", sichereWeiterleitung("/admin/konto#profil"), "/admin/konto#profil");
pruefe("Pfad mit Query bleibt", sichereWeiterleitung("/admin/fortbildungen?x=1"), "/admin/fortbildungen?x=1");
pruefe("leer", sichereWeiterleitung(""), "/admin");
pruefe("undefined", sichereWeiterleitung(undefined), "/admin");
pruefe("//evil", sichereWeiterleitung("//evil.example"), "/admin");
pruefe("/\\evil", sichereWeiterleitung("/\\evil.example"), "/admin");
pruefe("Backslash mitten im Pfad", sichereWeiterleitung("/admin\\x"), "/admin");
pruefe("/%5Cevil bleibt ein Pfad (kein Backslash im Klartext)", sichereWeiterleitung("/%5Cevil"), "/%5Cevil");
pruefe("https://evil", sichereWeiterleitung("https://evil.example"), "/admin");
pruefe("javascript:", sichereWeiterleitung("javascript:alert(1)"), "/admin");
pruefe("relativ ohne Slash", sichereWeiterleitung("admin"), "/admin");
pruefe("Tabulator", sichereWeiterleitung("/\t/evil.example"), "/admin");
pruefe("Zeilenumbruch", sichereWeiterleitung("/admin\nx"), "/admin");
pruefe("NUL", sichereWeiterleitung("/admin\u0000"), "/admin");
pruefe("DEL", sichereWeiterleitung("/admin\u007f"), "/admin");
pruefe("zu lang", sichereWeiterleitung("/" + "a".repeat(3000)), "/admin");

console.log("\nTeambereich (Schuljahr, Karten, Profiltext)");
pruefe("Schuljahr kurz im Oktober 2026", aktuellesSchuljahrKurz(new Date("2026-10-05T10:00:00Z")), "2026/27");
pruefe("Schuljahr kurz am 31.07.", aktuellesSchuljahrKurz(new Date("2027-07-31T10:00:00Z")), "2026/27");
pruefe("Schuljahr kurz am 01.08.", aktuellesSchuljahrKurz(new Date("2027-08-01T10:00:00Z")), "2027/28");
pruefe("Schuljahr kurz im Januar", aktuellesSchuljahrKurz(new Date("2027-01-15T10:00:00Z")), "2026/27");
pruefe("Schuljahr kurz am Jahrhundertwechsel", aktuellesSchuljahrKurz(new Date("2099-09-01T10:00:00Z")), "2099/00");
pruefe("Initialen", initialen("Erika", "Muster"), "EM");
pruefe("Initialen: Kleinschreibung und Leerraum", initialen("  anja", " skizze"), "AS");
pruefe("Initialen: leer", initialen("", ""), "?");
pruefe("Initialen: Umlaut", initialen("Änne", "Öztürk"), "ÄÖ");
pruefe("Schwerpunkte: Komma, Leerraum, leere Einträge", schwerpunkteListe(" KI , ,ByCS,, Tablets "), ["KI", "ByCS", "Tablets"]);
pruefe("Schwerpunkte: Dubletten ohne Groß/Klein", schwerpunkteListe("KI, ki, KI"), ["KI"]);
pruefe("Schwerpunkte: höchstens drei", schwerpunkteListe("a, b, c, d, e", 3), ["a", "b", "c"]);
pruefe("Schwerpunkte: null", schwerpunkteListe(null), []);
pruefe("Porträt-Variante ist stabil und im Bereich", [portraetVariante("abc"), portraetVariante("abc")].every((v) => v === portraetVariante("abc") && v >= 0 && v <= 2), true);
pruefe("Zähler: nur SchiLf", angebotsZaehler(2, 0), "2 SchiLf");
pruefe("Zähler: eine Fortbildung", angebotsZaehler(0, 1), "1 Fortbildung");
pruefe("Zähler: beides", angebotsZaehler(3, 2), "3 SchiLf · 2 Fortbildungen");
pruefe("Zähler: bei 0 nichts", angebotsZaehler(0, 0), "");
pruefe("Funktion: Referent", funktionsEtikett("REFERENT"), "Referent");
pruefe("Funktion: Fachfunktion", funktionsEtikett("FACHFUNKTION"), "Fachfunktion");
pruefe("Funktion: Unbekanntes gilt als Referent", funktionsEtikett("XYZ"), "Referent");
pruefe("Profiltext: CRLF, drei Leerzeilen gekürzt", profilText("A\r\n\r\n\r\n\r\nB\nC  "), "A\n\nB\nC");
pruefe("Profiltext: leer", profilText("  \n "), "");
pruefe("Profiltext: null", profilText(null), "");
pruefe(
  "Öffentliche Referenten-Auswahl ohne Kontaktdaten und Notiz",
  Object.keys(oeffentlicherReferentSelect).some((k) => ["email", "telefon", "notiz", "userId"].includes(k)),
  false,
);
pruefe("Öffentlicher Referenten-Filter: aktiv und sichtbar", oeffentlicheReferentWhere(), { aktiv: true, oeffentlichSichtbar: true });

console.log(
  fehler === 0
    ? "\nAlle Prüfungen bestanden.\n"
    : `\n${fehler} Prüfung(en) fehlgeschlagen.\n`,
);
process.exit(fehler === 0 ? 0 : 1);
