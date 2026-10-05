"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { Check, CircleHelp, X } from "lucide-react";

import {
  richteZugangAusUmfrageEin,
  speichereUmfrageAntwort,
} from "@/actions/umfrageOeffentlich";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ANTWORT_WERTE, UMFRAGE_GRENZEN } from "@/constants/umfrage";
import type { FormularState } from "@/lib/validation/fortbildung";
import { cn } from "@/lib/utils";
import { T } from "@/texte/de";

import {
  setzeTermineUngespeichert,
  verlassenOhneNachfrage,
} from "./termineUngespeichert";

const TX = T.umfrage.oeffentlich;

export interface ProfilAnstoss {
  /** Konto mit gesetztem Passwort vorhanden? */
  hatZugang: boolean;
  /** Was im Profil noch fehlt, in Klartext. Nur bei `hatZugang`. */
  fehlt: string[];
}

const ICONS = { JA: Check, VIELLEICHT: CircleHelp, NEIN: X } as const;

const AKTIV_STIL = {
  JA: "peer-checked:bg-emerald-600 peer-checked:text-white peer-checked:hover:bg-emerald-700 peer-checked:hover:text-white",
  VIELLEICHT:
    "peer-checked:bg-amber-500 peer-checked:text-white peer-checked:hover:bg-amber-600 peer-checked:hover:text-white",
  NEIN: "peer-checked:bg-rose-600 peer-checked:text-white peer-checked:hover:bg-rose-700 peer-checked:hover:text-white",
} as const;

/**
 * Die eigene Antwort als Karte, auf jeder Breite gleich: je Termin eine Zeile
 * mit Dreifach-Umschalter. Die Felder sind kontrolliert (State), weil React 19
 * ein Formular nach einer Aktion zurücksetzt und nicht kontrollierte Felder
 * sonst auf den Stand vom ersten Rendern zurückspringen. Abgeschickt wird per
 * `onSubmit` in einer Transition statt über `action`: Nur so setzt React das
 * Formular danach nicht zurück, die Auswahl bleibt nach dem Speichern sichtbar.
 *
 * Solange die Auswahl vom gespeicherten Stand abweicht, steht ein Hinweis am
 * Knopf, das Verlassen der Seite fragt nach, und Onboarding sowie „Weiter zum
 * Profil“ sehen es über `termineUngespeichert`.
 */
