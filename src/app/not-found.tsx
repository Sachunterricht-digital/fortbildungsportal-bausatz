import { NichtGefunden } from "@/components/public/NichtGefunden";
import { T } from "@/texte/de";

/**
 * 404 für Adressen, die zu keiner Seite gehören, und für `notFound()` im
 * Redaktionsbereich. Es steht nur im Wurzel-Layout, deshalb mit eigenem Rahmen.
 * Innerhalb der öffentlichen Seiten greift `(public)/not-found.tsx` mit Kopf
 * und Fuß, bei Steckbriefen und Angeboten die jeweils eigene Datei.
 */
export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:py-14">
      <NichtGefunden
        titel={T.aussen.nichtGefunden.titel}
        weg={{ href: "/", label: T.aussen.nichtGefunden.zurStartseite }}
      />
    </main>
  );
}
