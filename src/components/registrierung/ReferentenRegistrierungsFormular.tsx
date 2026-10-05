"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";

import { registriereReferent } from "@/actions/referentenRegistrierung";
import type { FormularState } from "@/lib/validation/fortbildung";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { T } from "@/texte/de";
import { FUNKTIONEN } from "@/constants/fortbildung";

export function ReferentenRegistrierungsFormular({ token }: { token: string }) {
  const [state, formAction] = useActionState<FormularState, FormData>(
    registriereReferent,
    {},
  );
  const fehler = state.fehler ?? {};

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Feld
          id="vorname"
          label={T.zugang.registrierungsFormular.vorname}
          autoComplete="given-name"
          fehler={fehler.vorname}
          autoFocus
        />
        <Feld
          id="nachname"
          label={T.zugang.registrierungsFormular.nachname}
          autoComplete="family-name"
          fehler={fehler.nachname}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{T.profil.funktion}</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {FUNKTIONEN.map((f) => (
            <label key={f.value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="funktion"
                value={f.value}
                defaultChecked={f.value === "REFERENT"}
                required
                className="size-4 accent-primary"
              />
              {f.label}
            </label>
          ))}
        </div>
      </fieldset>

      <Feld
        id="organisation"
        label={T.profil.stammschule}
        autoComplete="organization"
        fehler={fehler.organisation}
      />

      <Feld
        id="email"
        label={T.zugang.registrierungsFormular.email}
        type="email"
        autoComplete="email"
        fehler={fehler.email}
      />

      <div className="space-y-1.5">
        <Label htmlFor="passwort">{T.zugang.registrierungsFormular.passwort}</Label>
        <Input
          id="passwort"
          name="passwort"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
          className="w-full"
          aria-invalid={Boolean(fehler.passwort)}
        />
        {fehler.passwort ? (
          <p role="alert" className="text-sm text-destructive">{fehler.passwort}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {T.zugang.registrierungsFormular.passwortHinweis}
          </p>
        )}
      </div>

      <Feld
        id="wiederholung"
        label={T.zugang.registrierungsFormular.wiederholung}
        type="password"
        autoComplete="new-password"
        fehler={fehler.wiederholung}
      />

      {fehler._ ? (
        <p
          role="alert"
          className="flex items-start gap-2 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {fehler._}
        </p>
      ) : null}

      <AbsendenKnopf />
    </form>
  );
}

function Feld({
  id,
  label,
  type = "text",
  autoComplete,
  fehler,
  autoFocus = false,
}: {
  id: "vorname" | "nachname" | "organisation" | "email" | "wiederholung";
  label: string;
  type?: "text" | "email" | "password";
  autoComplete: string;
  fehler?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        required
        autoFocus={autoFocus}
        className="w-full"
        aria-invalid={Boolean(fehler)}
      />
      {fehler ? <p role="alert" className="text-sm text-destructive">{fehler}</p> : null}
    </div>
  );
}

function AbsendenKnopf() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending
        ? T.zugang.registrierungsFormular.registrierenLaeuft
        : T.zugang.registrierungsFormular.registrieren}
    </Button>
  );
}
