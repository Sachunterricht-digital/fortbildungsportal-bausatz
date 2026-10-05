"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { aenderePasswort } from "@/actions/zugang";
import type { FormularState } from "@/lib/validation/fortbildung";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswortAendernFormular() {
  const [state, formAction] = useActionState<FormularState, FormData>(
    aenderePasswort,
    {},
  );
  const fehler = state.fehler ?? {};

  return (
    <form action={formAction} className="space-y-4 border bg-card p-5">
      <h2 className="font-semibold tracking-tight">Passwort ändern</h2>

      <Feld
        name="bisheriges"
        label="Bisheriges Passwort"
        autoComplete="current-password"
        fehler={fehler.bisheriges}
      />
      <Feld
        name="neues"
        label="Neues Passwort"
        autoComplete="new-password"
        fehler={fehler.neues}
        hinweis="Mindestens 12 Zeichen."
      />
      <Feld
        name="wiederholung"
        label="Neues Passwort wiederholen"
        autoComplete="new-password"
        fehler={fehler.wiederholung}
      />

      <div className="flex items-center gap-3">
        <SpeichernKnopf />
        {state.erfolg ? (
          <span className="text-sm text-primary">{state.meldung}</span>
        ) : null}
        {fehler._ ? (
          <span role="alert" className="text-sm text-destructive">
            {fehler._}
          </span>
        ) : null}
      </div>
    </form>
  );
}

function SpeichernKnopf() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Wird geändert …" : "Passwort ändern"}
    </Button>
  );
}

function Feld({
  name,
  label,
  autoComplete,
  fehler,
  hinweis,
}: {
  name: string;
  label: string;
  autoComplete: string;
  fehler?: string;
  hinweis?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type="password"
        autoComplete={autoComplete}
        required
        className="w-full"
        aria-invalid={Boolean(fehler)}
      />
      {fehler ? (
        <p role="alert" className="text-sm text-destructive">
          {fehler}
        </p>
      ) : hinweis ? (
        <p className="text-xs text-muted-foreground">{hinweis}</p>
      ) : null}
    </div>
  );
}
