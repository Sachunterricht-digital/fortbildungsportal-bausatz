import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { AUSGEGRAUT } from "@/constants/funktionen";
import { BISHERIGES_SCHULAMT, SCHULAMT_PROFIL_SCHLUESSEL, SchulamtProfilSchema } from "@/lib/schulamtProfil";

/** React dedupliziert nur innerhalb eines Renderdurchlaufs, nicht dauerhaft. */
export const ladeSchulamt = cache(async () => {
  const eintrag = await prisma.systemSetting.findUnique({ where: { id: SCHULAMT_PROFIL_SCHLUESSEL } });
  // Ohne gespeichertes Profil nie den Absender eines fremden Schulamts zeigen.
  if (!eintrag)
    return {
      ...BISHERIGES_SCHULAMT,
      name: "Digi-Team Aichach-Friedberg · Beratung digitale Bildung",
      kurzname: "Digi-Team Aichach-Friedberg",
      region: "Landkreis Aichach-Friedberg",
    };
  return SchulamtProfilSchema.parse(JSON.parse(eintrag.value));
});

export const istEinrichtungOffen = cache(async () => {
  if (AUSGEGRAUT.einrichtung) return false;
  const eintrag = await prisma.systemSetting.findUnique({ where: { id: "einrichtungStatus" } });
  return eintrag?.value === "offen";
});

/** Vorhandene Kalender-UIDs bleiben beim Wechsel der Schulamtsbezeichnung stabil. */
export async function ladeKalenderKennung(): Promise<string> {
  const eintrag = await prisma.systemSetting.findUnique({ where: { id: "kalenderKennung" } });
  return eintrag?.value ?? "fortbildungen-uamm";
}
