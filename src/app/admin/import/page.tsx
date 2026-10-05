import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { formatDatumZeit } from "@/lib/datetime";
import { AUSGEGRAUT } from "@/constants/funktionen";
import { Badge } from "@/components/ui/badge";
import { FibsImportFormular } from "@/components/admin/FibsImportFormular";
import { T } from "@/texte/de";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "FIBS-Import" };
export const dynamic = "force-dynamic";

export default async function ImportSeite() {
  const user = await requireRole("ADMIN", "REDAKTEUR");

  if (AUSGEGRAUT.fibsImport) {
    return (
      <div className="max-w-4xl">
        <h1 className="text-2xl font-semibold tracking-tight">FIBS-Import</h1>
        <p className="mt-4 text-sm text-muted-foreground">{T.allgemein.kommtSpaeter}</p>
      </div>
    );
  }

  const [suchbegriffe, laeufe] = await Promise.all([
    prisma.schlagwort.findMany({
      where: { fuerFibsImport: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.fibsImportJob.findMany({
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
  ]);

  const aktiv = process.env.FIBS_IMPORT_ENABLED === "true";

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">FIBS-Import</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sucht in FIBS nach Lehrgängen zu den markierten Schlagworten und legt
          sie als Entwurf an.
        </p>
      </div>

      {!aktiv ? (
        <div className="border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="flex items-start gap-2 font-medium text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            Der Abruf von FIBS ist abgeschaltet.
          </p>
          <p className="mt-2 text-muted-foreground">
            Ein Trockenlauf arbeitet solange mit der mitgelieferten
            Beispieldatei — damit lässt sich die gesamte Kette prüfen, ohne FIBS
            anzufassen. Vor dem Scharfschalten
            (<code className="rounded bg-muted px-1">FIBS_IMPORT_ENABLED=true</code>)
            bitte die Nutzungsbedingungen von FIBS prüfen und, besser noch, bei
            der ALP Dillingen nach einer offiziellen Exportmöglichkeit fragen.
            Automatisiertes Auslesen der Webseite ist rechtlich nicht
            selbstverständlich.
          </p>
        </div>
      ) : null}

      <section className="border p-5">
        <h2 className="text-sm font-semibold">Suchbegriffe</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Gesucht wird mit den Schlagworten, die unter{" "}
          <Link
            href="/admin/schlagworte"
            className="text-foreground underline underline-offset-4"
          >
            Schlagworte
          </Link>{" "}
          für die FIBS-Suche markiert sind.
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {suchbegriffe.length === 0 ? (
            <p className="text-sm text-destructive">
              Kein Schlagwort markiert — der Import würde nichts finden.
            </p>
          ) : (
            suchbegriffe.map((s) => (
              <Badge key={s.id} variant="secondary">
                {s.name}
              </Badge>
            ))
          )}
        </div>
      </section>

      <FibsImportFormular darfUebernehmen={user.role === "ADMIN"} />

      <section>
        <h2 className="mb-3 text-sm font-semibold">Letzte Läufe</h2>

        {laeufe.length === 0 ? (
          <p className="border border-dashed py-10 text-center text-sm text-muted-foreground">
            Noch kein Import durchgeführt.
          </p>
        ) : (
          <div className="overflow-x-auto border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zeitpunkt</TableHead>
                  <TableHead>Art</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Gefunden</TableHead>
                  <TableHead className="text-right">Neu</TableHead>
                  <TableHead className="text-right">Aktualisiert</TableHead>
                  <TableHead className="text-right">Übersprungen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {laeufe.map((lauf) => (
                  <TableRow key={lauf.id}>
                    <TableCell className="whitespace-nowrap zahl">
                      {formatDatumZeit(lauf.startedAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={lauf.dryRun ? "outline" : "secondary"}>
                        {lauf.dryRun ? "Trockenlauf" : "Übernahme"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {lauf.status === "FEHLER" ? (
                        <span
                          className="text-sm text-destructive"
                          title={lauf.fehlermeldung ?? undefined}
                        >
                          Fehler
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {lauf.status === "ERFOLG" ? "erfolgreich" : lauf.status}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right zahl">
                      {lauf.gefunden}
                    </TableCell>
                    <TableCell className="text-right zahl">{lauf.neu}</TableCell>
                    <TableCell className="text-right zahl">
                      {lauf.aktualisiert}
                    </TableCell>
                    <TableCell className="text-right zahl">
                      {lauf.uebersprungen}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
