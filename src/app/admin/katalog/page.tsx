import type { Metadata } from "next";
import { FileSpreadsheet, FileText, SearchX } from "lucide-react";

import { ERFASSER, requireRole } from "@/lib/auth";
import { ladeKatalog } from "@/lib/katalog";
import { baueUrl, leseFilter, type SuchParameter } from "@/lib/filter";
import { prisma } from "@/lib/prisma";
import { AdminFilterLeiste } from "@/components/admin/AdminFilterLeiste";
import { KatalogTabelle } from "@/components/admin/KatalogTabelle";
import { Button } from "@/components/ui/button";
import { T } from "@/texte/de";

export const metadata: Metadata = { title: T.zugang.katalog.titel };
export const dynamic = "force-dynamic";

export default async function KatalogSeite({
  searchParams,
}: {
  searchParams: Promise<SuchParameter>;
}) {
  const user = await requireRole(...ERFASSER);
  const params = await searchParams;
  const filter = leseFilter(params);

  const [eintraege, schlagworte] = await Promise.all([
    ladeKatalog(user, filter),
    prisma.schlagwort.findMany({
      // Der Katalog selbst zeigt nie Archiv — die Filteroption soll dann
      // auch keine archivreinen Schlagworte anbieten.
      where: { fortbildungen: { some: { fortbildung: { status: { not: "ARCHIVIERT" } } } } },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
  ]);

  const excel = baueUrl("/api/admin/katalog/export", params, {});
  const pdf = baueUrl("/api/admin/katalog/export/pdf", params, {});

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="etikett text-primary">{T.zugang.katalog.eyebrow}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{T.zugang.katalog.titel}</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {T.zugang.katalog.beschreibung(user.role === "REFERENT")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button nativeButton={false} variant="outline" size="sm" render={<a href={excel}><FileSpreadsheet className="size-3.5" aria-hidden /> Excel</a>} />
          <Button nativeButton={false} variant="outline" size="sm" render={<a href={pdf}><FileText className="size-3.5" aria-hidden /> PDF</a>} />
        </div>
      </div>

      <AdminFilterLeiste
        params={params}
        schlagworte={schlagworte.map((schlagwort) => schlagwort.name)}
        ohne={["status", "fibs"]}
      />

      <p className="text-sm text-muted-foreground">
        {eintraege.length} {eintraege.length === 1 ? "Fortbildung" : "Fortbildungen"} gefunden
      </p>

      {eintraege.length > 0 ? (
        <KatalogTabelle eintraege={eintraege} />
      ) : (
        <div className="border border-l-4 border-l-primary bg-card py-16 text-center">
          <SearchX className="mx-auto mb-3 size-7 text-muted-foreground" aria-hidden />
          <p className="font-medium">Keine passende Fortbildung gefunden.</p>
          <p className="mt-1 text-sm text-muted-foreground">Filter oder Suchbegriff anpassen.</p>
        </div>
      )}
    </div>
  );
}
