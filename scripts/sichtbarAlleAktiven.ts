/**
 * Setzt `oeffentlichSichtbar = true` für alle aktiven Personen.
 *
 * Seit dem 05.10.2026 erscheint jede aktive Person im Teambereich der Webseite,
 * auch mit leerem Profil. Der Haken in der Referentenverwaltung bleibt als
 * Notbremse. Das Skript holt die Altbestände nach, die noch auf „verborgen“
 * stehen (ältere Stände setzten `false`). Stillgelegte Personen bleiben
 * unberührt.
 *
 * Idempotent: Ein zweiter Lauf findet nichts mehr und meldet 0.
 *
 * Läuft wie der Seed über das Builder-Image (siehe README.md),
 * nie gegen die echte Datenbank, ohne vorher `--probe` gesehen zu haben:
 *
 *   docker build --target builder -t fortbildung-test:builder .
 *   docker run --rm --network fortbildung-test_default \
 *     -e DATABASE_URL="postgresql://..." \
 *     fortbildung-test:builder npx tsx scripts/sichtbarAlleAktiven.ts --probe
 *   ... npx tsx scripts/sichtbarAlleAktiven.ts
 */
import { prisma } from "@/lib/prisma";

async function main() {
  const probe = process.argv.includes("--probe");
  const betroffen = { aktiv: true, oeffentlichSichtbar: false };

  if (probe) {
    const personen = await prisma.referent.findMany({
      where: betroffen,
      orderBy: [{ nachname: "asc" }, { vorname: "asc" }],
      select: { vorname: true, nachname: true },
    });
    console.log(`Probelauf: ${personen.length} aktive Personen stehen auf „verborgen“.`);
    for (const p of personen) console.log(`  - ${p.vorname} ${p.nachname}`);
    console.log("Nichts geändert.");
    return;
  }

  const ergebnis = await prisma.referent.updateMany({
    where: betroffen,
    data: { oeffentlichSichtbar: true },
  });
  console.log(`${ergebnis.count} aktive Personen auf „öffentlich sichtbar“ gesetzt.`);
}

main()
  .catch((error) => {
    console.error("sichtbarAlleAktiven fehlgeschlagen:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
