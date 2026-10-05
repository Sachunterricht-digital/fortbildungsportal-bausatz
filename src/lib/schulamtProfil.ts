import { z } from "zod";
import { normalisiereSchlagwortListe, schlagwortSchluessel } from "@/lib/schlagwort";

const einzeilig = (maximum: number) => z.string().trim().min(2, "Bitte ausfüllen.").max(maximum).refine((wert) => !/[\r\n\u0000-\u001f]/.test(wert), "Bitte einzeilig eingeben.");

export const SchulamtProfilSchema = z.object({
  name: einzeilig(160),
  kurzname: einzeilig(60),
  region: einzeilig(100),
  startTitel: einzeilig(100),
  zielgruppe: einzeilig(160),
  angebotsRegion: einzeilig(160),
  pflichtSchlagworte: z.array(einzeilig(60)).max(8, "Höchstens acht Pflicht-Schlagworte.")
    .transform(normalisiereSchlagwortListe)
    .refine((werte) => werte.every((wert) => schlagwortSchluessel(wert).length >= 2), "Schlagworte brauchen mindestens zwei Zeichen."),
}).transform((profil) => ({ ...profil, startText: `Suche für das neue Fortbildungsangebot für ${profil.zielgruppe} in ${profil.angebotsRegion}.` }));

export type SchulamtProfil = z.infer<typeof SchulamtProfilSchema>;
export const SCHULAMT_PROFIL_SCHLUESSEL = "schulamtProfil";

export const NEUTRALES_SCHULAMT: SchulamtProfil = {
  name: "Staatliches Schulamt",
  kurzname: "Schulamt",
  region: "Unsere Region",
  startTitel: "Impulse, die Unterricht bewegen.",
  zielgruppe: "Lehrkräfte",
  angebotsRegion: "unserer Region",
  startText: "Suche für das neue Fortbildungsangebot für Lehrkräfte in unserer Region.",
  pflichtSchlagworte: [],
};

/** Rückwärtskompatibilität für Installationen vor Einführung der Einrichtung. */
export const BISHERIGES_SCHULAMT: SchulamtProfil = {
  name: "Staatliches Schulamt im Landkreis Unterallgäu und in der Stadt Memmingen",
  kurzname: "Schulamt Memmingen-Unterallgäu",
  region: "Memmingen · Unterallgäu",
  startTitel: "Impulse, die Unterricht bewegen.",
  zielgruppe: "Grund- und Mittelschulen",
  angebotsRegion: "Memmingen und dem Unterallgäu",
  startText: "Suche für das neue Fortbildungsangebot für Grund- und Mittelschulen in Memmingen und dem Unterallgäu.",
  pflichtSchlagworte: ["UAMM", "Medienteam-UAMM"],
};
