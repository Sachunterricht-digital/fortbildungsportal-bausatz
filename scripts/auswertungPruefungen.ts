import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { auswertungsFilterZuWhere, berechneKennzahlen, erstelleAuswertung, leseAuswertungsFilter, type AuswertungsTermin } from "../src/lib/auswertung";
import { erstelleAuswertungsmappe } from "../src/lib/auswertungExcel";

const jetzt = new Date("2026-09-21T12:00:00Z");
const anna = { id: "anna", vorname: "Anna", nachname: "Muster" };
const ben = { id: "ben", vorname: "Ben", nachname: "Beispiel" };
function termin(id: string, aenderungen: Partial<AuswertungsTermin> = {}): AuswertungsTermin {
  return {
    id, titel: `Termin ${id}`, beginn: new Date("2026-09-10T10:00:00Z"), ende: new Date("2026-09-10T12:00:00Z"),
    status: "VEROEFFENTLICHT", organisationsform: "SCHILF", format: "PRAESENZ", niveaustufe: null,
    maxTn: 20, tnTatsaechlich: 10, ortText: null, veranstaltungsort: { name: "Schule" }, referenten: [{ referent: anna }],
    ...aenderungen,
  };
}

async function pruefeAuswertung() {
  const termine = [
    termin("gemeinsam", { referenten: [{ referent: anna }, { referent: ben }], tnTatsaechlich: 30 }),
    termin("null", { tnTatsaechlich: 0, maxTn: 10, status: "ARCHIVIERT" }),
    termin("offen", { tnTatsaechlich: null, maxTn: 100 }),
    termin("abgesagt", { status: "ABGESAGT", tnTatsaechlich: 999 }),
    termin("entwurf", { status: "ENTWURF", tnTatsaechlich: 999 }),
    termin("eingereicht", { status: "EINGEREICHT", tnTatsaechlich: 999 }),
    termin("zukuenftig", { beginn: new Date("2026-10-01T10:00:00Z"), ende: new Date("2026-10-01T12:00:00Z"), tnTatsaechlich: 999 }),
    termin("laufend", { ende: jetzt, tnTatsaechlich: 999 }),
  ];
  const auswertung = erstelleAuswertung(termine, jetzt);
  assert.deepEqual(auswertung.gesamt, { veranstaltungen: 8, beendet: 3, gemeldet: 2, offen: 1, abgesagt: 1, geplant: 2, vorbereitung: 2, teilnahmen: 30, durchschnitt: 15, auslastung: 1, meldequote: 2 / 3 });
  assert.equal(auswertung.referenten.find((zeile) => zeile.id === "anna")?.teilnahmen, 30);
  assert.equal(auswertung.referenten.find((zeile) => zeile.id === "ben")?.teilnahmen, 30);
  assert.equal(auswertung.referenten.find((zeile) => zeile.id === "ben")?.auslastung, 1.5);
  assert.equal(auswertung.monate.find((zeile) => zeile.id === "2026-10")?.teilnahmen, null);
  assert.equal(berechneKennzahlen([termin("nur-offen", { tnTatsaechlich: null })], jetzt).teilnahmen, null);
  assert.equal(berechneKennzahlen([termin("nur-null", { tnTatsaechlich: 0 })], jetzt).teilnahmen, 0);
  assert.equal(berechneKennzahlen([], jetzt).meldequote, null);
  assert.equal(berechneKennzahlen([termin("ohne-plaetze", { maxTn: 0 })], jetzt).auslastung, null);
  const ohneZuordnung = erstelleAuswertung([termin("ohne", { referenten: [] })], jetzt);
  assert.equal(ohneZuordnung.referenten[0].name, "Ohne Referentenzuordnung");
  assert.equal(ohneZuordnung.referenten[0].teilnahmen, 10);
  const namensgleich = erstelleAuswertung([termin("namen", { referenten: [{ referent: anna }, { referent: { ...anna, id: "andere-anna" } }] })], jetzt);
  assert.equal(namensgleich.referenten.length, 2);
  const monatswechsel = erstelleAuswertung([termin("berlin", { beginn: new Date("2026-08-31T22:30:00Z") })], jetzt);
  assert.equal(monatswechsel.monate[0].id, "2026-09");

  assert.equal(leseAuswertungsFilter({}, jetzt).schuljahr, "2026/2027");
  assert.equal(leseAuswertungsFilter({ schuljahr: "alle" }, jetzt).schuljahr, undefined);
  assert.equal(leseAuswertungsFilter({ schuljahr: ["2025/2026", "2026/2027"] }, jetzt).schuljahr, "2025/2026");
  assert.equal(leseAuswertungsFilter({ status: "ENTWURF", q: "versteckter Filter" }, jetzt).status, undefined);
  assert.throws(() => leseAuswertungsFilter({ schuljahr: "2026/2028" }, jetzt), /Schuljahr/);
  assert.throws(() => leseAuswertungsFilter({ von: "2026-02-31" }, jetzt), /Datum/);
  assert.throws(() => leseAuswertungsFilter({ von: "2026-13-01" }, jetzt), /Datum/);
  assert.throws(() => leseAuswertungsFilter({ von: "2026-09-30", bis: "2026-09-01" }, jetzt), /Enddatum/);
  assert.equal(leseAuswertungsFilter({ von: "2028-02-29" }, jetzt).von, "2028-02-29");
  assert.deepEqual(auswertungsFilterZuWhere({ von: "2026-03-29", bis: "2026-03-29" }), {
    AND: [{}, { ende: { gte: new Date("2026-03-28T23:00:00Z") } }, { beginn: { lte: new Date("2026-03-29T21:59:59.999Z") } }],
  });
  assert.deepEqual(auswertungsFilterZuWhere({ schuljahr: "2026/2027", referent: "anna" }), {
    AND: [{}, { beginn: { gte: new Date("2026-07-31T22:00:00Z"), lte: new Date("2027-07-31T21:59:59.999Z") } }, { referenten: { some: { referentId: "anna" } } }],
  });

  const mappe = erstelleAuswertungsmappe(auswertung, { schuljahr: "2026/2027" });
  const geladen = new ExcelJS.Workbook();
  await geladen.xlsx.load(await mappe.xlsx.writeBuffer());
  assert.equal(geladen.worksheets.length, 7);
  const blatt = geladen.getWorksheet("Veranstaltungen")!;
  assert.equal(blatt.rowCount, termine.length + 1);
  assert.equal(blatt.getCell("J2").value, 30);
  assert.equal(blatt.getCell("J3").value, 0);
  assert.equal(blatt.getCell("J4").value, null);
  assert.equal(blatt.getCell("K4").value, "Offen");
  assert.equal(blatt.getCell("J5").value, null);
  assert.equal(blatt.getCell("K5").value, "Nicht auswertbar");
  assert.equal(blatt.getCell("L2").value, 1.5);
  assert.equal(blatt.getCell("L2").numFmt, "0.0%");
  const gefaehrlicherTitel = erstelleAuswertungsmappe(erstelleAuswertung([termin("formel", { titel: '=HYPERLINK("beispiel")' })], jetzt), {});
  assert.equal(gefaehrlicherTitel.getWorksheet("Veranstaltungen")!.getCell("C2").value, '\'=HYPERLINK("beispiel")');
  console.log("Auswertung: Kennzahlen, Mehrfachzuordnung, Nullwerte, Status, Berliner Monatsgrenze, Filter und Excel-Rundlauf bestanden.");
}

pruefeAuswertung().catch((fehler) => { console.error(fehler); process.exitCode = 1; });
