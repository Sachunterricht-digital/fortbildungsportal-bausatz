import { NichtGefunden } from "@/components/public/NichtGefunden";
import { T } from "@/texte/de";

/** 404 der Detailseite: unbekannte, nicht veröffentlichte und gelöschte Angebote. */
export default function NotFound() {
  return (
    <NichtGefunden
      titel={T.aussen.fortbildungDetail.nichtGefunden}
      weg={{ href: "/fortbildungen", label: T.aussen.layout.nav.alleFortbildungen }}
    />
  );
}
