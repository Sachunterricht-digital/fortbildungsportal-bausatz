import { auswertungsProzent, auswertungsZahl, type AuswertungsZeile } from "@/lib/auswertung";

export function AuswertungsTabelle({ titel, zeilen, beschreibung }: { titel: string; zeilen: AuswertungsZeile[]; beschreibung?: string }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{titel}</h2>
        {beschreibung ? <p className="mt-1 text-sm text-muted-foreground">{beschreibung}</p> : null}
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card print:overflow-visible">
        <table className="auswertung-tabelle w-full text-sm">
          <caption className="sr-only">{titel}</caption>
          <thead><tr>
            <th scope="col" className="text-left">{titel === "Referenten" ? "Referent/in" : "Gruppe"}</th>
            <th scope="col">Veranstaltungen</th><th scope="col">Beendet</th><th scope="col">Meldungen</th><th scope="col">Offen</th><th scope="col">Teilnahmen</th><th scope="col">Ø je Meldung</th><th scope="col">Auslastung</th>
          </tr></thead>
          <tbody>{zeilen.map((zeile) => <tr key={zeile.id}>
            <th scope="row" className="text-left font-medium">{zeile.name}</th>
            <td>{auswertungsZahl(zeile.veranstaltungen)}</td><td>{auswertungsZahl(zeile.beendet)}</td><td>{auswertungsZahl(zeile.gemeldet)}</td>
            <td className={zeile.offen ? "font-semibold text-amber-800" : undefined}>{auswertungsZahl(zeile.offen)}</td>
            <td className="font-semibold">{auswertungsZahl(zeile.teilnahmen)}</td><td>{auswertungsZahl(zeile.durchschnitt, 1)}</td><td>{auswertungsProzent(zeile.auslastung)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}
