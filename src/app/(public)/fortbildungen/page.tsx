import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import {
  anzahlAktiverFilter,
  baueUrl,
  beschreibeFilter,
  filterZuWhere,
  leseFilter,
  ohneFilter,
  type SuchParameter,
} from "@/lib/filter";
import { fortbildungKachelSelect, oeffentlicheFortbildungWhere } from "@/lib/queries";
import { aktuellesSchuljahr, berlinIsoDatum } from "@/lib/datetime";
import { MonatsGruppen } from "@/components/public/MonatsGruppen";
import { OeffentlicheFilterLeiste } from "@/components/public/OeffentlicheFilterLeiste";
import {
  Schnellzugriffe,
  type Schnellzugriff,
} from "@/components/public/Schnellzugriffe";
import { LeerZustand, type Ausweg } from "@/components/public/LeerZustand";
import { T } from "@/texte/de";

export const metadata: Metadata = {
  title: T.aussen.fortbildungenListe.metaTitel,
  description: T.aussen.fortbildungenListe.metaBeschreibung,
};

export default async function FortbildungsListe({
  searchParams,
}: {
  searchParams: Promise<SuchParameter>;
}) {
  const params = await searchParams;
  const filter = leseFilter(params);

  // Nur "vergangene anzeigen" schaltet zurückliegende Termine frei — sonst
  // sieht man die Liste, die einen interessiert: die kommenden.
  const zeigeVergangene = params.vergangene === "1";
  // Angebote ohne Termin (auf Abruf) gelten immer als kommend.
  const nurKuenftige = { OR: [{ ende: { gte: new Date() } }, { ende: null }] };

  const [fortbildungen, schlagworte, bereiche] = await Promise.all([
    prisma.fortbildung.findMany({
      where: {
        AND: [
          oeffentlicheFortbildungWhere(),
          filterZuWhere(filter),
          zeigeVergangene ? {} : nurKuenftige,
        ],
      },
      orderBy: { beginn: { sort: zeigeVergangene ? "desc" : "asc", nulls: "last" } },
      take: 200,
      select: { ...fortbildungKachelSelect, maxTn: true },
    }),

    prisma.schlagwort.findMany({
      // Nur Schlagworte, die an mindestens einem öffentlich sichtbaren Thema
      // hängen — archivierte und interne Entwürfe füllen die Liste sonst mit
      // Begriffen, die außen ins Leere filtern.
      where: { fortbildungen: { some: { fortbildung: oeffentlicheFortbildungWhere() } } },
      orderBy: { name: "asc" },
      select: { name: true },
    }),

    prisma.digCompKompetenz.findMany({
      where: { parentCode: null, aktiv: true },
      orderBy: { sortOrder: "asc" },
      select: { code: true, titel: true },
    }),
  ]);

  const gefiltert = anzahlAktiverFilter(filter) > 0 || zeigeVergangene;
  const aktiveFilter = beschreibeFilter(params, bereiche);

  // --- Schnellzugriffe ----------------------------------------------------
  // Die Datumsgrenzen werden hier auf dem Server gebildet: Im Browser
  // gerechnet ergäben sie beim ersten Rendern einen anderen Wert als auf dem
  // Server und React würde die Abweichung melden.
  const heute = new Date();
  const schnellzugriffe: Schnellzugriff[] = [
    {
      id: "bald",
      label: T.aussen.fortbildungenListe.schnellzugriffBald,
      werte: {
        von: berlinIsoDatum(heute),
        bis: berlinIsoDatum(new Date(heute.getTime() + 28 * 24 * 60 * 60 * 1000)),
      },
    },
    { id: "online", label: T.aussen.fortbildungenListe.schnellzugriffOnline, werte: { format: "ESESSION" } },
    { id: "gs", label: T.aussen.fortbildungenListe.schnellzugriffGrundschule, werte: { schulart: "GRUNDSCHULE" } },
    { id: "ms", label: T.aussen.fortbildungenListe.schnellzugriffMittelschule, werte: { schulart: "MITTELSCHULE" } },
    {
      id: "schuljahr",
      label: T.aussen.fortbildungenListe.schnellzugriffSchuljahr,
      werte: { schuljahr: aktuellesSchuljahr(heute) },
    },
  ];

  // --- Auswege für den Leerzustand ---------------------------------------
  // Nur wenn wirklich nichts gefunden wurde: dann eine Zählung je gesetztem
  // Filter, um zu zeigen, welcher einzelne im Weg steht.
  let auswege: Ausweg[] = [];

  if (fortbildungen.length === 0) {
    const zaehle = (suchparameter: SuchParameter, mitVergangenen: boolean) =>
      prisma.fortbildung.count({
        where: {
          AND: [
            oeffentlicheFortbildungWhere(),
            filterZuWhere(leseFilter(suchparameter)),
            mitVergangenen ? {} : nurKuenftige,
          ],
        },
      });

    // Für jeden gesetzten Filter: was brächte sein Wegfall?
    const wegfall = await Promise.all(
      aktiveFilter.map(async (chip) => {
        const rest = ohneFilter(params, chip.param);
        return {
          schluessel: chip.param,
          vorsatz: T.aussen.fortbildungenListe.auswegOhneVorsatz,
          hervorhebung: `${chip.art}: ${chip.wert}`,
          treffer: await zaehle(
            rest,
            chip.param === "vergangene" ? false : zeigeVergangene,
          ),
          href: baueUrl("/fortbildungen", rest, {}),
        };
      }),
    );

    // Und der umgekehrte Weg: den Zeitraum aufmachen. Wer nichts findet, sucht
    // oft nach etwas, das gerade erst gelaufen ist.
    const rueckblick: Ausweg[] = [];
    if (!zeigeVergangene) {
      const treffer = await zaehle(params, true);
      if (treffer > 0) {
        rueckblick.push({
          schluessel: "vergangene",
          vorsatz: "",
          hervorhebung: T.aussen.fortbildungenListe.auswegVergangeneAnzeigen,
          treffer,
          href: baueUrl("/fortbildungen", params, { vergangene: "1" }),
        });
      }
    }

    auswege = [...wegfall, ...rueckblick]
      .filter((a) => a.treffer > 0)
      .sort((a, b) => b.treffer - a.treffer);
  }

  return (
    <div className="space-y-7">
      <header className="rounded-2xl border border-border bg-secondary/45 px-5 py-7 sm:px-7">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{T.aussen.fortbildungenListe.titel}</h1>
        <p className="mt-2 text-muted-foreground">
          {fortbildungen.length === 0
            ? T.aussen.fortbildungenListe.keinTreffer
            : T.aussen.fortbildungenListe.anzahlAngebote(fortbildungen.length)}
          {gefiltert ? T.aussen.fortbildungenListe.fuerAuswahl : ""}
          {zeigeVergangene ? T.aussen.fortbildungenListe.inklVergangene : ""}
        </p>
      </header>

      <Schnellzugriffe
        params={params}
        zugriffe={schnellzugriffe}
        aktiveFilter={aktiveFilter}
      />

      <OeffentlicheFilterLeiste
        params={params}
        schlagworte={schlagworte.map((s) => s.name)}
        kompetenzbereiche={bereiche}
      />

      {fortbildungen.length === 0 ? (
        <LeerZustand
          auswege={auswege}
          alleZuruecksetzen="/fortbildungen"
          gefiltert={gefiltert}
        />
      ) : (
        <div className="pt-2">
          <MonatsGruppen fortbildungen={fortbildungen} />
        </div>
      )}
    </div>
  );
}
