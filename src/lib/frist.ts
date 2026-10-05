import { prisma } from "@/lib/prisma";
import { aktuellesSchuljahr, schuljahrZeitraum } from "@/lib/datetime";

/** Schlüssel in SystemSetting, Wert als ISO-Zeitpunkt (Ende des Stichtags). */
export const FRIST_SCHLUESSEL = "einreichFrist";

export async function ladeFrist(): Promise<Date | null> {
  const eintrag = await prisma.systemSetting.findUnique({ where: { id: FRIST_SCHLUESSEL } });
  if (!eintrag) return null;
  const datum = new Date(eintrag.value);
  return Number.isNaN(datum.getTime()) ? null : datum;
}

/**
 * Referenten ohne eingereichtes Thema im laufenden Schuljahr. Maßgeblich ist
 * `eingereichtAm`: Archivdaten aus TaskCard und Katalog tragen dort nichts ein
 * und zählen deshalb nicht als neue Einreichung.
 */
export async function referentenOhneEinreichung() {
  const schuljahr = aktuellesSchuljahr();
  const { start } = schuljahrZeitraum(schuljahr);

  const referenten = await prisma.referent.findMany({
    where: {
      aktiv: true,
      funktion: "REFERENT",
      NOT: {
        OR: [
          { fortbildungen: { some: { fortbildung: { eingereichtAm: { gte: start } } } } },
          { user: { fortbildungen: { some: { eingereichtAm: { gte: start } } } } },
        ],
      },
    },
    orderBy: [{ nachname: "asc" }, { vorname: "asc" }],
    select: {
      id: true,
      vorname: true,
      nachname: true,
      organisation: true,
      user: { select: { lastLoginAt: true } },
    },
  });

  return { schuljahr, referenten };
}
