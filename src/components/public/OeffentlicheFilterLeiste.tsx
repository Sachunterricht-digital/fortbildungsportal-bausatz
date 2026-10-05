"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { baueUrl, type SuchParameter } from "@/lib/filter";
import {
  NIVEAUSTUFEN,
  SCHULARTEN_AUSWAHL,
  VERANSTALTUNGSFORMATE,
  organisationsformenAuswahl,
} from "@/constants/fortbildung";
import { T } from "@/texte/de";

const FILTERNAMEN = [
  "q",
  "von",
  "bis",
  "organisationsform",
  "format",
  "schulart",
  "niveaustufe",
  "kb",
  "schlagwort",
  "vergangene",
];

export function OeffentlicheFilterLeiste({
  params,
  schlagworte,
  kompetenzbereiche,
}: {
  params: SuchParameter;
  schlagworte: string[];
  kompetenzbereiche: Array<{ code: string; titel: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [laeuft, starte] = useTransition();

  const wert = (name: string) => {
    const v = params[name];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };

  function setzen(aenderungen: Record<string, string | undefined>) {
    starte(() => {
      router.push(baueUrl(pathname, params, aenderungen), { scroll: false });
    });
  }

  const aktiv = FILTERNAMEN.some((name) => wert(name));

  return (
    <div className={`space-y-4 border bg-card p-4 ${laeuft ? "opacity-60" : ""}`}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          defaultValue={wert("q")}
          placeholder={T.aussen.filterLeiste.suchPlatzhalter}
          aria-label={T.aussen.filterLeiste.suchAriaLabel}
          className="h-11 w-full border-input pl-9 text-base"
          onKeyDown={(e) => {
            if (e.key === "Enter") setzen({ q: e.currentTarget.value || undefined });
          }}
          onBlur={(e) => {
            if (e.currentTarget.value !== wert("q")) {
              setzen({ q: e.currentTarget.value || undefined });
            }
          }}
        />
      </div>

      <details className="group" open={aktiv}>
        <summary className="etikett flex cursor-pointer list-none items-center gap-2 text-muted-foreground transition-colors hover:text-foreground">
          <SlidersHorizontal className="size-4" aria-hidden />
          {T.aussen.filterLeiste.filterLabel}
          <span className="font-normal normal-case tracking-normal">{T.aussen.filterLeiste.filterUntertitel}</span>
        </summary>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Liste
            label={T.aussen.filterLeiste.labelSchulart}
            wert={wert("schulart")}
            optionen={SCHULARTEN_AUSWAHL.map((s) => ({ value: s.value, label: s.label }))}
            onChange={(v) => setzen({ schulart: v })}
          />
          <Liste
            label={T.aussen.filterLeiste.labelFormat}
            wert={wert("format")}
            optionen={VERANSTALTUNGSFORMATE.map((f) => ({
              value: f.value,
              label: f.label,
            }))}
            onChange={(v) => setzen({ format: v })}
          />
          <Liste
            label={T.aussen.filterLeiste.labelArt}
            wert={wert("organisationsform")}
            optionen={organisationsformenAuswahl(wert("organisationsform")).map((o) => ({
              value: o.value,
              label: o.label,
            }))}
            onChange={(v) => setzen({ organisationsform: v })}
          />
          <Liste
            label={T.aussen.filterLeiste.labelKompetenzbereich}
            wert={wert("kb")}
            optionen={kompetenzbereiche.map((k) => ({
              value: k.code,
              label: T.aussen.filterLeiste.kompetenzbereichOption(k.code, k.titel),
            }))}
            onChange={(v) => setzen({ kb: v })}
          />
          <Liste
            label={T.aussen.filterLeiste.labelNiveaustufe}
            wert={wert("niveaustufe")}
            optionen={NIVEAUSTUFEN.map((n) => ({ value: n.value, label: n.label }))}
            onChange={(v) => setzen({ niveaustufe: v })}
          />
          <Liste
            label={T.aussen.filterLeiste.labelSchlagwort}
            wert={wert("schlagwort")}
            optionen={schlagworte.map((s) => ({ value: s, label: s }))}
            onChange={(v) => setzen({ schlagwort: v })}
          />

          <Datum label={T.aussen.filterLeiste.labelAb} wert={wert("von")} onChange={(v) => setzen({ von: v })} />
          <Datum label={T.aussen.filterLeiste.labelBis} wert={wert("bis")} onChange={(v) => setzen({ bis: v })} />

          <label className="flex h-8 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={wert("vergangene") === "1"}
              onChange={(e) => setzen({ vergangene: e.target.checked ? "1" : undefined })}
              className="size-4 accent-[var(--primary)]"
            />
            {T.aussen.filterLeiste.vergangeneAnzeigen}
          </label>

          {aktiv ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setzen(Object.fromEntries(FILTERNAMEN.map((n) => [n, undefined])))
              }
            >
              <X className="size-3.5" aria-hidden />
              {T.aussen.filterLeiste.zuruecksetzen}
            </Button>
          ) : null}
        </div>
      </details>
    </div>
  );
}

function Liste({
  label,
  wert,
  optionen,
  onChange,
}: {
  label: string;
  wert: string;
  optionen: Array<{ value: string; label: string }>;
  onChange: (wert: string | undefined) => void;
}) {
  const id = `f-${label.toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="etikett mb-1.5 block text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        value={wert}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="h-9 max-w-56 border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring dark:bg-input/30"
      >
        <option value="">Alle</option>
        {optionen.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Datum({
  label,
  wert,
  onChange,
}: {
  label: string;
  wert: string;
  onChange: (wert: string | undefined) => void;
}) {
  const id = `f-datum-${label.toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="etikett mb-1.5 block text-muted-foreground">
        {label}
      </label>
      <Input
        id={id}
        type="date"
        value={wert}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="zahl h-9 w-36"
      />
    </div>
  );
}
