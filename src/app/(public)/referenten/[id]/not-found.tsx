import { NichtGefunden } from "@/components/public/NichtGefunden";
import { T } from "@/texte/de";

/**
 * 404 des Steckbriefs: unbekannte, stillgelegte und verborgene Personen
 * sehen dasselbe, es verrät nicht, ob es die Person gibt.
 */
export default function NotFound() {
  return (
    <NichtGefunden
      titel={T.referenten.steckbrief.nichtGefunden}
      weg={{ href: "/referenten", label: T.referenten.steckbrief.zurueck }}
    />
  );
}
