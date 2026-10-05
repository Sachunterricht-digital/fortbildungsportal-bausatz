import { berlinIsoDatum, formatMonatJahr } from "@/lib/datetime";
import type { FortbildungKachel } from "@/lib/queries";
import { FortbildungKarte } from "./FortbildungKarte";
import { T } from "@/texte/de";

type MitPlaetzen = FortbildungKachel & { maxTn?: number | null };

const ABRUF = "abruf";

/**
 * Termine nach Monat gruppiert.
 *
 * Eine durchgehende Liste von dreißig Karten liest sich wie eine Tabelle.
 * Monatsüberschriften geben der Seite Rhythmus und beantworten die Frage
 * „was steht im November an?" ohne Filter.
 */
export function MonatsGruppen({
  fortbildungen,
}: {
  fortbildungen: MitPlaetzen[];
}) {
  const gruppen = new Map<string, MitPlaetzen[]>();

  for (const f of fortbildungen) {
    const schluessel = f.beginn ? berlinIsoDatum(f.beginn).slice(0, 7) : ABRUF;
    const liste = gruppen.get(schluessel);
    if (liste) liste.push(f);
    else gruppen.set(schluessel, [f]);
  }

  return (
    <div className="space-y-10">
      {[...gruppen.entries()]
        // Angebote auf Abruf stehen immer am Schluss.
        .sort(([a], [b]) => Number(a === ABRUF) - Number(b === ABRUF))
        .map(([monat, termine]) => (
        <section key={monat}>
          <h2 className="mb-3 flex items-baseline gap-4 border-b-2 border-foreground pb-1.5">
            <span className="etikett text-base tracking-widest">
              {monat === ABRUF
                ? T.allgemein.abrufUeberschrift
                : formatMonatJahr(new Date(`${monat}-15T12:00:00Z`))}
            </span>
            <span className="h-px flex-1" aria-hidden />
            <span className="zahl text-xs text-muted-foreground">
              {T.aussen.monatsGruppen.anzahlTermine(termine.length)}
            </span>
          </h2>

          <div className="grid">
            {termine.map((f) => (
              <FortbildungKarte key={f.id} fortbildung={f} maxTn={f.maxTn} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
