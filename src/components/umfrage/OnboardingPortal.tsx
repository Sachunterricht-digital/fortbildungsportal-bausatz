import Link from "next/link";

import { cn } from "@/lib/utils";
import { T } from "@/texte/de";

const TP = T.onboarding.portal;

/**
 * „Das Portal in drei Schritten“: Karte mit drei nummerierten Schritten und je
 * einem Screenshot der Testperson „Erika Muster“. Reiner Serveranteil, die
 * Bilder liegen unter `public/bilder/onboarding/`.
 */
export function OnboardingPortal() {
  return (
    <section
      className="space-y-4 border border-border bg-card p-4 sm:p-5"
      aria-labelledby="onboarding-portal"
      data-testid="onboarding-portal"
    >
      <h3 id="onboarding-portal" className="font-heading text-lg font-bold tracking-tight">
        {TP.titel}
      </h3>
      <ol className="space-y-6">
        {TP.schritte.map((schritt, index) => (
          <li key={schritt.titel} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="grid size-6 shrink-0 place-content-center rounded-[4px] bg-primary text-xs font-semibold text-primary-foreground tabular-nums"
              >
                {index + 1}
              </span>
              <span className="font-semibold">{schritt.titel}</span>
            </div>
            <p className="text-sm text-muted-foreground text-pretty">{schritt.text}</p>
            {"zusatz" in schritt ? (
              <p className="text-sm text-muted-foreground text-pretty">{schritt.zusatz}</p>
            ) : null}
            <figure
              className={cn(
                "mt-1 overflow-hidden border border-border bg-background leading-[0]",
                schritt.schmal && "w-full sm:w-[68.8%]",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- statische Datei mit fester Größe, keine Optimierung nötig */}
              <img
                src={schritt.bild}
                width={schritt.breite}
                height={schritt.hoehe}
                alt={schritt.titel}
                className="block h-auto w-full"
              />
            </figure>
          </li>
        ))}
      </ol>
      <p className="text-sm">
        {TP.uebersicht.text}{" "}
        <Link
          href={TP.uebersicht.href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary underline underline-offset-2"
        >
          {TP.uebersicht.link}
          <span className="sr-only"> {TP.uebersicht.neuerTab}</span>
        </Link>
      </p>
    </section>
  );
}
