import type { Prisma } from "@prisma/client";
import { aktuellesSchuljahr, berlinIsoDatum, formatMonatJahr, fromDatetimeLocalValue, schuljahrZeitraum } from "@/lib/datetime";
import { filterZuWhere, leseFilter, type FortbildungFilter, type SuchParameter } from "@/lib/filter";
import { formatLabel, niveaustufeLabel, organisationsformLabel } from "@/constants/fortbildung";

export interface AuswertungsFilter extends FortbildungFilter {
  referent?: string;
}

/** Nur die im Auswertungsformular angebotenen Filter übernehmen. */
export function leseAuswertungsFilter(params: SuchParameter, jetzt = new Date()): AuswertungsFilter {
  const wert = (name: string) => {
    const roh = params[name];
    return (Array.isArray(roh) ? roh[0] : roh)?.trim() || undefined;
  };
  const schuljahr = wert("schuljahr") ?? aktuellesSchuljahr(jetzt);
  if (schuljahr !== "alle" && (!/^[1-9]\d{3}\/[1-9]\d{3}$/.test(schuljahr) || Number(schuljahr.slice(5)) !== Number(schuljahr.slice(0, 4)) + 1)) {
    throw new Error("Bitte ein gültiges Schuljahr auswählen.");
  }
  for (const name of ["von", "bis"]) {
    const datum = wert(name);
    const geprueft = datum && /^[1-9]\d{3}-\d{2}-\d{2}$/.test(datum) ? fromDatetimeLocalValue(`${datum}T00:00`) : null;
    if (datum && (!geprueft || berlinIsoDatum(geprueft) !== datum)) {
      throw new Error("Bitte ein gültiges Datum eingeben.");
    }
  }
  if (wert("von") && wert("bis") && wert("von")! > wert("bis")!) {
    throw new Error("Das Enddatum muss am oder nach dem Anfangsdatum liegen.");
  }
  return {
    ...leseFilter({ schuljahr: schuljahr === "alle" ? undefined : schuljahr, von: wert("von"), bis: wert("bis"), organisationsform: wert("organisationsform"), format: wert("format") }),
    referent: wert("referent"),
  };
}

export const auswertungsAuswahl = {
  id: true, titel: true, beginn: true, ende: true, status: true,
  organisationsform: true, format: true, niveaustufe: true,
  maxTn: true, tnTatsaechlich: true,
  ortText: true,
  veranstaltungsort: { select: { name: true } },
  referenten: { select: { referent: { select: { id: true, vorname: true, nachname: true } } } },
} satisfies Prisma.FortbildungSelect;

/** Tagesgrenzen schließen auch die Sekunden der letzten Minute ein. */
export function auswertungsFilterZuWhere(filter: AuswertungsFilter): Prisma.FortbildungWhereInput {
  const { von, bis, schuljahr, referent, ...merkmale } = filter;
  const und: Prisma.FortbildungWhereInput[] = [filterZuWhere(merkmale)];
  if (von) und.push({ ende: { gte: fromDatetimeLocalValue(`${von}T00:00`)! } });
  if (bis) und.push({ beginn: { lte: new Date(fromDatetimeLocalValue(`${bis}T23:59`)!.getTime() + 59_999) } });
  if (schuljahr) {
    const { start, ende } = schuljahrZeitraum(schuljahr);
    und.push({ beginn: { gte: start, lte: new Date(ende.getTime() + 59_999) } });
  }
  if (referent) und.push({ referenten: { some: { referentId: referent } } });
  return { AND: und };
}

export type AuswertungsTermin = Prisma.FortbildungGetPayload<{ select: typeof auswertungsAuswahl }>;

export function istAuswertbar(termin: Pick<AuswertungsTermin, "status" | "ende">, jetzt: Date): boolean {
  // Ohne Termin (SchiLf auf Abruf, Video-Tutorial) gibt es nichts auszuwerten.
  return (
    termin.ende !== null &&
    ["VEROEFFENTLICHT", "ARCHIVIERT"].includes(termin.status) &&
    termin.ende < jetzt
  );
}

