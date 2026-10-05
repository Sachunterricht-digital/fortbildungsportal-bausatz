import "server-only";

import { ladeSchulamt } from "@/lib/schulamt";
import { prisma } from "@/lib/prisma";
import type {
  KompetenzBereichOption,
  ReferentOption,
} from "@/components/admin/FortbildungForm/types";

/**
 * Auswahllisten für das Fortbildungs-Formular.
 * In einem Rutsch geladen, damit die Seite nicht an vier hintereinander
 * laufenden Abfragen hängt.
 */
export async function ladeFormularDaten(): Promise<{
  kompetenzBereiche: KompetenzBereichOption[];
  referenten: ReferentOption[];
  schlagwortVorschlaege: string[];
  pflichtSchlagworte: string[];
}> {
  const [bereiche, referenten, schlagworte, schulamt] = await Promise.all([
    prisma.digCompKompetenz.findMany({
      where: { parentCode: null, aktiv: true },
      orderBy: { sortOrder: "asc" },
      select: {
        code: true,
        titel: true,
        beschreibung: true,
        children: {
          where: { aktiv: true },
          orderBy: { sortOrder: "asc" },
          select: { code: true, titel: true, istPlatzhalter: true },
        },
      },
    }),

    prisma.referent.findMany({
      where: { aktiv: true },
      orderBy: [{ nachname: "asc" }, { vorname: "asc" }],
      select: { id: true, vorname: true, nachname: true, organisation: true },
    }),

    prisma.schlagwort.findMany({
      // Schlagworte, die nur an archivierten Themen hängen, sind als
      // Vorschlag keine Hilfe — sie würden im laufenden Formular etwas
      // nahelegen, das es im aktuellen Angebot gar nicht mehr gibt.
      where: {
        istPflicht: false,
        fortbildungen: { some: { fortbildung: { status: { not: "ARCHIVIERT" } } } },
      },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
    ladeSchulamt(),
  ]);

  return {
    kompetenzBereiche: bereiche,
    referenten,
    schlagwortVorschlaege: schlagworte.map((s) => s.name),
    pflichtSchlagworte: schulamt.pflichtSchlagworte,
  };
}
