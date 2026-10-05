import Link from "next/link";
import { ArrowRight, SearchX } from "lucide-react";
import { T } from "@/texte/de";

export interface Ausweg {
  schluessel: string;
  /** Einleitung, etwa "ohne" — bei einem erweiternden Vorschlag leer. */
  vorsatz: string;
  /** Der Filter selbst, hervorgehoben dargestellt. */
  hervorhebung: string;
  /** Wie viele Treffer dieser Weg brächte. */
  treffer: number;
  href: string;
}

/**
 * Leerzustand mit Auswegen.
 *
 * „Kein Treffer" ist der Moment, in dem Leute die Seite verlassen. Statt sie
 * damit allein zu lassen, wird gezeigt, welcher einzelne Filter im Weg steht
 * und was sein Wegfall brächte — dann ist der nächste Schritt ein Klick statt
 * einer Suche nach der richtigen Auswahlliste.
 */
export function LeerZustand({
  auswege,
  alleZuruecksetzen,
  gefiltert,
}: {
  auswege: Ausweg[];
  alleZuruecksetzen: string;
  gefiltert: boolean;
}) {
  return (
    <div className="border border-dashed px-6 py-14 text-center">
      <SearchX
        className="mx-auto mb-3 size-7 text-muted-foreground/60"
        aria-hidden
      />

      <p className="text-lg font-semibold">{T.aussen.leerZustand.titel}</p>

      {!gefiltert ? (
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground text-pretty">
          {T.aussen.leerZustand.ohneFilterText}
        </p>
      ) : auswege.length === 0 ? (
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground text-pretty">
          {T.aussen.leerZustand.keinTrefferTrotzWeniger}{" "}
          <Link
            href={alleZuruecksetzen}
            className="text-foreground underline underline-offset-4"
          >
            {T.aussen.leerZustand.alleFilterZuruecksetzen}
          </Link>
        </p>
      ) : (
        <>
          <p className="mx-auto mt-1 mb-5 max-w-md text-sm text-muted-foreground text-pretty">
            {T.aussen.leerZustand.dasWuerdeHelfen}
          </p>

          <ul className="mx-auto flex max-w-md flex-col gap-2">
            {auswege.map((ausweg) => (
              <li key={ausweg.schluessel}>
                <Link
                  href={ausweg.href}
                  className="zeile flex items-center justify-between gap-3 border border-l-4 border-l-primary bg-card px-4 py-3 text-left text-sm hover:bg-accent/45"
                >
                  <span className="text-pretty">
                    {ausweg.vorsatz ? `${ausweg.vorsatz} ` : ""}
                    <span className="font-medium">{ausweg.hervorhebung}</span>
                  </span>
                  <span className="zahl flex shrink-0 items-center gap-1.5 font-medium text-primary whitespace-nowrap">
                    {T.aussen.leerZustand.treffer(ausweg.treffer)}
                    <ArrowRight className="size-4" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
