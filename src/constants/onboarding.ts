/**
 * Wertelisten und Prüfung des Onboardings unter der Terminumfrage. Die
 * Datenbank speichert sie als String (keine Prisma-Enums, siehe AGENTS.md),
 * zod setzt sie in der Server Action durch.
 */
import { z } from "zod";

import { TELEFON_MAX, telefonFeld } from "@/lib/validation/profil";
import { T } from "@/texte/de";

export const KONTAKTWEGE = [
  { value: "MAIL", label: "Mail" },
  { value: "TELEFON", label: "Telefon" },
  { value: "MESSENGER", label: "Messenger-Gruppe" },
] as const;

export type Kontaktweg = (typeof KONTAKTWEGE)[number]["value"];

export const KONTAKTWEG_VALUES = KONTAKTWEGE.map((k) => k.value) as [Kontaktweg, ...Kontaktweg[]];

/** Montag bis Freitag. `kurz` für die kompakte Anzeige in der Administration. */
export const TAGE = [
  { value: "MO", label: "Montag", kurz: "Mo" },
  { value: "DI", label: "Dienstag", kurz: "Di" },
  { value: "MI", label: "Mittwoch", kurz: "Mi" },
  { value: "DO", label: "Donnerstag", kurz: "Do" },
  { value: "FR", label: "Freitag", kurz: "Fr" },
] as const;

export const TAGESZEITEN = [
  { value: "VORMITTAGS", label: "vormittags", kurz: "vm" },
  { value: "NACHMITTAGS", label: "nachmittags", kurz: "nm" },
] as const;

/** Alle zehn Kombinationen, z. B. `MO_VORMITTAGS`, in Reihenfolge der Tabelle. */
export const ZEITEN = TAGE.flatMap((tag) =>
  TAGESZEITEN.map((zeit) => ({
    value: `${tag.value}_${zeit.value}`,
    label: `${tag.label} ${zeit.label}`,
    kurz: `${tag.kurz} ${zeit.kurz}`,
  })),
);

export type Zeit = (typeof ZEITEN)[number]["value"];

export function zeitValue(tag: string, tageszeit: string): string {
  return `${tag}_${tageszeit}`;
}

export const ONBOARDING_GRENZEN = {
  telefon: TELEFON_MAX,
  bemerkung: 300,
} as const;

/** Reihenfolge der Wertelisten, doppelte Einträge entfallen. */
function sortiert<V extends string>(werte: readonly V[], reihenfolge: readonly string[]): V[] {
  const einmalig = [...new Set(werte)];
  return einmalig.sort((a, b) => reihenfolge.indexOf(a) - reihenfolge.indexOf(b));
}

const TX = T.onboarding;


/**
 * Eingabe aus dem Formular. Werte außerhalb der Wertelisten sind ein Fehler,
 * kein stilles Weglassen. Ist „weitere Formate“ aus, verwirft das Schema Zeiten
 * und Bemerkung (sie werden dann nicht gespeichert). `telefon` gehört nicht in
 * die Onboarding-Tabelle, die Aktion schreibt es nach `Referent.telefon`.
 */
export const OnboardingSchema = z
  .object({
    kontaktwege: z.array(z.enum(KONTAKTWEG_VALUES)).max(KONTAKTWEGE.length),
    // Die Handynummer ist `Referent.telefon`, Prüfung wie im Profil.
    telefon: telefonFeld(TX.fehler.handynummer),
    weitereFormate: z.boolean(),
    zeiten: z.array(z.enum(ZEITEN.map((z) => z.value) as [string, ...string[]])).max(ZEITEN.length),
    bemerkung: z
      .string()
      .trim()
      .max(ONBOARDING_GRENZEN.bemerkung, { error: TX.fehler.bemerkungZuLang }),
  })
  .transform((eingabe) => ({
    kontaktwege: sortiert(eingabe.kontaktwege, KONTAKTWEG_VALUES),
    telefon: eingabe.telefon,
    weitereFormate: eingabe.weitereFormate,
    zeiten: eingabe.weitereFormate
      ? sortiert(eingabe.zeiten, ZEITEN.map((z) => z.value))
      : [],
    bemerkung: eingabe.weitereFormate ? eingabe.bemerkung || null : null,
  }));

export type OnboardingEingabe = z.output<typeof OnboardingSchema>;

/** „Mo vm, Di nm“ für die Administration. Unbekannte Werte werden übersprungen. */
export function zeitenKompakt(zeiten: readonly string[]): string {
  return ZEITEN.filter((z) => zeiten.includes(z.value))
    .map((z) => z.kurz)
    .join(", ");
}

export function kontaktwegLabel(wert: string): string {
  return KONTAKTWEGE.find((k) => k.value === wert)?.label ?? wert;
}
