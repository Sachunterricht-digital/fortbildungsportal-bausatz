import "server-only";

import { fortbildungScope, type SessionUser } from "@/lib/auth";
import { auswertungsAuswahl, auswertungsFilterZuWhere, erstelleAuswertung, type AuswertungsFilter } from "@/lib/auswertung";
import { prisma } from "@/lib/prisma";

export async function ladeAuswertung(user: SessionUser, filter: AuswertungsFilter) {
  const termine = await prisma.fortbildung.findMany({
    where: { AND: [fortbildungScope(user), auswertungsFilterZuWhere(filter)] },
    select: auswertungsAuswahl,
    orderBy: [{ beginn: "desc" }, { titel: "asc" }, { id: "asc" }],
    // Keine Begrenzung: Auch der Export muss alle gefilterten Termine zählen.
  });
  return erstelleAuswertung(termine);
}

export async function ladeAuswertungsAuswahl(user: SessionUser) {
  const scope = fortbildungScope(user);
  const [erster, letzter, referenten] = await Promise.all([
    prisma.fortbildung.findFirst({ where: { AND: [scope, { beginn: { not: null } }] }, orderBy: { beginn: "asc" }, select: { beginn: true } }),
    prisma.fortbildung.findFirst({ where: { AND: [scope, { beginn: { not: null } }] }, orderBy: { beginn: "desc" }, select: { beginn: true } }),
    prisma.referent.findMany({
      where: { fortbildungen: { some: { fortbildung: scope } } },
      select: { id: true, vorname: true, nachname: true },
      orderBy: [{ nachname: "asc" }, { vorname: "asc" }],
    }),
  ]);
  return { erster, letzter, referenten };
}
