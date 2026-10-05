import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { prisma } from "@/lib/prisma";
import { bildeSlug } from "@/lib/queries";
import { ladeSchulamt } from "@/lib/schulamt";
import { schlagwortSchluessel } from "@/lib/schlagwort";

import { basisUrl, holeSuchergebnis, importAktiv } from "./client";
import { mapFibsLehrgang, type GemappteFortbildung } from "./mapper";
import { parseSuchergebnis } from "./parser";
import type {
  FibsImportErgebnis,
  FibsImportOptionen,
  FibsRohLehrgang,
  FibsVorschauZeile,
} from "./types";

const MAX_TREFFER = 100;

/**
 * Führt einen FIBS-Import durch.
 *
 * Voreinstellung ist ein Trockenlauf: Es wird gesucht, gelesen und gemappt,
 * aber nichts geschrieben. Erst ein ausdrückliches `dryRun: false` legt
 * Datensätze an.
 *
 * Grundregeln:
 *   - Die Suchbegriffe kommen aus den Schlagworten mit `fuerFibsImport`.
 *   - Deduplizierung über `externalId` ("fibs:<Lehrgangsnummer>").
 *   - Ein bestehender Datensatz mit `quelle = MANUELL` wird NIE überschrieben.
 *     Was die Redaktion von Hand gepflegt hat, gewinnt immer.
 *   - Importierte Einträge landen als ENTWURF, nicht direkt im Frontend.
 */
export async function runFibsImport(
  optionen: FibsImportOptionen = {},
): Promise<FibsImportErgebnis> {
  const dryRun = optionen.dryRun ?? true;
  const maxTreffer = Math.min(optionen.maxTreffer ?? MAX_TREFFER, MAX_TREFFER);

  const suchbegriffe =
    optionen.suchbegriffe ??
    (
      await prisma.schlagwort.findMany({
        where: { fuerFibsImport: true },
        orderBy: { name: "asc" },
        select: { name: true },
      })
    ).map((s) => s.name);

  const job = await prisma.fibsImportJob.create({
    data: { dryRun, suchbegriffe },
    select: { id: true },
  });

  try {
    if (suchbegriffe.length === 0) {
      throw new Error(
        "Es ist kein Schlagwort für die FIBS-Suche markiert. Unter Schlagworte mindestens eines auswählen.",
      );
    }

    const roh = await sammleLehrgaenge(suchbegriffe, maxTreffer);
    const zeilen: FibsVorschauZeile[] = [];
    let neu = 0;
    let aktualisiert = 0;
    let uebersprungen = 0;

    for (const eintrag of roh) {
      const gemappt = mapFibsLehrgang(eintrag, basisUrl());

      if (!gemappt.ok) {
        uebersprungen += 1;
        zeilen.push({
          lehrgangsnummer: eintrag.lehrgangsnummer,
          titel: eintrag.titel,
          beginn: eintrag.beginn ?? null,
          ende: eintrag.ende ?? null,
          ort: eintrag.ort ?? null,
          aktion: "uebersprungen",
          hinweis: gemappt.grund,
        });
        continue;
      }

      // Abgleich über die externalId UND die Lehrgangsnummer: Hat die
      // Redaktion einen Lehrgang von Hand erfasst und dabei die FIBS-Nummer
      // eingetragen, ist das derselbe Termin — ohne diese zweite Bedingung
      // stünde er nach dem Import doppelt im System.
      const bestehend = await prisma.fortbildung.findFirst({
        where: {
          OR: [
            { externalId: gemappt.daten.externalId },
            { fibsLehrgangsnummer: gemappt.daten.fibsLehrgangsnummer },
          ],
        },
        select: { id: true, quelle: true },
      });

      if (bestehend && bestehend.quelle === "MANUELL") {
        uebersprungen += 1;
        zeilen.push(
          vorschau(
            gemappt.daten,
            "uebersprungen",
            "Von Hand gepflegt — bleibt unverändert",
          ),
        );
        continue;
      }

      if (!dryRun) {
        await schreibe(gemappt.daten, bestehend?.id ?? null);
      }

      if (bestehend) {
        aktualisiert += 1;
        zeilen.push(vorschau(gemappt.daten, "aktualisiert"));
      } else {
        neu += 1;
        zeilen.push(vorschau(gemappt.daten, "neu"));
      }
    }

    await prisma.fibsImportJob.update({
      where: { id: job.id },
      data: {
        finishedAt: new Date(),
        status: "ERFOLG",
        gefunden: roh.length,
        neu,
        aktualisiert,
        uebersprungen,
        rohdaten: dryRun ? JSON.parse(JSON.stringify(zeilen)) : undefined,
      },
    });

    return {
      jobId: job.id,
      dryRun,
      suchbegriffe,
      gefunden: roh.length,
      neu,
      aktualisiert,
      uebersprungen,
      zeilen,
    };
  } catch (error) {
    const meldung = error instanceof Error ? error.message : "Unbekannter Fehler";

    await prisma.fibsImportJob.update({
      where: { id: job.id },
      data: { finishedAt: new Date(), status: "FEHLER", fehlermeldung: meldung },
    });

    return {
      jobId: job.id,
      dryRun,
      suchbegriffe,
      gefunden: 0,
      neu: 0,
      aktualisiert: 0,
      uebersprungen: 0,
      zeilen: [],
      fehler: meldung,
    };
  }
}

