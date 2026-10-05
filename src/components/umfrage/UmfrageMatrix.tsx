import type { ReactNode } from "react";
import { Check, CircleHelp, X } from "lucide-react";

import { ANTWORT_WERTE, type AntwortWert } from "@/constants/umfrage";
import { cn } from "@/lib/utils";
import { T } from "@/texte/de";

export interface MatrixTermin {
  id: string;
  /** Kurzform, z. B. "Mo 09.11." */
  label: string;
  festgelegt?: boolean;
}

export interface MatrixZeile {
  id: string;
  name: string;
  /** Die eigene Zeile der Person, die die Seite geöffnet hat. */
  eigene?: boolean;
  /** Noch nicht geantwortet (nur im Admin sichtbar, öffentlich gar nicht erst geliefert). */
  offen?: boolean;
  werte: Partial<Record<string, string>>;
  kommentar?: string | null;
  /** Zellen für `zusatzSpalten`, in derselben Reihenfolge. */
  zusatz?: ReactNode[];
}

const WERT_STIL: Record<AntwortWert, string> = {
  JA: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  VIELLEICHT: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  NEIN: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
};

/** Ein Wert als Icon mit Text für Screenreader, dezent eingefärbt. */
export function WertIcon({ wert }: { wert: string | undefined }) {
  const eintrag = ANTWORT_WERTE.find((a) => a.value === wert);
  if (!eintrag) {
    return <span className="text-muted-foreground/60" aria-label="keine Angabe">–</span>;
  }
  const Icon = eintrag.value === "JA" ? Check : eintrag.value === "VIELLEICHT" ? CircleHelp : X;
  return (
    <span
      className={cn("inline-flex size-7 items-center justify-center rounded-full", WERT_STIL[eintrag.value])}
      title={eintrag.label}
    >
      <Icon className="size-4" aria-hidden />
      <span className="sr-only">{eintrag.label}</span>
    </span>
  );
}

/**
 * Tabelle wie bei Doodle: Spalten sind Termine, Zeilen Personen, unten die
 * Summe der „Ja“ je Termin. Die Namensspalte bleibt beim horizontalen
 * Scrollen stehen (wichtig bei 390 px Breite).
 */
export function UmfrageMatrix({
  termine,
  zeilen,
  zusatzSpalten = [],
  leerText,
}: {
  termine: MatrixTermin[];
  zeilen: MatrixZeile[];
  zusatzSpalten?: string[];
  leerText?: string;
}) {
  const summen = termine.map(
    (termin) => zeilen.filter((zeile) => zeile.werte[termin.id] === "JA").length,
  );
  const hoechste = Math.max(0, ...summen);

  return (
    <div className="relative overflow-x-auto border border-border bg-card" data-testid="umfrage-matrix">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th
              scope="col"
              className="sticky left-0 z-10 min-w-36 bg-card px-3 py-2.5 text-left text-xs font-medium text-muted-foreground"
            >
              {T.umfrage.oeffentlich.spalteName}
            </th>
            {termine.map((termin) => (
              <th
                key={termin.id}
                scope="col"
                className={cn(
                  "min-w-20 px-2 py-2.5 text-center text-xs font-medium whitespace-nowrap",
                  termin.festgelegt ? "bg-primary/10 text-primary" : "text-muted-foreground",
                )}
              >
                {termin.label}
                {termin.festgelegt ? (
                  <span className="mt-0.5 block text-[0.7rem] font-semibold">
                    {T.umfrage.oeffentlich.festgelegtKurz}
                  </span>
                ) : null}
              </th>
            ))}
            {zusatzSpalten.map((kopf) => (
              <th
                key={kopf}
                scope="col"
                className="px-3 py-2.5 text-left text-xs font-medium whitespace-nowrap text-muted-foreground"
              >
                {kopf}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {zeilen.length === 0 ? (
            <tr>
              <td
                colSpan={1 + termine.length + zusatzSpalten.length}
                className="px-3 py-6 text-center text-muted-foreground"
              >
                {leerText ?? T.umfrage.oeffentlich.keineAntworten}
              </td>
            </tr>
          ) : null}
          {zeilen.map((zeile) => (
            <tr
              key={zeile.id}
              data-zeile={zeile.name}
              className={cn("border-b border-border/70 last:border-b-0", zeile.eigene && "bg-primary/5")}
            >
              <th
                scope="row"
                className={cn(
                  "sticky left-0 z-10 px-3 py-2 text-left font-normal",
                  zeile.eigene ? "bg-[color-mix(in_oklch,var(--card),var(--primary)_5%)]" : "bg-card",
                )}
              >
                <span className={cn(zeile.offen && "text-muted-foreground")}>{zeile.name}</span>
                {zeile.eigene ? (
                  <span className="ml-1.5 text-xs text-muted-foreground">({T.umfrage.oeffentlich.du})</span>
                ) : null}
                {zeile.kommentar ? (
                  <span
                    className="mt-0.5 block max-w-48 text-xs text-muted-foreground text-pretty"
                    title={T.umfrage.oeffentlich.kommentarVon(zeile.name)}
                  >
                    {zeile.kommentar}
                  </span>
                ) : null}
              </th>
              {termine.map((termin) => (
                <td
                  key={termin.id}
                  className={cn("px-2 py-2 text-center", termin.festgelegt && "bg-primary/5")}
                >
                  <WertIcon wert={zeile.werte[termin.id]} />
                </td>
              ))}
              {zeile.zusatz?.map((zelle, index) => (
                <td key={index} className="px-3 py-2 align-middle whitespace-nowrap">
                  {zelle}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-border bg-muted/40">
            <th
              scope="row"
              className="sticky left-0 z-10 bg-muted px-3 py-2.5 text-left text-xs font-medium text-muted-foreground"
              title={T.umfrage.oeffentlich.summeHinweis}
            >
              {T.umfrage.oeffentlich.summeJa}
            </th>
            {summen.map((summe, index) => (
              <td
                key={termine[index]!.id}
                data-testid="summe-ja"
                className={cn(
                  "px-2 py-2.5 text-center font-mono text-sm",
                  summe > 0 && summe === hoechste ? "font-semibold text-emerald-700 dark:text-emerald-300" : "text-muted-foreground",
                )}
              >
                {summe}
              </td>
            ))}
            {zusatzSpalten.map((kopf) => (
              <td key={kopf} />
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
