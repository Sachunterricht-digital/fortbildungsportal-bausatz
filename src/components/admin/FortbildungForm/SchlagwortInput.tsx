"use client";

import { useId, useMemo, useState } from "react";
import { Lock, Plus, Tag, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { normalisiereSchlagwort, schlagwortSchluessel } from "@/lib/schlagwort";
import { T } from "@/texte/de";

const MAX_SCHLAGWORTE = 30;

/**
 * Schlagwort-Eingabe mit Vorschlägen.
 *
 * Die Pflicht-Schlagworte des Schulamts stehen fest verankert vorn und lassen
 * sich nicht entfernen. Verlassen darf man sich darauf trotzdem nicht — die
 * Server Action hängt sie unabhängig davon noch einmal an.
 */
export function SchlagwortInput({
  werte,
  onChange,
  vorschlaege,
  pflicht,
}: {
  werte: string[];
  onChange: (werte: string[]) => void;
  vorschlaege: string[];
  pflicht: string[];
}) {
  const [eingabe, setEingabe] = useState("");
  const vorschlagsId = useId();


  const offeneVorschlaege = useMemo(() => {
    const belegt = new Set(
      [...werte, ...pflicht].map(schlagwortSchluessel),
    );
    const suche = schlagwortSchluessel(eingabe);

    return vorschlaege
      .filter((v) => !belegt.has(schlagwortSchluessel(v)))
      .filter((v) => (suche ? schlagwortSchluessel(v).includes(suche) : true))
      .sort((a, b) => {
        const aBeginnt = schlagwortSchluessel(a).startsWith(suche);
        const bBeginnt = schlagwortSchluessel(b).startsWith(suche);
        if (aBeginnt !== bBeginnt) return aBeginnt ? -1 : 1;
        return a.localeCompare(b, "de-DE");
      })
      .slice(0, 8);
  }, [vorschlaege, werte, eingabe, pflicht]);

  function hinzufuegen(name: string) {
    if (werte.length >= MAX_SCHLAGWORTE) return;

    const bereinigt = normalisiereSchlagwort(name);
    if (!bereinigt) return;

    // Existiert der Begriff bereits global, wird dessen Schreibweise
    // übernommen. Das verhindert „digital“ neben „Digital“ schon im Browser.
    const kanonisch =
      vorschlaege.find(
        (vorschlag) =>
          schlagwortSchluessel(vorschlag) === schlagwortSchluessel(bereinigt),
      ) ?? bereinigt;

    const belegt = [...werte, ...pflicht].some(
      (w) => schlagwortSchluessel(w) === schlagwortSchluessel(kanonisch),
    );
    if (!belegt) onChange([...werte, kanonisch]);
    setEingabe("");
  }

  return (
    <div className="space-y-2">
      {/* Für jedes Schlagwort ein eigenes Feld — die Action liest sie mit getAll(). */}
      {werte.map((wert) => (
        <input key={wert} type="hidden" name="schlagworte" value={wert} />
      ))}

      <div className="flex flex-wrap gap-1.5 border border-input p-2">
        {pflicht.map((wert) => (
          <span
            key={schlagwortSchluessel(wert)}
            title={T.maske.schlagwortInput.pflichtTitle}
            className="inline-flex items-center gap-1 bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
          >
            <Lock className="size-3" aria-hidden />
            {wert}
          </span>
        ))}

        {werte.map((wert) => (
          <span
            key={wert}
            title={T.maske.schlagwortInput.schlagwortTitle(wert)}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary shadow-sm"
          >
            <Tag className="size-3 shrink-0" aria-hidden />
            {wert}
            <button
              type="button"
              onClick={() => onChange(werte.filter((w) => w !== wert))}
              aria-label={T.maske.schlagwortInput.entfernenAriaLabel(wert)}
              className="rounded-full text-primary/65 transition-colors hover:bg-primary/10 hover:text-destructive"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}

        <Input
          value={eingabe}
          onChange={(e) => setEingabe(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              // Enter darf hier nicht das ganze Formular absenden.
              e.preventDefault();
              hinzufuegen(eingabe);
            }
            if (e.key === "Backspace" && eingabe === "" && werte.length > 0) {
              onChange(werte.slice(0, -1));
            }
          }}
          list={vorschlagsId}
          placeholder={T.maske.schlagwortInput.eingabePlatzhalter}
          aria-label={T.maske.schlagwortInput.eingabeAriaLabel}
          aria-describedby={`${vorschlagsId}-hinweis`}
          disabled={werte.length >= MAX_SCHLAGWORTE}
          className="h-7 min-w-52 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
        />
      </div>

      <datalist id={vorschlagsId}>
        {offeneVorschlaege.map((vorschlag) => (
          <option key={vorschlag} value={vorschlag} />
        ))}
      </datalist>

      <p id={`${vorschlagsId}-hinweis`} className="text-xs text-muted-foreground">
        {T.maske.schlagwortInput.hinweisText}
        {werte.length >= MAX_SCHLAGWORTE
          ? T.maske.schlagwortInput.maxHinweis(MAX_SCHLAGWORTE)
          : T.maske.schlagwortInput.nochMoeglich(MAX_SCHLAGWORTE - werte.length)}
      </p>

      {offeneVorschlaege.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{T.maske.schlagwortInput.vorschlaegeLabel}</span>
          {offeneVorschlaege.map((vorschlag) => (
            <button
              key={vorschlag}
              type="button"
              onClick={() => hinzufuegen(vorschlag)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-solid hover:bg-accent hover:text-foreground"
            >
              <Plus className="size-3" aria-hidden />
              {vorschlag}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
