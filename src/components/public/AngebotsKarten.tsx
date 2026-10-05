import Link from "next/link";
import { MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { angebotsEtikett, ortFuerKarte, schulartLabel } from "@/constants/fortbildung";
import { formatDatum, formatZeit } from "@/lib/datetime";
import type { FortbildungKachel } from "@/lib/queries";
import { cn } from "@/lib/utils";

const KARTE =
  "group flex h-full flex-col gap-2 border border-border bg-card p-4 text-inherit no-underline outline-none transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

/** Gelbes Etikett wie auf den Startseiten-Karten der Angebote. */
const BADGE = "rounded-sm border-marke-gelb bg-marke-gelb-weich text-foreground";

/**
 * Karte für eine regionale Fortbildung mit Termin: Datum, Uhrzeit, Titel, Ort.
 * Führt zur Detailseite des Angebots.
 */
export function TerminKarte({ fortbildung: f }: { fortbildung: FortbildungKachel }) {
  return (
    <li className="w-60">
      <Link href={`/fortbildungen/${f.slug}`} className={KARTE}>
        <span className="zahl block text-lg leading-tight font-bold text-primary">
          {formatDatum(f.beginn)}
          {f.beginn && f.ende ? (
            <small className="mt-0.5 block text-xs font-normal tracking-normal text-muted-foreground">
              {formatZeit(f.beginn)}–{formatZeit(f.ende)}
            </small>
          ) : null}
        </span>
        <h3 className="text-base leading-snug font-bold text-pretty transition-colors group-hover:text-primary">
          {f.titel}
        </h3>
        <p className="mt-auto flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0">{ortFuerKarte(f)}</span>
        </p>
      </Link>
    </li>
  );
}

/**
 * Karte für ein Angebot ohne Termin (SchiLf, Micro-SchiLf, Video-Tutorial):
 * Etikett, Titel, Schularten. Führt zur Detailseite des Angebots.
 */
export function AbrufKarte({ fortbildung: f }: { fortbildung: FortbildungKachel }) {
  const schularten = f.schularten.map(schulartLabel).join(" · ");
  return (
    <li className="w-60">
      <Link href={`/fortbildungen/${f.slug}`} className={KARTE}>
        <Badge className={cn(BADGE, "self-start")}>{angebotsEtikett(f)}</Badge>
        <h3 className="text-base leading-snug font-bold text-pretty transition-colors group-hover:text-primary">
          {f.titel}
        </h3>
        {schularten ? <p className="mt-auto text-sm text-muted-foreground">{schularten}</p> : null}
      </Link>
    </li>
  );
}
