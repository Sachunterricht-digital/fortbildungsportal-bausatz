import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Löschkonzept (Art. 5 Abs. 1 lit. e DSGVO — Speicherbegrenzung).
 *
 * Die Anwendung speichert bewusst keine Teilnehmerdaten, deshalb ist hier
 * wenig zu tun. Was bleibt:
 *
 *   1. Vergangene Fortbildungen werden nach zwei Jahren archiviert. Sie
 *      verschwinden damit aus Frontend, Kalender und ICS-Feed, bleiben im
 *      Redaktionsbereich aber auffindbar (Nachweis der Fortbildungstätigkeit).
 *   2. Die Zuordnung von Referentinnen und Referenten zu Terminen, die länger
 *      als fünf Jahre zurückliegen, wird aufgelöst. Danach steht der Name
 *      nicht mehr an einer konkreten Veranstaltung.
 *   3. Protokolle (AuditLog) und Import-Läufe werden nach zwölf Monaten
 *      gelöscht.
 *
 * Der Zeitpunkt des letzten Laufs wird als Rechenschaftsnachweis in
 * SystemSetting festgehalten (Art. 5 Abs. 2).
 */

const ARCHIV_NACH_TAGEN = 730; // 2 Jahre
const REFERENTEN_ZUORDNUNG_NACH_TAGEN = 1825; // 5 Jahre
const PROTOKOLL_NACH_TAGEN = 365;

export interface AufraeumErgebnis {
  archiviert: number;
  referentenZuordnungenGeloescht: number;
  protokolleGeloescht: number;
  importLaeufeGeloescht: number;
  gelaufenAm: Date;
}

export async function runRetention(): Promise<AufraeumErgebnis> {
  const jetzt = new Date();
  const vorTagen = (tage: number) =>
    new Date(jetzt.getTime() - tage * 24 * 60 * 60 * 1000);

  const ergebnis = await prisma.$transaction(async (tx) => {
    const archiviert = await tx.fortbildung.updateMany({
      where: {
        ende: { lt: vorTagen(ARCHIV_NACH_TAGEN) },
        status: { in: ["VEROEFFENTLICHT", "ABGESAGT"] },
      },
      data: { status: "ARCHIVIERT" },
    });

    const referenten = await tx.fortbildungReferent.deleteMany({
      where: {
        fortbildung: { ende: { lt: vorTagen(REFERENTEN_ZUORDNUNG_NACH_TAGEN) } },
      },
    });

    const protokolle = await tx.auditLog.deleteMany({
      where: { at: { lt: vorTagen(PROTOKOLL_NACH_TAGEN) } },
    });

    const importe = await tx.fibsImportJob.deleteMany({
      where: { startedAt: { lt: vorTagen(PROTOKOLL_NACH_TAGEN) } },
    });

    return {
      archiviert: archiviert.count,
      referentenZuordnungenGeloescht: referenten.count,
      protokolleGeloescht: protokolle.count,
      importLaeufeGeloescht: importe.count,
    };
  });

  await prisma.systemSetting.upsert({
    where: { id: "lastRetentionRun" },
    update: { value: jetzt.toISOString() },
    create: { id: "lastRetentionRun", value: jetzt.toISOString() },
  });

  console.log(
    `[Löschlauf] archiviert: ${ergebnis.archiviert}, ` +
      `Referentenzuordnungen: ${ergebnis.referentenZuordnungenGeloescht}, ` +
      `Protokolle: ${ergebnis.protokolleGeloescht}, ` +
      `Import-Läufe: ${ergebnis.importLaeufeGeloescht}`,
  );

  return { ...ergebnis, gelaufenAm: jetzt };
}

export async function letzterLauf(): Promise<Date | null> {
  const eintrag = await prisma.systemSetting.findUnique({
    where: { id: "lastRetentionRun" },
  });
  return eintrag ? new Date(eintrag.value) : null;
}
