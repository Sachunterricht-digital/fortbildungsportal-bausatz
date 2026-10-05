import { ladeSchulamt } from "@/lib/schulamt";
import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";

import { prisma } from "@/lib/prisma";
import { fortbildungScope, getSessionUser } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import { archivAusblenden, filterZuWhere, leseFilter, type SuchParameter } from "@/lib/filter";
import { berlinIsoDatum, formatDatumZeit } from "@/lib/datetime";
import { fibsStatusText } from "@/lib/fibs/status";
import {
  formatLabel,
  niveaustufeLabel,
  organisationsformLabel,
  ortAnzeige,
  schulartLabel,
  statusLabel,
} from "@/constants/fortbildung";
import { T } from "@/texte/de";

export const dynamic = "force-dynamic";

const REITER_FILTER: Record<string, Record<string, string>> = {
  regional: { organisationsform: "REGIONAL" },
  schilf: { organisationsform: "SCHILF" },
  alp: { organisationsform: "ALP" },
  eingereicht: { status: "EINGEREICHT" },
  entwuerfe: { status: "ENTWURF" },
};

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  const schulamt = await ladeSchulamt();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const params: SuchParameter = Object.fromEntries(
    request.nextUrl.searchParams.entries(),
  );
  const reiter = typeof params.reiter === "string" ? params.reiter : "";
  const filter = { ...leseFilter(params), ...(REITER_FILTER[reiter] ?? {}) };

  const where = {
    AND: [
      // Referentinnen und Referenten exportieren nur ihre eigenen Termine.
      fortbildungScope(user),
      filterZuWhere(filter),
      ...archivAusblenden(filter),
    ],
  };

  const fortbildungen = await prisma.fortbildung.findMany({
    where,
    // Nach Ebene gruppiert, innerhalb der Ebene nach Datum — dieselbe
    // Gliederung wie im PDF-Bericht.
    orderBy: [{ organisationsform: "asc" }, { beginn: "asc" }],
    include: {
      veranstaltungsort: true,
      schlagworte: { include: { schlagwort: true } },
      kompetenzen: { include: { kompetenz: true } },
      referenten: { include: { referent: true } },
    },
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = `Fortbildungsportal · ${schulamt.name}`;
  workbook.created = new Date();

  const blatt = workbook.addWorksheet("Fortbildungen", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  blatt.columns = [
    { header: "Beginn", key: "beginn", width: 18 },
    { header: "Ende", key: "ende", width: 18 },
    { header: "Lehrgangstitel", key: "titel", width: 45 },
    { header: "Kurztitel", key: "kurztitel", width: 25 },
    { header: "Organisationsform", key: "organisationsform", width: 20 },
    { header: "Format", key: "format", width: 12 },
    { header: "Veranstaltungsort", key: "ort", width: 30 },
    { header: "Plätze geplant", key: "maxTn", width: 13 },
    { header: "TN tatsächlich", key: "tnIst", width: 13 },
    { header: "TN-Bemerkung", key: "tnBemerkung", width: 26 },
    { header: "Schularten", key: "schularten", width: 28 },
    { header: "Fach", key: "fach", width: 16 },
    { header: "Niveaustufe", key: "niveaustufe", width: 16 },
    { header: "Kompetenzen", key: "kompetenzen", width: 30 },
    { header: "Schlagworte", key: "schlagworte", width: 30 },
    { header: "Referenten", key: "referenten", width: 30 },
    { header: "Status", key: "status", width: 22 },
    { header: "FIBS-Status", key: "inFibs", width: 22 },
    { header: "FIBS-Nummer", key: "fibs", width: 18 },
    { header: "FIBS-Link", key: "fibsUrl", width: 40 },
  ];

  blatt.getRow(1).font = { bold: true };

  const jetzt = new Date();
  for (const f of fortbildungen) {
    blatt.addRow({
      beginn: zelle(formatDatumZeit(f.beginn)),
      ende: zelle(formatDatumZeit(f.ende)),
      titel: zelle(f.titel),
      kurztitel: zelle(f.kurztitel ?? ""),
      organisationsform: zelle(organisationsformLabel(f.organisationsform)),
      format: zelle(formatLabel(f.format)),
      ort: zelle(ortAnzeige(f.ortText, f.veranstaltungsort) ?? T.allgemein.ortNachAbsprache),
      maxTn: f.maxTn,
      // Leer statt 0, wenn noch nichts gemeldet wurde — sonst verfälscht die
      // Meldelücke jede Summenbildung in der Tabellenkalkulation.
      tnIst: f.tnTatsaechlich ?? "",
      tnBemerkung: zelle(f.tnBemerkung ?? ""),
      schularten: zelle(f.schularten.map(schulartLabel).join(", ")),
      fach: zelle(f.fach ?? ""),
      niveaustufe: zelle(f.niveaustufe ? niveaustufeLabel(f.niveaustufe) : ""),
      kompetenzen: zelle(
        f.kompetenzen
          .map((k) => `${k.kompetenz.code} ${k.kompetenz.titel}`)
          .sort()
          .join("; "),
      ),
      schlagworte: zelle(f.schlagworte.map((s) => s.schlagwort.name).join(", ")),
      // Nur Namen — Kontaktdaten der Referenten gehören nicht in eine Datei,
      // die per Mail weitergereicht wird.
      referenten: zelle(
        f.referenten
          .map((r) => `${r.referent.vorname} ${r.referent.nachname}`)
          .join(", "),
      ),
      status: zelle(statusLabel(f.status)),
      inFibs: fibsStatusText({
        organisationsform: f.organisationsform,
        inFibs: f.inFibs,
        ende: f.ende,
        status: f.status,
        jetzt,
      }),
      fibs: zelle(f.fibsLehrgangsnummer ?? ""),
      fibsUrl: zelle(f.fibsUrl ?? ""),
    });
  }

  blatt.autoFilter = { from: "A1", to: { row: 1, column: blatt.columnCount } };

  await auditLog({
    userId: user.id,
    aktion: "UPDATE",
    entitaet: "Export",
    details: { anzahl: fortbildungen.length, reiter: reiter || "alle" },
  });

  const puffer = await workbook.xlsx.writeBuffer();
  const dateiname = `fortbildungen-${berlinIsoDatum(new Date())}.xlsx`;

  return new NextResponse(puffer as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${dateiname}"`,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Schutz vor Formel-Injektion: Tabellenprogramme werten einen Zellinhalt, der
 * mit = + - @ beginnt, als Formel aus. Ein Titel wie "=HYPERLINK(...)" würde
 * beim Öffnen des Exports ausgeführt.
 */
function zelle(wert: string): string {
  return /^[=+\-@\t\r]/.test(wert) ? `'${wert}` : wert;
}
