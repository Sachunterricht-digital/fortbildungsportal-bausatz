import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CheckCircle2,
  ChevronLeft,
  Copy,
  ExternalLink,
  History,
  Printer,
  Undo2,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { ERFASSER, fortbildungScope, requireRole } from "@/lib/auth";
import { ladeFormularDaten } from "@/lib/formularDaten";
import { duplizieren } from "@/actions/fortbildung";
import { FortbildungForm } from "@/components/admin/FortbildungForm";
import { LoeschenKnopf } from "@/components/admin/LoeschenKnopf";
import { Button } from "@/components/ui/button";
import {
  STATUS_OEFFENTLICH,
  STATUS_REFERENT_BEARBEITBAR,
  darfFreigeben,
  type FortbildungStatus,
} from "@/constants/fortbildung";
import { AUSGEGRAUT } from "@/constants/funktionen";
import { formatDatumZeit } from "@/lib/datetime";
import { FibsKennzeichen, StatusKennzeichen } from "@/components/admin/Kennzeichen";
import { FibsSchalter } from "@/components/admin/FibsSchalter";
import { FreigabeLeiste } from "@/components/admin/FreigabeLeiste";
import { Aenderungsverlauf } from "@/components/admin/Aenderungsverlauf";
import { T } from "@/texte/de";

export const metadata = { title: T.maske.seiteBearbeiten.metaTitel };

