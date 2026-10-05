import ExcelJS from "exceljs";
import { AUSWERTUNGS_HINWEISE, istAuswertbar, type AuswertungsFilter, type AuswertungsZeile, type erstelleAuswertung } from "@/lib/auswertung";
import { formatDatumZeit } from "@/lib/datetime";
import { formatLabel, organisationsformLabel, statusLabel } from "@/constants/fortbildung";
import { T } from "@/texte/de";

type Auswertung = ReturnType<typeof erstelleAuswertung>;

/** Gleiche Kennzahlen und Datenbasis wie auf der Auswertungsseite. */
export function erstelleAuswertungsmappe(auswertung: Auswertung, filter: AuswertungsFilter, schulamtName = "Schulamt") {
  const mappe = new ExcelJS.Workbook();
  mappe.creator = `Fortbildungsportal · ${schulamtName}`;
  mappe.created = auswertung.jetzt;

  const uebersicht = mappe.addWorksheet("Übersicht");
  uebersicht.columns = [{ header: "Auswertungsbogen", key: "titel", width: 38 }, { header: "Wert", key: "wert", width: 100 }];
  const { gesamt } = auswertung;
  const referent = auswertung.termine.flatMap((termin) => termin.referenten).find(({ referent }) => referent.id === filter.referent)?.referent;
  for (const zeile of [
    ["Stand (Europe/Berlin)", formatDatumZeit(auswertung.jetzt)],
    ["Schuljahr", filter.schuljahr ?? "Alle Schuljahre"],
    ["Von", filter.von ?? "Offener Beginn"], ["Bis", filter.bis ?? "Offenes Ende"],
    ["Fortbildungsart", filter.organisationsform ? organisationsformLabel(filter.organisationsform) : "Alle"],
    ["Format", filter.format ? formatLabel(filter.format) : "Alle"],
    ["Referent/in", filter.referent ? (referent ? `${referent.vorname} ${referent.nachname}` : "Keine Treffer") : "Alle"],
    ["Veranstaltungen", gesamt.veranstaltungen], ["Beendet", gesamt.beendet],
    ["Anstehend / laufend", gesamt.geplant], ["In Vorbereitung", gesamt.vorbereitung], ["Abgesagt", gesamt.abgesagt],
    ["Veranstaltungen mit Meldung", gesamt.gemeldet], ["Offene Teilnehmermeldungen", gesamt.offen],
    ["Gemeldete Teilnahmen", gesamt.teilnahmen], ["Ø Teilnahmen je Meldung", gesamt.durchschnitt],
  ]) uebersicht.addRow(zeile.map(sichereZelle));
  uebersicht.addRow(["Auslastung", gesamt.auslastung]).getCell(2).numFmt = "0.0%";
  uebersicht.addRow(["Meldequote", gesamt.meldequote]).getCell(2).numFmt = "0.0%";
  uebersicht.addRow([]);
  for (const hinweis of AUSWERTUNGS_HINWEISE) {
    const zeile = uebersicht.addRow(["Berechnungsgrundlage", hinweis.replace("(–)", "(leere Zelle)")]);
    zeile.alignment = { vertical: "top", wrapText: true };
    zeile.height = 60;
  }

  function gruppenblatt(name: string, zeilen: AuswertungsZeile[]) {
    const blatt = mappe.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    blatt.columns = [
      { header: "Bezeichnung", key: "name", width: 40 },
      { header: "Veranstaltungen", key: "veranstaltungen", width: 19 },
      { header: "Beendet", key: "beendet", width: 14 },
      { header: "Meldungen", key: "gemeldet", width: 14 },
      { header: "Offene Meldungen", key: "offen", width: 20 },
      { header: "Teilnahmen", key: "teilnahmen", width: 16 },
      { header: "Ø je Meldung", key: "durchschnitt", width: 18, style: { numFmt: "0.0" } },
      { header: "Auslastung", key: "auslastung", width: 16, style: { numFmt: "0.0%" } },
      { header: "Meldequote", key: "meldequote", width: 16, style: { numFmt: "0.0%" } },
      { header: "Abgesagt", key: "abgesagt", width: 14 },
    ];
    for (const zeile of zeilen) blatt.addRow({ ...zeile, name: sichereZelle(zeile.name) });
    blatt.autoFilter = { from: "A1", to: { row: 1, column: blatt.columnCount } };
  }
  gruppenblatt("Referenten", auswertung.referenten);
  gruppenblatt("Monatsverlauf", auswertung.monate);
  gruppenblatt("Fortbildungsarten", auswertung.arten);
  gruppenblatt("Formate", auswertung.formate);
  gruppenblatt("Niveaustufen", auswertung.niveaus);

  const termine = mappe.addWorksheet("Veranstaltungen", { views: [{ state: "frozen", ySplit: 1 }] });
  termine.columns = [
    { header: "Beginn (Europe/Berlin)", key: "beginn", width: 24 }, { header: "Ende (Europe/Berlin)", key: "ende", width: 24 },
    { header: "Veranstaltung", key: "titel", width: 50 }, { header: "Referenten", key: "referenten", width: 35 },
    { header: "Fortbildungsart", key: "art", width: 20 }, { header: "Format", key: "format", width: 18 },
    { header: "Ort", key: "ort", width: 35 }, { header: "Status", key: "status", width: 20 },
    { header: "Geplante Plätze", key: "plaetze", width: 18 }, { header: "Teilnahmen", key: "teilnahmen", width: 15 },
    { header: "Meldestand", key: "meldestand", width: 22 }, { header: "Auslastung", key: "auslastung", width: 15, style: { numFmt: "0.0%" } },
  ];
  for (const termin of auswertung.termine) {
    const auswertbar = istAuswertbar(termin, auswertung.jetzt);
    const tn = auswertbar ? termin.tnTatsaechlich : null;
    termine.addRow({
      beginn: formatDatumZeit(termin.beginn), ende: formatDatumZeit(termin.ende), titel: sichereZelle(termin.titel),
      referenten: sichereZelle(termin.referenten.map(({ referent }) => `${referent.vorname} ${referent.nachname}`).join(", ")),
      art: organisationsformLabel(termin.organisationsform), format: formatLabel(termin.format), ort: sichereZelle(termin.veranstaltungsort?.name ?? T.allgemein.ortNachAbsprache),
      status: statusLabel(termin.status), plaetze: termin.maxTn, teilnahmen: tn,
      meldestand: auswertbar ? (tn === null ? "Offen" : "Gemeldet") : "Nicht auswertbar",
      auslastung: tn !== null && termin.maxTn !== null && termin.maxTn > 0 ? tn / termin.maxTn : null,
    });
  }
  termine.autoFilter = { from: "A1", to: { row: 1, column: termine.columnCount } };

  for (const blatt of mappe.worksheets) {
    blatt.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    blatt.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF23483F" } };
    blatt.getRow(1).height = 26;
    blatt.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:1" };
  }
  return mappe;
}

function sichereZelle(wert: string | number | null): string | number | null {
  return typeof wert === "string" && /^[=+\-@\t\r]/.test(wert) ? `'${wert}` : wert;
}
