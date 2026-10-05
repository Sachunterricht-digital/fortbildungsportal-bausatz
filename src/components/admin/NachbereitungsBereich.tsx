import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { fortbildungScope, requireRole } from "@/lib/auth";
import { TeilnehmerMeldung } from "@/components/admin/TeilnehmerMeldung";
import { NACHBEREITUNG_RUECKBLICK_TAGE } from "@/constants/fortbildung";

/**
 * Arbeitsbereich für die Nachbereitung vergangener Fortbildungen.
 *
 * Die Komponente übernimmt die Rollenprüfung selbst, damit sie sowohl als
 * eigenständige Seite als auch im Admin-Dashboard sicher verwendet werden kann.
 */
export async function NachbereitungsBereich({
  eingebettet = false,
}: {
  eingebettet?: boolean;
}) {
  const user = await requireRole("ADMIN", "REFERENT");
  const istAdmin = user.role === "ADMIN";

  const jetzt = new Date();
  const grenze = new Date(
    jetzt.getTime() - NACHBEREITUNG_RUECKBLICK_TAGE * 24 * 60 * 60 * 1000,
  );

  // Referent:innen sehen ausschließlich eigene beziehungsweise zugeordnete
  // SchiLf. Die Administration bearbeitet dagegen alle Veranstaltungen.
  const bereich = istAdmin
    ? {}
    : {
        AND: [fortbildungScope(user), { organisationsform: "SCHILF" }],
      };

  const vergangen = {
    AND: [
      bereich,
      { ende: { lt: jetzt, gte: grenze } },
      // Nur tatsächlich veröffentlichte oder inzwischen archivierte Termine
      // werden nachbereitet. Entwürfe und abgesagte Veranstaltungen gehören
      // nicht in diesen Arbeitsbereich.
      { status: { in: ["VEROEFFENTLICHT", "ARCHIVIERT"] } },
    ],
  };

  const [offenRoh, gemeldetRoh] = await Promise.all([
    prisma.fortbildung.findMany({
      where: {
        AND: [
          vergangen,
          istAdmin
            ? {
                OR: [
                  { tnTatsaechlich: null },
                  // SchiLf werden üblicherweise erst nach dem Termin in FIBS
                  // nachgetragen. Dieser Nachtrag gehört deshalb ausdrücklich
                  // zur administrativen Nachbereitung.
                  { organisationsform: "SCHILF", inFibs: false },
                  { teilnahmebestaetigungenReferentenVersandtAm: null },
                  { teilnahmebestaetigungenTeilnehmendeVersandtAm: null },
                ],
              }
            : { tnTatsaechlich: null },
        ],
      },
      orderBy: { beginn: "desc" },
      select: auswahl,
    }),
    prisma.fortbildung.findMany({
      where: {
        AND: [
          vergangen,
          istAdmin
            ? {
                tnTatsaechlich: { not: null },
                teilnahmebestaetigungenReferentenVersandtAm: { not: null },
                teilnahmebestaetigungenTeilnehmendeVersandtAm: { not: null },
                OR: [
                  { organisationsform: { not: "SCHILF" } },
                  { inFibs: true },
                ],
              }
            : { tnTatsaechlich: { not: null } },
        ],
      },
      orderBy: { beginn: "desc" },
      take: 50,
      select: auswahl,
    }),
  ]);

  // `vergangen` filtert bereits auf ein gesetztes `ende` — Nachbereitung ohne
  // Termin gibt es nicht (SchiLf auf Abruf, Video-Tutorial). TypeScript kennt
  // die Query aber nicht, deshalb hier zusätzlich zur Laufzeit prüfen.
  const offen = offenRoh.filter(hatTermin);
  const gemeldet = gemeldetRoh.filter(hatTermin);

  return (
    <section
      className={eingebettet ? "space-y-5 rounded-2xl border bg-card p-4 shadow-sm sm:p-5" : "max-w-4xl space-y-8"}
      aria-labelledby="nachbereitung-titel"
    >
      <div>
        {eingebettet ? (
          <h2 id="nachbereitung-titel" className="text-lg font-semibold tracking-tight">
            Nachbereitung
          </h2>
        ) : (
          <h1 id="nachbereitung-titel" className="text-2xl font-semibold tracking-tight">
            Nachbereitung
          </h1>
        )}
        <p
          className={
            eingebettet
              ? "mt-1 text-sm text-muted-foreground text-pretty"
              : "mt-1 max-w-2xl text-sm text-muted-foreground text-pretty"
          }
        >
          {eingebettet
            ? "Teilnehmerzahlen nachtragen und, als Administration, SchiLf in FIBS nachtragen sowie den Versand der Teilnahmebestätigungen bestätigen."
            : "Nach der Veranstaltung wird hier die tatsächliche Teilnehmerzahl gemeldet. Bei SchiLf trägt die Administration anschließend die Veranstaltung in FIBS nach. Danach bestätigt sie getrennt den Versand der Teilnahmebestätigungen für Referent:innen und Teilnehmende."}
          {user.role === "REFERENT"
            ? " Teilnehmerzahlen lassen sich nur für eigene oder zugeordnete SchiLf nachtragen."
            : ""}
        </p>
      </div>

      <section aria-labelledby="nachbereitung-offen">
        {eingebettet ? (
          <h3 id="nachbereitung-offen" className="mb-3 text-sm font-semibold">
            Offen in der Nachbereitung{" "}
            <span className="font-normal text-muted-foreground">({offen.length})</span>
          </h3>
        ) : (
          <h2 id="nachbereitung-offen" className="mb-3 text-sm font-semibold">
            Offen in der Nachbereitung{" "}
            <span className="font-normal text-muted-foreground">({offen.length})</span>
          </h2>
        )}

        {offen.length === 0 ? (
          <div className="rounded-2xl border border-l-4 border-l-primary bg-card py-14 text-center shadow-sm">
            <CheckCircle2
              className="mx-auto mb-3 size-7 text-muted-foreground/60"
              aria-hidden
            />
            <p className="font-medium">Alles erledigt.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {istAdmin
                ? "Für keine vergangene Veranstaltung fehlt eine Teilnehmerzahl, ein SchiLf-Nachtrag in FIBS oder eine Versandbestätigung."
                : "Für keine eigene vergangene SchiLf fehlt eine Teilnehmerzahl."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {offen.map((fortbildung) => (
              <TeilnehmerMeldung
                key={fortbildung.id}
                fortbildung={fortbildung}
                darfBestaetigungen={istAdmin}
              />
            ))}
          </div>
        )}
      </section>

      {gemeldet.length > 0 ? (
        <section aria-labelledby="nachbereitung-abgeschlossen">
          {eingebettet ? (
            <h3 id="nachbereitung-abgeschlossen" className="mb-3 text-sm font-semibold">
              Abgeschlossen{" "}
              <span className="font-normal text-muted-foreground">({gemeldet.length})</span>
            </h3>
          ) : (
            <h2 id="nachbereitung-abgeschlossen" className="mb-3 text-sm font-semibold">
              Abgeschlossen{" "}
              <span className="font-normal text-muted-foreground">({gemeldet.length})</span>
            </h2>
          )}

          <div className="space-y-3">
            {gemeldet.map((fortbildung) => (
              <TeilnehmerMeldung
                key={fortbildung.id}
                fortbildung={fortbildung}
                darfBestaetigungen={istAdmin}
              />
            ))}
          </div>
        </section>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Angezeigt werden Veranstaltungen der letzten {NACHBEREITUNG_RUECKBLICK_TAGE} Tage.
        Ältere lassen sich weiterhin über die{" "}
        <Link href="/admin" className="underline underline-offset-4">
          Fortbildungsübersicht
        </Link>{" "}
        aufrufen.
      </p>
    </section>
  );
}

const auswahl = {
  id: true,
  titel: true,
  organisationsform: true,
  format: true,
  beginn: true,
  ende: true,
  maxTn: true,
  inFibs: true,
  fibsEingetragenAm: true,
  tnTatsaechlich: true,
  tnBemerkung: true,
  tnGemeldetAm: true,
  ortText: true,
  veranstaltungsort: { select: { name: true, istOnline: true } },
  tnGemeldetVon: { select: { name: true, email: true } },
  teilnahmebestaetigungenReferentenVersandtAm: true,
  teilnahmebestaetigungenReferentenVersandtVon: { select: { name: true, email: true } },
  teilnahmebestaetigungenTeilnehmendeVersandtAm: true,
  teilnahmebestaetigungenTeilnehmendeVersandtVon: { select: { name: true, email: true } },
} as const;

type NachbereitungsZeile = Prisma.FortbildungGetPayload<{ select: typeof auswahl }>;

/**
 * Ohne Termin und Plätze gibt es nichts nachzubereiten. Der Ort ist seit dem
 * Freitext-Feld kein Pflichtkriterium mehr — er wird über ortAnzeige()
 * angezeigt und fällt sonst auf den alten Veranstaltungsort zurück.
 */
function hatTermin(
  f: NachbereitungsZeile,
): f is NachbereitungsZeile & {
  beginn: Date;
  ende: Date;
  maxTn: number;
} {
  return f.beginn !== null && f.ende !== null && f.maxTn !== null;
}
