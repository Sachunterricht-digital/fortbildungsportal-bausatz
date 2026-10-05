import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { ladeTerminumfeld } from "@/actions/terminumfeld";
import { ERFASSER, REDAKTION, requireRole } from "@/lib/auth";
import { berlinIsoDatum, formatMonatJahr } from "@/lib/datetime";
import { AUSGEGRAUT } from "@/constants/funktionen";
import { Planungskalender } from "@/components/admin/Planungskalender";
import { Button } from "@/components/ui/button";
import { T } from "@/texte/de";

export const metadata: Metadata = { title: "Planungskalender" };

export default async function PlanungskalenderSeite({
  searchParams,
}: {
  searchParams: Promise<{ monat?: string }>;
}) {
  const user = await requireRole(...ERFASSER);

  if (AUSGEGRAUT.planungskalender) {
    return (
      <div className="max-w-4xl">
        <h1 className="text-2xl font-semibold tracking-tight">Planungskalender</h1>
        <p className="mt-4 text-sm text-muted-foreground">{T.allgemein.kommtSpaeter}</p>
      </div>
    );
  }

  const { monat } = await searchParams;
  const { jahr, monatsIndex } = leseMonat(monat);
  const anker = new Date(Date.UTC(jahr, monatsIndex, 15, 12));

  // Bewusst über ladeTerminumfeld(): Dort ist die einzige projektweit
  // erlaubte Abfrage über fremde Veranstaltungen gekapselt.
  const { termine } = await ladeTerminumfeld({
    beginn: anker.toISOString(),
    ende: anker.toISOString(),
    referentIds: [],
    ausserId: null,
  });

  const vorheriger = monatsSchluessel(jahr, monatsIndex - 1);
  const naechster = monatsSchluessel(jahr, monatsIndex + 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="etikett text-primary">Gemeinsam planen</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {formatMonatJahr(anker)}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Mehrere Termine an einem Tag werden hervorgehoben; Details zu
            Inhalt, Zeit und Ort stehen unter dem Kalender.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            nativeButton={false}
            variant="outline"
            size="sm"
            render={
              <Link
                href={`/admin/kalender?monat=${vorheriger}`}
                aria-label="Vorheriger Monat"
              >
                <ChevronLeft className="size-4" aria-hidden />
                Zurück
              </Link>
            }
          />
          <Button
            nativeButton={false}
            variant="outline"
            size="sm"
            render={<Link href="/admin/kalender">Heute</Link>}
          />
          <Button
            nativeButton={false}
            variant="outline"
            size="sm"
            render={
              <Link
                href={`/admin/kalender?monat=${naechster}`}
                aria-label="Nächster Monat"
              >
                Weiter
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            }
          />
        </div>
      </div>

      <Planungskalender
        jahr={jahr}
        monatsIndex={monatsIndex}
        termine={termine}
        darfAlleOeffnen={REDAKTION.includes(user.role)}
      />
    </div>
  );
}

/** "2026-09" aus der URL, sonst der laufende Berliner Monat. */
function leseMonat(wert: string | undefined): {
  jahr: number;
  monatsIndex: number;
} {
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
