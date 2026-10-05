"use client";

import { useActionState, useState } from "react";
import { speichereEinrichtung } from "@/actions/einrichtung";
import type { SchulamtProfil } from "@/lib/schulamtProfil";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function EinrichtungsFormular({ profil, assistent = false }: { profil: SchulamtProfil; assistent?: boolean }) {
  const [stand, aktion, laeuft] = useActionState(speichereEinrichtung, {});
  const [zielgruppe, setZielgruppe] = useState(profil.zielgruppe);
  const [angebotsRegion, setAngebotsRegion] = useState(profil.angebotsRegion);
  const felder = [
    { name: "name", label: "Amtliche Bezeichnung", maximum: 160, hinweis: "Für Fußzeile, Kalender und Berichte." },
    { name: "kurzname", label: "Kurzname", maximum: 60, hinweis: "Für Navigation, Anmeldung und Seitentitel." },
    { name: "region", label: "Region", maximum: 100, hinweis: "Zum Beispiel Landkreis oder Stadt." },
    { name: "startTitel", label: "Überschrift der Startseite", maximum: 100 },
    { name: "zielgruppe", label: "Zielgruppe", maximum: 160, hinweis: "Zum Beispiel Grund- und Mittelschulen oder Lehrkräfte aller Schularten." },
    { name: "angebotsRegion", label: "Angebotsregion im Einleitungssatz", maximum: 160, hinweis: "Ergänzt den Satz nach „in“, zum Beispiel Memmingen und dem Unterallgäu." },
  ] as const;
  return <form action={aktion} className="space-y-5 rounded-xl border bg-card p-5">
    {assistent ? <input type="hidden" name="weiter" value="schulen" /> : null}
    <fieldset disabled={laeuft} className="space-y-5">
      <legend className="mb-4 text-lg font-semibold">Schulamt und Auftritt</legend>
      {felder.map((feld) => <label key={feld.name} className="block space-y-1.5 text-sm font-medium">
        <span>{feld.label}</span>
        <Input name={feld.name} defaultValue={profil[feld.name]} onChange={(ereignis) => { if (feld.name === "zielgruppe") setZielgruppe(ereignis.target.value); if (feld.name === "angebotsRegion") setAngebotsRegion(ereignis.target.value); }} maxLength={feld.maximum} required className="w-full" aria-invalid={Boolean(stand.fehler?.[feld.name])} />
        {"hinweis" in feld ? <span className="block text-xs font-normal text-muted-foreground">{feld.hinweis}</span> : null}
        {stand.fehler?.[feld.name] ? <span role="alert" className="block text-sm text-destructive">{stand.fehler[feld.name]}</span> : null}
      </label>)}
      <div className="rounded-lg bg-muted p-4 text-sm"><p className="mb-1 font-medium">Vorschau der Einleitung</p><p>Suche für das neue Fortbildungsangebot für {zielgruppe} in {angebotsRegion}.</p></div>
      <label className="block space-y-1.5 text-sm font-medium"><span>Pflicht-Schlagworte</span><Textarea name="pflichtSchlagworte" defaultValue={profil.pflichtSchlagworte.join("\n")} rows={4} maxLength={500} /><span className="block text-xs font-normal text-muted-foreground">Ein Begriff pro Zeile, höchstens acht. Leer lassen, wenn keine benötigt werden. Neue Pflichtbegriffe werden auch für die FIBS-Suche aktiviert. Entfernte Pflichtbegriffe bleiben an bisherigen Veranstaltungen erhalten, werden aber nicht mehr für die FIBS-Suche verwendet.</span></label>
      {Object.entries(stand.fehler ?? {}).filter(([name]) => name.startsWith("pflichtSchlagworte")).map(([name, text]) => <p role="alert" className="text-sm text-destructive" key={name}>{text}</p>)}
      <Button type="submit">{laeuft ? "Wird gespeichert …" : assistent ? "Speichern und weiter zu den Schulen" : "Einrichtung speichern"}</Button>
    </fieldset>
    {stand.erfolg ? <p role="status" className="text-sm text-primary">{stand.meldung}</p> : null}
  </form>;
}
