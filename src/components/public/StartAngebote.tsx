"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { T } from "@/texte/de";

const A = T.aussen.start.angebote;

export type StartAnsicht = "schilf" | "termine" | "kalender";

export type StartAngebotKarte = {
  id: string;
  slug: string;
  titel: string;
  badge: string;
  referenten: string[];
  schularten: string;
  digCompEdu: string | null;
};

export type StartTermin = {
  id: string;
  slug: string;
  titel: string;
  datum: string;
  zeit: string | null;
  badge: string;
  ort: string;
};

const REITER: { id: StartAnsicht; label: string }[] = [
  { id: "schilf", label: A.reiterSchilf },
  { id: "termine", label: A.reiterTermine },
  { id: "kalender", label: A.reiterKalender },
];

const ANFANG = 6;
const BADGE = "rounded-sm border-marke-gelb bg-marke-gelb-weich text-foreground";

/**
 * Drei Reiter auf der Startseite: Angebote ohne Termin, kommende Termine,
 * Monatskalender. Der Kalender kommt als fertiges Server-Element von außen.
 * Die Wahl steht auch in der Adresse (?ansicht=), damit sie sich teilen lässt.
 */
export function StartAngebote({
  start,
  angebote,
  termine,
  anzahlKommend,
  kalender,
}: {
  start: StartAnsicht;
  angebote: StartAngebotKarte[];
  termine: StartTermin[];
  anzahlKommend: number;
  kalender: ReactNode;
}) {
  const [aktiv, setAktiv] = useState<StartAnsicht>(start);
  const [alle, setAlle] = useState(false);
  const reiterRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function waehle(id: StartAnsicht, fokus = false) {
    setAktiv(id);
    try {
      const url = new URL(window.location.href);
      if (id === "schilf") url.searchParams.delete("ansicht");
      else url.searchParams.set("ansicht", id);
      window.history.replaceState(null, "", url);
    } catch {
      // Adresse bleibt unverändert, die Ansicht wechselt trotzdem.
    }
    if (fokus) reiterRefs.current[id]?.focus();
  }

  function taste(e: KeyboardEvent, index: number) {
    let ziel: number | null = null;
    if (e.key === "ArrowRight") ziel = (index + 1) % REITER.length;
    else if (e.key === "ArrowLeft") ziel = (index - 1 + REITER.length) % REITER.length;
    else if (e.key === "Home") ziel = 0;
    else if (e.key === "End") ziel = REITER.length - 1;
    if (ziel === null) return;
    e.preventDefault();
    waehle(REITER[ziel].id, true);
  }

  const sichtbar = alle ? angebote : angebote.slice(0, ANFANG);

  return (
    <div>
      <div
        role="tablist"
        aria-label={A.reiterAriaLabel}
        className="mb-6 flex overflow-x-auto overflow-y-hidden border-b border-border"
      >
        {REITER.map((r, i) => {
          const gewaehlt = aktiv === r.id;
          return (
            <button
              key={r.id}
              ref={(el) => {
                reiterRefs.current[r.id] = el;
              }}
              type="button"
              role="tab"
              id={`start-reiter-${r.id}`}
              aria-selected={gewaehlt}
              aria-controls={`start-feld-${r.id}`}
              tabIndex={gewaehlt ? 0 : -1}
              onClick={() => waehle(r.id)}
              onKeyDown={(e) => taste(e, i)}
              className={cn(
                "-mb-px border-b-[3px] px-2.5 py-2.5 text-sm whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4 sm:text-base",
                gewaehlt
                  ? "border-marke-gelb font-semibold text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id="start-feld-schilf" aria-labelledby="start-reiter-schilf" hidden={aktiv !== "schilf"}>
        {angebote.length === 0 ? (
          <Leer text={A.schilfLeerText} />
        ) : (
          <>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sichtbar.map((a) => (
                <li key={a.id} className="flex min-w-0 flex-col gap-2 border border-border bg-card p-4">
                  <Badge className={BADGE}>{a.badge}</Badge>
                  <h3 className="leading-snug font-semibold text-pretty">
                    <Link
                      href={`/fortbildungen/${a.slug}`}
                      className="underline-offset-4 outline-none hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {a.titel}
                    </Link>
                  </h3>
                  <ul className="grid gap-0.5 text-sm text-muted-foreground">
                    {a.referenten.map((r) => (
                      <li key={r} className="font-medium text-foreground/80">
                        {r}
                      </li>
                    ))}
                    {a.schularten ? <li>{a.schularten}</li> : null}
                  </ul>
                  {a.digCompEdu ? (
                    <p className="mt-auto border-t border-border pt-2 text-xs text-muted-foreground">
                      {A.digCompEdu(a.digCompEdu)}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
            {angebote.length > ANFANG ? (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => setAlle((v) => !v)}
                  aria-expanded={alle}
                  className="rounded-md border border-primary px-4 py-2 text-sm font-medium text-primary outline-none hover:bg-secondary/50 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {alle ? A.wenigerAnzeigen : A.mehrAnzeigen}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>

      <div role="tabpanel" id="start-feld-termine" aria-labelledby="start-reiter-termine" hidden={aktiv !== "termine"}>
        {termine.length === 0 ? (
          <Leer text={T.aussen.start.leerText} titel={T.aussen.start.leerTitel} />
        ) : (
          <>
            <ul className="divide-y divide-border border-b border-border">
              {termine.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/fortbildungen/${t.slug}`}
                    className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-5 py-4 outline-none hover:bg-secondary/50 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="zahl">
                      <span className="block text-lg leading-tight font-bold text-primary">{t.datum}</span>
                      {t.zeit ? <span className="block text-xs text-muted-foreground">{t.zeit}</span> : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block leading-snug font-semibold">{t.titel}</span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <Badge className={BADGE}>{t.badge}</Badge>
                        <span>{t.ort}</span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/fortbildungen" className="group mt-4 inline-flex items-center gap-1.5 text-sm text-primary">
              {T.aussen.start.alleAnzeigen(anzahlKommend)}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </>
        )}
      </div>

      <div role="tabpanel" id="start-feld-kalender" aria-labelledby="start-reiter-kalender" hidden={aktiv !== "kalender"}>
        {kalender}
      </div>
    </div>
  );
}

function Leer({ text, titel }: { text: string; titel?: string }) {
  return (
    <div className="py-2">
      {titel ? <p className="font-semibold">{titel}</p> : null}
      <p className={cn("text-sm text-muted-foreground", titel && "mt-1")}>{text}</p>
      <Link href="/fortbildungen" className="group mt-3 inline-flex items-center gap-1.5 text-sm text-primary">
        {A.alleFortbildungen}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </div>
  );
}
