/**
 * Seed für das Fortbildungs-Tool.
 *
 * Idempotent: Der Seed arbeitet durchgehend mit `upsert` und kann jederzeit
 * erneut laufen, ohne bestehende Fortbildungen oder Zuordnungen zu zerstören.
 *
 *   npm run db:seed
 */
import { randomUUID } from "node:crypto";
import { BISHERIGES_SCHULAMT, NEUTRALES_SCHULAMT, SCHULAMT_PROFIL_SCHLUESSEL, SchulamtProfilSchema, type SchulamtProfil } from "../src/lib/schulamtProfil";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DIGCOMP_BAUM, type KompetenzSeed } from "./seed-data/digcomp";
import { ORTE_SEED } from "./seed-data/orte";
import { schlagwortSchluessel } from "../src/lib/schlagwort";

const prisma = new PrismaClient();

async function seedProfil(): Promise<{ profil: SchulamtProfil; importiereUamm: boolean }> {
  const gespeichert = await prisma.systemSetting.findUnique({ where: { id: SCHULAMT_PROFIL_SCHLUESSEL } });
  if (gespeichert) return { profil: SchulamtProfilSchema.parse(JSON.parse(gespeichert.value)), importiereUamm: false };
  const altbestand = (await prisma.user.count()) > 0 || (await prisma.veranstaltungsort.count()) > 0 || (await prisma.fortbildung.count()) > 0;
  const importiereUamm = !altbestand && process.env.SCHULAMT_STARTPROFIL === "uamm";
  const profil = altbestand || importiereUamm ? BISHERIGES_SCHULAMT : NEUTRALES_SCHULAMT;
  await prisma.$transaction([
    prisma.systemSetting.create({ data: { id: SCHULAMT_PROFIL_SCHLUESSEL, value: JSON.stringify(profil) } }),
    prisma.systemSetting.upsert({ where: { id: "einrichtungStatus" }, update: {}, create: { id: "einrichtungStatus", value: altbestand ? "fertig" : "offen" } }),
    prisma.systemSetting.upsert({ where: { id: "kalenderKennung" }, update: {}, create: { id: "kalenderKennung", value: altbestand ? "fortbildungen-uamm" : `fortbildungsportal-${randomUUID()}` } }),
  ]);
  return { profil, importiereUamm };
}

/** Weitere Schlagworte als Startbestand — im Admin frei erweiterbar. */
const START_SCHLAGWORTE = [
  "Künstliche Intelligenz",
  "iPad",
  "Medienkonzept",
  "Datenschutz",
  "mebis",
  "Office 365",
  "Informatik",
  "Digitale Prüfungskultur",
];

async function seedDigComp() {
  let angelegt = 0;

  async function upsertKnoten(knoten: KompetenzSeed, parentCode: string | null, index: number) {
    await prisma.digCompKompetenz.upsert({
      where: { code: knoten.code },
      update: {
        titel: knoten.titel,
        beschreibung: knoten.beschreibung ?? null,
        parentCode,
        sortOrder: index,
        istPlatzhalter: knoten.istPlatzhalter ?? false,
      },
      create: {
        code: knoten.code,
        titel: knoten.titel,
        beschreibung: knoten.beschreibung ?? null,
        parentCode,
        sortOrder: index,
        istPlatzhalter: knoten.istPlatzhalter ?? false,
      },
    });
    angelegt += 1;

    // Kinder erst nach dem Elternteil, sonst greift der Fremdschlüssel ins Leere.
    for (const [i, kind] of knoten.children.entries()) {
      await upsertKnoten(kind, knoten.code, i);
    }
  }

  for (const [i, bereich] of DIGCOMP_BAUM.entries()) {
    await upsertKnoten(bereich, null, i);
  }

  console.log(`  DigCompEdu: ${angelegt} Einträge`);
}

async function seedOrte(importiereUamm: boolean) {
  const orte = importiereUamm ? ORTE_SEED : ORTE_SEED.filter((ort) => ort.istOnline);
  for (const ort of orte) {
    const bestehend = await prisma.veranstaltungsort.findFirst({
      where: ort.istOnline ? { istOnline: true } : { name: ort.name, ort: ort.ort ?? null },
      select: { id: true },
    });
    // Wiederholtes Seeden überschreibt weder Importe noch manuell gepflegte Adressen.
    if (!bestehend) await prisma.veranstaltungsort.create({ data: {
      name: ort.name, ort: ort.ort ?? null, strasse: ort.strasse ?? null,
      istOnline: ort.istOnline ?? false, sortOrder: ort.sortOrder ?? 10,
    } });
  }
  console.log(`  Veranstaltungsorte: ${orte.length} Starteinträge geprüft`);
}

