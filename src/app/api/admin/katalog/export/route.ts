import { ladeSchulamt } from "@/lib/schulamt";
import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";

import { getSessionUser } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import { berlinIsoDatum, formatDatum, formatZeit } from "@/lib/datetime";
import { leseFilter, type SuchParameter } from "@/lib/filter";
import { katalogKurzbeschreibung, ladeKatalog } from "@/lib/katalog";
import {
  formatLabel,
  niveaustufeLabel,
  organisationsformLabel,
  ortAnzeige,
  schulartLabel,
} from "@/constants/fortbildung";
import { T } from "@/texte/de";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  const schulamt = await ladeSchulamt();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const params: SuchParameter = Object.fromEntries(request.nextUrl.searchParams.entries());
  const eintraege = await ladeKatalog(user, leseFilter(params));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = `Fortbildungsportal · ${schulamt.name}`;
  workbook.created = new Date();

  const blatt = workbook.addWorksheet("Fortbildungskatalog", {
    views: [{ state: "frozen", ySplit: 4 }],
  });

  // Die Spalten bewusst ohne `header` definieren: ExcelJS würde Header sonst
  // in Zeile 1 schreiben und damit den zusammengeführten Titel überschreiben.
  blatt.columns = [
    { key: "datum", width: 14 },
    { key: "zeit", width: 14 },
    { key: "titel", width: 42 },
    { key: "beschreibung", width: 58 },
    { key: "organisationsform", width: 21 },
    { key: "format", width: 13 },
    { key: "ort", width: 27 },
    { key: "schularten", width: 28 },
    { key: "fach", width: 17 },
    { key: "niveau", width: 19 },
    { key: "kompetenzen", width: 35 },
    { key: "schlagworte", width: 34 },
    { key: "referenten", width: 28 },
    { key: "teilnehmende", width: 15 },
  ];
  blatt.getColumn("datum").numFmt = "dd.mm.yyyy";

  blatt.mergeCells("A1:N1");
  blatt.getCell("A1").value = "Fortbildungskatalog";
  blatt.getCell("A1").font = { name: "Aptos Display", size: 18, bold: true, color: { argb: "FFFFFFFF" } };
  blatt.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D3869" } };
  blatt.getCell("A1").alignment = { vertical: "middle" };
  blatt.getRow(1).height = 32;

  blatt.mergeCells("A2:N2");
  blatt.getCell("A2").value = `${eintraege.length} Fortbildungen im laufenden Katalog · erstellt am ${formatDatum(new Date())}`;
  blatt.getCell("A2").font = { italic: true, color: { argb: "FF4B5563" } };
  blatt.getRow(2).height = 22;

  const kopf = blatt.getRow(4);
  kopf.values = [
    "Datum", "Zeit", "Titel", "Beschreibung", "Organisationsform", "Format",
    "Ort", "Schularten", "Fach", "DigCompEdu", "Kompetenzen", "Schlagworte",
    "Referenten", "Teilnehmende",
  ];
  kopf.font = { bold: true, color: { argb: "FFFFFFFF" } };
  kopf.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F5E9D" } };
  kopf.alignment = { vertical: "middle", wrapText: true };
  kopf.height = 28;

  for (const eintrag of eintraege) {
    const zeile = blatt.addRow({
      datum: excelDatum(eintrag.beginn) ?? T.allgemein.aufAbruf,
      zeit:
        eintrag.beginn && eintrag.ende
          ? `${formatZeit(eintrag.beginn)}-${formatZeit(eintrag.ende)} Uhr`
          : "",
      titel: zelle(eintrag.titel),
      beschreibung: zelle(katalogKurzbeschreibung(eintrag.beschreibungText, 900)),
      organisationsform: organisationsformLabel(eintrag.organisationsform),
      format: formatLabel(eintrag.format),
      ort: zelle(ortAnzeige(eintrag.ortText, eintrag.veranstaltungsort) ?? T.allgemein.ortNachAbsprache),
      schularten: eintrag.schularten.map(schulartLabel).join(", "),
      fach: zelle(eintrag.fach ?? ""),
      niveau: eintrag.niveaustufe ? niveaustufeLabel(eintrag.niveaustufe) : "",
      kompetenzen: zelle(eintrag.kompetenzen.map((k) => `${k.kompetenz.code} ${k.kompetenz.titel}`).sort().join("; ")),
      schlagworte: zelle(eintrag.schlagworte.map((s) => s.schlagwort.name).sort().join(", ")),
      referenten: zelle(eintrag.referenten.map((r) => `${r.referent.vorname} ${r.referent.nachname}`.trim()).join(", ")),
      teilnehmende: eintrag.tnTatsaechlich ?? "",
    });
    zeile.alignment = { vertical: "top", wrapText: true };
    zeile.height = 48;
    if (zeile.number % 2 === 1) {
      zeile.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F8FC" } };
    }
  }

  blatt.autoFilter = { from: "A4", to: { row: 4, column: blatt.columnCount } };
  blatt.views = [{ state: "frozen", ySplit: 4, showGridLines: false }];

  const hinweis = workbook.addWorksheet("Hinweise");
  hinweis.columns = [{ width: 26 }, { width: 92 }];
  hinweis.getCell("A1").value = "Fortbildungskatalog";
  hinweis.getCell("A1").font = { size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  hinweis.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D3869" } };
  hinweis.mergeCells("A1:B1");
  hinweis.getRow(1).height = 30;
  hinweis.getCell("A3").value = "Inhalt";
  hinweis.getCell("B3").value = "Der Export enthält eingereichte, veröffentlichte und abgesagte Fortbildungen des laufenden Katalogs, unabhängig vom Termin, entsprechend der aktuellen Filterung. Die Tabellenüberschriften lassen sich direkt filtern und sortieren.";
  hinweis.getCell("A4").value = "Datenschutz";
  hinweis.getCell("B4").value = "Der Katalog enthält keine Kontaktdaten von Referentinnen und Referenten. Er ist für die interne Weiterentwicklung des Fortbildungsangebots bestimmt.";
  for (const zeile of [3, 4]) {
    hinweis.getCell(`A${zeile}`).alignment = { vertical: "top", wrapText: true };
    hinweis.getCell(`B${zeile}`).alignment = { vertical: "top", wrapText: true };
    hinweis.getCell(`A${zeile}`).font = { bold: true };
  }
  hinweis.getRow(3).height = 40;
  hinweis.getRow(4).height = 40;
  hinweis.views = [{ showGridLines: false }];

  await auditLog({
    userId: user.id,
    aktion: "UPDATE",
    entitaet: "KatalogExport",
    details: { format: "xlsx", anzahl: eintraege.length },
  });

  const puffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(puffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="fortbildungskatalog-${berlinIsoDatum(new Date())}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Schutz vor Formel-Injektion in Tabellenprogrammen. */
function zelle(wert: string): string {
  return /^[=+\-@\t\r]/.test(wert) ? `'${wert}` : wert;
}

/** Stabiler Excel-Kalendertag ohne Verschiebung durch die lokale Zeitzone. */
function excelDatum(datum: Date | null): Date | null {
  if (!datum) return null;
  const [jahr, monat, tag] = berlinIsoDatum(datum).split("-").map(Number);
  return new Date(Date.UTC(jahr!, monat! - 1, tag!, 12));
}
