import Link from "next/link";
import { Fragment } from "react";

import {
  berlinIsoDatum,
  formatZeit,
  isoKalenderwoche,
  montagIndex,
  WOCHENTAGE_KURZ,
} from "@/lib/datetime";
import { ferienStatus } from "@/lib/ferien";
import { ebeneKlassen } from "@/constants/fortbildung";
import type { FortbildungKachel } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { T } from "@/texte/de";

/**
 * Monatsraster als Server Component — kein Client-JavaScript.
 *
 * Bayerische Ferien und Feiertage sind hinterlegt und farblich markiert, damit
 * auf einen Blick erkennbar ist, warum in einer Woche nichts stattfindet.
 * Auf schmalen Bildschirmen wird das Raster zur Liste (siehe unten): Ein
 * 7-Spalten-Gitter ist auf dem Telefon nicht lesbar.
 */
export function Monatskalender({
  jahr,
  monatsIndex,
  fortbildungen,
}: {
  jahr: number;
  monatsIndex: number;
  fortbildungen: FortbildungKachel[];
}) {
  const tage = rasterTage(jahr, monatsIndex);
  const heute = berlinIsoDatum(new Date());

  // Termine je Kalendertag — mehrtägige Lehrgänge erscheinen an jedem ihrer Tage.
  const nachTag = new Map<string, FortbildungKachel[]>();
  for (const f of fortbildungen) {
    for (const tag of tageEinerFortbildung(f)) {
      const liste = nachTag.get(tag);
      if (liste) liste.push(f);
      else nachTag.set(tag, [f]);
    }
  }

  return (
    <>
      {/* Rasteransicht ab Tablet-Breite */}
      <div className="hidden overflow-hidden border-2 border-foreground sm:block">
        <div className="grid grid-cols-[2.25rem_repeat(7,minmax(0,1fr))] border-b-2 border-foreground bg-card">
          <div className="etikett px-1 py-2 text-center text-muted-foreground">{T.aussen.monatskalender.kwSpalte}</div>
          {WOCHENTAGE_KURZ.map((tag) => (
            <div
              key={tag}
              className="etikett px-2 py-2 text-center text-muted-foreground"
            >
              {tag}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-[2.25rem_repeat(7,minmax(0,1fr))]">
          {tage.map((tag, index) => {
            const status = ferienStatus(new Date(`${tag.iso}T12:00:00Z`));
            const termine = nachTag.get(tag.iso) ?? [];

            return (
              <Fragment key={tag.iso}>
                {index % 7 === 0 ? (
                  <div className="zahl border-r border-b bg-muted/30 px-1 pt-1.5 text-center text-xs text-muted-foreground">
                    {tag.kalenderwoche}
                  </div>
                ) : null}
                <div
                  className={cn(
                    "min-h-28 border-r border-b p-1.5 last:border-r-0",
                    !tag.imMonat && "bg-muted/40",
                    status.art === "ferien" && "bg-ferien-weich",
                    status.art === "feiertag" && "bg-feiertag-weich",
                  )}
                >
                  <div className="mb-1 flex items-baseline justify-between gap-1">
                    <span
                      className={cn(
                        "zahl text-xs",
                        tag.imMonat ? "text-foreground" : "text-muted-foreground/50",
                        tag.iso === heute &&
                          "bg-primary px-1.5 py-0.5 font-semibold text-primary-foreground",
                      )}
                    >
                      {tag.tagesZahl}
                    </span>
                    {status.label && status.art !== "wochenende" ? (
                      <span className="etikett truncate text-[0.6rem] text-muted-foreground">
                        {status.label}
                      </span>
                    ) : null}
                  </div>

                  <div className="space-y-1">
                    {termine.map((f) => (
                      <TerminChip key={f.id + tag.iso} fortbildung={f} />
                    ))}
                  </div>
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>

      {/* Listenansicht auf dem Telefon */}
      <div className="space-y-2 sm:hidden">
        {tage
          .filter((tag) => tag.imMonat && (nachTag.get(tag.iso)?.length ?? 0) > 0)
          .map((tag) => {
            const status = ferienStatus(new Date(`${tag.iso}T12:00:00Z`));
            return (
              <div key={tag.iso} className="border-l-4 border-l-primary bg-card p-3">
                <p className="mb-2 text-sm font-medium">
                  {T.aussen.monatskalender.mobilKopf(tag.kalenderwoche, tag.tagesZahl, WOCHENTAGE_KURZ[tag.wochentag])}
                  {status.label ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {status.label}
                    </span>
                  ) : null}
                </p>
                <div className="space-y-1">
                  {(nachTag.get(tag.iso) ?? []).map((f) => (
                    <TerminChip key={f.id} fortbildung={f} />
                  ))}
                </div>
              </div>
            );
          })}

        {[...nachTag.keys()].length === 0 ? (
          <p className="border border-dashed py-12 text-center text-sm text-muted-foreground">
            {T.aussen.monatskalender.keinTermin}
          </p>
        ) : null}
      </div>
    </>
  );
}

function TerminChip({ fortbildung }: { fortbildung: FortbildungKachel }) {
  const ebene = ebeneKlassen(fortbildung.organisationsform);

  return (
    <Link
      href={`/fortbildungen/${fortbildung.slug}`}
      title={fortbildung.titel}
      className={cn(
        "block truncate px-1.5 py-1 text-[11px] leading-tight font-medium transition-opacity hover:opacity-80",
        ebene.weich,
        fortbildung.status === "ABGESAGT" && "line-through opacity-60",
      )}
    >
      <span className="zahl">{formatZeit(fortbildung.beginn)}</span>{" "}
      {fortbildung.kurztitel ?? fortbildung.titel}
    </Link>
  );
}

interface RasterTag {
  iso: string;
  tagesZahl: number;
  imMonat: boolean;
  wochentag: number;
  kalenderwoche: number;
}

/** Kalenderraster von Montag bis Sonntag, inklusive angrenzender Tage. */
function rasterTage(jahr: number, monatsIndex: number): RasterTag[] {
  const erster = new Date(Date.UTC(jahr, monatsIndex, 1));
  const versatz = montagIndex(erster);

  const start = new Date(erster.getTime() - versatz * 24 * 60 * 60 * 1000);
  const tage: RasterTag[] = [];

  for (let i = 0; i < 42; i += 1) {
    const datum = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const imMonat = datum.getUTCMonth() === monatsIndex;

    tage.push({
      iso: berlinIsoDatum(datum),
      tagesZahl: datum.getUTCDate(),
      imMonat,
      wochentag: montagIndex(datum),
      kalenderwoche: isoKalenderwoche(datum),
    });

    // Sechste Zeile nur zeigen, wenn der Monat sie braucht.
    if (i >= 34 && i % 7 === 6 && !tage.slice(-7).some((t) => t.imMonat)) {
      return tage.slice(0, -7);
    }
  }

  return tage;
}

/** Alle Kalendertage, an denen eine Fortbildung läuft. */
function tageEinerFortbildung(f: FortbildungKachel): string[] {
  if (!f.beginn || !f.ende) return [];
  const start = berlinIsoDatum(f.beginn);
  const schluss = berlinIsoDatum(f.ende);
  if (start === schluss) return [start];

  const tage: string[] = [];
  let aktuell = new Date(`${start}T12:00:00Z`);
  const grenze = new Date(`${schluss}T12:00:00Z`);

  while (aktuell <= grenze && tage.length < 60) {
    tage.push(berlinIsoDatum(aktuell));
    aktuell = new Date(aktuell.getTime() + 24 * 60 * 60 * 1000);
  }

  return tage;
}
