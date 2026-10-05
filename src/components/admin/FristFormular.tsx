"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { speichereFrist } from "@/actions/frist";
import type { FormularState } from "@/lib/validation/fortbildung";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { T } from "@/texte/de";

/** `wert` im Format JJJJ-MM-TT, leer ohne Frist. */
export function FristFormular({ wert }: { wert: string }) {
  const [state, formAction] = useActionState<FormularState, FormData>(speichereFrist, {});
  const fehler = state.fehler ?? {};

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="frist">{T.frist.label}</Label>
        <Input
          id="frist"
          name="frist"
          type="date"
          defaultValue={wert}
          className="w-44"
          aria-invalid={Boolean(fehler.frist)}
        />
      </div>
      <Knopf />
      {state.erfolg ? <span className="text-sm text-primary">{state.meldung}</span> : null}
      {fehler.frist || fehler._ ? (
        <span role="alert" className="text-sm text-destructive">{fehler.frist ?? fehler._}</span>
      ) : null}
    </form>
  );
}

function Knopf() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" disabled={pending}>
      {T.frist.speichern}
    </Button>
  );
}
