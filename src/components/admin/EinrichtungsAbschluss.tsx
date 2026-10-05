"use client";

import { useActionState } from "react";
import { schliesseEinrichtungAb } from "@/actions/einrichtung";
import { Button } from "@/components/ui/button";

export function EinrichtungsAbschluss() {
  const [stand, aktion, laeuft] = useActionState(schliesseEinrichtungAb, {});
  return <form action={aktion} className="space-y-4">
    <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="bestaetigt" required className="mt-1" /><span>Ich habe Schulamtsangaben und Schulverzeichnis geprüft sowie Impressum und Datenschutzerklärung für diese Installation vervollständigt und gespeichert.</span></label>
    {stand.fehler?._ ? <p role="alert" className="text-sm text-destructive">{stand.fehler._}</p> : null}
    <Button type="submit" disabled={laeuft}>{laeuft ? "Wird abgeschlossen …" : "Einrichtung abschließen und Portal verwalten"}</Button>
  </form>;
}
