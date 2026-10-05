"use client";

import { useEffect, useRef } from "react";
import { AlertCircle } from "lucide-react";
import { fehlerTab } from "@/lib/validation/fortbildung";
import { T } from "@/texte/de";

/** Serverfehler bleiben auch dann erreichbar, wenn ihr Feld ausgeblendet ist. */
export function FehlerUebersicht({
  fehler,
  onAbschnitt,
}: {
  fehler: Record<string, string>;
  onAbschnitt: (abschnitt: string, feld: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const hatFehler = Object.keys(fehler).length > 0;

  useEffect(() => {
    if (hatFehler) ref.current?.focus();
  }, [fehler, hatFehler]);

  if (!hatFehler) return null;

  return (
    <div ref={ref} tabIndex={-1} role="alert" className="scroll-mt-20 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive outline-none focus:ring-2 focus:ring-destructive/40">
      <p className="flex items-center gap-2 font-medium">
        <AlertCircle className="size-4 shrink-0" aria-hidden />
        {T.maske.fehlerUebersicht.ueberschrift}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {Object.entries(fehler).map(([feld, meldung]) => {
          const abschnitt = fehlerTab(feld);
          return (
            <li key={feld}>
              {abschnitt ? (
                <button type="button" className="text-left underline underline-offset-2" onClick={() => onAbschnitt(abschnitt, feld)}>
                  {meldung} <span className="sr-only">{T.maske.fehlerUebersicht.zumAbschnittSrOnly}</span>
                </button>
              ) : meldung}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
