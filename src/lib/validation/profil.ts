import { z } from "zod";

import { FUNKTION_VALUES } from "@/constants/fortbildung";
import { T } from "@/texte/de";

/**
 * Die eine Telefonnummer einer Person (`Referent.telefon`). Profil,
 * Referentenverwaltung und Onboarding prüfen sie gleich: Freitext bis 40
 * Zeichen, leer wird null. Bewusst ohne Zeichenprüfung, damit schon
 * gespeicherte Nummern in keinem der drei Wege plötzlich ungültig sind.
 */
export const TELEFON_MAX = 40;
export function telefonFeld(zuLang?: string) {
  return z.string().trim().max(TELEFON_MAX, zuLang).optional().transform((w) => w || null);
}

/** Pflicht sind nur Name, Stammschule und Funktion. */
export const ProfilSchema = z.object({
  vorname: z.string().trim().min(1, T.profil.vornameFehlt).max(80),
  nachname: z.string().trim().min(1, T.profil.nachnameFehlt).max(80),
  organisation: z.string().trim().min(2, T.profil.stammschuleFehlt).max(120),
  funktion: z.enum(FUNKTION_VALUES, { message: T.profil.funktionFehlt }),
  telefon: telefonFeld(T.profil.telefonZuLang),
  schwerpunkte: z
    .string()
    .trim()
    .max(200, T.profil.schwerpunkteZuLang)
    .optional()
    .transform((w) => w || null),
  kurzprofil: z
    .string()
    .trim()
    .max(1000, T.profil.kurzprofilZuLang)
    .optional()
    .transform((w) => w || null),
});

/** Erlaubte Bildtypen für den Foto-Upload. */
export const ERLAUBTE_FOTO_TYPEN = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

/** Höchstgröße der hochgeladenen Datei, bevor sie zugeschnitten wird. */
export const MAX_FOTO_BYTES = 5 * 1024 * 1024;

/** Ein Profil gilt als vollständig, sobald die Pflichtangaben stehen. */
export function profilVollstaendig(
  referent: { vorname: string; nachname: string; organisation: string | null } | null,
): boolean {
  return Boolean(referent?.vorname && referent.nachname && referent.organisation?.trim());
}

/** HEIC/HEIF (iPhone-Format) wird nicht verarbeitet, aber gesondert gemeldet. */
export const HEIC_FOTO_TYPEN = ["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"] as const;
export const HEIC_FOTO_ENDUNGEN = ["heic", "heif"] as const;
