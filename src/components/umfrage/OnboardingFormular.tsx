"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { Check } from "lucide-react";

import { speichereOnboarding } from "@/actions/umfrageOeffentlich";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  KONTAKTWEGE,
  ONBOARDING_GRENZEN,
  TAGE,
  TAGESZEITEN,
  zeitValue,
} from "@/constants/onboarding";
import type { FormularState } from "@/lib/validation/fortbildung";
import { cn } from "@/lib/utils";
import { T } from "@/texte/de";

import {
  setzeOnboardingUngespeichert,
  useOffeneQuellen,
  verlassenOhneNachfrage,
} from "./termineUngespeichert";

const TO = T.onboarding;

export interface OnboardingStart {
  kontaktwege: string[];
  /** Die eigene Nummer (`Referent.telefon`), nur für die Person selbst. */
  telefon: string;
  weitereFormate: boolean;
  zeiten: string[];
  bemerkung: string;
}

/**
 * Kästchen wie `checkbox.tsx`, nur Anzeige. Die Bedienung übernimmt eine native
 * Checkbox (sr-only), der Fokusring kommt per `peer`, wenn sie direkt davor steht.
 */
function Kaestchen({ aktiv, className }: { aktiv: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-[18px] shrink-0 place-content-center rounded-[4px] border border-input bg-card text-primary-foreground transition-colors peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
        aktiv && "border-primary bg-primary",
        className,
      )}
    >
      <Check strokeWidth={3} className={cn("size-3.5", aktiv ? "opacity-100" : "opacity-0")} />
    </span>
  );
}

/** Vergleichbarer Stand der Eingaben. Zeiten und Bemerkung zählen nur bei „weitere Formate“. */
function stand(e: {
  kontaktwege: string[];
  telefon: string;
  weitereFormate: boolean;
  zeiten: string[];
  bemerkung: string;
}): string {
  return JSON.stringify([
    [...e.kontaktwege].sort(),
    e.telefon.trim(),
    e.weitereFormate,
    e.weitereFormate ? [...e.zeiten].sort() : [],
    e.weitereFormate ? e.bemerkung.trim() : "",
  ]);
}

function umschalten(liste: string[], wert: string, an: boolean): string[] {
  return an ? [...liste.filter((w) => w !== wert), wert] : liste.filter((w) => w !== wert);
}

/**
 * Die beiden Eingabekarten des Onboardings (Kontaktmöglichkeiten, Weitere
 * Formate) als ein Formular. Alle Felder sind kontrolliert (State), weil React
 * 19 ein Formular nach einer Aktion zurücksetzt. Der Zeitenblock existiert
 * erst, wenn „weitere Formate“ angekreuzt ist.
 *
 * Wie bei den Terminen: Weicht die Eingabe vom zuletzt gespeicherten Stand ab,
 * steht ein Hinweis am Knopf, das Verlassen der Seite fragt nach, und
 * „Weiter zum Profil“ sieht es über `termineUngespeichert`.
 */
