import Link from "next/link";
import { BookOpen, Globe, MapPin, Users } from "lucide-react";

import type { KatalogEintrag } from "@/lib/katalog";
import { katalogKurzbeschreibung } from "@/lib/katalog";
import { formatZeitraum } from "@/lib/datetime";
import {
  ebeneKlassen,
  formatLabel,
  organisationsformKurz,
  ortAnzeige,
  schulartLabel,
} from "@/constants/fortbildung";
import { StatusKennzeichen } from "@/components/admin/Kennzeichen";
import { T } from "@/texte/de";

export function KatalogTabelle({ eintraege }: { eintraege: KatalogEintrag[] }) {
  return (
    <div className="divide-y border bg-card">
      {eintraege.map((eintrag) => {
        const ebene = ebeneKlassen(eintrag.organisationsform);
        const schlagworte = eintrag.schlagworte
          .map((zuordnung) => zuordnung.schlagwort.name)
          .sort((a, b) => a.localeCompare(b, "de"));
        const referenten = eintrag.referenten
          .map((zuordnung) =>
            `${zuordnung.referent.vorname} ${zuordnung.referent.nachname}`.trim(),
          )
          .join(", ");

        return (
          <Link
            key={eintrag.id}
            href={`/admin/fortbildungen/${eintrag.id}`}
            className="group block border-l-4 border-l-transparent p-4 transition-colors hover:border-l-primary hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex flex-wrap items-start justify-between gap-x-5 gap-y-2">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className={`etikett px-1.5 py-0.5 ${ebene.flaeche}`}>
                    {organisationsformKurz(eintrag.organisationsform)}
                  </span>
                  <StatusKennzeichen status={eintrag.status} />
                  <span className="zahl text-xs text-muted-foreground">
                    {formatZeitraum(eintrag.beginn, eintrag.ende)}
                  </span>
                </div>
                <h2 className="font-semibold leading-snug group-hover:underline group-hover:underline-offset-4">
                  {eintrag.titel}
                </h2>
                {eintrag.kurztitel ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">{eintrag.kurztitel}</p>
                ) : null}
                <p className="mt-2 max-w-4xl text-sm leading-relaxed text-muted-foreground">
                  {katalogKurzbeschreibung(eintrag.beschreibungText, 430) || "Keine Beschreibung hinterlegt."}
                </p>
              </div>

              <div className="grid min-w-52 gap-1.5 text-sm text-muted-foreground sm:text-right">
                <span className="flex items-center gap-1.5 sm:justify-end">
                  {eintrag.veranstaltungsort?.istOnline ? <Globe className="size-3.5 shrink-0" aria-hidden /> : <MapPin className="size-3.5 shrink-0" aria-hidden />}
                  {ortAnzeige(eintrag.ortText, eintrag.veranstaltungsort) ?? T.allgemein.ortNachAbsprache}
                </span>
                <span className="flex items-center gap-1.5 sm:justify-end">
                  <BookOpen className="size-3.5 shrink-0" aria-hidden />
                  {formatLabel(eintrag.format)} · {eintrag.schularten.map(schulartLabel).join(", ")}
                </span>
                {referenten ? (
                  <span className="flex items-center gap-1.5 sm:justify-end">
                    <Users className="size-3.5 shrink-0" aria-hidden />
                    {referenten}
                  </span>
                ) : null}
              </div>
            </div>

            {schlagworte.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {schlagworte.map((schlagwort) => (
                  <span key={schlagwort} className="bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                    {schlagwort}
                  </span>
                ))}
              </div>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
