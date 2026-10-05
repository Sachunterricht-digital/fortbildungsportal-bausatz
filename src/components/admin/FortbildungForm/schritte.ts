import { T } from "@/texte/de";

/**
 * Die Schritte des Wizards.
 *
 * Dieselben Abschnitte dienen im Bearbeiten-Formular als Reiter — die
 * Zuordnung Feld → Abschnitt liegt deshalb nur einmal vor (FELD_ZU_TAB in
 * lib/validation/fortbildung.ts).
 */
export interface Schritt {
  id: string;
  titel: string;
  /** Kurze Erklärung, was in diesem Schritt gebraucht wird. */
  hilfe: string;
  /** Felder, die vor dem Weitergehen ausgefüllt sein müssen. */
  pflichtfelder: string[];
}

export const SCHRITTE: Schritt[] = [
  {
    id: "eckdaten",
    titel: T.maske.abschnitteNamen.eckdaten,
    hilfe: T.maske.schritte.hilfeEckdaten,
    pflichtfelder: [
      "titel",
      "organisationsform",
      "maxTn",
      "format",
      "beginn",
      "ende",
      "ortText",
    ],
  },
  {
    id: "beschreibung",
    titel: T.maske.abschnitteNamen.beschreibung,
    hilfe: T.maske.schritte.hilfeBeschreibung,
    pflichtfelder: ["beschreibungHtml"],
  },
  {
    id: "zielgruppe",
    titel: T.maske.abschnitteNamen.zielgruppe,
    hilfe: T.maske.schritte.hilfeZielgruppe,
    pflichtfelder: ["schularten"],
  },
  {
    id: "digcomp",
    titel: T.maske.abschnitteNamen.digcomp,
    hilfe: T.maske.schritte.hilfeDigcomp,
    pflichtfelder: ["niveaustufe", "kompetenzen"],
  },
  {
    id: "referenten",
    titel: T.maske.abschnitteNamen.referenten,
    hilfe: T.maske.schritte.hilfeReferenten,
    pflichtfelder: ["referenten"],
  },
  {
    id: "pruefen",
    titel: T.maske.abschnitteNamen.pruefen,
    hilfe: T.maske.schritte.hilfePruefen,
    pflichtfelder: [],
  },
];

export const SCHRITT_IDS = SCHRITTE.map((s) => s.id);

/**
 * Referentinnen und Referenten tragen nur ihr Thema ein. Niveaustufe und
 * DigCompEdu ergänzt die Redaktion beim Zusammenstellen der Kataloge.
 */
export function schritteFuer(redaktion: boolean): Schritt[] {
  return redaktion ? SCHRITTE : SCHRITTE.filter((s) => s.id !== "digcomp");
}