export function OnboardingFormular({ token, start }: { token: string; start: OnboardingStart }) {
  // Ausgangswert der Nummer: Der Server schreibt sie nur, wenn sie davon
  // abweicht, und nur, solange sie in der Datenbank noch so steht. Nach einem
  // erfolgreichen Speichern ist der gespeicherte Wert der neue Ausgangswert.
  const [telefonAusgang, setTelefonAusgang] = useState(start.telefon);
  const offen = useOffeneQuellen();
  const [gespeichert, setGespeichert] = useState(() => stand(start));
  const [state, formAction, laeuft] = useActionState<FormularState, FormData>(
    async (bisher, formData) => {
      const ergebnis = await speichereOnboarding(token, bisher, formData);
      if (ergebnis.erfolg) {
        const telefonNeu = (formData.get("telefon") ?? "").toString().trim();
        setTelefonAusgang(telefonNeu);
        setGespeichert(
          stand({
            kontaktwege: formData.getAll("kontaktweg").map(String),
            telefon: telefonNeu,
            weitereFormate: formData.get("weitereFormate") === "on",
            zeiten: formData.getAll("zeit").map(String),
            bemerkung: (formData.get("bemerkung") ?? "").toString(),
          }),
        );
      }
      return ergebnis;
    },
    {},
  );
  const [kontaktwege, setKontaktwege] = useState(start.kontaktwege);
  const [telefon, setTelefon] = useState(start.telefon);
  const [weitereFormate, setWeitereFormate] = useState(start.weitereFormate);
  const [zeiten, setZeiten] = useState(start.zeiten);
  const [bemerkung, setBemerkung] = useState(start.bemerkung);

  const ungespeichert =
    stand({ kontaktwege, telefon, weitereFormate, zeiten, bemerkung }) !== gespeichert;

  useEffect(() => {
    setzeOnboardingUngespeichert(ungespeichert);
    if (!ungespeichert) return;
    const warnen = (e: BeforeUnloadEvent) => {
      if (verlassenOhneNachfrage()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warnen);
    return () => window.removeEventListener("beforeunload", warnen);
  }, [ungespeichert]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const daten = new FormData(e.currentTarget);
        startTransition(() => formAction(daten));
      }}
      className="space-y-6"
      data-testid="onboarding-formular"
    >
      <section className="space-y-4 border border-border bg-card p-4 sm:p-5" aria-labelledby="onboarding-kontakt">
        <h3 id="onboarding-kontakt" className="font-heading text-lg font-bold tracking-tight">
          {TO.kontakt.titel}
        </h3>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{TO.kontakt.legende}</legend>
          <div className="flex flex-wrap gap-2">
            {KONTAKTWEGE.map((weg) => (
              <label key={weg.value} className="relative inline-flex cursor-pointer">
                <input
                  type="checkbox"
                  name="kontaktweg"
                  value={weg.value}
                  checked={kontaktwege.includes(weg.value)}
                  onChange={(e) => setKontaktwege((alt) => umschalten(alt, weg.value, e.target.checked))}
                  className="peer sr-only"
                />
                <span
                  className={cn(
                    "inline-flex min-h-10 items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
                    kontaktwege.includes(weg.value) &&
                      "border-marke-gelb bg-marke-gelb-weich text-foreground",
                  )}
                >
                  <Kaestchen aktiv={kontaktwege.includes(weg.value)} />
                  {weg.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="space-y-1.5">
          <label htmlFor="onboarding-telefon" className="text-sm font-medium">
            {TO.kontakt.handynummerLabel}{" "}
            <span className="text-muted-foreground">{TO.kontakt.handynummerOptional}</span>
          </label>
          <input type="hidden" name="telefonAusgang" value={telefonAusgang} />
          <Input
            id="onboarding-telefon"
            name="telefon"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            maxLength={ONBOARDING_GRENZEN.telefon}
            value={telefon}
            onChange={(e) => setTelefon(e.target.value)}
            aria-invalid={state.fehler?.telefon ? true : undefined}
            aria-describedby="onboarding-telefon-hinweis"
          />
          <p id="onboarding-telefon-hinweis" className="text-xs text-muted-foreground">
            {TO.kontakt.handynummerHinweis}
          </p>
          {state.fehler?.telefon ? (
            <p role="alert" className="text-sm text-destructive">
              {state.fehler.telefon}
            </p>
          ) : null}
        </div>
      </section>

      <section className="space-y-4 border border-border bg-card p-4 sm:p-5" aria-labelledby="onboarding-formate">
        <div className="space-y-1">
          <h3 id="onboarding-formate" className="font-heading text-lg font-bold tracking-tight">
            {TO.formate.titel}
          </h3>
          <p className="text-sm text-pretty">{TO.formate.einleitung}</p>
        </div>

        <label className="relative flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="weitereFormate"
            checked={weitereFormate}
            onChange={(e) => setWeitereFormate(e.target.checked)}
            className="peer sr-only"
          />
          <Kaestchen aktiv={weitereFormate} className="mt-0.5" />
          <span>{TO.formate.zustimmung}</span>
        </label>

        {weitereFormate ? (
          <div className="space-y-4" data-testid="onboarding-zeiten">
            <p className="text-sm font-medium">{TO.formate.zeitenFrage}</p>
            <div className="relative overflow-x-auto border border-border">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">{TO.formate.zeitenTabelle}</caption>
                <thead>
                  <tr className="border-b border-border bg-muted/60">
                    <td />
                    {TAGESZEITEN.map((zeit) => (
                      <th
                        key={zeit.value}
                        scope="col"
                        className="px-2 py-2 text-center text-xs font-medium text-muted-foreground capitalize"
                      >
                        {zeit.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TAGE.map((tag) => (
                    <tr key={tag.value} className="border-b border-border last:border-b-0">
                      <th scope="row" className="px-3 text-left font-medium whitespace-nowrap">
                        {tag.label}
                      </th>
                      {TAGESZEITEN.map((zeit) => {
                        const wert = zeitValue(tag.value, zeit.value);
                        return (
                          <td key={zeit.value} className="w-[28%] text-center">
                            <label className="relative flex h-11 cursor-pointer items-center justify-center">
                              <input
                                type="checkbox"
                                name="zeit"
                                value={wert}
                                checked={zeiten.includes(wert)}
                                onChange={(e) => setZeiten((alt) => umschalten(alt, wert, e.target.checked))}
                                aria-label={`${tag.label} ${zeit.label}`}
                                className="peer sr-only"
                              />
                              <Kaestchen aktiv={zeiten.includes(wert)} />
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="onboarding-bemerkung" className="text-sm font-medium">
                {TO.formate.bemerkungLabel}
                <span className="font-normal text-muted-foreground">{TO.formate.bemerkungBeispiel}</span>
              </label>
              <Textarea
                id="onboarding-bemerkung"
                name="bemerkung"
                rows={2}
                maxLength={ONBOARDING_GRENZEN.bemerkung}
                value={bemerkung}
                onChange={(e) => setBemerkung(e.target.value)}
                aria-invalid={state.fehler?.bemerkung ? true : undefined}
              />
              {state.fehler?.bemerkung ? (
                <p role="alert" className="text-sm text-destructive">
                  {state.fehler.bemerkung}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {state.fehler?._ ? (
          <p role="alert" className="text-sm text-destructive">
            {state.fehler._}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" id="onboarding-speichern" disabled={laeuft}>
            {laeuft ? TO.speichernLaeuft : TO.speichern}
          </Button>
          {ungespeichert && !laeuft ? (
            <p data-testid="onboarding-ungespeichert" className="text-sm font-medium text-amber-700">
              {TO.ungespeichert}
            </p>
          ) : null}
          {state.erfolg && !laeuft && !ungespeichert ? (
            <p role="status" data-testid="onboarding-erfolg" className="text-sm text-muted-foreground">
              {offen.termine ? TO.erfolgTermineOffen : (state.meldung ?? TO.erfolg)}
            </p>
          ) : null}
        </div>
      </section>
    </form>
  );
}
