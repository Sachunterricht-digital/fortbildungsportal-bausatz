import type { Metadata } from "next";

import { SystemtextSeite } from "@/components/public/SystemtextSeite";
import { T } from "@/texte/de";

// Die Seite liest bei jedem Aufruf aus der Datenbank. Ohne diese Zeile
// würde Next die Inhalte beim Bauen einfrieren.
export const dynamic = "force-dynamic";


export const metadata: Metadata = {
  title: T.aussen.rechtliches.impressumMetaTitel,
  robots: { index: true, follow: false },
};

export default function ImpressumSeite() {
  return <SystemtextSeite id="impressum" ueberschrift={T.aussen.rechtliches.impressumUeberschrift} />;
}