export function UmfrageAntwortFormular({
  token,
  vorname,
  termine,
  startWerte,
  startKommentar,
  profil,
}: {
  token: string;
  vorname: string;
  termine: Array<{ id: string; label: string }>;
  startWerte: Record<string, string>;
  startKommentar: string;
  profil: ProfilAnstoss;
}) {
  const [gespeichert, setGespeichert] = useState({ werte: startWerte, kommentar: startKommentar });
  const [state, formAction, laeuft] = useActionState<FormularState, FormData>(
    async (bisher, formData) => {
      const ergebnis = await speichereUmfrageAntwort(token, bisher, formData);
      if (ergebnis.erfolg) {
        setGespeichert({
          werte: Object.fromEntries(
            termine.map((t) => [t.id, (formData.get(`wert-${t.id}`) ?? "").toString()]),
          ),
          kommentar: (formData.get("kommentar") ?? "").toString(),
        });
      }
      return ergebnis;
    },
    {},
  );
  const [werte, setWerte] = useState<Record<string, string>>(startWerte);
  const [kommentar, setKommentar] = useState(startKommentar);

  const alleGewaehlt = termine.every((t) => (werte[t.id] ?? "") !== "");
  const ungespeichert =
    termine.some((t) => (werte[t.id] ?? "") !== (gespeichert.werte[t.id] ?? "")) ||
    kommentar !== gespeichert.kommentar;

  useEffect(() => {
    setzeTermineUngespeichert(ungespeichert);
    if (!ungespeichert) return;
    const warnen = (e: BeforeUnloadEvent) => {
      if (verlassenOhneNachfrage()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warnen);
    return () => window.removeEventListener("beforeunload", warnen);
  }, [ungespeichert]);

  // „Bitte wähle für jeden Termin eine Antwort.“ erledigt sich, sobald alle gewählt sind.
  const fehlerText =
    state.fehler?._ ?? (alleGewaehlt ? undefined : state.fehler?.werte) ?? state.fehler?.kommentar;

  return (
    <section className="space-y-4" aria-labelledby="deine-antwort">
      <form
        id="umfrage-antwort"
        onSubmit={(e) => {
          e.preventDefault();
          const daten = new FormData(e.currentTarget);
          startTransition(() => formAction(daten));
        }}
        className="space-y-4 border border-border bg-card p-4 sm:p-5"
      >
        <div>
          <h2 id="deine-antwort" className="font-heading text-lg font-bold tracking-tight">
            {TX.deineAntwortTitel}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {TX.begruessung(vorname)}. {TX.antwortHinweis}
          </p>
        </div>

        <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {termine.map((termin) => (
            <fieldset
              key={termin.id}
              className="flex items-center justify-between gap-3 border-b border-border/60 pb-3"
              aria-label={TX.terminGruppe(termin.label)}
            >
              <legend className="sr-only">{TX.terminGruppe(termin.label)}</legend>
              <span className="text-sm font-medium whitespace-nowrap">{termin.label}</span>
              <div className="inline-flex overflow-hidden rounded-md border border-border">
                {ANTWORT_WERTE.map((wert) => {
                  const Icon = ICONS[wert.value];
                  return (
                    <label key={wert.value} className="relative cursor-pointer">
                      <input
                        type="radio"
                        name={`wert-${termin.id}`}
                        value={wert.value}
                        checked={werte[termin.id] === wert.value}
                        onChange={() => setWerte((alt) => ({ ...alt, [termin.id]: wert.value }))}
                        className="peer sr-only"
                      />
                      <span
                        className={cn(
                          "flex h-10 min-w-11 items-center justify-center gap-1 px-2 text-xs text-muted-foreground transition-colors hover:bg-muted peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 peer-focus-visible:ring-inset sm:px-3",
                          AKTIV_STIL[wert.value],
                        )}
                      >
                        <Icon className="size-4" aria-hidden />
                        <span className="max-[400px]:sr-only">{wert.label}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="umfrage-kommentar" className="text-sm font-medium">
            {TX.kommentarLabel}
          </label>
          <Textarea
            id="umfrage-kommentar"
            name="kommentar"
            rows={2}
            maxLength={UMFRAGE_GRENZEN.kommentar}
            value={kommentar}
            onChange={(e) => setKommentar(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {TX.kommentarHinweis(UMFRAGE_GRENZEN.kommentar)}
          </p>
        </div>

        {fehlerText ? (
          <p role="alert" className="text-sm text-destructive">
            {fehlerText}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" id="umfrage-antwort-speichern" disabled={laeuft}>
            {laeuft ? TX.speichernLaeuft : TX.speichern}
          </Button>
          {ungespeichert && !laeuft ? (
            <p data-testid="umfrage-ungespeichert" className="text-sm font-medium text-amber-700">
              {TX.ungespeichert}
            </p>
          ) : null}
        </div>
      </form>

      {state.erfolg ? <Dankeskasten token={token} profil={profil} /> : null}
    </section>
  );
}

function Dankeskasten({ token, profil }: { token: string; profil: ProfilAnstoss }) {
  const D = TX.danke;
  const [zugangState, zugangAction, zugangLaeuft] = useActionState<FormularState, FormData>(
    richteZugangAusUmfrageEin.bind(null, token),
    {},
  );
  // Hat die Person schon ein Passwort, nützt ein Link zur Anmeldung mehr als der Text allein.
  const schonVorhanden = zugangState.fehler?._ === D.zugangFehler.schonVorhanden;

  return (
    <div
      role="status"
      data-testid="dankeskasten"
      className="space-y-3 border border-primary/30 bg-primary/5 p-4 sm:p-5"
    >
      <div>
        <h3 className="font-heading text-base font-bold tracking-tight">{D.titel}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground text-pretty">{D.text}</p>
      </div>

      {profil.hatZugang ? (
        <div className="space-y-2 border-t border-primary/20 pt-3 text-sm">
          {profil.fehlt.length > 0 ? (
            <>
              <p className="font-medium">{D.profilFehlt}</p>
              <ul className="list-disc pl-5">
                {profil.fehlt.map((punkt) => (
                  <li key={punkt}>{punkt}</li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">{D.freiwillig}</p>
            </>
          ) : (
            <p>{D.profilKomplett}</p>
          )}
          <a
            href="/login?weiter=/admin"
            className={cn(buttonVariants({ variant: "outline" }), "mt-1")}
          >
            {D.zumReferentenbereich}
          </a>
        </div>
      ) : (
        <form action={zugangAction} className="space-y-2 border-t border-primary/20 pt-3">
          <p className="text-sm text-pretty">{D.ohneKontoText}</p>
          {zugangState.fehler?._ ? (
            <p role="alert" className="text-sm text-destructive">
              {zugangState.fehler._}
            </p>
          ) : null}
          {schonVorhanden ? (
            <a
              href="/login?weiter=/admin"
              data-testid="zugang-zur-anmeldung"
              className={buttonVariants({ variant: "outline" })}
            >
              {D.zurAnmeldung}
            </a>
          ) : (
            <Button type="submit" variant="outline" disabled={zugangLaeuft}>
              {zugangLaeuft ? D.zugangLaeuft : D.zugangEinrichten}
            </Button>
          )}
        </form>
      )}
    </div>
  );
}
