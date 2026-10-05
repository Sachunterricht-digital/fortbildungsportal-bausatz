"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { CalendarRange } from "lucide-react";

import { baueUrl, type SuchParameter } from "@/lib/filter";

/**
 * Umschalter für das Schuljahr.
 *
 * Bewusst neben der Überschrift und nicht in der Filterleiste: Das Schuljahr
 * ist keine Feinheit unter vielen, sondern bestimmt, welchen Ausschnitt der
 * Arbeit man gerade vor sich hat.
 */
export function SchuljahrWahl({
  params,
  jahrgaenge,
  aktuell,
}: {
  params: SuchParameter;
  /** Alle Schuljahre, zu denen es Termine gibt, neueste zuerst. */
  jahrgaenge: string[];
  /** Das laufende Schuljahr, wird eigens gekennzeichnet. */
  aktuell: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [laeuft, starte] = useTransition();

  const gewaehlt =
    (Array.isArray(params.schuljahr) ? params.schuljahr[0] : params.schuljahr) ?? "";

  return (
    <label
      className={`flex items-center gap-2 text-sm ${laeuft ? "opacity-60" : ""}`}
    >
      <CalendarRange className="size-4 text-muted-foreground" aria-hidden />
      <span className="sr-only">Schuljahr</span>
      <select
        value={gewaehlt}
        onChange={(e) =>
          starte(() => {
            router.push(
              baueUrl(pathname, params, { schuljahr: e.target.value || undefined }),
              { scroll: false },
            );
          })
        }
        className="h-9 rounded-md border border-input bg-card px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/35 dark:bg-input/30"
      >
        <option value="">Alle Schuljahre</option>
        {jahrgaenge.map((jahr) => (
          <option key={jahr} value={jahr}>
            Schuljahr {jahr}
            {jahr === aktuell ? " (laufend)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
