import { ladeSchulamt } from "@/lib/schulamt";
import { NextResponse, type NextRequest } from "next/server";
import { jsPDF } from "jspdf";

import { prisma } from "@/lib/prisma";
import { ERFASSER, fortbildungScope, getSessionUser } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import { ladeLogo } from "@/lib/logo";
import { zeichneQr } from "@/lib/qrZeichnen";
import { htmlZuText } from "@/lib/sanitize";
import { formatDatumLang, formatZeit } from "@/lib/datetime";
import { bestimmeFibsAnmeldestatus } from "@/lib/fibs/status";
import {
  formatLabel,
  niveaustufeLabel,
  organisationsformKurz,
  ortAnzeige,
  schulartLabel,
} from "@/constants/fortbildung";
import { AUSGEGRAUT } from "@/constants/funktionen";
import { T } from "@/texte/de";

export const dynamic = "force-dynamic";

/**
 * Wappenfarben als RGB — dieselben wie im Frontend, nur im Farbraum, den
 * jsPDF versteht.
 */
const BLAU: [number, number, number] = [29, 56, 105];
const GRAU: [number, number, number] = [112, 116, 126];
const PAPIER: [number, number, number] = [246, 244, 238];

/**
 * Aushang für das Lehrerzimmer: eine A4-Seite je Fortbildung.
 *
 * Gedacht zum Ausdrucken und Anpinnen — deshalb große Typografie, viel Weiß
 * und ein QR-Code, über den Lehrkräfte direkt auf die Detailseite kommen.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (AUSGEGRAUT.aushang) {
    return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });
  }

  const user = await getSessionUser();
  const schulamt = await ladeSchulamt();
  if (!user || !ERFASSER.includes(user.role)) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const { id } = await params;

  const fortbildung = await prisma.fortbildung.findFirst({
    where: { AND: [{ id }, fortbildungScope(user)] },
    include: {
      veranstaltungsort: true,
      referenten: {
        where: { referent: { oeffentlichSichtbar: true } },
        include: { referent: true },
      },
    },
  });

  if (!fortbildung) {
    return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });
  }

  const basis = (
    process.env.APP_BASE_URL ?? request.nextUrl.origin
  ).replace(/\/+$/, "");
  const adresse = `${basis}/fortbildungen/${fortbildung.slug}`;
  const anmeldestatus = bestimmeFibsAnmeldestatus(fortbildung);
  const teilnahmeSchulintern = anmeldestatus === "SCHILF_INTERN";

  // compress: Der gestaltete QR-Code besteht aus mehreren hundert
  // Vektorformen — unkomprimiert wäre die Datei über ein Megabyte groß.
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });
  const breite = doc.internal.pageSize.getWidth();
  const hoehe = doc.internal.pageSize.getHeight();
  const rand = 20;
  const inhalt = breite - 2 * rand;

  // --- Kopfbalken ---------------------------------------------------------
  doc.setFillColor(...BLAU);
  doc.rect(0, 0, breite, 6, "F");

  let y = 28;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BLAU);
  doc.text(
    `${organisationsformKurz(fortbildung.organisationsform)}  ·  ${formatLabel(fortbildung.format).toUpperCase()}`,
    rand,
    y,
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRAU);
  const schulamtZeilen = doc.splitTextToSize(schulamt.kurzname, inhalt / 2) as string[];
  doc.text(schulamtZeilen, breite - rand, y, {
    align: "right",
  });

  // --- Titel --------------------------------------------------------------
  y += 14 + (schulamtZeilen.length - 1) * 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(20, 24, 32);

  const titelZeilen = doc.splitTextToSize(fortbildung.titel, inhalt) as string[];
  doc.text(titelZeilen, rand, y);
  y += titelZeilen.length * 11;

  if (fortbildung.kurztitel) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(13);
    doc.setTextColor(...GRAU);
    const zeilen = doc.splitTextToSize(fortbildung.kurztitel, inhalt) as string[];
    doc.text(zeilen, rand, y + 2);
    y += zeilen.length * 6 + 2;
  }

  // --- Eckdaten in einem farbigen Feld ------------------------------------
  y += 8;
  const feldHoehe = 34;
  doc.setFillColor(...PAPIER);
  doc.rect(rand, y, inhalt, feldHoehe, "F");
  doc.setFillColor(...BLAU);
  doc.rect(rand, y, 1.5, feldHoehe, "F");

  const spalte = inhalt / 2;
  const angabe = (
    x: number,
    zeile: number,
    beschriftung: string,
    wert: string,
  ) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRAU);
    doc.text(beschriftung.toUpperCase(), x, y + 9 + zeile * 13);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20, 24, 32);
    doc.text(wert, x, y + 15 + zeile * 13);
  };

  angabe(
    rand + 6,
    0,
    "Termin",
    `${formatDatumLang(fortbildung.beginn)}`,
  );
  angabe(
    rand + 6,
    1,
    "Uhrzeit",
    fortbildung.beginn && fortbildung.ende
      ? `${formatZeit(fortbildung.beginn)} bis ${formatZeit(fortbildung.ende)} Uhr`
      : T.allgemein.aufAbruf,
  );
  angabe(
    rand + spalte,
    0,
    "Ort",
    ortAnzeige(fortbildung.ortText, fortbildung.veranstaltungsort) ?? T.allgemein.ortNachAbsprache,
  );
  angabe(
    rand + spalte,
    1,
    "Plätze",
    fortbildung.maxTn === null
      ? T.allgemein.ohneAngabe
      : `${fortbildung.maxTn} Teilnehmende`,
  );

  y += feldHoehe + 12;

  // --- Beschreibung -------------------------------------------------------
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(45, 50, 60);

  // Der QR-Code sitzt unten rechts, deshalb bekommt der Text nur so viel
  // Platz, dass er nicht darunter läuft.
  const qrKante = 45;
  const qrOben = hoehe - rand - qrKante - 12;

  const text = htmlZuText(fortbildung.beschreibungHtml);
  const textZeilen = doc.splitTextToSize(text, inhalt) as string[];
  const maxZeilen = Math.floor((qrOben - y - 30) / 5.6);
  const gekuerzt = textZeilen.slice(0, Math.max(0, maxZeilen));
  if (textZeilen.length > gekuerzt.length && gekuerzt.length > 0) {
    gekuerzt[gekuerzt.length - 1] += " …";
  }

  doc.text(gekuerzt, rand, y, { lineHeightFactor: 1.45 });
  y += gekuerzt.length * 5.6 + 8;

  // --- Zielgruppe, Leitung, Niveaustufe ----------------------------------
  doc.setFontSize(9.5);

  const fusszeilen: string[] = [
    `Zielgruppe: ${fortbildung.schularten.map(schulartLabel).join(", ")}`,
  ];
  if (fortbildung.fach) fusszeilen.push(`Fach: ${fortbildung.fach}`);
  if (fortbildung.niveaustufe) {
    fusszeilen.push(`DigCompEdu: ${niveaustufeLabel(fortbildung.niveaustufe)}`);
  }
  if (fortbildung.referenten.length > 0) {
    fusszeilen.push(
      `Leitung: ${fortbildung.referenten
        .map((r) => `${r.referent.vorname} ${r.referent.nachname}`)
        .join(", ")}`,
    );
  }

  doc.setTextColor(...GRAU);
  for (const zeile of fusszeilen) {
    doc.text(zeile, rand, y);
    y += 5.5;
  }

  // --- QR-Code mit Anmeldehinweis ----------------------------------------
  // Trennlinie, damit der Weißraum über dem Aufruf als gewollter Abstand
  // liest und nicht als vergessener Inhalt.
  doc.setDrawColor(220, 226, 234);
  doc.setLineWidth(0.4);
  doc.line(rand, qrOben - 8, breite - rand, qrOben - 8);

  const qrLinks = breite - rand - qrKante;

  zeichneQr(doc, adresse, {
    x: qrLinks,
    y: qrOben,
    groesse: qrKante,
    farbe: BLAU,
    logo: (await ladeLogo()) ?? undefined,
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...BLAU);
  doc.text(
    teilnahmeSchulintern ? "Alle Infos zum Termin" : "Alle Infos und Anmeldung",
    rand,
    qrOben + 10,
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(45, 50, 60);
  const hinweis = teilnahmeSchulintern
    ? "Code scannen - die Teilnahme wird schulintern organisiert."
    : fortbildung.fibsLehrgangsnummer
      ? `Code scannen oder in FIBS nach der Lehrgangsnummer ${fortbildung.fibsLehrgangsnummer} suchen.`
      : anmeldestatus === "FIBS_OFFEN"
        ? "Code scannen - die Anmeldung läuft über FIBS."
        : "Code scannen - der FIBS-Anmeldelink wird ergänzt, sobald er verfügbar ist.";
  doc.text(
    doc.splitTextToSize(hinweis, inhalt - qrKante - 10) as string[],
    rand,
    qrOben + 17,
    { lineHeightFactor: 1.4 },
  );

  doc.setFontSize(8);
  doc.setTextColor(...GRAU);
  doc.text(adresse.replace(/^https?:\/\//, ""), rand, qrOben + qrKante - 2);

  // --- Fußbalken ----------------------------------------------------------
  doc.setFillColor(...BLAU);
  doc.rect(0, hoehe - 4, breite, 4, "F");

  await auditLog({
    userId: user.id,
    aktion: "UPDATE",
    entitaet: "Aushang",
    entitaetId: fortbildung.id,
  });

  const dateiname = `aushang-${fortbildung.slug}.pdf`;

  return new NextResponse(Buffer.from(doc.output("arraybuffer")), {
    headers: {
      "Content-Type": "application/pdf",
      // inline, damit der Aushang im Browser aufgeht und direkt gedruckt
      // werden kann — genau dafür ist er gedacht.
      "Content-Disposition": `inline; filename="${dateiname}"`,
      "Cache-Control": "no-store",
    },
  });
}
