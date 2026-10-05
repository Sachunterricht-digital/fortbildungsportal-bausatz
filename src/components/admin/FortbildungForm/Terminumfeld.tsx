"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarRange, Info } from "lucide-react";

import {
  ladeTerminumfeld,
  type Konflikt,
  type UmfeldTermin,
} from "@/actions/terminumfeld";
import {
  berlinIsoDatum,
  formatMonatJahr,
  formatZeit,
  isoKalenderwoche,
  montagIndex,
  parseDatumZeitEingabe,
  WOCHENTAGE_KURZ,
} from "@/lib/datetime";
import { ferienStatus } from "@/lib/ferien";
import { ebeneKlassen } from "@/constants/fortbildung";
import { cn } from "@/lib/utils";
import { T } from "@/texte/de";

/**
 * Zeigt beim Planen, was sonst noch läuft, und warnt vor Überschneidungen.
 *
 * Bewusst über alle Veranstaltungen hinweg — auch über die fremder Personen.
 * Sonst legen zwei Referenten unabhängig voneinander zwei Fortbildungen auf
 * denselben Nachmittag. Titel, Ort und Beschreibung helfen zusätzlich,
 * inhaltliche Ballungen zu erkennen.
 */
export function Terminumfeld({
  beginn,
  ende,
  referentIds,
  eigeneId,
}: {
  beginn: string;
  ende: string;
  referentIds: string[];
  eigeneId?: string;
}) {
  const [termine, setTermine] = useState<UmfeldTermin[]>([]);
  const [konflikte, setKonflikte] = useState<Konflikt[]>([]);
  const [weitere, setWeitere] = useState(0);
  const [laeuft, setLaeuft] = useState(false);

  const referentenSchluessel = referentIds.join(",");

  useEffect(() => {
    const von = parseDatumZeitEingabe(beginn);
    // Ohne Datum wird gar nicht erst geladen; die Komponente zeigt dann den
    // Platzhalter und der alte Zustand bleibt unsichtbar.
    if (!von) return;

    let verworfen = false;

    // Kurz warten: Beim Tippen im Datumsfeld entstehen sonst bei jedem
    // Zeichen Anfragen.
    const zeitgeber = setTimeout(async () => {
      const bis = parseDatumZeitEingabe(ende);
      setLaeuft(true);

      try {
        const ergebnis = await ladeTerminumfeld({
          beginn: von.toISOString(),
          ende: (bis && bis > von ? bis : von).toISOString(),
          referentIds: referentenSchluessel ? referentenSchluessel.split(",") : [],
          ausserId: eigeneId ?? null,
        });

        if (verworfen) return;
        setTermine(ergebnis.termine);
        setKonflikte(ergebnis.konflikte);
        setWeitere(ergebnis.weitereHinweise);
      } finally {
        if (!verworfen) setLaeuft(false);
      }
    }, 400);

    return () => {
      verworfen = true;
      clearTimeout(zeitgeber);
    };
  }, [beginn, ende, referentenSchluessel, eigeneId]);

  const gewaehlterTag = useMemo(() => {
    const von = parseDatumZeitEingabe(beginn);
    return von ? berlinIsoDatum(von) : null;
  }, [beginn]);

  if (!gewaehlterTag) {
    return (
      <div className="border border-dashed p-5 text-center">
        <CalendarRange
          className="mx-auto mb-2 size-5 text-muted-foreground/60"
          aria-hidden
        />
        <p className="text-sm text-muted-foreground text-pretty">
          {T.maske.terminumfeld.platzhalterHinweis}
        </p>
      </div>
    );
  }

  const harteKonflikte = konflikte.filter((k) => k.schwere === "hart");
  const hinweise = konflikte.filter((k) => k.schwere === "hinweis");

  return (
    <div className={cn("space-y-4", laeuft && "opacity-70")}>
      {harteKonflikte.map((k, i) => (
        <p
          key={`hart-${i}`}
          role="alert"
          className="flex items-start gap-2 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {k.text}
            <span className="mt-0.5 block text-xs opacity-80">
              {T.maske.terminumfeld.konfliktTerminHinweis}
            </span>
          </span>
        </p>
      ))}

      {hinweise.map((k, i) => (
        <p
          key={`hinweis-${i}`}
          className="flex items-start gap-2 bg-ferien-weich px-4 py-3 text-sm text-ferien"
        >
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {k.text}
            {k.art === "tag" || k.art === "zeit" ? (
              <span className="mt-0.5 block text-xs opacity-80">{T.maske.terminumfeld.tagBitte}</span>
            ) : null}
          </span>
        </p>
      ))}

      {weitere > 0 ? (
        <p className="text-sm text-muted-foreground">
          {T.maske.terminumfeld.weitereVeranstaltungen(weitere)}
        </p>
      ) : null}

      {konflikte.length === 0 && !laeuft ? (
        <p className="flex items-start gap-2 bg-primary/10 px-4 py-3 text-sm text-primary">
          <CalendarRange className="mt-0.5 size-4 shrink-0" aria-hidden />
          {T.maske.terminumfeld.keineAndereVeranstaltung}
        </p>
      ) : null}

      <MiniKalender tag={gewaehlterTag} termine={termine} />

      <TagesListe tag={gewaehlterTag} termine={termine} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function MiniKalender({
  tag,
  termine,
}: {
  tag: string;
  termine: UmfeldTermin[];
}) {
  const jahr = Number(tag.slice(0, 4));
  const monat = Number(tag.slice(5, 7)) - 1;

  const belegt = new Map<string, number>();
  for (const termin of termine) {
    for (const t of tageZwischen(termin.beginn, termin.ende)) {
      belegt.set(t, (belegt.get(t) ?? 0) + 1);
    }
  }

  const erster = new Date(Date.UTC(jahr, monat, 1));
  const versatz = montagIndex(erster);
  const start = new Date(erster.getTime() - versatz * 24 * 60 * 60 * 1000);

  const zellen = Array.from({ length: 42 }, (_, i) => {
    const datum = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    return {
      iso: berlinIsoDatum(datum),
      zahl: datum.getUTCDate(),
      imMonat: datum.getUTCMonth() === monat,
      kalenderwoche: isoKalenderwoche(datum),
    };
  }).filter((_, i, alle) => i < 35 || alle.slice(35).some((z) => z.imMonat));

  return (
    <div className="overflow-hidden border">
      <p className="border-b bg-muted/40 px-3 py-2 text-sm font-medium">
        {formatMonatJahr(new Date(Date.UTC(jahr, monat, 15)))}
      </p>

      <div className="grid grid-cols-[2rem_repeat(7,minmax(0,1fr))] border-b bg-muted/20">
        <div className="py-1 text-center text-[0.65rem] font-medium text-muted-foreground">KW</div>
        {WOCHENTAGE_KURZ.map((w) => (
          <div
            key={w}
            className="py-1 text-center text-[0.65rem] font-medium text-muted-foreground"
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[2rem_repeat(7,minmax(0,1fr))]">
        {zellen.map((zelle, index) => {
          const anzahl = belegt.get(zelle.iso) ?? 0;
          const status = ferienStatus(new Date(`${zelle.iso}T12:00:00Z`));
          const gewaehlt = zelle.iso === tag;

          return (
            <Fragment key={zelle.iso}>
              {index % 7 === 0 ? (
                <div className="zahl border-r border-b bg-muted/30 px-0.5 pt-1 text-center text-[0.625rem] text-muted-foreground">
                  {zelle.kalenderwoche}
                </div>
              ) : null}
              <div
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-0.5 border-r border-b last:border-r-0",
                  !zelle.imMonat && "bg-muted/30",
                  status.art === "ferien" && "bg-ferien-weich",
                  status.art === "feiertag" && "bg-feiertag-weich",
                )}
                title={
                  status.label
                    ? `${status.label}${anzahl > 0 ? ` · ${anzahl} Termin(e)` : ""}`
                    : anzahl > 0
                      ? `${anzahl} Termin(e)`
                      : undefined
                }
              >
                <span
                  className={cn(
                    "text-xs zahl",
                    !zelle.imMonat && "text-muted-foreground/50",
                    gewaehlt &&
                      "rounded bg-primary px-1.5 py-0.5 font-semibold text-primary-foreground",
                  )}
                >
                  {zelle.zahl}
                </span>

                {anzahl > 0 ? (
                  <span className="flex gap-0.5" aria-hidden>
                    {Array.from({ length: Math.min(anzahl, 3) }, (_, i) => (
                      <span key={i} className="size-1 bg-foreground/40" />
                    ))}
                  </span>
                ) : (
                  <span className="h-1" aria-hidden />
                )}
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function TagesListe({ tag, termine }: { tag: string; termine: UmfeldTermin[] }) {
  const amTag = termine.filter((t) =>
    tageZwischen(t.beginn, t.ende).includes(tag),
  );

  if (amTag.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {T.maske.terminumfeld.keinTerminAmTag}
      </p>
    );
  }

  return (
    <div>
      <p className="mb-2 text-sm font-medium">
        {T.maske.terminumfeld.amSelbenTag(amTag.length)}
      </p>
      <ul className="space-y-1.5">
        {amTag.map((t) => {
          const ebene = ebeneKlassen(t.organisationsform);

          return (
            <li
              key={t.id}
              className="flex flex-wrap items-center gap-x-2 gap-y-1 border px-3 py-2 text-sm"
            >
              <span className="zahl text-muted-foreground">
                {formatZeit(new Date(t.beginn))}–{formatZeit(new Date(t.ende))}
              </span>

              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-xs font-medium",
                  ebene.flaeche,
                )}
              >
                {t.organisationsform === "REGIONAL"
                  ? T.maske.terminumfeld.kuerzelRegional
                  : t.organisationsform === "SCHILF"
                    ? T.maske.terminumfeld.kuerzelSchilf
                    : T.maske.terminumfeld.kuerzelSonst}
              </span>

              {t.istEigener ? (
                <Link
                  href={`/admin/fortbildungen/${t.id}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {t.titel}
                </Link>
              ) : (
                <span>{t.titel}</span>
              )}

              {t.ortName ? (
                <span className="text-muted-foreground">· {t.ortName}</span>
              ) : null}

              {t.status === "ENTWURF" ? (
                <span className="text-xs text-muted-foreground">{T.maske.terminumfeld.entwurfHinweis}</span>
              ) : null}

              {t.beschreibung ? (
                <p className="basis-full text-xs text-muted-foreground">
                  {t.beschreibung}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Alle Kalendertage, die ein Zeitraum berührt. */
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