export default async function FortbildungBearbeitenPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ gespeichert?: string; fehlt?: string; tab?: string }>;
}) {
  const user = await requireRole(...ERFASSER);
  const { id } = await params;
  const { gespeichert, fehlt, tab } = await searchParams;

  const [fortbildung, daten] = await Promise.all([
    prisma.fortbildung.findFirst({
      // Referentinnen und Referenten dürfen nur eigene bzw. ihnen
      // zugeordnete Fortbildungen öffnen. Die Seitenprüfung ist zusätzlich
      // zu den Berechtigungsprüfungen in den Server Actions nötig.
      where: { AND: [{ id }, fortbildungScope(user)] },
      include: {
        schlagworte: { include: { schlagwort: { select: { name: true, istPflicht: true } } } },
        kompetenzen: { select: { kompetenzCode: true } },
        referenten: { select: { referentId: true } },
        fibsEingetragenVon: { select: { name: true, email: true } },
        freigegebenVon: { select: { name: true, email: true } },
      },
    }),
    ladeFormularDaten(),
  ]);

  if (!fortbildung) notFound();

  const istOeffentlich = STATUS_OEFFENTLICH.includes(
    fortbildung.status as FortbildungStatus,
  );
  const freigabeberechtigt = darfFreigeben(user.role);
  const darfInhaltBearbeiten =
    freigabeberechtigt ||
    STATUS_REFERENT_BEARBEITBAR.includes(fortbildung.status as never);

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/admin"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {T.maske.seiteBearbeiten.zurueckZurUebersicht}
      </Link>

      {gespeichert ? (
        <p className="mb-6 flex items-center gap-2 bg-primary/10 px-4 py-3 text-sm text-primary">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          {T.maske.seiteBearbeiten.gespeichertHinweis}
        </p>
      ) : null}

      {fehlt === "redaktion" ? (
        <p role="alert" className="mb-6 bg-ferien-weich px-4 py-3 text-sm text-ferien">
          {T.maske.seiteBearbeiten.fehltRedaktionHinweis}
        </p>
      ) : null}

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {T.maske.seiteBearbeiten.ueberschrift}
          </h1>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusKennzeichen status={fortbildung.status} />
            <FibsKennzeichen
              inFibs={fortbildung.inFibs}
              lehrgangsnummer={fortbildung.fibsLehrgangsnummer}
              organisationsform={fortbildung.organisationsform}
            />
          </div>

          <p className="mt-2 text-sm text-muted-foreground">
            {fortbildung.quelle === "FIBS_IMPORT"
              ? T.maske.seiteBearbeiten.quelleFibsImport
              : T.maske.seiteBearbeiten.quelleManuell}
            {fortbildung.freigegebenAm
              ? T.maske.seiteBearbeiten.freigegebenSuffix(
                  formatDatumZeit(fortbildung.freigegebenAm),
                  fortbildung.freigegebenVon
                    ? (fortbildung.freigegebenVon.name ?? fortbildung.freigegebenVon.email)
                    : null,
                )
              : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {istOeffentlich ? (
            <Button nativeButton={false}
              variant="outline"
              size="sm"
              render={<Link href={`/fortbildungen/${fortbildung.slug}`} target="_blank">
                  <ExternalLink className="size-3.5" aria-hidden />
                  {T.maske.seiteBearbeiten.imFrontendAnsehen}
                </Link>
              }
            />
          ) : null}

          {!AUSGEGRAUT.aushang ? (
            <Button
              nativeButton={false}
              variant="outline"
              size="sm"
              title={T.maske.seiteBearbeiten.aushangTitle}
              render={
                <a
                  href={`/api/admin/fortbildungen/${fortbildung.id}/aushang`}
                  target="_blank"
                >
                  <Printer className="size-3.5" aria-hidden />
                  {T.maske.seiteBearbeiten.aushang}
                </a>
              }
            />
          ) : null}

          <form action={duplizieren.bind(null, fortbildung.id)}>
            <Button type="submit" variant="outline" size="sm">
              <Copy className="size-3.5" aria-hidden />
              {T.maske.seiteBearbeiten.duplizieren}
            </Button>
          </form>

          {user.role === "ADMIN" ? (
            <LoeschenKnopf id={fortbildung.id} titel={fortbildung.titel} />
          ) : null}
        </div>
      </div>

      {fortbildung.freigabeNotiz ? (
        <div className="mb-6 bg-ferien-weich px-4 py-3 text-sm text-ferien">
          <p className="flex items-start gap-2 font-medium">
            <Undo2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            {T.maske.seiteBearbeiten.zurueckgewiesenTitel}
          </p>
          <p className="mt-1 pl-6 text-pretty">{fortbildung.freigabeNotiz}</p>
        </div>
      ) : null}

      {!freigabeberechtigt && fortbildung.status === "VEROEFFENTLICHT" ? (
        <p className="mb-6 border-l-4 border-primary bg-primary/5 px-4 py-3 text-sm text-pretty">
          {T.maske.seiteBearbeiten.veroeffentlichtHinweisReferent}
        </p>
      ) : null}

      {freigabeberechtigt && fortbildung.status === "EINGEREICHT" ? (
        <div className="mb-6 border bg-card p-5">
          <p className="text-sm font-medium">{T.maske.seiteBearbeiten.eingereichtTitel}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {fortbildung.eingereichtAm
              ? T.maske.seiteBearbeiten.eingereichtAmText(formatDatumZeit(fortbildung.eingereichtAm))
              : ""}{" "}
            {T.maske.seiteBearbeiten.nachDerFreigabeHinweis}
          </p>
          <FreigabeLeiste
            id={fortbildung.id}
            titel={fortbildung.titel}
            lehrgangsnummer={fortbildung.fibsLehrgangsnummer}
            updatedAt={fortbildung.updatedAt}
          />
        </div>
      ) : null}

      {freigabeberechtigt ? (
        <div className="mb-6">
          <FibsSchalter
            id={fortbildung.id}
            inFibs={fortbildung.inFibs}
            lehrgangsnummer={fortbildung.fibsLehrgangsnummer}
            organisationsform={fortbildung.organisationsform}
            eingetragenAm={fortbildung.fibsEingetragenAm}
            eingetragenVon={
              fortbildung.fibsEingetragenVon?.name ??
              fortbildung.fibsEingetragenVon?.email ??
              null
            }
          />
        </div>
      ) : null}

      {darfInhaltBearbeiten ? (
        <FortbildungForm
          {...daten}
          darfVeroeffentlichen={freigabeberechtigt}
          redaktion={user.role !== "REFERENT"}
          startTab={fehlt === "redaktion" ? "digcomp" : tab}
          fortbildung={{
          id: fortbildung.id,
          titel: fortbildung.titel,
          kurztitel: fortbildung.kurztitel,
          beschreibungHtml: fortbildung.beschreibungHtml,
          organisationsform: fortbildung.organisationsform,
          maxTn: fortbildung.maxTn,
          format: fortbildung.format,
          beginn: fortbildung.beginn,
          ende: fortbildung.ende,
          ortText: fortbildung.ortText,
          schularten: fortbildung.schularten,
          fach: fortbildung.fach,
          niveaustufe: fortbildung.niveaustufe,
          fibsLehrgangsnummer: fortbildung.fibsLehrgangsnummer,
          fibsUrl: fortbildung.fibsUrl,
          status: fortbildung.status,
          kompetenzCodes: fortbildung.kompetenzen.map((k) => k.kompetenzCode),
          // Pflicht-Schlagworte zeigt das Formular selbst an, sie kommen nicht
          // in die frei bearbeitbare Liste.
          schlagwortNamen: fortbildung.schlagworte
            .filter((s) => !s.schlagwort.istPflicht)
            .map((s) => s.schlagwort.name),
          referentIds: fortbildung.referenten.map((r) => r.referentId),
          updatedAt: fortbildung.updatedAt,
          }}
        />
      ) : (
        <div className="border-l-4 border-primary bg-primary/5 px-5 py-4">
          <p className="font-medium">{T.maske.seiteBearbeiten.freigegebenTitel}</p>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {T.maske.seiteBearbeiten.freigegebenHinweis}
          </p>
          {!AUSGEGRAUT.nachbereitung ? (
            <Button
              className="mt-4"
              nativeButton={false}
              variant="outline"
              render={<Link href="/admin/nachbereitung">{T.maske.seiteBearbeiten.zurNachbereitung}</Link>}
            />
          ) : null}
        </div>
      )}

      <section className="mt-12 border-t pt-6">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <History className="size-4 text-muted-foreground" aria-hidden />
          {T.maske.seiteBearbeiten.aenderungsverlauf}
        </h2>
        <Aenderungsverlauf id={fortbildung.id} />
      </section>
    </div>
  );
}
