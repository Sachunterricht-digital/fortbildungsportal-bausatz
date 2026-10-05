"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Pencil, Undo2 } from "lucide-react";

import { freigeben, zurueckweisen } from "@/actions/freigabe";
import type { FormularState } from "@/lib/validation/fortbildung";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { T } from "@/texte/de";

/**
 * Freigeben oder zurückweisen.
 *
 * Das Zurückweisen verlangt eine Begründung — eine Fortbildung kommentarlos
 * in den Entwurfsstatus zurückzuschicken, hilft der einreichenden Person
 * nicht weiter.
 */
export function FreigabeLeiste({
  id,
  titel,
  lehrgangsnummer,
  updatedAt,
}: {
  id: string;
  titel: string;
  lehrgangsnummer?: string | null;
  /** Zuletzt gesehener Stand — schützt vor einer Freigabe auf veralteter Grundlage. */
  updatedAt: Date;
}) {
  const updatedAtWert = updatedAt.toISOString();
  const [zurueckOffen, setZurueckOffen] = useState(false);
  const action = zurueckweisen.bind(null, id);
  const [state, formAction] = useActionState<FormularState, FormData>(action, {});
  const freigebenAction = freigeben.bind(null, id);
  const [freigabeState, freigabeFormAction] = useActionState<FormularState, FormData>(
    freigebenAction,
    {},
  );

  return (
    <div className="mt-5 border-t pt-4">
      {zurueckOffen ? (
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="updatedAt" value={updatedAtWert} />
          <div className="space-y-1.5">
            <Label htmlFor={`notiz-${id}`}>
              {T.maske.freigabeLeiste.notizLabel}
            </Label>
            <Textarea
              id={`notiz-${id}`}
              name="notiz"
              rows={3}
              required
              autoFocus
              placeholder={T.maske.freigabeLeiste.notizPlatzhalter}
              className="w-full"
              aria-invalid={Boolean(state.fehler?.notiz)}
            />
            <p className="text-xs text-muted-foreground">
              {T.maske.freigabeLeiste.notizHinweis(titel)}
            </p>
            {state.fehler?.notiz ? (
              <p role="alert" className="text-sm text-destructive">
                {state.fehler.notiz}
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <ZurueckKnopf />
            <Button
              type="button"
              variant="ghost"
              onClick={() => setZurueckOffen(false)}
            >
              {T.maske.freigabeLeiste.abbrechen}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <form action={freigabeFormAction} className="contents">
            <input type="hidden" name="updatedAt" value={updatedAtWert} />
            <FreigabeKnopf />
          </form>
          {freigabeState.fehler?._ ? (
            <p role="alert" className="text-sm text-destructive">
              {freigabeState.fehler._}
            </p>
          ) : null}

          <Button
            type="button"
            variant="outline"
            onClick={() => setZurueckOffen(true)}
          >
            <Undo2 className="size-4" aria-hidden />
            {T.maske.freigabeLeiste.zurueckweisen}
          </Button>

          <Button
            nativeButton={false}
            variant="ghost"
            render={
              <a href={`/admin/fortbildungen/${id}`}>
                <Pencil className="size-4" aria-hidden />
                {T.maske.freigabeLeiste.erstBearbeiten}
              </a>
            }
          />

          {lehrgangsnummer ? (
            <span className="ml-auto text-xs text-muted-foreground">
              {T.maske.freigabeLeiste.fibsNummerBereits(lehrgangsnummer)}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}

function FreigabeKnopf() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Check className="size-4" aria-hidden />
      {pending ? T.maske.freigabeLeiste.wirdFreigegeben : T.maske.freigabeLeiste.freigeben}
    </Button>
  );
}

function ZurueckKnopf() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending ? T.maske.freigabeLeiste.wirdGesendet : T.maske.freigabeLeiste.zurueckweisen}
    </Button>
  );
}
