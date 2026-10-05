/**
 * Wertelisten der Terminumfrage. Die Datenbank speichert sie als String (keine
 * Prisma-Enums, siehe AGENTS.md), zod setzt sie in den Server Actions durch.
 */
import { z } from "zod";

export const UMFRAGE_STATUS = [
  { value: "OFFEN", label: "Offen" },
  { value: "GESCHLOSSEN", label: "Geschlossen" },
] as const;

export type UmfrageStatus = (typeof UMFRAGE_STATUS)[number]["value"];

export const UMFRAGE_STATUS_VALUES = UMFRAGE_STATUS.map((s) => s.value) as [
  UmfrageStatus,
  ...UmfrageStatus[],
];

export const ANTWORT_WERTE = [
  { value: "JA", label: "Ja" },
  { value: "VIELLEICHT", label: "Vielleicht" },
  { value: "NEIN", label: "Nein" },
] as const;

export type AntwortWert = (typeof ANTWORT_WERTE)[number]["value"];

export const ANTWORT_VALUES = ANTWORT_WERTE.map((a) => a.value) as [
  AntwortWert,
  ...AntwortWert[],
];

export const AntwortWertSchema = z.enum(ANTWORT_VALUES);

/** Längengrenzen, in Formular, zod und Datenbank gleich. */
export const UMFRAGE_GRENZEN = {
  titel: 150,
  beschreibung: 2000,
  ort: 150,
  uhrzeit: 80,
  kommentar: 300,
  /** Obergrenze, damit kein Formular Hunderte Spalten erzeugt. */
  termineMax: 20,
  mailBetreff: 200,
  mailText: 5000,
} as const;
