"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { speichereUmfrage } from "@/actions/umfrage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UMFRAGE_GRENZEN } from "@/constants/umfrage";
import type { FormularState } from "@/lib/validation/fortbildung";
import { T } from "@/texte/de";

const TF = T.umfrage.form;

export interface EmpfaengerOption {
  id: string;
  name: string;
  organisation: string | null;
  hatMail: boolean;
  aktiv: boolean;
}

export interface UmfrageStart {
  titel: string;
  beschreibung: string;
  ort: string;
  uhrzeit: string;
  /** ISO-Tage, aufsteigend */
  termine: string[];
  /** Ausgewählte Referent-IDs */
  empfaenger: string[];
  /** Referent-IDs, die schon in der Umfrage stehen (bleiben auswählbar, auch ohne Mail) */
  bestehend: string[];
}

export function UmfrageForm({
  umfrageId,
  start,
  personen,
}: {
  umfrageId: string | null;
  start: UmfrageStart;
  personen: EmpfaengerOption[];
}) {
  const [state, formAction, laeuft] = useActionState<FormularState, FormData>(
    speichereUmfrage.bind(null, umfrageId),
    {},
  );
  // Schlüssel je Zeile, damit „Entfernen“ in der Mitte nicht die Werte vertauscht.
  const [termine, setTermine] = useState(() =>
    (start.termine.length > 0 ? start.termine : [""]).map((wert, i) => ({ schluessel: i, wert })),
  );
  const [naechster, setNaechster] = useState(termine.length);
  const [gewaehlt, setGewaehlt] = useState(() => new Set(start.empfaenger));

  const waehlbar = (p: EmpfaengerOption) => p.hatMail || start.bestehend.includes(p.id);

  return (
    <form action={formAction} className="max-w-3xl space-y-8">
      <section className="space-y-4">
        <Feld id="u-titel" label={TF.titel} fehler={state.fehler?.titel}>
          <Input id="u-titel" name="titel" defaultValue={start.titel} maxLength={UMFRAGE_GRENZEN.titel} required />
        </Feld>
        <Feld id="u-beschreibung" label={TF.beschreibung} fehler={state.fehler?.beschreibung}>
          <Textarea
            id="u-beschreibung"
            name="beschreibung"
            defaultValue={start.beschreibung}
            rows={3}
            maxLength={UMFRAGE_GRENZEN.beschreibung}
          />
        </Feld>
        <div className="grid gap-4 sm:grid-cols-2">
          <Feld id="u-ort" label={TF.ort} fehler={state.fehler?.ort}>
            <Input id="u-ort" name="ort" defaultValue={start.ort} maxLength={UMFRAGE_GRENZEN.ort} />
          </Feld>
          <Feld id="u-uhrzeit" label={TF.uhrzeit} fehler={state.fehler?.uhrzeit}>
            <Input
              id="u-uhrzeit"
              name="uhrzeit"
              defaultValue={start.uhrzeit}
              placeholder={TF.uhrzeitPlatzhalter}
              maxLength={UMFRAGE_GRENZEN.uhrzeit}
            />
          </Feld>
        </div>
      </section>

      <fieldset className="space-y-3">
        <legend className="font-semibold tracking-tight">{TF.termineTitel}</legend>
        <p className="text-sm text-muted-foreground">{TF.termineHinweis}</p>
        <ul className="space-y-2">
          {termine.map((termin, index) => (
            <li key={termin.schluessel} className="flex items-center gap-2">
              <Label htmlFor={`u-termin-${termin.schluessel}`} className="w-20 shrink-0">
                {TF.terminLabel(index + 1)}
              </Label>
              <Input
                id={`u-termin-${termin.schluessel}`}
                type="date"
                name="termin"
                value={termin.wert}
                onChange={(e) =>
                  setTermine((alt) =>
                    alt.map((t) => (t.schluessel === termin.schluessel ? { ...t, wert: e.target.value } : t)),
                  )
                }
                className="max-w-48"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={TF.terminEntfernen(index + 1)}
                disabled={termine.length === 1}
                onClick={() => setTermine((alt) => alt.filter((t) => t.schluessel !== termin.schluessel))}
              >
                <Trash2 className="size-3.5" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={termine.length >= UMFRAGE_GRENZEN.termineMax}
          onClick={() => {
            setTermine((alt) => [...alt, { schluessel: naechster, wert: "" }]);
            setNaechster((n) => n + 1);
          }}
        >
          <Plus className="size-3.5" aria-hidden />
          {TF.terminHinzufuegen}
        </Button>
        {state.fehler?.termine ? (
          <p role="alert" className="text-sm text-destructive">
            {state.fehler.termine}
          </p>
        ) : null}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-semibold tracking-tight">{TF.empfaengerTitel}</legend>
        <p className="text-sm text-muted-foreground">
          {TF.empfaengerHinweis}
          {umfrageId ? ` ${TF.empfaengerAbgewaehlt}` : ""}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => setGewaehlt(new Set(personen.filter(waehlbar).map((p) => p.id)))}
          >
            {TF.alleWaehlen}
          </Button>
          <Button type="button" variant="outline" size="xs" onClick={() => setGewaehlt(new Set())}>
            {TF.keineWaehlen}
          </Button>
        </div>
        <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {personen.map((person) => {
            const erlaubt = waehlbar(person);
            return (
              <li key={person.id}>
                <label
                  className={`flex items-start gap-2.5 py-1.5 text-sm ${erlaubt ? "cursor-pointer" : "cursor-not-allowed text-muted-foreground/60"}`}
                >
                  <input
                    type="checkbox"
                    name="referentId"
                    value={person.id}
                    disabled={!erlaubt}
                    checked={gewaehlt.has(person.id)}
                    onChange={(e) =>
                      setGewaehlt((alt) => {
                        const neu = new Set(alt);
                        if (e.target.checked) neu.add(person.id);
                        else neu.delete(person.id);
                        return neu;
                      })
                    }
                    className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
                  />
                  <span className="min-w-0">
                    {person.name}
                    {person.organisation ? (
                      <span className="text-muted-foreground"> · {person.organisation}</span>
                    ) : null}
                    {!person.hatMail ? (
                      <span className="block text-xs">{TF.ohneMail}</span>
                    ) : !person.aktiv ? (
                      <span className="block text-xs text-muted-foreground">{TF.inaktiv}</span>
                    ) : null}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        {state.fehler?.empfaenger ? (
          <p role="alert" className="text-sm text-destructive">
            {state.fehler.empfaenger}
          </p>
        ) : null}
      </fieldset>

      {state.fehler?._ ? (
        <p role="alert" className="text-sm text-destructive">
          {state.fehler._}
        </p>
      ) : null}
      {state.erfolg && state.meldung ? (
        <p role="status" className="text-sm text-primary">
          {state.meldung}
        </p>
      ) : null}

      <Button type="submit" disabled={laeuft}>
        {laeuft ? TF.speichernLaeuft : TF.speichern}
      </Button>
    </form>
  );
}

function Feld({
  id,
  label,
  fehler,
  children,
}: {
  id: string;
  label: string;
  fehler?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {fehler ? (
        <p role="alert" className="text-sm text-destructive">
          {fehler}
        </p>
      ) : null}
    </div>
  );
}
