"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { X } from "lucide-react";

import {
  baueUrl,
  ohneFilter,
  type FilterChip,
  type SuchParameter,
} from "@/lib/filter";
import { cn } from "@/lib/utils";
import { T } from "@/texte/de";

export interface Schnellzugriff {
  id: string;
  label: string;
  /** Die Suchparameter, die dieser Zugriff setzt. */
  werte: Record<string, string>;
}

/**
 * Schnellzugriffe und aktive Filter als Chip-Reihen.
 *
 * Die Fragen, mit denen Lehrkräfte auf die Seite kommen, sind fast immer
 * dieselben — „was ist bald?", „was geht online?", „was passt zu meiner
 * Schulart?". Ein Klick ist der richtige Aufwand dafür; drei Auswahllisten in
 * einem zugeklappten Feld sind es nicht.
 *
 * Darunter stehen die tatsächlich gesetzten Filter. Ohne sie sieht man nur
 * eine kleine Trefferzahl und weiß nicht, warum.
 */
export function Schnellzugriffe({
  params,
  zugriffe,
  aktiveFilter,
}: {
  params: SuchParameter;
  zugriffe: Schnellzugriff[];
  aktiveFilter: FilterChip[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [laeuft, starte] = useTransition();

  const wert = (name: string): string => {
    const v = params[name];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };

  function gehe(aenderungen: Record<string, string | undefined>) {
    starte(() => {
      router.push(baueUrl(pathname, params, aenderungen), { scroll: false });
    });
  }

  function entferne(param: string) {
    starte(() => {
      const rest = ohneFilter(params, param);
      const query = new URLSearchParams(
        Object.entries(rest).flatMap(([k, v]) => {
          const text = Array.isArray(v) ? v[0] : v;
          return text ? [[k, text] as [string, string]] : [];
        }),
      ).toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  return (
    <div className={cn("space-y-3", laeuft && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="etikett text-muted-foreground">{T.aussen.schnellzugriffe.schnellFinden}</span>

        {zugriffe.map((zugriff) => {
          // Aktiv ist ein Zugriff nur, wenn all seine Werte gesetzt sind.
          const aktiv = Object.entries(zugriff.werte).every(
            ([name, sollwert]) => wert(name) === sollwert,
          );

          return (
            <button
              key={zugriff.id}
              type="button"
              aria-pressed={aktiv}
              onClick={() =>
                gehe(
                  aktiv
                    ? Object.fromEntries(
                        Object.keys(zugriff.werte).map((name) => [name, undefined]),
                      )
                    : zugriff.werte,
                )
              }
              className={cn(
                "etikett border px-2.5 py-1.5 transition-colors",
                aktiv
                  // Gelb markiert nur, was gerade gesetzt ist, nie eine Überschrift.
                  ? "border-marke-gelb bg-marke-gelb-weich text-foreground"
                  : "border-input text-muted-foreground hover:border-primary hover:text-foreground",
              )}
            >
              {zugriff.label}
            </button>
          );
        })}
      </div>

      {aktiveFilter.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="etikett text-muted-foreground">{T.aussen.schnellzugriffe.gesetzt}</span>

          {aktiveFilter.map((chip) => (
            <button
              key={chip.param}
              type="button"
              onClick={() => entferne(chip.param)}
              title={T.aussen.schnellzugriffe.chipEntfernenTitel(chip.art, chip.wert)}
              className="group flex items-center gap-1.5 border border-input bg-secondary px-2.5 py-1.5 text-sm transition-colors hover:border-destructive hover:bg-destructive/10"
            >
              <span className="etikett text-muted-foreground">{chip.art}</span>
              <span className="font-medium">{chip.wert}</span>
              <X
                className="size-3.5 text-muted-foreground group-hover:text-destructive"
                aria-hidden
              />
            </button>
          ))}

          {aktiveFilter.length > 1 ? (
            <button
              type="button"
              onClick={() =>
                starte(() => router.push(pathname, { scroll: false }))
              }
              className="etikett text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              {T.aussen.schnellzugriffe.alleEntfernen}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
