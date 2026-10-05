"use client";

import { useActionState, useState } from "react";

import { richteZugangAusUmfrageEin } from "@/actions/umfrageOeffentlich";
import { Button, buttonVariants } from "@/components/ui/button";
import type { FormularState } from "@/lib/validation/fortbildung";
import { T } from "@/texte/de";

import { erlaubeVerlassen, offeneQuellen, useOffeneQuellen } from "./termineUngespeichert";

/** Ziel nach dem Login: das Profil im eigenen Konto (der Hash wird als %23 mitgegeben). */
export const PROFIL_LOGIN_LINK = "/login?weiter=%2Fadmin%2Fkonto%23profil";

/**
 * „Weiter zum Profil“ am Ende des Onboardings. Verhalten wie der Knopf im
 * Dankeskasten der Umfrage: Wer noch kein Passwort hat, bekommt über
 * `richteZugangAusUmfrageEin` einen Zugang und landet auf `/zugang`. Wer
 * schon eines hat, geht zum Login und danach ins Profil.
 *
 * Sind oben Termine oder Onboarding-Angaben nicht gespeichert, hält der erste
 * Klick an, nennt im Hinweis, was offen ist, und springt zum ersten offenen
 * Speichern-Knopf. Ein zweiter Klick geht bewusst ohne diese Angaben weiter.
 * Der Hinweis verschwindet, sobald alles gespeichert ist.
 */
export function OnboardingProfilKnopf({
  token,
  hatZugang,
}: {
  token: string;
  hatZugang: boolean;
}) {
  const [state, formAction, laeuft] = useActionState<FormularState, FormData>(
    richteZugangAusUmfrageEin.bind(null, token),
    {},
  );
  const [gewarnt, setGewarnt] = useState(false);
  const offen = useOffeneQuellen();
  const irgendwasOffen = offen.termine || offen.onboarding;
  // Alles gespeichert: Die Warnung ist erledigt, ein späteres Ändern warnt neu.
  if (gewarnt && !irgendwasOffen) setGewarnt(false);

  /** true = weitergehen, false = angehalten (Hinweis steht, Fokus beim ersten offenen Speichern). */
  function darfWeiter(): boolean {
    const jetzt = offeneQuellen();
    if (!jetzt.termine && !jetzt.onboarding) return true;
    if (gewarnt) {
      erlaubeVerlassen();
      return true;
    }
    setGewarnt(true);
    const knopf = document.getElementById(
      jetzt.termine ? "umfrage-antwort-speichern" : "onboarding-speichern",
    );
    knopf?.scrollIntoView({ behavior: "smooth", block: "center" });
    knopf?.focus({ preventScroll: true });
    return false;
  }

  const hinweis =
    gewarnt && irgendwasOffen ? (
      <p role="alert" data-testid="weiter-termine-offen" className="text-sm font-medium text-amber-700">
        {T.onboarding.weiterOffen(offen.termine, offen.onboarding)}
      </p>
    ) : null;

  if (hatZugang) {
    return (
      <div data-testid="onboarding-profil-knopf" className="space-y-2">
        {hinweis}
        <a
          href={PROFIL_LOGIN_LINK}
          onClick={(e) => {
            if (!darfWeiter()) e.preventDefault();
          }}
          className={buttonVariants()}
        >
          {T.onboarding.weiterZumProfil}
        </a>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!darfWeiter()) e.preventDefault();
      }}
      data-testid="onboarding-profil-knopf"
      className="space-y-2"
    >
      {hinweis}
      {state.fehler?._ ? (
        <p role="alert" className="text-sm text-destructive">
          {state.fehler._}
        </p>
      ) : null}
      <Button type="submit" disabled={laeuft}>
        {T.onboarding.weiterZumProfil}
      </Button>
    </form>
  );
}
