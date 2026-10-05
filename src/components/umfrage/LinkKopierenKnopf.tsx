"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { T } from "@/texte/de";

/**
 * Kopiert den persönlichen Link in die Zwischenablage. Ist sie gesperrt (etwa
 * ohne HTTPS), erscheint stattdessen ein Feld zum Markieren und Kopieren.
 */
export function LinkKopierenKnopf({ link, name }: { link: string; name: string }) {
  const [status, setStatus] = useState<"bereit" | "kopiert" | "manuell">("bereit");

  async function kopieren() {
    try {
      await navigator.clipboard.writeText(link);
      setStatus("kopiert");
      setTimeout(() => setStatus("bereit"), 2500);
    } catch {
      setStatus("manuell");
    }
  }

  if (status === "manuell") {
    return (
      <input
        readOnly
        value={link}
        aria-label={T.umfrage.detail.linkAnzeigen}
        onFocus={(e) => e.currentTarget.select()}
        className="h-7 w-56 rounded-md border border-input bg-transparent px-2 font-mono text-xs"
      />
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={T.umfrage.detail.linkKopierenFuer(name)}
      data-link={link}
      onClick={kopieren}
    >
      {status === "kopiert" ? (
        <Check className="size-3.5" aria-hidden />
      ) : (
        <Link2 className="size-3.5" aria-hidden />
      )}
      {status === "kopiert" ? T.umfrage.detail.linkKopiert : T.umfrage.detail.linkKopieren}
    </Button>
  );
}
