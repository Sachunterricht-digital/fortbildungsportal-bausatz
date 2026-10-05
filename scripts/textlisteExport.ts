/**
 * Zieht alle Texte aus src/texte/de.ts und den Wertelisten als JSON für die
 * Textliste (eine Zeile je Text). Texte mit Platzhaltern erscheinen mit {name}.
 *
 *   npx tsx scripts/textlisteExport.ts > textliste.json
 */
import {
  FUNKTIONEN,
  NIVEAUSTUFEN,
  ORGANISATIONSFORMEN,
  SCHULARTEN,
  STATUS,
  VERANSTALTUNGSFORMATE,
} from "@/constants/fortbildung";
import { T } from "@/texte/de";

interface Zeile {
  kennung: string;
  bereich: string;
  text: string;
}

const zeilen: Zeile[] = [];
const BEREICH: Record<string, string> = {
  allgemein: "außen und innen",
  aussen: "außen",
  referenten: "außen, Teambereich",
  maske: "innen, Maske",
  zugang: "innen, Anmeldung und Übersicht",
  profil: "innen, Profil",
  frist: "innen, Frist",
};

/** Ruft eine Textfunktion mit ihren Parameternamen als {platzhalter} auf. */
function mitPlatzhaltern(fn: (...args: never[]) => unknown): string {
  const kopf = fn.toString().split("=>")[0];
  const namen = [...kopf.matchAll(/([A-Za-zäöüß_]\w*)\s*(?::[^,)]+)?/g)]
    .map((m) => m[1])
    .filter((n) => !["string", "number", "boolean"].includes(n));
  const werte = namen.map((n) => `{${n}}`);
  try {
    return String((fn as (...a: string[]) => unknown)(...werte));
  } catch {
    return `[Funktion: ${kopf.trim()}]`;
  }
}

function lauf(pfad: string[], wert: unknown) {
  if (typeof wert === "string") {
    zeilen.push({ kennung: `WEB-${pfad.join(".")}`, bereich: BEREICH[pfad[0]] ?? pfad[0], text: wert });
  } else if (typeof wert === "function") {
    zeilen.push({
      kennung: `WEB-${pfad.join(".")}`,
      bereich: BEREICH[pfad[0]] ?? pfad[0],
      text: mitPlatzhaltern(wert as (...args: never[]) => unknown),
    });
  } else if (wert && typeof wert === "object") {
    for (const [k, v] of Object.entries(wert)) lauf([...pfad, k], v);
  }
}

lauf([], T);

const WERTE: Record<string, ReadonlyArray<{ value: string; label: string; beschreibung?: string }>> = {
  organisationsform: ORGANISATIONSFORMEN,
  format: VERANSTALTUNGSFORMATE,
  schulart: SCHULARTEN,
  niveaustufe: NIVEAUSTUFEN,
  status: STATUS,
  funktion: FUNKTIONEN,
};
for (const [gruppe, liste] of Object.entries(WERTE)) {
  for (const eintrag of liste) {
    zeilen.push({ kennung: `WEB-werte.${gruppe}.${eintrag.value}`, bereich: "Auswahlwerte", text: eintrag.label });
    if (eintrag.beschreibung) {
      zeilen.push({
        kennung: `WEB-werte.${gruppe}.${eintrag.value}_beschreibung`,
        bereich: "Auswahlwerte",
        text: eintrag.beschreibung,
      });
    }
  }
}

process.stdout.write(JSON.stringify(zeilen, null, 2));
