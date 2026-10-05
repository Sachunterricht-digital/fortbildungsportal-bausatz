"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import type { KompetenzBereichOption } from "./types";
import { kompetenzAuswahlUmschalten } from "@/lib/formularauswahl";
import { T } from "@/texte/de";

/**
 * DigCompEdu Bavaria: sechs Kompetenzbereiche als Akkordeon, darin die
 * Unterkompetenzen als Checkboxen.
 *
 * Ausgewählt werden können sowohl der Bereich selbst (z. B. "3") als auch
 * einzelne Unterkompetenzen ("3.2"), unabhängig voneinander. Der öffentliche
 * Bereichsfilter findet Unterkompetenzen bereits über ihren Code-Präfix.
 */
export function DigCompAccordion({
  bereiche,
  ausgewaehlt,
  onChange,
}: {
  bereiche: KompetenzBereichOption[];
  ausgewaehlt: string[];
  onChange: (codes: string[]) => void;
}) {
  const gesetzt = new Set(ausgewaehlt);

  function umschalten(code: string, aktiv: boolean) {
    onChange(kompetenzAuswahlUmschalten(ausgewaehlt, code, aktiv));
  }

  return (
    <div className="space-y-3">
      {ausgewaehlt.map((code) => (
        <input key={code} type="hidden" name="kompetenzen" value={code} />
      ))}

      <Accordion multiple defaultValue={[]} className="border px-4">
        {bereiche.map((bereich) => {
          const anzahl = bereich.children.filter((k) => gesetzt.has(k.code)).length;
          const bereichGesetzt = gesetzt.has(bereich.code);

          return (
            <AccordionItem key={bereich.code} value={bereich.code}>
              <AccordionTrigger>
                <span className="flex flex-1 items-center gap-2 pr-2">
                  <span className="text-muted-foreground zahl">
                    {T.maske.digCompAccordion.kbLabel(bereich.code)}
                  </span>
                  <span>{bereich.titel}</span>
                  {anzahl > 0 || bereichGesetzt ? (
                    <span className="etikett bg-primary px-1.5 py-0.5 text-primary-foreground">
                      {anzahl > 0
                        ? T.maske.digCompAccordion.anzahlAusgewaehlt(anzahl)
                        : T.maske.digCompAccordion.bereichGewaehlt}
                    </span>
                  ) : null}
                </span>
              </AccordionTrigger>

              <AccordionContent keepMounted>
                <div className="space-y-3 pb-4">
                  {bereich.beschreibung ? (
                    <p className="text-sm text-muted-foreground">
                      {bereich.beschreibung}
                    </p>
                  ) : null}

                  <label className="flex items-center gap-2.5 bg-muted/50 px-2.5 py-2">
                    <Checkbox
                      checked={bereichGesetzt}
                      onCheckedChange={(checked) =>
                        umschalten(bereich.code, checked)
                      }
                    />
                    <span className="text-sm font-medium">
                      {T.maske.digCompAccordion.gesamterBereichLabel(bereich.code)}
                    </span>
                  </label>
                  <p className="px-2.5 text-xs text-muted-foreground">
                    {T.maske.digCompAccordion.einzelneKompetenzenHinweis}
                  </p>

                  <div className="grid gap-1 sm:grid-cols-2">
                    {bereich.children.map((kompetenz) => (
                      <label
                        key={kompetenz.code}
                        className="flex items-start gap-2.5 px-2.5 py-1.5 transition-colors hover:bg-accent/50"
                      >
                        <Checkbox
                          className="mt-0.5"
                          checked={gesetzt.has(kompetenz.code)}
                          onCheckedChange={(checked) =>
                            umschalten(kompetenz.code, checked)
                          }
                        />
                        <span className="text-sm">
                          <span className="text-muted-foreground zahl">
                            {kompetenz.code}
                          </span>{" "}
                          {kompetenz.titel}
                          {kompetenz.istPlatzhalter ? (
                            <span
                              title={T.maske.digCompAccordion.platzhalterTitle}
                              className="ml-1.5 text-xs text-muted-foreground"
                            >
                              {T.maske.digCompAccordion.platzhalterHinweis}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      <p className="text-xs text-muted-foreground">
        {T.maske.digCompAccordion.ausgewaehltZeile(ausgewaehlt)}
      </p>
    </div>
  );
}
