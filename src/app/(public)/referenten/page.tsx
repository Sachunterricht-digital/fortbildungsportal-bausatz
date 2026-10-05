import type { Metadata } from "next";

import { MitgliedKarteGross } from "@/components/public/MitgliedKarten";
import { aktuellesSchuljahrKurz } from "@/lib/datetime";
import { ladeMitglieder } from "@/lib/mitgliederDaten";
import { T } from "@/texte/de";

// Die Seite liest bei jedem Aufruf aus der Datenbank, sonst fehlen neue Profile.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: T.referenten.metaTitel };

/** Alle Mitglieder des Digi-Teams als Raster, nach Nachname. Der Kopf nennt nur das Schuljahr. */
export default async function Mitglieder() {
  const mitglieder = await ladeMitglieder();

  return (
    <div className="space-y-7">
      <header className="rounded-2xl border border-border bg-secondary/45 px-5 py-7 sm:px-7">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {T.referenten.seiteTitel(aktuellesSchuljahrKurz())}
        </h1>
      </header>

      {mitglieder.length === 0 ? (
        <p className="border border-dashed px-6 py-14 text-center text-sm text-muted-foreground">
          {T.referenten.leer}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {mitglieder.map((m) => (
            <MitgliedKarteGross key={m.id} mitglied={m} />
          ))}
        </ul>
      )}
    </div>
  );
}
