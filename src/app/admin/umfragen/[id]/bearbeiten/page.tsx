import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { UmfrageForm } from "@/components/umfrage/UmfrageForm";
import { isoTage, ladeEmpfaengerOptionen } from "@/lib/umfrageAdmin";
import { T } from "@/texte/de";

export const metadata = { title: T.umfrage.form.titelBearbeiten };

export default async function UmfrageBearbeiten({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("ADMIN");
  const { id } = await params;

  const umfrage = await prisma.umfrage.findUnique({
    where: { id },
    include: {
      termine: { orderBy: { reihenfolge: "asc" } },
      teilnehmer: { select: { referentId: true } },
    },
  });
  if (!umfrage) notFound();

  const personen = await ladeEmpfaengerOptionen();
  const bestehend = umfrage.teilnehmer.map((t) => t.referentId);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/umfragen/${id}`} className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" aria-hidden />
          {umfrage.titel}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{T.umfrage.form.titelBearbeiten}</h1>
      </div>
      <UmfrageForm
        umfrageId={id}
        personen={personen}
        start={{
          titel: umfrage.titel,
          beschreibung: umfrage.beschreibung ?? "",
          ort: umfrage.ort ?? "",
          uhrzeit: umfrage.uhrzeit ?? "",
          termine: isoTage(umfrage.termine),
          empfaenger: bestehend,
          bestehend,
        }}
      />
    </div>
  );
}
