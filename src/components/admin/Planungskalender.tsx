import Link from "next/link";
import { Fragment } from "react";
import type { UmfeldTermin } from "@/actions/terminumfeld";
import {
  ebeneKlassen,
  statusLabel,
} from "@/constants/fortbildung";
import {
  berlinIsoDatum,
  formatZeit,
  formatZeitraum,
  isoKalenderwoche,
  montagIndex,
  WOCHENTAGE_KURZ,
} from "@/lib/datetime";
import { ferienStatus } from "@/lib/ferien";
import { cn } from "@/lib/utils";

export function Planungskalender({
  jahr,
  monatsIndex,
  termine,
  darfAlleOeffnen,
}: {
  jahr: number;
  monatsIndex: number;
  termine: UmfeldTermin[];
  darfAlleOeffnen: boolean;
}) {
  const tage = rasterTage(jahr, monatsIndex);
  const nachTag = new Map<string, UmfeldTermin[]>();

  for (const termin of termine) {
    for (const tag of tageZwischen(termin.beginn, termin.ende)) {
      const liste = nachTag.get(tag);
      if (liste) liste.push(termin);
      else nachTag.set(tag, [termin]);
    }
  }

  const tageImMonat = tage.filter((tag) => tag.imMonat);
  const belegteTage = tageImMonat.filter(
    (tag) => (nachTag.get(tag.iso)?.length ?? 0) > 0,
  );
  const ballungen = belegteTage.filter(
    (tag) => (nachTag.get(tag.iso)?.length ?? 0) >= 2,
  );
  const monatsPraefix = `${jahr}-${String(monatsIndex + 1).padStart(2, "0")}-`;
  const termineImMonat = termine.filter((termin) =>
    tageZwischen(termin.beginn, termin.ende).some((tag) =>
      tag.startsWith(monatsPraefix),
    ),
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Kennzahl wert={termineImMonat.length} label="Termine im Monat" />
        <Kennzahl wert={belegteTage.length} label="belegte Kalendertage" />
        <Kennzahl
          wert={ballungen.length}
          label="Tage mit mehreren Terminen"
          warnung={ballungen.length > 0}
        />
      </div>

      <div className="hidden overflow-hidden border-2 border-foreground sm:block">
        <div className="grid grid-cols-[2.25rem_repeat(7,minmax(0,1fr))] border-b-2 border-foreground bg-card">
          <div className="etikett px-1 py-2 text-center text-muted-foreground">KW</div>
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
          {tage.map((tag, index) => (
            <Fragment key={tag.iso}>
              {index % 7 === 0 ? (
                <div className="zahl border-r border-b bg-muted/30 px-1 pt-1.5 text-center text-xs text-muted-foreground">
                  {tag.kalenderwoche}
                </div>
              ) : null}
              <KalenderTag
                tag={tag}
                termine={nachTag.get(tag.iso) ?? []}
                darfAlleOeffnen={darfAlleOeffnen}
              />
            </Fragment>
          ))}
        </div>
      </div>

      <div className="space-y-2 sm:hidden">
        {belegteTage.map((tag) => {
          const tagTermine = nachTag.get(tag.iso) ?? [];
          const status = ferienStatus(new Date(`${tag.iso}T12:00:00Z`));

          return (
            <div key={tag.iso} className="border-l-4 border-l-primary bg-card p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  KW {tag.kalenderwoche} · {WOCHENTAGE_KURZ[tag.wochentag]}, {tag.tagesZahl}.
                </p>
                <Dichte anzahl={tagTermine.length} />
              </div>
              {status.label ? (
                <p className="mb-2 text-xs text-muted-foreground">{status.label}</p>
              ) : null}
              <div className="space-y-1">
                {tagTermine.map((termin) => (
                  <TerminChip
                    key={`${tag.iso}-${termin.id}`}
                    termin={termin}
                    tagIso={tag.iso}
                    darfAlleOeffnen={darfAlleOeffnen}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {belegteTage.length === 0 ? (
          <p className="border border-dashed py-12 text-center text-sm text-muted-foreground">
            In diesem Monat ist noch kein Termin geplant.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span>2 Termine: mögliche Ballung</span>
        <span>3+ Termine: deutliche Ballung</span>
      </div>

      <TerminDetails
        termine={termineImMonat}
        darfAlleOeffnen={darfAlleOeffnen}
      />
    </div>
  );
}

function Kennzahl({
  wert,
  label,
  warnung = false,
}: {
  wert: number;
  label: string;
  warnung?: boolean;
}) {
  return (
    <div className={cn("border-l-4 bg-card p-4", warnung ? "border-l-ferien" : "border-l-primary")}>
      <p className="zahl text-2xl font-semibold">{wert}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function KalenderTag({
  tag,
  termine,
  darfAlleOeffnen,
}: {
  tag: RasterTag;
  termine: UmfeldTermin[];
  darfAlleOeffnen: boolean;
}) {
  const status = ferienStatus(new Date(`${tag.iso}T12:00:00Z`));

  return (
    <div
      className={cn(
        "min-h-32 border-r border-b p-1.5 last:border-r-0",
        !tag.imMonat && "bg-muted/40",
        status.art === "ferien" && "bg-ferien-weich",
        status.art === "feiertag" && "bg-feiertag-weich",
        termine.length === 2 && "ring-1 ring-inset ring-ferien/50",
        termine.length >= 3 && "ring-2 ring-inset ring-destructive/60",
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-1">
        <span
          className={cn(
            "zahl text-xs",
            tag.imMonat ? "text-foreground" : "text-muted-foreground/50",
          )}
        >
          {tag.tagesZahl}
        </span>
        {termine.length > 1 ? <Dichte anzahl={termine.length} /> : null}
      </div>

      {status.label && status.art !== "wochenende" ? (
        <p className="etikett mb-1 truncate text-[0.6rem] text-muted-foreground">
          {status.label}
        </p>
      ) : null}

      <div className="space-y-1">
        {termine.map((termin) => (
          <TerminChip
            key={`${tag.iso}-${termin.id}`}
            termin={termin}
            tagIso={tag.iso}
            darfAlleOeffnen={darfAlleOeffnen}
          />
        ))}
      </div>
    </div>
  );
}

function Dichte({ anzahl }: { anzahl: number }) {
  return (
    <span
      className={cn(
        "zahl rounded px-1.5 py-0.5 text-[10px] font-semibold",
        anzahl >= 3
          ? "bg-destructive text-white"
          : "bg-ferien text-white",
      )}
      title={`${anzahl} Termine an diesem Tag`}
    >
      {anzahl}×
    </span>
  );
}

function TerminChip({
  termin,
  tagIso,
  darfAlleOeffnen,
}: {
  termin: UmfeldTermin;
  tagIso: string;
  darfAlleOeffnen: boolean;
}) {
  const ebene = ebeneKlassen(termin.organisationsform);
  const starttag = berlinIsoDatum(new Date(termin.beginn));
  const endtag = berlinIsoDatum(new Date(termin.ende));
  const mehrtaegig = starttag !== endtag;
  const inhalt = (
    <>
      <span className="zahl shrink-0">
        {tagIso === starttag ? formatZeit(new Date(termin.beginn)) : "↳"}
      </span>
      <span className="min-w-0 truncate font-medium">{termin.titel}</span>
      {mehrtaegig ? <span className="sr-only">, mehrtägig</span> : null}
    </>
  );
  const klassen = cn(
    "flex min-w-0 items-baseline gap-1.5 px-1.5 py-1 text-[11px] leading-tight",
    ebene.weich,
  );

  return darfAlleOeffnen || termin.istEigener ? (
    <Link
      href={`/admin/fortbildungen/${termin.id}`}
      title={`${termin.titel}${mehrtaegig ? " (mehrtägig)" : ""}`}
      className={cn(klassen, "transition-opacity hover:opacity-75")}
    >
      {inhalt}
    </Link>
  ) : (
    <span
      title={`${termin.titel}${mehrtaegig ? " (mehrtägig)" : ""}`}
      className={klassen}
    >
      {inhalt}
    </span>
  );
}

function TerminDetails({
  termine,
  darfAlleOeffnen,
}: {
  termine: UmfeldTermin[];
  darfAlleOeffnen: boolean;
}) {
  if (termine.length === 0) return null;

  return (
    <section aria-labelledby="termin-details" className="space-y-3">
      <div>
        <p className="etikett text-primary">Inhalte im Überblick</p>
        <h2 id="termin-details" className="mt-1 text-lg font-semibold">
          Termine dieses Monats
        </h2>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {termine.map((termin) => {
          const ebene = ebeneKlassen(termin.organisationsform);
          const darfOeffnen = darfAlleOeffnen || termin.istEigener;

          return (
            <article
              key={termin.id}
              className={cn("border-l-4 bg-card p-4", ebene.kante)}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span className="zahl">
                  {formatZeitraum(
                    new Date(termin.beginn),
                    new Date(termin.ende),
                  )}
                </span>
                <span>· {termin.ortName ?? "Ort noch offen"}</span>
                <span>· {statusLabel(termin.status)}</span>
              </div>

              <h3 className="mt-2 font-semibold">
                {darfOeffnen ? (
                  <Link
                    href={`/admin/fortbildungen/${termin.id}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {termin.titel}
                  </Link>
                ) : (
                  termin.titel
                )}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                {termin.beschreibung || "Noch keine Beschreibung hinterlegt."}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

interface RasterTag {
  iso: string;
  tagesZahl: number;
  imMonat: boolean;
  wochentag: number;
  kalenderwoche: number;
}

function rasterTage(jahr: number, monatsIndex: number): RasterTag[] {
  const erster = new Date(Date.UTC(jahr, monatsIndex, 1));
  const versatz = montagIndex(erster);
  const start = new Date(erster.getTime() - versatz * 24 * 60 * 60 * 1000);
  const tage: RasterTag[] = [];

  for (let i = 0; i < 42; i += 1) {
    const datum = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    tage.push({
      iso: berlinIsoDatum(datum),
      tagesZahl: datum.getUTCDate(),
      imMonat: datum.getUTCMonth() === monatsIndex,
      wochentag: montagIndex(datum),
      kalenderwoche: isoKalenderwoche(datum),
    });

    if (i >= 34 && i % 7 === 6 && !tage.slice(-7).some((tag) => tag.imMonat)) {
      return tage.slice(0, -7);
    }
  }

  return tage;
}

function tageZwischen(vonIso: string, bisIso: string): string[] {
  const start = berlinIsoDatum(new Date(vonIso));
  const schluss = berlinIsoDatum(new Date(bisIso));
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
