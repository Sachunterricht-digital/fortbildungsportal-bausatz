import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { fortbildungKachelSelect, oeffentlicheFortbildungWhere } from "@/lib/queries";
import { berlinIsoDatum, formatMonatJahr } from "@/lib/datetime";
import { FERIEN_GEPFLEGT_BIS } from "@/lib/ferien";
import { Monatskalender } from "@/components/public/Monatskalender";
import { Button } from "@/components/ui/button";
import { T } from "@/texte/de";

export const metadata: Metadata = {
  title: T.aussen.kalenderSeite.metaTitel,
  description: T.aussen.kalenderSeite.metaBeschreibung,
};

export default async function KalenderSeite({
  searchParams,
}: {
  searchParams: Promise<{ monat?: string }>;
}) {
  const { monat } = await searchParams;
  const { jahr, monatsIndex } = leseMonat(monat);

  // Ein Monatsraster zeigt auch Tage der Nachbarmonate — die Abfrage muss
  // deshalb etwas großzügiger sein als der Monat selbst.
  const von = new Date(Date.UTC(jahr, monatsIndex - 1, 20));
  const bis = new Date(Date.UTC(jahr, monatsIndex + 1, 10));

  const fortbildungen = await prisma.fortbildung.findMany({
    where: {
      AND: [
        oeffentlicheFortbildungWhere(),
        { beginn: { lte: bis } },
        { ende: { gte: von } },
      ],
    },
    orderBy: { beginn: "asc" },
    select: fortbildungKachelSelect,
  });

  const anker = new Date(Date.UTC(jahr, monatsIndex, 15));
  const vorheriger = monatsSchluessel(jahr, monatsIndex - 1);
  const naechster = monatsSchluessel(jahr, monatsIndex + 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {formatMonatJahr(anker)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {T.aussen.kalenderSeite.anzahlTermine(fortbildungen.length)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button nativeButton={false}
            variant="outline"
            size="sm"
            render={<Link href={`/kalender?monat=${vorheriger}`} aria-label={T.aussen.kalenderSeite.vorherigerMonatAria}>
                <ChevronLeft className="size-4" aria-hidden />
                {T.aussen.kalenderSeite.zurueck}
              </Link>
            }
          />
          <Button nativeButton={false}
            variant="outline"
            size="sm"
            render={<Link href="/kalender">{T.aussen.kalenderSeite.heute}</Link>}
          />
          <Button nativeButton={false}
            variant="outline"
            size="sm"
            render={<Link href={`/kalender?monat=${naechster}`} aria-label={T.aussen.kalenderSeite.naechsterMonatAria}>
                {T.aussen.kalenderSeite.weiter}
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            }
          />
        </div>
      </div>

      <Monatskalender
        jahr={jahr}
        monatsIndex={monatsIndex}
        fortbildungen={fortbildungen}
      />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-regional" aria-hidden />
          {T.aussen.kalenderSeite.legendeRegional}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-schilf" aria-hidden />
          {T.aussen.kalenderSeite.legendeSchilf}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-ferien" aria-hidden />
          {T.aussen.kalenderSeite.legendeFerien}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-feiertag" aria-hidden />
          {T.aussen.kalenderSeite.legendeFeiertag}
        </span>
        <span>
          {T.aussen.kalenderSeite.ferienGepflegtBis(FERIEN_GEPFLEGT_BIS.split("-").reverse().join("."))}
        </span>
      </div>
    </div>
  );
}

/** "2026-09" aus der URL, sonst der laufende Monat. */
function leseMonat(wert: string | undefined): { jahr: number; monatsIndex: number } {
  const treffer = /^(\d{4})-(\d{2})$/.exec(wert ?? "");
  if (treffer) {
    const jahr = Number(treffer[1]);
    const monat = Number(treffer[2]);
    if (jahr >= 2000 && jahr <= 2100 && monat >= 1 && monat <= 12) {
      return { jahr, monatsIndex: monat - 1 };
    }
  }

  const [jahr, monat] = berlinIsoDatum(new Date()).split("-").map(Number);
  return { jahr: jahr!, monatsIndex: monat! - 1 };
}

function monatsSchluessel(jahr: number, monatsIndex: number): string {
  const datum = new Date(Date.UTC(jahr, monatsIndex, 1));
  return `${datum.getUTCFullYear()}-${String(datum.getUTCMonth() + 1).padStart(2, "0")}`;
}
