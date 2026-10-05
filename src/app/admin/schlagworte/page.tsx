import { Lock, Trash2 } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { entferneSchlagwort } from "@/actions/stammdaten";
import { SchlagwortFormular } from "@/components/admin/SchlagwortFormular";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Schlagworte" };

export default async function SchlagwortePage() {
  const user = await requireRole("ADMIN", "REDAKTEUR");

  const gefunden = await prisma.schlagwort.findMany({
    orderBy: [{ istPflicht: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      istPflicht: true,
      // Nur laufende Themen zählen, das Archiv der Vorjahre gehört nicht in
      // diese Übersicht (gleiches Muster wie /admin/referenten).
      fortbildungen: {
        where: { fortbildung: { status: { not: "ARCHIVIERT" } } },
        select: { fortbildungId: true },
      },
    },
  });

  const schlagworte = gefunden.map(({ fortbildungen, ...rest }) => ({
    ...rest,
    aktuelleThemen: fortbildungen.length,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Schlagworte</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Pflicht-Schlagworte werden an jede Fortbildung automatisch angehängt
          und lassen sich weder abwählen noch löschen.
        </p>
      </div>

      <SchlagwortFormular />

      <div className="overflow-x-auto border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-56">Schlagwort</TableHead>
              <TableHead className="text-right">Verwendet in</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {schlagworte.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">
                  {s.name}
                  {s.istPflicht ? (
                    <Badge variant="secondary" className="ml-2">
                      <Lock className="size-3" aria-hidden />
                      Pflicht
                    </Badge>
                  ) : null}
                </TableCell>

                <TableCell className="text-right zahl">
                  {s.aktuelleThemen}
                </TableCell>

                <TableCell>
                  {user.role === "ADMIN" && !s.istPflicht ? (
                    <form action={entferneSchlagwort.bind(null, s.id)}>
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Schlagwort ${s.name} löschen`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </form>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
