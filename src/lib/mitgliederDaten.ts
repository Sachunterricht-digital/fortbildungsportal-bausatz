import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  fortbildungKachelSelect,
  oeffentlicheFortbildungWhere,
  oeffentlicherReferentSelect,
  oeffentlicheReferentWhere,
  type OeffentlicherReferent,
} from "@/lib/queries";
import {
  initialen,
  schwerpunkteListe,
  type MitgliedKarte,
} from "@/lib/mitglieder";

/**
 * Abfragen für den Teambereich. Sichtbarkeit entscheiden allein
 * `oeffentlicheReferentWhere()` und `oeffentlicheFortbildungWhere()`.
 *
 * Zwei Arten von Angeboten, überall gleich gezählt und gezeigt:
 *  - „termin“: veröffentlicht, mit Termin, noch nicht vorbei (Reg. Fortbildungen)
 *  - „abruf“:  veröffentlicht, ohne Termin (SchiLf, Micro-SchiLf, Video-Tutorials)
 * Abgesagte Angebote gehören in keine der beiden Gruppen.
 */
export type AngebotsArt = "termin" | "abruf";

export function angebotWhere(art: AngebotsArt, jetzt: Date = new Date()): Prisma.FortbildungWhereInput {
  return {
    AND: [
      oeffentlicheFortbildungWhere(),
      { status: { not: "ABGESAGT" } },
      art === "abruf" ? { beginn: null } : { beginn: { not: null }, ende: { gte: jetzt } },
    ],
  };
}

const sortierung = new Intl.Collator("de", { sensitivity: "base" });

function zuKarte(
  p: OeffentlicherReferent,
  anzahlSchilf: number,
  anzahlFortbildungen: number,
): MitgliedKarte {
  return {
    id: p.id,
    name: `${p.vorname} ${p.nachname}`,
    initialen: initialen(p.vorname, p.nachname),
    fotoVersion: p.portraetAm ? p.portraetAm.getTime() : null,
    schule: p.organisation?.trim() || null,
    funktion: p.funktion,
    schwerpunkte: schwerpunkteListe(p.schwerpunkte),
    anzahlSchilf,
    anzahlFortbildungen,
  };
}

/** Alle öffentlichen Mitglieder, nach Nachname sortiert, mit den Zahlen für die Kartenfußzeile. */
export async function ladeMitglieder(): Promise<MitgliedKarte[]> {
  const jetzt = new Date();
  const zaehle = (art: AngebotsArt) =>
    prisma.fortbildungReferent.groupBy({
      by: ["referentId"],
      where: { referent: oeffentlicheReferentWhere(), fortbildung: angebotWhere(art, jetzt) },
      _count: { _all: true },
    });

  const [personen, schilf, termine] = await Promise.all([
    prisma.referent.findMany({
      where: oeffentlicheReferentWhere(),
      select: oeffentlicherReferentSelect,
    }),
    zaehle("abruf"),
    zaehle("termin"),
  ]);

  const schilfJe = new Map(schilf.map((z) => [z.referentId, z._count._all]));
  const termineJe = new Map(termine.map((z) => [z.referentId, z._count._all]));

  return personen
    .sort(
      (a, b) =>
        sortierung.compare(a.nachname, b.nachname) || sortierung.compare(a.vorname, b.vorname),
    )
    .map((p) => zuKarte(p, schilfJe.get(p.id) ?? 0, termineJe.get(p.id) ?? 0));
}

/**
 * Eine öffentliche Person mit ihren beiden Angebotsgruppen. `null`, wenn es
 * die Person nicht gibt, sie stillgelegt oder verborgen ist.
 */
export async function ladeSteckbrief(id: string) {
  const person = await prisma.referent.findFirst({
    where: { AND: [{ id }, oeffentlicheReferentWhere()] },
    select: oeffentlicherReferentSelect,
  });
  if (!person) return null;

  const jetzt = new Date();
  const vonPerson = { referenten: { some: { referentId: person.id } } };
  const [termine, abruf] = await Promise.all([
    prisma.fortbildung.findMany({
      where: { AND: [angebotWhere("termin", jetzt), vonPerson] },
      orderBy: { beginn: "asc" },
      select: fortbildungKachelSelect,
    }),
    prisma.fortbildung.findMany({
      where: { AND: [angebotWhere("abruf", jetzt), vonPerson] },
      orderBy: { titel: "asc" },
      select: fortbildungKachelSelect,
    }),
  ]);

  return { person, karte: zuKarte(person, abruf.length, termine.length), termine, abruf };
}
