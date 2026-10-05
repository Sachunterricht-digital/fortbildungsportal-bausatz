import Link from "next/link";
import { BarChart3, FileSpreadsheet } from "lucide-react";
import { ERFASSER, requireRole } from "@/lib/auth";
import { AUSWERTUNGS_HINWEISE, auswertungsProzent, auswertungsZahl, istAuswertbar, leseAuswertungsFilter } from "@/lib/auswertung";
import { ladeAuswertung, ladeAuswertungsAuswahl } from "@/lib/auswertungDaten";
import { aktuellesSchuljahr, formatDatum, formatDatumZeit } from "@/lib/datetime";
import { baueUrl, type SuchParameter } from "@/lib/filter";
import { ORGANISATIONSFORMEN, VERANSTALTUNGSFORMATE, formatLabel, organisationsformKurz, ortAnzeige, statusLabel } from "@/constants/fortbildung";
import { AUSGEGRAUT } from "@/constants/funktionen";
import { T } from "@/texte/de";
import { Button } from "@/components/ui/button";
import { AuswertungsTabelle } from "@/components/admin/AuswertungsTabelle";
import { AuswertungDrucken } from "@/components/admin/AuswertungDrucken";

export const metadata = { title: "Auswertung" };
export const dynamic = "force-dynamic";

