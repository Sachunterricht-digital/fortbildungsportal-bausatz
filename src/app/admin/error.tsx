"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Fängt Fehler aus dem gesamten Redaktionsbereich ab — vor allem
 * `requireRole()`, das bei fehlender Berechtigung wirft (siehe
 * `src/lib/auth.ts`). Ohne diese Datei landet eine rollenfremde Admin-Seite
 * bei der generischen 500-Seite von Next statt einer verständlichen Meldung.
 *
 * Die eigentliche Fehlermeldung kommt aus einer Server-Komponente und wird
 * von Next im Produktionsbetrieb bewusst nicht an den Client weitergereicht
 * (nur ein Digest) — die Meldung hier bleibt deshalb allgemein gehalten.
 */
export default function AdminError() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-start gap-3 border bg-card p-6">
      <TriangleAlert className="size-6 text-destructive" aria-hidden />
      <h1 className="text-lg font-semibold tracking-tight">Kein Zugriff</h1>
      <p className="text-sm text-muted-foreground">
        Diese Seite ist entweder für die eigene Rolle nicht verfügbar, oder es
        ist ein technisches Problem aufgetreten.
      </p>
      <Button nativeButton={false} render={<Link href="/admin">Zurück zur Übersicht</Link>} />
    </div>
  );
}
