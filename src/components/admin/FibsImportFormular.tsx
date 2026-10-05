"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Download, PlayCircle } from "lucide-react";

import { starteFibsImport, type ImportState } from "@/actions/fibs";
import { formatDatumZeit } from "@/lib/datetime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function FibsImportFormular({
  darfUebernehmen,
}: {
  darfUebernehmen: boolean;
}) {
  const [state, formAction] = useActionState<ImportState, FormData>(
    starteFibsImport,
    {},
  );

  return (
    <div className="space-y-6">
      <form action={formAction} className="border p-5">
        <h2 className="text-sm font-semibold">Import starten</h2>

        {darfUebernehmen ? (
          <label className="mt-4 flex items-start gap-2.5">
            <Checkbox name="uebernehmen" className="mt-0.5" />
            <span className="text-sm">
              Treffer wirklich übernehmen
              <span className="block text-xs text-muted-foreground">
                Ohne Häkchen läuft nur ein Trockenlauf: Die Vorschau zeigt, was
                passieren würde, es wird nichts gespeichert. Übernommene
                Lehrgänge landen als Entwurf und müssen noch veröffentlicht
                werden.
              </span>
            </span>
          </label>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Als Redaktion können Sie einen Trockenlauf starten. Das Übernehmen
            der Treffer ist der Administration vorbehalten.
          </p>
        )}

        <div className="mt-4">
          <StartKnopf />
        </div>
      </form>

      {state.fehler ? (
        <p
          role="alert"
          className="flex items-start gap-2 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.fehler}
        </p>
      ) : null}

      {state.ergebnis && !state.fehler ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-semibold">
              {state.ergebnis.dryRun ? "Vorschau (nichts gespeichert)" : "Ergebnis"}
            </h2>
            <span className="text-sm text-muted-foreground">
              {state.ergebnis.gefunden} gefunden · {state.ergebnis.neu} neu ·{" "}
              {state.ergebnis.aktualisiert} aktualisiert ·{" "}
              {state.ergebnis.uebersprungen} übersprungen
            </span>
          </div>

          {state.ergebnis.zeilen.length === 0 ? (
            <p className="border border-dashed py-10 text-center text-sm text-muted-foreground">
              Keine Treffer.
            </p>
          ) : (
            <div className="overflow-x-auto border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aktion</TableHead>
                    <TableHead>Lehrgangsnummer</TableHead>
                    <TableHead className="min-w-64">Titel</TableHead>
                    <TableHead>Beginn</TableHead>
                    <TableHead>Ort</TableHead>
                    <TableHead>Hinweis</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.ergebnis.zeilen.map((zeile) => (
                    <TableRow key={zeile.lehrgangsnummer}>
                      <TableCell>
                        <Badge
                          variant={
                            zeile.aktion === "neu"
                              ? "default"
                              : zeile.aktion === "aktualisiert"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {zeile.aktion}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        {zeile.lehrgangsnummer}
                      </TableCell>
                      <TableCell>{zeile.titel}</TableCell>
                      <TableCell className="whitespace-nowrap zahl">
                        {zeigeZeitpunkt(zeile.beginn)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {zeile.ort ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {zeile.hinweis ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

/**
 * Zeigt den Beginn einer Vorschauzeile.
 *
 * Bei übersprungenen Treffern steht hier der Rohtext aus FIBS (etwa
 * "Termin wird noch bekanntgegeben") statt eines Datums — genau deshalb wurde
 * die Zeile ja übersprungen. Der Rohtext wird dann unverändert angezeigt.
 */
function zeigeZeitpunkt(wert: string | null): string {
  if (!wert) return "—";

  const datum = new Date(wert);
  return Number.isNaN(datum.getTime()) ? wert : formatDatumZeit(datum);
}

function StartKnopf() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <Download className="size-4 animate-pulse" aria-hidden />
          Suche läuft …
        </>
      ) : (
        <>
          <PlayCircle className="size-4" aria-hidden />
          Import starten
        </>
      )}
    </Button>
  );
}