async function seedSchlagworte(profil: SchulamtProfil) {
  for (const name of profil.pflichtSchlagworte) {
    await prisma.schlagwort.upsert({
      where: { normalisiert: schlagwortSchluessel(name) },
      update: { istPflicht: true },
      create: {
        name,
        normalisiert: schlagwortSchluessel(name),
        istPflicht: true,
        fuerFibsImport: true,
      },
    });
  }

  for (const name of START_SCHLAGWORTE) {
    await prisma.schlagwort.upsert({
      where: { normalisiert: schlagwortSchluessel(name) },
      update: {},
      create: { name, normalisiert: schlagwortSchluessel(name) },
    });
  }

  console.log(
    `  Schlagworte: ${profil.pflichtSchlagworte.length} Pflicht + ${START_SCHLAGWORTE.length} weitere`,
  );
}

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const passwort = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !passwort) {
    console.log(
      "  Admin: übersprungen (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD nicht gesetzt)",
    );
    return;
  }

  const passwordHash = await bcrypt.hash(passwort, 12);

  // Ein bestehendes Passwort wird NICHT überschrieben — sonst würde jeder
  // Seed-Lauf ein in der App geändertes Passwort zurücksetzen.
  await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN", isActive: true },
    create: {
      email,
      passwordHash,
      name: process.env.SEED_ADMIN_NAME ?? "Administration",
      role: "ADMIN",
    },
  });

  console.log(`  Admin: ${email}`);
}

async function seedTexte(profil: SchulamtProfil) {
  const texte: Array<{ id: string; value: string }> = [
    {
      id: "impressum",
      value: [
        "## Impressum",
        "",
        `**${profil.name}**`,
        "",
        "_Platzhalter — bitte im Admin-Bereich durch die amtlichen Angaben ersetzen_",
        "",
        "Anschrift, Telefon, E-Mail, Vertretungsberechtigte, Aufsichtsbehörde,",
        "Umsatzsteuer-Identifikationsnummer (falls einschlägig),",
        "Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV.",
      ].join("\n"),
    },
    {
      id: "datenschutz",
      value: [
        "## Datenschutzerklärung",
        "",
        "_Platzhalter — bitte im Admin-Bereich durch die geprüfte Fassung ersetzen._",
        "",
        "### Was diese Anwendung verarbeitet",
        "",
        "- **Keine Teilnehmerdaten.** Die Anmeldung zu Fortbildungen läuft",
        "  ausschließlich über FIBS. Diese Anwendung speichert keine",
        "  personenbezogenen Daten von Lehrkräften, die Fortbildungen besuchen.",
        "- **Referentinnen und Referenten**: Name und Organisation werden",
        "  veröffentlicht, sofern dies im Einzelfall so hinterlegt ist.",
        "  Kontaktdaten werden ausschließlich intern verarbeitet.",
        "- **Redaktionszugänge**: E-Mail-Adresse, Name, Passwort-Hash sowie",
        "  Protokolle über Änderungen (Rechenschaftspflicht, Art. 5 Abs. 2 DSGVO).",
        "",
        "### Cookies",
        "",
        "Es wird ausschließlich ein technisch notwendiges Sitzungs-Cookie für den",
        "Redaktionsbereich gesetzt. Der öffentliche Bereich setzt keine Cookies,",
        "bindet keine externen Dienste ein und überträgt keine Daten an Dritte.",
        "",
        "### Speicherdauer",
        "",
        "Vergangene Fortbildungen werden nach zwei Jahren archiviert, Protokolle",
        "nach zwölf Monaten gelöscht.",
      ].join("\n"),
    },
  ];

  for (const text of texte) {
    await prisma.systemSetting.upsert({
      where: { id: text.id },
      update: {}, // redaktionell gepflegte Texte nie überschreiben
      create: text,
    });
  }

  console.log(`  Systemtexte: ${texte.length} Einträge (nur falls noch leer)`);
}

async function main() {
  console.log("Seed läuft …");
  const { profil, importiereUamm } = await seedProfil();
  await seedDigComp();
  await seedOrte(importiereUamm);
  await seedSchlagworte(profil);
  await seedTexte(profil);
  await seedAdmin();
  console.log("Seed fertig.");
}

main()
  .catch((error) => {
    console.error("Seed fehlgeschlagen:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
