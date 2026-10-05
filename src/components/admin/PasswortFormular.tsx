"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";

import { setzePasswort } from "@/actions/zugang";
import type { FormularState } from "@/lib/validation/fortbildung";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { T } from "@/texte/de";

export function PasswortFormular({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const [state, formAction] = useActionState<FormularState, FormData>(
    setzePasswort,
    {},
  );
  const fehler = state.fehler ?? {};

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      <div className="space-y-1.5">
        <Label htmlFor="anmeldename">{T.zugang.passwortFormular.anmeldename}</Label>
        {/* Sichtbar, aber nicht änderbar — Passwortverwaltungen im Browser
            merken sich so das richtige Konto. */}
        <Input
          id="anmeldename"
          value={email}
          readOnly
          autoComplete="username"
          className="w-full bg-muted"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="passwort">{T.zugang.passwortFormular.passwort}</Label>
        <Input
          id="passwort"
          name="passwort"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          autoFocus
          className="w-full"
          aria-invalid={Boolean(fehler.passwort)}
        />
        {fehler.passwort ? (
          <p role="alert" className="text-sm text-destructive">
            {fehler.passwort}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {T.zugang.passwortFormular.passwortHinweis}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="wiederholung">{T.zugang.passwortFormular.wiederholung}</Label>
        <Input
          id="wiederholung"
          name="wiederholung"
          type="password"
          autoComplete="new-password"
          required
          className="w-full"
          aria-invalid={Boolean(fehler.wiederholung)}
        />
        {fehler.wiederholung ? (
          <p role="alert" className="text-sm text-destructive">
            {fehler.wiederholung}
          </p>
        ) : null}
      </div>

      {fehler._ ? (
        <p
          role="alert"
          className="flex items-start gap-2 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {fehler._}
        </p>
      ) : null}

      <SpeichernKnopf />
    </form>
  );
}

function SpeichernKnopf() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? T.zugang.passwortFormular.speichernLaeuft : T.zugang.passwortFormular.speichern}
    </Button>
  );
}
