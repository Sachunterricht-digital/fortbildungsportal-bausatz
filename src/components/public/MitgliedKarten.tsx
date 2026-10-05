import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Portraet } from "@/components/public/Portraet";
import { angebotsZaehler, funktionsEtikett, type MitgliedKarte } from "@/lib/mitglieder";
import { cn } from "@/lib/utils";
import { T } from "@/texte/de";

const KARTE =
  "flex h-full flex-col border border-border bg-card text-inherit no-underline outline-none transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

/** Referent: Linie. Fachfunktion: das weiche Gelb der Marke. */
export function FunktionsBadge({ funktion, className }: { funktion: string; className?: string }) {
  return funktion === "FACHFUNKTION" ? (
    <Badge className={cn("rounded-sm border-marke-gelb bg-marke-gelb-weich text-foreground", className)}>
      {funktionsEtikett(funktion)}
    </Badge>
  ) : (
    <Badge variant="outline" className={cn("rounded-sm", className)}>
      {funktionsEtikett(funktion)}
    </Badge>
  );
}

/** Etikett im Kopf des Steckbriefs: immer im weichen Gelb der Marke. */
export function FunktionsBadgeEtikett({ funktion }: { funktion: string }) {
  return (
    <span className="etikett border border-marke-gelb bg-marke-gelb-weich px-1.5 py-0.5 text-foreground">
      {funktionsEtikett(funktion)}
    </span>
  );
}

/**
 * Kompakte Karte für den Slider auf der Startseite (ca. 180 px breit):
 * Porträt, Name, Stammschule, Funktion.
 */
export function MitgliedKarteKlein({
  mitglied,
  ueberschrift: Ueberschrift = "h4",
}: {
  mitglied: MitgliedKarte;
  ueberschrift?: "h2" | "h3" | "h4";
}) {
  return (
    <li className="w-[11.25rem]">
      <Link href={`/referenten/${mitglied.id}`} className={cn(KARTE, "gap-2.5 p-4")}>
        <Portraet id={mitglied.id} initialen={mitglied.initialen} fotoVersion={mitglied.fotoVersion} />
        <Ueberschrift className="mt-0.5 text-[0.9375rem] leading-tight font-bold [overflow-wrap:anywhere]">
          {mitglied.name}
        </Ueberschrift>
        {mitglied.schule ? (
          <p className="-mt-1.5 text-[0.8125rem] leading-snug text-muted-foreground [overflow-wrap:anywhere]">
            {mitglied.schule}
          </p>
        ) : null}
        <FunktionsBadge funktion={mitglied.funktion} className="mt-auto self-start" />
      </Link>
    </li>
  );
}

/**
 * Profilkarte im Raster der Seite „Mitglieder Digi-Team“: Porträt, Name,
 * Stammschule, Funktion, bis zu drei Schwerpunkte und die Zahl der Angebote.
 */
export function MitgliedKarteGross({ mitglied }: { mitglied: MitgliedKarte }) {
  const schwerpunkte = mitglied.schwerpunkte.slice(0, 3);
  const zaehler = angebotsZaehler(mitglied.anzahlSchilf, mitglied.anzahlFortbildungen);

  return (
    <li className="min-w-0">
      <Link href={`/referenten/${mitglied.id}`} className={cn(KARTE, "group gap-3.5 p-4")}>
        <div className="flex min-w-0 items-center gap-3.5">
          <Portraet id={mitglied.id} initialen={mitglied.initialen} fotoVersion={mitglied.fotoVersion} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="text-[1.0625rem] leading-tight font-bold text-pretty [overflow-wrap:anywhere]">
              {mitglied.name}
            </h2>
            {mitglied.schule ? (
              <p className="text-sm leading-snug text-muted-foreground [overflow-wrap:anywhere]">{mitglied.schule}</p>
            ) : null}
          </div>
        </div>

        <FunktionsBadge funktion={mitglied.funktion} className="-mt-1 self-start" />

        {schwerpunkte.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5" aria-label={T.referenten.schwerpunkteAriaLabel}>
            {schwerpunkte.map((s) => (
              <li key={s} className="min-w-0">
                <Badge variant="secondary" className="max-w-full">
                  <span className="truncate">{s}</span>
                </Badge>
              </li>
            ))}
          </ul>
        ) : null}

        {zaehler ? (
          <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/70 pt-3 text-xs text-muted-foreground">
            <span className="zahl">{zaehler}</span>
            <ArrowRight
              className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </div>
        ) : null}
      </Link>
    </li>
  );
}
