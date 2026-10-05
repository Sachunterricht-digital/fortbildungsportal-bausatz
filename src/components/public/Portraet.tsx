"use client";

import { useEffect, useRef, useState } from "react";

import { portraetVariante } from "@/lib/mitglieder";
import { cn } from "@/lib/utils";

/** Initialen in drei ruhigen Varianten: Petrol, weiches Gelb, helles Blau. */
const VARIANTEN = [
  "bg-primary text-primary-foreground",
  "bg-marke-gelb-weich text-foreground shadow-[inset_0_0_0_1.5px_var(--marke-gelb)]",
  "bg-accent text-primary",
] as const;

/**
 * Rundes Porträt: das Foto der Person, sonst ihre Initialen.
 *
 * Mit `alt` ist das Bild Inhalt (Steckbrief). Ohne `alt` steht der Name direkt
 * daneben und das Bild ist Schmuck. Lädt das Foto nicht, erscheinen die
 * Initialen, statt ein kaputtes Bild zu zeigen. Ein Fehler, der vor der
 * Hydration passiert (Datei fehlt, Route liefert 404), erreicht `onError`
 * nicht mehr, deshalb schaut `useEffect` beim Start einmal nach.
 */
export function Portraet({
  id,
  initialen,
  fotoVersion,
  alt,
  gross = false,
  className,
}: {
  id: string;
  initialen: string;
  fotoVersion: number | null;
  alt?: string;
  gross?: boolean;
  className?: string;
}) {
  const [kaputt, setKaputt] = useState(false);
  const bild = useRef<HTMLImageElement>(null);
  const groesse = gross ? "size-32" : "size-14";

  useEffect(() => {
    const el = bild.current;
    if (el && el.complete && el.naturalWidth === 0) setKaputt(true);
  }, []);

  if (fotoVersion !== null && !kaputt) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- eigene, nicht optimierbare Route, kein externes Bild
      <img
        ref={bild}
        src={`/api/portraet/${id}?v=${fotoVersion}`}
        alt={alt ?? ""}
        width={gross ? 128 : 56}
        height={gross ? 128 : 56}
        loading="lazy"
        onError={() => setKaputt(true)}
        className={cn("shrink-0 rounded-full border border-border object-cover", groesse, className)}
      />
    );
  }

  return (
    <span
      role={alt ? "img" : undefined}
      aria-label={alt}
      aria-hidden={alt ? undefined : true}
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-heading leading-none font-bold",
        gross ? "text-[2.5rem]" : "text-lg",
        groesse,
        VARIANTEN[portraetVariante(id)],
        className,
      )}
    >
      {initialen}
    </span>
  );
}