export default async function AuswertungsSeite({ searchParams }: { searchParams: Promise<SuchParameter> }) {
  const user = await requireRole(...ERFASSER);

  if (AUSGEGRAUT.auswertung) {
    return (
      <div className="max-w-4xl">
        <h1 className="text-3xl font-semibold tracking-tight">Auswertung</h1>
        <p className="mt-4 text-sm text-muted-foreground">{T.allgemein.kommtSpaeter}</p>
      </div>
    );
  }

  const params = await searchParams;
  let filter;
  try {
    filter = leseAuswertungsFilter(params);
  } catch (fehler) {
    return <div className="space-y-4"><h1 className="text-3xl font-semibold">Auswertung</h1><p role="alert">{(fehler as Error).message}</p><Link className="underline" href="/admin/auswertung">Filter zurücksetzen</Link></div>;
  }
  const [auswertung, auswahl] = await Promise.all([ladeAuswertung(user, filter), ladeAuswertungsAuswahl(user)]);
  const { gesamt } = auswertung;
  const aktuell = aktuellesSchuljahr();
  const jahre = new Set([aktuell, ...(filter.schuljahr ? [filter.schuljahr] : [])]);
  if (auswahl.erster?.beginn && auswahl.letzter?.beginn) {
    const von = Number(aktuellesSchuljahr(auswahl.erster.beginn).slice(0, 4));
    const bis = Number(aktuellesSchuljahr(auswahl.letzter.beginn).slice(0, 4));
    for (let jahr = von; jahr <= bis; jahr++) jahre.add(`${jahr}/${jahr + 1}`);
  }
  const exportParams: SuchParameter = { schuljahr: filter.schuljahr ?? "alle", von: filter.von, bis: filter.bis, organisationsform: filter.organisationsform, format: filter.format, referent: filter.referent };
  const referentName = auswahl.referenten.find((referent) => referent.id === filter.referent);
  const eingabeKlasse = "mt-1 block h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return <div className="auswertung space-y-8">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="etikett text-primary">Fortbildungsbilanz · {filter.schuljahr ?? "Alle Schuljahre"}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{user.role === "REFERENT" ? "Meine Auswertung" : "Auswertung"}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Veranstaltungen, Teilnahmen und Auslastung auf einen Blick. Stand: {formatDatumZeit(auswertung.jetzt)} Uhr.</p>
        {user.role === "REFERENT" ? <p className="mt-1 text-sm text-muted-foreground">Berücksichtigt werden nur Veranstaltungen mit eigenem Zugriff.</p> : null}
      </div>
      <div className="flex flex-wrap gap-2 print:hidden">
        <AuswertungDrucken />
        <Button nativeButton={false} render={<a href={baueUrl("/api/admin/export/auswertung", exportParams, {})}><FileSpreadsheet className="size-4" aria-hidden />Excel-Auswertungsbogen</a>} />
      </div>
    </div>

    <form action="/admin/auswertung" method="get" className="rounded-2xl border bg-card p-4 print:hidden" aria-label="Auswertung filtern">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <label className="text-sm font-medium">Schuljahr<select name="schuljahr" defaultValue={filter.schuljahr ?? "alle"} className={eingabeKlasse}><option value="alle">Alle Schuljahre</option>{[...jahre].sort().reverse().map((jahr) => <option key={jahr}>{jahr}</option>)}</select></label>
        <label className="text-sm font-medium">Von<input type="date" name="von" defaultValue={filter.von} className={eingabeKlasse} /></label>
        <label className="text-sm font-medium">Bis<input type="date" name="bis" defaultValue={filter.bis} className={eingabeKlasse} /></label>
        <label className="text-sm font-medium">Fortbildungsart<select name="organisationsform" defaultValue={filter.organisationsform ?? ""} className={eingabeKlasse}><option value="">Alle Arten</option>{ORGANISATIONSFORMEN.map((art) => <option key={art.value} value={art.value}>{art.label}</option>)}</select></label>
        <label className="text-sm font-medium">Format<select name="format" defaultValue={filter.format ?? ""} className={eingabeKlasse}><option value="">Alle Formate</option>{VERANSTALTUNGSFORMATE.map((format) => <option key={format.value} value={format.value}>{format.label}</option>)}</select></label>
        <label className="text-sm font-medium">Referent/in<select name="referent" defaultValue={filter.referent ?? ""} className={eingabeKlasse}><option value="">Alle zugeordneten Referenten</option>{filter.referent && !referentName ? <option value={filter.referent}>Nicht verfügbar</option> : null}{auswahl.referenten.map((referent) => <option key={referent.id} value={referent.id}>{referent.nachname}, {referent.vorname}</option>)}</select></label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3"><Button type="submit">Auswerten</Button><Link className="text-sm underline underline-offset-4" href="/admin/auswertung">Zurücksetzen</Link><p className="text-xs text-muted-foreground">Von/bis grenzt das gewählte Schuljahr zusätzlich ein.</p></div>
    </form>

    <p className="text-sm text-muted-foreground">Auswahl: {filter.schuljahr ?? "Alle Schuljahre"} · {filter.von ?? "offener Beginn"} bis {filter.bis ?? "offenes Ende"} · {filter.organisationsform ? organisationsformKurz(filter.organisationsform) : "alle Arten"} · {filter.format ? formatLabel(filter.format) : "alle Formate"} · {filter.referent ? (referentName ? `${referentName.vorname} ${referentName.nachname}` : "Referent/in nicht verfügbar") : "alle Referenten"}</p>

    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Kennzahl titel="Veranstaltungen" wert={auswertungsZahl(gesamt.veranstaltungen)} text={`${gesamt.beendet} beendet · ${gesamt.geplant} anstehend / laufend`} />
      <Kennzahl titel="Gemeldete Teilnahmen" wert={auswertungsZahl(gesamt.teilnahmen)} text={`aus ${gesamt.gemeldet} Veranstaltungen mit Meldung`} />
      <Kennzahl titel="Auslastung" wert={auswertungsProzent(gesamt.auslastung)} text={`Ø ${auswertungsZahl(gesamt.durchschnitt, 1)} Teilnahmen je gemeldeter Veranstaltung`} />
      <Kennzahl titel="Offene Teilnehmermeldungen" wert={auswertungsZahl(gesamt.offen)} text={`Meldequote: ${auswertungsProzent(gesamt.meldequote)}`} />
    </div>
    <p className="text-sm text-muted-foreground">{gesamt.vorbereitung} in Vorbereitung · {gesamt.abgesagt} abgesagt. Teilnehmerkennzahlen berücksichtigen nur beendete, veröffentlichte oder archivierte Veranstaltungen mit Meldung.</p>

    {auswertung.termine.length === 0 ? <div className="rounded-2xl border bg-card p-12 text-center"><BarChart3 className="mx-auto mb-3 size-7 text-primary" aria-hidden /><h2 className="font-semibold">Keine Veranstaltungen in dieser Auswahl</h2><p className="mt-2 text-sm text-muted-foreground">Bitte ein anderes Schuljahr wählen oder den Zeitraum erweitern.</p></div> : <>
      <nav aria-label="Auswertungsbereiche" className="flex flex-wrap gap-4 text-sm print:hidden"><a href="#referenten" className="underline underline-offset-4">Referenten</a><a href="#verteilung" className="underline underline-offset-4">Verteilungen</a><a href="#veranstaltungen" className="underline underline-offset-4">Veranstaltungen</a></nav>
      <div id="referenten" className="scroll-mt-6"><AuswertungsTabelle titel="Referenten" zeilen={auswertung.referenten} beschreibung="Referenten mit zugeordneten Veranstaltungen in der Auswahl. Bei gemeinsamen Veranstaltungen erhält jede Person die volle Teilnehmerzahl; diese Zeilen sind daher nicht addierbar." /></div>
      <div id="verteilung" className="scroll-mt-6 space-y-8">
        <AuswertungsTabelle titel="Monatsverlauf" zeilen={auswertung.monate} beschreibung="Zuordnung nach Veranstaltungsbeginn, auch bei mehrtägigen Terminen." />
        <AuswertungsTabelle titel="Fortbildungsarten" zeilen={auswertung.arten} />
        <AuswertungsTabelle titel="Veranstaltungsformate" zeilen={auswertung.formate} />
        <AuswertungsTabelle titel="DigCompEdu-Niveaustufen" zeilen={auswertung.niveaus} />
      </div>
      <section id="veranstaltungen" className="scroll-mt-6 space-y-3">
        <div><h2 className="text-lg font-semibold">Teilnehmerzahlen nach Veranstaltung</h2><p className="mt-1 text-sm text-muted-foreground">Neueste Termine zuerst. „Offen“ bedeutet: Termin beendet, Teilnehmerzahl noch nicht gemeldet.</p></div>
        <div className="overflow-x-auto rounded-xl border bg-card print:overflow-visible"><table className="auswertung-tabelle w-full text-sm">
          <caption className="sr-only">Teilnehmerzahlen nach Veranstaltung</caption>
          <thead><tr><th scope="col" className="text-left">Veranstaltung</th><th scope="col" className="text-left">Referenten</th><th scope="col">Geplante Plätze</th><th scope="col">Teilnahmen</th><th scope="col">Auslastung</th></tr></thead>
          <tbody>{auswertung.termine.map((termin) => {
            const auswertbar = istAuswertbar(termin, auswertung.jetzt);
            const tn = auswertbar ? termin.tnTatsaechlich : null;
            return <tr key={termin.id}>
              <th scope="row" className="min-w-64 text-left font-normal"><Link href={`/admin/fortbildungen/${termin.id}`} className="font-medium underline decoration-border underline-offset-4 hover:decoration-primary">{termin.titel}</Link><span className="mt-1 block text-xs text-muted-foreground">{formatDatum(termin.beginn)} · {organisationsformKurz(termin.organisationsform)} · {formatLabel(termin.format)} · {statusLabel(termin.status)}</span><span className="block text-xs text-muted-foreground">{ortAnzeige(termin.ortText, termin.veranstaltungsort) ?? T.allgemein.ortNachAbsprache}</span></th>
              <td className="text-left">{termin.referenten.map(({ referent }) => `${referent.vorname} ${referent.nachname}`).join(", ") || "Ohne Zuordnung"}</td>
              <td>{auswertungsZahl(termin.maxTn)}</td><td>{tn !== null ? auswertungsZahl(tn) : auswertbar ? <span className="font-semibold text-amber-800">Offen</span> : <span title="Noch nicht beendet oder nicht auswertbarer Status">–</span>}</td><td>{auswertungsProzent(tn !== null && termin.maxTn !== null && termin.maxTn > 0 ? tn / termin.maxTn : null)}</td>
            </tr>;
          })}</tbody>
        </table></div>
      </section>
    </>}
    <section className="rounded-xl border bg-muted/30 p-5"><h2 className="text-sm font-semibold">So werden die Zahlen berechnet</h2><ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">{AUSWERTUNGS_HINWEISE.map((hinweis) => <li key={hinweis}>{hinweis}</li>)}</ul></section>
  </div>;
}

function Kennzahl({ titel, wert, text }: { titel: string; wert: string; text: string }) {
  return <div className="rounded-2xl border bg-card p-5"><p className="text-sm text-muted-foreground">{titel}</p><p className="zahl mt-3 text-3xl font-semibold tracking-tight text-primary">{wert}</p><p className="mt-2 text-xs text-muted-foreground">{text}</p></div>;
}
