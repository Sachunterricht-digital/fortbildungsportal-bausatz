import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { ERFASSER, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { darfFreigeben, formatLabel, organisationsformKurz } from "@/constants/fortbildung";
import { formatDatum } from "@/lib/datetime";
import { ladeFormularDaten } from "@/lib/formularDaten";
import { FortbildungWizard } from "@/components/admin/FortbildungForm/Wizard";
import { HinweisLeiste } from "@/components/admin/HinweisLeiste";
import { T } from "@/texte/de";

export const metadata = { title: T.maske.seiteNeu.metaTitel };

export default async function NeueFortbildungPage() {
  const user = await requireRole(...ERFASSER);
  const daten = await ladeFormularDaten();
  const freigabeberechtigt = darfFreigeben(user.role);
  // Liste zum Durchsehen vor dem Eintragen: nur Eingereichtes und Veröffentlichtes.
  const vorhandene = await prisma.fortbildung.findMany({
    where: { status: { in: ["EINGEREICHT", "VEROEFFENTLICHT"] } },
    orderBy: [{ organisationsform: "asc" }, { titel: "asc" }],
    select: { id: true, titel: true, organisationsform: true, format: true, beginn: true },
  });
  const eigenerReferent =
    user.role === "REFERENT"
      ? await prisma.referent.findUnique({ where: { userId: user.id }, select: { id: true } })
      : null;

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/admin"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {T.maske.seiteNeu.zurueckZurUebersicht}
      </Link>

      <h1 className="mb-1 text-2xl font-semibold tracking-tight">{T.maske.seiteNeu.ueberschrift}</h1>
      <p className="mb-8 max-w-2xl text-sm text-muted-foreground text-pretty">
        {T.maske.seiteNeu.beschreibungBasis}
        {freigabeberechtigt ? "" : T.maske.seiteNeu.beschreibungZusatzReferent}
      </p>

      <div className="mb-8">
        <HinweisLeiste userId={user.id} rolle={user.role} mitProfil={false} />
      </div>

      {vorhandene.length > 0 ? (
        <details className="mb-8 border border-border bg-card px-5 py-4">
          <summary className="cursor-pointer font-semibold">
            {T.maske.seiteNeu.bereitsEingetragen(vorhandene.length)}
          </summary>
          <p className="mt-2 text-sm text-muted-foreground">{T.maske.seiteNeu.bereitsEingetragenHinweis}</p>
          <ul className="mt-3 max-h-80 divide-y divide-border overflow-y-auto text-sm">
            {vorhandene.map((f) => (
              <li key={f.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2">
                <span>{f.titel}</span>
                <span className="text-xs text-muted-foreground">
                  {organisationsformKurz(f.organisationsform)} · {formatLabel(f.format)}
                  {f.beginn ? ` · ${formatDatum(f.beginn)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <FortbildungWizard
        {...daten}
        darfVeroeffentlichen={freigabeberechtigt}
        redaktion={user.role !== "REFERENT"}
        eigeneReferentId={eigenerReferent?.id ?? null}
      />
    </div>
  );
}
