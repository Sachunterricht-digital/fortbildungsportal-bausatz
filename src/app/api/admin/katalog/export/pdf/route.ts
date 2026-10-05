import { ladeSchulamt } from "@/lib/schulamt";
import { NextResponse, type NextRequest } from "next/server";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { getSessionUser } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import { berlinIsoDatum, formatDatum, formatDatumZeit, formatZeit } from "@/lib/datetime";
import { leseFilter, type SuchParameter } from "@/lib/filter";
import { katalogKurzbeschreibung, ladeKatalog } from "@/lib/katalog";
import { formatLabel, organisationsformKurz, ortAnzeige } from "@/constants/fortbildung";
import { T } from "@/texte/de";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  const schulamt = await ladeSchulamt();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const params: SuchParameter = Object.fromEntries(request.nextUrl.searchParams.entries());
  const eintraege = await ladeKatalog(user, leseFilter(params));

  // Die eingebauten jsPDF-Schriften sind WinAnsi-kodiert. Deshalb nur
  // Bindestriche verwenden, damit in allen PDFs die Inhalte vollständig lesbar bleiben.
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const breite = doc.internal.pageSize.getWidth();
  const rand = 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const schulamtZeilen = doc.splitTextToSize(pdfText(schulamt.name), breite - 2 * rand - 65) as string[];
  const kopfZusatz = (schulamtZeilen.length - 1) * 4;
  doc.setFillColor(29, 56, 105);
  doc.rect(0, 0, breite, 31 + kopfZusatz, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("Fortbildungskatalog", rand, 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(schulamtZeilen, rand, 22);
  doc.text(`${eintraege.length} Fortbildungen im laufenden Katalog`, breite - rand, 22, { align: "right" });
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 38 + kopfZusatz,
    margin: { left: rand, right: rand },
    head: [["Datum", "Fortbildung und Inhalt", "Art", "Ort", "Schlagworte", "Referenten"]],
    body: eintraege.map((eintrag) =>
      [
        // SchiLf auf Abruf hat keinen Termin — formatDatum liefert dafür
        // bereits "Auf Abruf", eine Uhrzeit gibt es dann nicht dazu.
        eintrag.beginn && eintrag.ende
          ? `${formatDatum(eintrag.beginn)}\n${formatZeit(eintrag.beginn)}-${formatZeit(eintrag.ende)} Uhr`
          : formatDatum(eintrag.beginn),
        [
          eintrag.titel,
          katalogKurzbeschreibung(eintrag.beschreibungText, 430) ||
            "Keine Beschreibung hinterlegt.",
          eintrag.fach ? `Fach: ${eintrag.fach}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        `${organisationsformKurz(eintrag.organisationsform)}\n${formatLabel(eintrag.format)}`,
        ortAnzeige(eintrag.ortText, eintrag.veranstaltungsort) ?? T.allgemein.ortNachAbsprache,
        eintrag.schlagworte.map((s) => s.schlagwort.name).sort().join(", ") ||
          "-",
        eintrag.referenten
          .map((r) =>
            `${r.referent.vorname} ${r.referent.nachname}`.trim(),
          )
          .join(", ") || "-",
      ].map(pdfText),
    ),
    styles: { font: "helvetica", fontSize: 7.4, cellPadding: 2, overflow: "linebreak", valign: "top" },
    headStyles: { fillColor: [47, 94, 157], textColor: [255, 255, 255], fontSize: 7.5 },
    alternateRowStyles: { fillColor: [245, 248, 252] },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 78 },
      2: { cellWidth: 22 },
      3: { cellWidth: 39 },
      4: { cellWidth: 54 },
      5: { cellWidth: 42 },
    },
    didParseCell(data) {
      if (data.section === "body" && data.column.index === 1) {
        data.cell.styles.fontStyle = "normal";
      }
    },
  });

  const seiten = doc.getNumberOfPages();
  for (let seite = 1; seite <= seiten; seite += 1) {
    doc.setPage(seite);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(105);
    doc.text(`Erstellt am ${formatDatumZeit(new Date())} - Seite ${seite} von ${seiten}`, breite - rand, doc.internal.pageSize.getHeight() - 7, { align: "right" });
  }

  await auditLog({
    userId: user.id,
    aktion: "UPDATE",
    entitaet: "KatalogExport",
    details: { format: "pdf", anzahl: eintraege.length },
  });

  return new NextResponse(Buffer.from(doc.output("arraybuffer")), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="fortbildungskatalog-${berlinIsoDatum(new Date())}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * jsPDFs Standardschrift ist WinAnsi-kodiert. Häufige typografische Zeichen
 * lesbar ersetzen; nicht darstellbare Symbole werden sichtbar markiert statt
 * still verschluckt.
 */
function pdfText(wert: string): string {
  return wert
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[“”„]/g, '"')
    .replace(/[‘’‚]/g, "'")
    .replace(/…/g, "...")
    .replace(/→/g, "->")
    .replace(/←/g, "<-")
    .replace(/•/g, "*")
    .replace(/\u00a0/g, " ")
    .replace(/[^\t\n\r\x20-\x7e\xa0-\xff€]/g, "?");
}
