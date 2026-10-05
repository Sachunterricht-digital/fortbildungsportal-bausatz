import { NichtGefunden } from "@/components/public/NichtGefunden";
import { T } from "@/texte/de";

/** 404 innerhalb der öffentlichen Seiten, mit Kopf und Fuß des Layouts. */
export default function NotFound() {
  return (
    <NichtGefunden
      titel={T.aussen.nichtGefunden.titel}
      weg={{ href: "/", label: T.aussen.nichtGefunden.zurStartseite }}
    />
  );
}