/**
 * Sucht zu jedem Begriff und führt die Treffer zusammen.
 *
 * Solange der Import abgeschaltet ist, wird die mitgelieferte Beispieldatei
 * gelesen. Dadurch lässt sich die gesamte Kette — Parser, Mapping, Abgleich,
 * Vorschau — durchspielen, ohne FIBS anzufassen.
 */
async function sammleLehrgaenge(
  begriffe: string[],
  maxTreffer: number,
): Promise<FibsRohLehrgang[]> {
  const gesehen = new Set<string>();
  const treffer: FibsRohLehrgang[] = [];

  for (const begriff of begriffe) {
    const html = importAktiv()
      ? await holeSuchergebnis(begriff)
      : await beispielSeite();

    for (const lehrgang of parseSuchergebnis(html)) {
      if (gesehen.has(lehrgang.lehrgangsnummer)) continue;
      gesehen.add(lehrgang.lehrgangsnummer);
      treffer.push(lehrgang);
      if (treffer.length >= maxTreffer) return treffer;
    }

    // Ohne echten Abruf bringt jeder weitere Begriff dasselbe Ergebnis.
    if (!importAktiv()) break;
  }

  return treffer;
}

async function beispielSeite(): Promise<string> {
  const datei = path.join(process.cwd(), "src/lib/fibs/fixtures/suchergebnis.html");
  return readFile(datei, "utf8");
}

/** Legt an oder aktualisiert — ohne die redaktionellen Felder anzutasten. */
async function schreibe(daten: GemappteFortbildung, id: string | null): Promise<void> {
  const ortId = await findeOrt(daten);

  const basis = {
    titel: daten.titel,
    beschreibungHtml: daten.beschreibungHtml,
    beschreibungText: daten.beschreibungText,
    beginn: daten.beginn,
    ende: daten.ende,
    format: daten.format,
    maxTn: daten.maxTn,
    schularten: daten.schularten,
    veranstaltungsortId: ortId,
    fibsLehrgangsnummer: daten.fibsLehrgangsnummer,
    fibsUrl: daten.fibsUrl,
    quelle: "FIBS_IMPORT",
    externalId: daten.externalId,
  };

  if (id) {
    await prisma.fortbildung.update({ where: { id }, data: basis });
    return;
  }

  const angelegt = await prisma.fortbildung.create({
    data: {
      ...basis,
      // FIBS liefert die Organisationsform nicht mit; regional ist der
      // Regelfall und die Redaktion korrigiert es im Entwurf.
      organisationsform: "REGIONAL",
      status: "ENTWURF",
      slug: `fibs-${crypto.randomUUID()}`,
      schlagworte: {
        create: (await pflichtSchlagwortIds()).map((schlagwortId) => ({ schlagwortId })),
      },
    },
    select: { id: true },
  });

  await prisma.fortbildung.update({
    where: { id: angelegt.id },
    data: { slug: bildeSlug(daten.titel, daten.beginn, angelegt.id) },
  });
}

/** Ordnet den FIBS-Ortsnamen einem gepflegten Veranstaltungsort zu. */
async function findeOrt(daten: GemappteFortbildung): Promise<string> {
  if (daten.ortIstOnline) {
    const online = await prisma.veranstaltungsort.findFirst({
      where: { istOnline: true },
      select: { id: true },
    });
    if (online) return online.id;
  }

  if (daten.ortName) {
    const treffer = await prisma.veranstaltungsort.findFirst({
      where: { name: { equals: daten.ortName, mode: "insensitive" } },
      select: { id: true },
    });
    if (treffer) return treffer.id;

    // Unbekannter Ort: anlegen statt den Import scheitern zu lassen. Die
    // Redaktion sieht ihn dann in der Ortsverwaltung und kann ihn zusammen-
    // führen oder stilllegen.
    const angelegt = await prisma.veranstaltungsort.create({
      data: { name: daten.ortName, sortOrder: 90 },
      select: { id: true },
    });
    return angelegt.id;
  }

  const ersatz = await prisma.veranstaltungsort.findFirst({
    where: { istOnline: true },
    select: { id: true },
  });
  if (ersatz) return ersatz.id;

  throw new Error(
    "Es ist kein Online-Veranstaltungsort angelegt. Bitte den Seed ausführen.",
  );
}

async function pflichtSchlagwortIds(): Promise<string[]> {
  const { pflichtSchlagworte } = await ladeSchulamt();
  const treffer = await prisma.schlagwort.findMany({
    where: { normalisiert: { in: pflichtSchlagworte.map(schlagwortSchluessel) } },
    select: { id: true },
  });
  return treffer.map((t) => t.id);
}

function vorschau(
  daten: GemappteFortbildung,
  aktion: FibsVorschauZeile["aktion"],
  hinweis?: string,
): FibsVorschauZeile {
  return {
    lehrgangsnummer: daten.fibsLehrgangsnummer,
    titel: daten.titel,
    beginn: daten.beginn.toISOString(),
    ende: daten.ende.toISOString(),
    ort: daten.ortIstOnline ? "ViKo (online)" : daten.ortName,
    aktion,
    hinweis,
  };
}
