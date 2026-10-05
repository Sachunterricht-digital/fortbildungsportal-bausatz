"use client";

import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";
import { ChevronDown, Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { baueUrl, type SuchParameter } from "@/lib/filter";
import {
  SCHULARTEN_AUSWAHL,
  STATUS,
  VERANSTALTUNGSFORMATE,
  organisationsformenAuswahl,
} from "@/constants/fortbildung";

/**
 * Filterleiste des Redaktionsbereichs.
 *
 * Schreibt ausschließlich in die URL — die Liste selbst rendert der Server neu.
 * Dadurch gibt es keine zweite Wahrheit über den aktuellen Filterzustand.
 */
export function AdminFilterLeiste({
  params,
  schlagworte,
  ohne = [],
}: {
  params: SuchParameter;
  schlagworte: string[];
  ohne?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [laeuft, starte] = useTransition();

  function setzen(aenderungen: Record<string, string | undefined>) {
    starte(() => {
      router.push(baueUrl(pathname, params, aenderungen), { scroll: false });
    });
  }

  const wert = (name: string) => {
    const v = params[name];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };

  const aktiv = [
    "q",
    "von",
    "bis",
    "organisationsform",
    "format",
    "schulart",
    "status",
    "schlagwort",
    "fibs",
  ].some((name) => wert(name));
  const weitereFilterAktiv = [
    "von",
    "bis",
    "organisationsform",
    "format",
    "schulart",
    "status",
    "schlagwort",
    "fibs",
  ].some((name) => wert(name));

  return (
    <div
      className={`space-y-3 rounded-2xl border bg-card p-4 shadow-sm ${laeuft ? "opacity-60" : ""}`}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label
            htmlFor="filter-q"
            className="mb-1.5 block text-xs font-medium text-muted-foreground"
          >
            Suche
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              key={wert("q")}
              id="filter-q"
              defaultValue={wert("q")}
              placeholder="Titel, Beschreibung, Fach, Ort"
              className="w-full pl-8"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setzen({ q: e.currentTarget.value || undefined });
                }
              }}
              onBlur={(e) => {
                if (e.currentTarget.value !== wert("q")) {
                  setzen({ q: e.currentTarget.value || undefined });
                }
              }}
            />
          </div>
        </div>
        {aktiv ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setzen({
                q: undefined,
                von: undefined,
                bis: undefined,
                organisationsform: undefined,
                format: undefined,
                schulart: undefined,
                status: undefined,
                schlagwort: undefined,
                fibs: undefined,
              })
            }
          >
            <X className="size-3.5" aria-hidden />
            Filter zurücksetzen
          </Button>
        ) : null}
      </div>

      <details className="group" open={weitereFilterAktiv}>
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
          Weitere Filter
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
          <span className="text-xs font-normal">{weitereFilterAktiv ? "aktiv" : "optional"}</span>
        </summary>
        <div className="mt-3 flex flex-wrap items-end gap-3 border-t pt-3">
        <Auswahl label="Von" typ="date" wert={wert("von")} onChange={(v) => setzen({ von: v })} />
        <Auswahl label="Bis" typ="date" wert={wert("bis")} onChange={(v) => setzen({ bis: v })} />
        {!ohne.includes("organisationsform") ? (
          <Liste
            label="Organisationsform"
            wert={wert("organisationsform")}
            optionen={organisationsformenAuswahl(wert("organisationsform")).map((o) => ({ value: o.value, label: o.label }))}
            onChange={(v) => setzen({ organisationsform: v })}
          />
        ) : null}

        <Liste
          label="Format"
          wert={wert("format")}
          optionen={VERANSTALTUNGSFORMATE.map((f) => ({ value: f.value, label: f.label }))}
          onChange={(v) => setzen({ format: v })}
        />

        <Liste
          label="Schulart"
          wert={wert("schulart")}
          optionen={SCHULARTEN_AUSWAHL.map((s) => ({ value: s.value, label: s.label }))}
          onChange={(v) => setzen({ schulart: v })}
        />

        {!ohne.includes("status") ? (
          <Liste
            label="Status"
            wert={wert("status")}
            optionen={STATUS.map((s) => ({ value: s.value, label: s.label }))}
            onChange={(v) => setzen({ status: v })}
          />
        ) : null}

        {!ohne.includes("fibs") ? (
          <Liste
            label="FIBS"
            wert={wert("fibs")}
            optionen={[
              { value: "offen", label: "alle noch nicht in FIBS" },
              { value: "offen-ausschreibung", label: "Ausschreibung offen (RLFB/ALP)" },
              { value: "schilf-nachtrag", label: "SchiLf · Nachtrag vorgesehen" },
              { value: "erledigt", label: "in FIBS eingetragen" },
            ]}
            onChange={(v) => setzen({ fibs: v })}
          />
        ) : null}

        <Liste
          label="Schlagwort"
          wert={wert("schlagwort")}
          optionen={schlagworte.map((s) => ({ value: s, label: s }))}
          onChange={(v) => setzen({ schlagwort: v })}
        />
        </div>
      </details>
    </div>
  );
}

function Auswahl({
  label,
  typ,
  wert,
  onChange,
}: {
  label: string;
  typ: string;
  wert: string;
  onChange: (wert: string | undefined) => void;
}) {
  const id = `filter-${label.toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Input
        id={id}
        type={typ}
        value={wert}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="w-40"
      />
    </div>
  );
}

/**
 * Bewusst ein natives <select>: Es ist hier kompakter, tastaturfreundlich und
 * braucht keinen zusätzlichen Client-Zustand.
 */
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
  const id = `filter-${label.toLowerCase().replace(/\s/g, "-")}`;

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        value={wert}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="h-8 border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
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
