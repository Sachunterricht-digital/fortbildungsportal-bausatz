"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Plus } from "lucide-react";

import { speichereSchlagwort } from "@/actions/stammdaten";
import type { FormularState } from "@/lib/validation/fortbildung";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SchlagwortFormular() {
  const [state, formAction] = useActionState<FormularState, FormData>(
    speichereSchlagwort,
    {},
  );

  return (
    <form action={formAction} className="border bg-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1 space-y-1.5">
          <Label htmlFor="name">Neues Schlagwort</Label>
          <Input
            id="name"
            name="name"
            required
            maxLength={60}
            placeholder="z. B. Robotik"
            className="w-full"
            aria-invalid={Boolean(state.fehler?.name)}
          />
        </div>
        <AnlegenKnopf />
      </div>

      {state.fehler?.name ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {state.fehler.name}
        </p>
      ) : null}
      {state.erfolg ? (
        <p className="mt-2 text-sm text-primary">{state.meldung}</p>
      ) : null}
    </form>
  );
}

function AnlegenKnopf() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Plus className="size-4" aria-hidden />
      {pending ? "Wird angelegt …" : "Anlegen"}
    </Button>
  );
}