export function berechneKennzahlen(termine: AuswertungsTermin[], jetzt: Date) {
  const beendet = termine.filter((termin) => istAuswertbar(termin, jetzt));
  const gemeldet = beendet.filter((termin) => termin.tnTatsaechlich !== null);
  const teilnahmen = gemeldet.reduce((summe, termin) => summe + termin.tnTatsaechlich!, 0);
  // Ohne Termin gibt es keine geplanten Plätze zu zählen (SchiLf auf Abruf).
  const plaetzeGemeldet = gemeldet.reduce((summe, termin) => summe + (termin.maxTn ?? 0), 0);
  return {
    veranstaltungen: termine.length,
    beendet: beendet.length,
    gemeldet: gemeldet.length,
    offen: beendet.length - gemeldet.length,
    abgesagt: termine.filter((termin) => termin.status === "ABGESAGT").length,
    geplant: termine.filter(
      (termin) =>
        ["VEROEFFENTLICHT", "ARCHIVIERT"].includes(termin.status) &&
        termin.ende !== null &&
        termin.ende >= jetzt,
    ).length,
    vorbereitung: termine.filter((termin) => ["ENTWURF", "EINGEREICHT"].includes(termin.status)).length,
    // Ohne Meldung ist auch die Summe unbekannt; eine gemeldete 0 bleibt 0.
    teilnahmen: gemeldet.length ? teilnahmen : null,
    durchschnitt: gemeldet.length ? teilnahmen / gemeldet.length : null,
    auslastung: plaetzeGemeldet > 0 ? teilnahmen / plaetzeGemeldet : null,
    meldequote: beendet.length ? gemeldet.length / beendet.length : null,
  };
}

export type AuswertungsKennzahlen = ReturnType<typeof berechneKennzahlen>;
export type AuswertungsZeile = AuswertungsKennzahlen & { id: string; name: string };

export function erstelleAuswertung(termine: AuswertungsTermin[], jetzt = new Date()) {
  function gruppiere(schluessel: (termin: AuswertungsTermin) => Array<{ id: string; name: string }>): AuswertungsZeile[] {
    const gruppen = new Map<string, { name: string; termine: AuswertungsTermin[] }>();
    for (const termin of termine) {
      for (const { id, name } of schluessel(termin)) {
        const gruppe = gruppen.get(id) ?? { name, termine: [] };
        gruppe.termine.push(termin);
        gruppen.set(id, gruppe);
      }
    }
    return [...gruppen].map(([id, gruppe]) => ({ id, name: gruppe.name, ...berechneKennzahlen(gruppe.termine, jetzt) }));
  }
  return {
    jetzt,
    termine,
    gesamt: berechneKennzahlen(termine, jetzt),
    referenten: gruppiere((termin) => termin.referenten.length
      ? termin.referenten.map(({ referent }) => ({ id: referent.id, name: `${referent.vorname} ${referent.nachname}` }))
      : [{ id: "ohne-referent", name: "Ohne Referentenzuordnung" }])
      .sort((a, b) => b.veranstaltungen - a.veranstaltungen || a.name.localeCompare(b.name, "de")),
    // Ohne Termin gibt es keinen Monat, dem sich die Veranstaltung zuordnen
    // ließe — solche Einträge bleiben im Monatsverlauf schlicht unberücksichtigt.
    monate: gruppiere((termin) =>
      termin.beginn
        ? [{ id: berlinIsoDatum(termin.beginn).slice(0, 7), name: formatMonatJahr(termin.beginn) }]
        : [],
    ).sort((a, b) => a.id.localeCompare(b.id)),
    arten: gruppiere((termin) => [{ id: termin.organisationsform, name: organisationsformLabel(termin.organisationsform) }]),
    formate: gruppiere((termin) => [{ id: termin.format, name: formatLabel(termin.format) }]),
    niveaus: gruppiere((termin) => [{ id: termin.niveaustufe ?? "ohne", name: termin.niveaustufe ? niveaustufeLabel(termin.niveaustufe) : "Ohne Niveaustufe" }]),
  };
}

export const AUSWERTUNGS_HINWEISE = [
  "Teilnahmen sind gemeldete Teilnehmerzahlen beendeter, veröffentlichter oder archivierter Veranstaltungen. Es handelt sich nicht um die Anzahl unterschiedlicher Personen.",
  "Fehlende Meldungen bleiben unbekannt (–); eine gemeldete 0 zählt als vollständige Meldung. Entwürfe, eingereichte, abgesagte und noch nicht beendete Termine fließen nicht in Teilnehmerkennzahlen ein.",
  "Auslastung = Teilnahmen / geplante Plätze der Veranstaltungen mit Meldung. Der Durchschnitt bezieht sich ebenfalls nur auf Veranstaltungen mit Meldung. Eine Auslastung über 100 % ist möglich.",
  "Bei mehreren Referenten wird die Veranstaltung mit ihrer vollen Teilnehmerzahl jedem zugeordnet. Referentenzeilen dürfen daher nicht zu einer Gesamtsumme addiert werden; die Gesamtübersicht zählt jeden Termin einmal.",
  "Das Schuljahr und die Monatszuordnung richten sich nach dem Beginn. Von/bis erfasst auch mehrtägige Veranstaltungen, die den Zeitraum überschneiden. Alle Datumsangaben gelten für Europe/Berlin.",
];

export function auswertungsZahl(wert: number | null, nachkommastellen = 0): string {
  return wert === null ? "–" : wert.toLocaleString("de-DE", { maximumFractionDigits: nachkommastellen });
}

export function auswertungsProzent(wert: number | null): string {
  return wert === null ? "–" : `${auswertungsZahl(wert * 100, 1)} %`;
}
