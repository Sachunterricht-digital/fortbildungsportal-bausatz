import Link from "next/link";
import { Plus } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { formatDatum } from "@/lib/datetime";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { T } from "@/texte/de";

export const metadata = { title: T.umfrage.liste.titel };

export default async function UmfragenListe() {
  await requireRole("ADMIN");
  const TL = T.umfrage.liste;

  const umfragen = await prisma.umfrage.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      titel: true,
      status: true,
      createdAt: true,
      _count: { select: { termine: true, teilnehmer: true } },
      teilnehmer: { where: { geantwortetAm: { not: null } }, select: { id: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{TL.titel}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{TL.beschreibung}</p>
        </div>
        <Link href="/admin/umfragen/neu" className={cn(buttonVariants())}>
          <Plus className="size-4" aria-hidden />
          {TL.neu}
        </Link>
      </div>

      {umfragen.length === 0 ? (
        <p className="text-sm text-muted-foreground">{TL.leer}</p>
      ) : (
        <div className="overflow-x-auto border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">{TL.spalteTitel}</th>
                <th className="px-3 py-2.5 font-medium">{TL.spalteStatus}</th>
                <th className="px-3 py-2.5 font-medium">{TL.spalteAntworten}</th>
                <th className="px-3 py-2.5 font-medium">{TL.spalteTermine}</th>
                <th className="px-3 py-2.5 font-medium">{TL.spalteAngelegt}</th>
              </tr>
            </thead>
            <tbody>
              {umfragen.map((u) => (
                <tr key={u.id} className="border-b border-border/70 last:border-b-0">
                  <td className="px-3 py-2.5">
                    <Link href={`/admin/umfragen/${u.id}`} className="font-medium text-primary underline-offset-4 hover:underline">
                      {u.titel}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "inline-block rounded-full px-2 py-0.5 text-xs",
                        u.status === "OFFEN" ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {T.umfrage.status[u.status as "OFFEN" | "GESCHLOSSEN"] ?? u.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-mono">{TL.quote(u.teilnehmer.length, u._count.teilnehmer)}</td>
                  <td className="px-3 py-2.5 font-mono">{u._count.termine}</td>
                  <td className="px-3 py-2.5">{formatDatum(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
