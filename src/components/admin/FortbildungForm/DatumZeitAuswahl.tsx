"use client";

import { useId, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import {
  berlinIsoDatum, formatDatum, formatDatumLang, formatDatumZeitEingabe,
  formatMonatJahr, formatZeit, kalenderMonat, kalenderTage,
  parseDatumZeitEingabe, parseDeDateTime, WOCHENTAGE_KURZ,
} from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { T } from "@/texte/de";

/** Freie deutsche Texteingabe plus sofort nutzbarer Kalender, auch bei leerem Feld. */
export function DatumZeitAuswahl({ name, label, wert, onChange, ungueltig, pflicht = true }: {
  name: string;
  label: string;
  wert: string;
  onChange: (wert: string) => void;
  ungueltig: boolean;
  pflicht?: boolean;
}) {
  const id = useId();
  const [offen, setOffen] = useState(false);
  const [tag, setTag] = useState<Date | null>(null);
  const [monat, setMonat] = useState<Date | null>(null);
  const [zeit, setZeit] = useState("14:00");
  const eingabe = tag ? `${formatDatum(tag)} ${zeit}` : "";
  const geprueft = parseDatumZeitEingabe(eingabe);
  // Nicht existierende Uhrzeiten während der Zeitumstellung nicht verschieben.
  const gueltig = geprueft !== null && formatDatumZeitEingabe(geprueft) === eingabe;
  const [stunde, minute] = zeit.split(":");

  function oeffnen(naechsterWert: boolean) {
    if (naechsterWert) {
      const vorhanden = parseDatumZeitEingabe(wert);
      const datum = vorhanden ?? parseDeDateTime(wert) ?? new Date();
      setTag(datum);
      setMonat(kalenderMonat(datum));
      setZeit(vorhanden ? formatZeit(vorhanden) : "14:00");
    }
    setOffen(naechsterWert);
  }

  return (
    <div className="flex min-w-0 gap-2">
      <Input name={name} aria-label={label} type="text" placeholder={T.maske.datumZeitAuswahl.platzhalter} lang="de-DE" required={pflicht} value={wert} onChange={(e) => onChange(e.target.value)} className="min-w-0 flex-1" aria-invalid={ungueltig} />
      <Popover open={offen} onOpenChange={oeffnen}>
        <PopoverTrigger type="button" aria-label={T.maske.datumZeitAuswahl.auswaehlenAriaLabel(label)} title={T.maske.datumZeitAuswahl.kalenderOeffnenTitel} className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-input bg-background text-primary hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">
          <CalendarDays className="size-5" aria-hidden />
        </PopoverTrigger>
        <PopoverContent align="end" className="max-h-(--available-height) w-[min(21rem,calc(100vw-2rem))] overflow-y-auto p-4">
          <PopoverTitle>{T.maske.datumZeitAuswahl.popoverTitel(label)}</PopoverTitle>
          {monat && tag && <>
            <div className="flex items-center justify-between gap-2">
              <button type="button" aria-label={T.maske.datumZeitAuswahl.vorherigerMonatAriaLabel} className="rounded-md p-2 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring" onClick={() => setMonat(kalenderMonat(monat, -1))}><ChevronLeft className="size-4" aria-hidden /></button>
              <span className="font-medium" aria-live="polite">{formatMonatJahr(monat)}</span>
              <button type="button" aria-label={T.maske.datumZeitAuswahl.naechsterMonatAriaLabel} className="rounded-md p-2 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring" onClick={() => setMonat(kalenderMonat(monat, 1))}><ChevronRight className="size-4" aria-hidden /></button>
            </div>
            <div className="grid grid-cols-7 gap-1" role="group" aria-label={T.maske.datumZeitAuswahl.kalendertagGruppeAriaLabel}>
              {WOCHENTAGE_KURZ.map((tag) => <span key={tag} className="py-1 text-center text-xs text-muted-foreground">{tag}</span>)}
              {kalenderTage(monat).map((datum) => {
                const iso = berlinIsoDatum(datum);
                return <button key={iso} type="button" aria-label={formatDatumLang(datum)} aria-pressed={iso === berlinIsoDatum(tag)} onClick={() => setTag(datum)} className={cn("aspect-square rounded-md text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring aria-pressed:bg-primary aria-pressed:text-primary-foreground", iso.slice(0, 7) !== berlinIsoDatum(monat).slice(0, 7) && "text-muted-foreground")}>
                  {Number(iso.slice(-2))}
                </button>;
              })}
            </div>
            <p className="text-sm text-muted-foreground" role="status">{formatDatumLang(tag)}</p>
            <p className="text-xs text-muted-foreground">{T.maske.datumZeitAuswahl.ortszeitHinweis}</p>
            {!gueltig && <p role="alert" className="text-xs text-destructive">{T.maske.datumZeitAuswahl.zeitumstellungFehler}</p>}
            {/* Uhrzeit und Übernehmen bleiben am unteren Popoverrand sichtbar, auch wenn das Raster auf kleinen Displays gescrollt wird. */}
            <div className="sticky -bottom-4 -mx-4 -mb-4 flex flex-col gap-2 border-t bg-popover p-4 pt-3">
            <div className="flex items-center gap-2">
              <label htmlFor={`${id}-stunde`} className="mr-auto text-sm">{T.maske.datumZeitAuswahl.uhrzeitLabel}</label>
              <select id={`${id}-stunde`} aria-label={T.maske.datumZeitAuswahl.stundeAriaLabel(label)} value={stunde} onChange={(e) => setZeit(`${e.target.value}:${minute}`)} className="rounded-md border bg-background px-2 py-2">
                {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((wert) => <option key={wert}>{wert}</option>)}
              </select>
              <span aria-hidden>:</span>
              <select aria-label={T.maske.datumZeitAuswahl.minuteAriaLabel(label)} value={minute} onChange={(e) => setZeit(`${stunde}:${e.target.value}`)} className="rounded-md border bg-background px-2 py-2">
                {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")).map((wert) => <option key={wert}>{wert}</option>)}
              </select>
              <span className="text-xs text-muted-foreground">{T.maske.datumZeitAuswahl.uhrSuffix}</span>
            </div>
            <button type="button" disabled={!gueltig} onClick={() => { onChange(eingabe); setOffen(false); }} className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50">{T.maske.datumZeitAuswahl.uebernehmen}</button>
            </div>
          </>}
        </PopoverContent>
      </Popover>
    </div>
  );
}
