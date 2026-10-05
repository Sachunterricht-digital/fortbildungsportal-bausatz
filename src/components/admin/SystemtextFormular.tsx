"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { speichereSystemtext } from "@/actions/systemtext";
import type { FormularState } from "@/lib/validation/fortbildung";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function SystemtextFormular({
  id,
  ueberschrift,
  wert,
}: {
  id: string;
  ueberschrift: string;
  wert: string;
}) {
  const action = speichereSystemtext.bind(null, id);
  const [state, formAction] = useActionState<FormularState, FormData>(action, {});

  return (
    <form action={formAction} className="border p-5">
      <h2 className="mb-3 text-sm font-semibold">{ueberschrift}</h2>

      <Textarea
        name="wert"
        defaultValue={wert}
        rows={16}
        className="w-full font-mono text-xs"
        aria-label={ueberschrift}
      />

      <div className="mt-3 flex items-center gap-3">
        <SpeichernKnopf />
        {state.erfolg ? (
          <span className="text-sm text-primary">{state.meldung}</span>
        ) : null}
        {state.fehler?._ ? (
          <span role="alert" className="text-sm text-destructive">
            {state.fehler._}
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
      {pending ? "Wird gespeichert …" : "Speichern"}
    </Button>
  );
}
