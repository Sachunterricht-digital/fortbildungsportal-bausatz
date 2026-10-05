import { ladeKalenderKennung, ladeSchulamt } from "@/lib/schulamt";
import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { filterZuWhere, leseFilter, type SuchParameter } from "@/lib/filter";
import { oeffentlicheFortbildungWhere } from "@/lib/queries";
import { htmlZuText } from "@/lib/sanitize";
import { bestimmeFibsAnmeldestatus } from "@/lib/fibs/status";
import { ortAnzeige } from "@/constants/fortbildung";
import { T } from "@/texte/de";

export const dynamic = "force-dynamic";

/**
 * Abonnierbarer Kalenderfeed (RFC 5545).
 *
 * Ohne Parameter: alle veröffentlichten Termine — die Adresse lässt sich in
 * Outlook, Apple Kalender oder Thunderbird als Abo eintragen. Mit `slug`:
 * ein einzelner Termin zum Herunterladen. Alle Filter der Liste funktionieren
 * auch hier, ein Abo lässt sich also z. B. auf "nur Grundschule" begrenzen.
 *
 * Öffentlich zugänglich, aber ausschließlich mit Daten, die auch auf der
 * Webseite stehen — Referentennamen sind bewusst nicht enthalten.
 */
export async function GET(request: NextRequest) {
  const schulamt = await ladeSchulamt();
  const kalenderKennung = await ladeKalenderKennung();
  const params: SuchParameter = Object.fromEntries(
    request.nextUrl.searchParams.entries(),
  );
  const slug = typeof params.slug === "string" ? params.slug : undefined;

  const fortbildungen = await prisma.fortbildung.findMany({
    where: {
      AND: [
        oeffentlicheFortbildungWhere(),
        slug ? { slug } : filterZuWhere(leseFilter(params)),
        // Ohne Einzelabruf nur ein sinnvolles Fenster: ein Jahr zurück,
        // alles Kommende. Sonst wächst das Abo unbegrenzt.
        slug
          ? {}
          : { ende: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } },
        // Angebote auf Abruf haben keinen Termin und gehören nicht ins Abo.
        { beginn: { not: null }, ende: { not: null } },
      ],
    },
    orderBy: { beginn: "asc" },
    select: {
      id: true,
      slug: true,
      titel: true,
      beschreibungHtml: true,
      beginn: true,
      ende: true,
      status: true,
      updatedAt: true,
      organisationsform: true,
      inFibs: true,
      fibsUrl: true,
      ortText: true,
      veranstaltungsort: { select: { name: true, ort: true, istOnline: true } },
    },
  });

  const basis = process.env.APP_BASE_URL ?? request.nextUrl.origin;

  const zeilen: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Fortbildungsportal//Fortbildungen//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...falte(`X-WR-CALNAME:${maskiere(T.aussen.ics.kalenderName(schulamt.kurzname))}`),
    "X-WR-TIMEZONE:Europe/Berlin",
  ];

  for (const f of fortbildungen) {
    if (!f.beginn || !f.ende) continue;
    const ort = ortAnzeige(f.ortText, f.veranstaltungsort) ?? T.allgemein.ortNachAbsprache;

    const anmeldestatus = bestimmeFibsAnmeldestatus(f);
    const anmeldehinweis =
      anmeldestatus === "FIBS_OFFEN"
        ? T.aussen.ics.anmeldungFibsLink(f.fibsUrl ?? "")
        : anmeldestatus === "SCHILF_INTERN"
          ? T.aussen.ics.teilnahmeSchulintern
          : anmeldestatus === "FIBS_OHNE_LINK"
            ? T.aussen.ics.fibsOhneLink
            : T.aussen.ics.anmeldungFolgt;

    const beschreibung = [
      htmlZuText(f.beschreibungHtml),
      "",
      T.aussen.ics.details(`${basis}/fortbildungen/${f.slug}`),
      anmeldehinweis,
    ].join("\n");

    zeilen.push(
      "BEGIN:VEVENT",
      `UID:${f.id}@${kalenderKennung}`,
      `DTSTAMP:${zuIcsZeit(f.updatedAt)}`,
      `DTSTART:${zuIcsZeit(f.beginn)}`,
      `DTEND:${zuIcsZeit(f.ende)}`,
      ...falte(
        `SUMMARY:${maskiere(
          f.status === "ABGESAGT" ? T.aussen.ics.abgesagtPrefix(f.titel) : f.titel,
        )}`,
      ),
      ...falte(`DESCRIPTION:${maskiere(beschreibung)}`),
      ...falte(`LOCATION:${maskiere(ort)}`),
      `URL:${basis}/fortbildungen/${f.slug}`,
      `STATUS:${f.status === "ABGESAGT" ? "CANCELLED" : "CONFIRMED"}`,
      "END:VEVENT",
    );
  }

  zeilen.push("END:VCALENDAR");

  const dateiname = slug ? `${slug}.ics` : "fortbildungen.ics";

  return new NextResponse(zeilen.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `${slug ? "attachment" : "inline"}; filename="${dateiname}"`,
      // Kalender-Clients fragen den Feed regelmäßig ab; eine Stunde Cache
      // entlastet den Server, ohne dass Änderungen lange unsichtbar bleiben.
      "Cache-Control": slug ? "no-store" : "public, max-age=3600",
    },
  });
}

/** UTC-Zeitstempel im ICS-Format: 20260915T140000Z */
function zuIcsZeit(datum: Date): string {
  return `${datum.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

/** Sonderzeichen nach RFC 5545 maskieren. */
function maskiere(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Zeilen auf 75 Oktette umbrechen (RFC 5545 "folding"). Ohne das verwerfen
 * strenge Kalender-Clients lange Beschreibungen.
 */
function falte(zeile: string): string[] {
  if (Buffer.byteLength(zeile, "utf8") <= 73) return [zeile];

  const teile: string[] = [];
  let aktuell = "";

  for (const zeichen of zeile) {
    const naechste = aktuell + zeichen;
    // Fortsetzungszeilen beginnen mit einem Leerzeichen, das mitzählt.
    if (Buffer.byteLength(naechste, "utf8") > (teile.length === 0 ? 73 : 72)) {
      teile.push(aktuell);
      aktuell = zeichen;
    } else {
      aktuell = naechste;
    }
  }

  if (aktuell) teile.push(aktuell);

  return teile.map((teil, i) => (i === 0 ? teil : ` ${teil}`));
}
