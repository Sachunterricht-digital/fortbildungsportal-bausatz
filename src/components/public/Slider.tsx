"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { T } from "@/texte/de";

// Ein gesperrter Pfeil trägt `aria-disabled` statt `disabled`: Er bleibt
// fokussierbar. Mit `disabled` fiele der Fokus am Ende der Reihe auf den Seitenanfang.
const KNOPF =
  "grid size-8 place-items-center rounded-lg border border-input bg-card text-primary outline-none transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:bg-card";

/**
 * Offener Slider: eine Reihe Karten, die sich waagerecht wischen oder mit den
 * Pfeilen blättern lässt. Nichts klappt auf, es gibt keine sichtbare Laufleiste.
 *
 * Die Karten kommen als `<li>` von außen und tragen ihre Breite selbst. Die
 * Pfeile stehen in der Kopfzeile (neben `kopf`), sonst in der Fußzeile (neben
 * `fuss`). Passt alles nebeneinander, bleiben die Pfeile unsichtbar, aber ihr
 * Platz erhalten. Ohne JavaScript bleibt die Reihe mit dem Finger oder der
 * Tastatur (Pfeiltasten im Fokus) erreichbar.
 */
export function Slider({
  ariaLabel,
  kopf,
  fuss,
  children,
  className,
}: {
  ariaLabel: string;
  kopf?: ReactNode;
  fuss?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const spur = useRef<HTMLUListElement>(null);
  const [amAnfang, setAmAnfang] = useState(true);
  const [amEnde, setAmEnde] = useState(false);
  const [ueberlauf, setUeberlauf] = useState(false);

  function messen() {
    const el = spur.current;
    if (!el) return;
    setAmAnfang(el.scrollLeft <= 0);
    setAmEnde(el.scrollLeft >= el.scrollWidth - el.clientWidth - 1);
    setUeberlauf(el.scrollWidth - el.clientWidth > 1);
  }

  // Der Beobachter meldet sich beim Start und bei jeder Größenänderung.
  useEffect(() => {
    const el = spur.current;
    if (!el) return;
    const beobachter = new ResizeObserver(() => messen());
    beobachter.observe(el);
    for (const karte of Array.from(el.children)) beobachter.observe(karte);
    return () => beobachter.disconnect();
  }, []);

  function blaettern(richtung: 1 | -1) {
    const el = spur.current;
    if (!el) return;
    // Am Anfang und am Ende tut der gesperrte Pfeil nichts.
    if (richtung === -1 ? amAnfang : amEnde) return;
    const erste = el.children[0] as HTMLElement | undefined;
    const luecke = parseFloat(getComputedStyle(el).columnGap) || 0;
    const schritt = (erste?.getBoundingClientRect().width ?? el.clientWidth) + luecke;
    const anzahl = Math.max(1, Math.floor(el.clientWidth / schritt));
    const reduziert = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: richtung * anzahl * schritt, behavior: reduziert ? "auto" : "smooth" });
  }

  const pfeile = (
    <div className={cn("flex shrink-0 gap-2", !ueberlauf && "invisible")}>
      <button
        type="button"
        data-slider-zurueck
        aria-label={T.referenten.slider.zurueck}
        aria-disabled={amAnfang}
        onClick={() => blaettern(-1)}
        className={KNOPF}
      >
        <ChevronLeft className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        data-slider-weiter
        aria-label={T.referenten.slider.weiter}
        aria-disabled={amEnde}
        onClick={() => blaettern(1)}
        className={KNOPF}
      >
        <ChevronRight className="size-4" aria-hidden />
      </button>
    </div>
  );

  return (
    <div className={className}>
      {kopf ? (
        <div className="mb-3.5 flex items-center justify-between gap-4">
          <div className="min-w-0">{kopf}</div>
          {pfeile}
        </div>
      ) : null}

      <ul
        ref={spur}
        tabIndex={0}
        aria-label={ariaLabel}
        onScroll={messen}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain outline-none focus-visible:ring-2 focus-visible:ring-ring [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>li]:shrink-0 [&>li]:snap-start"
      >
        {children}
      </ul>

      {!kopf ? (
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">{fuss}</div>
          {pfeile}
        </div>
      ) : null}
    </div>
  );
}
