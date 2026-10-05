import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ExternalLink,
  Globe,
  MapPin,
  Users,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import {
  oeffentlicheFortbildungSelect,
  oeffentlicheFortbildungWhere,
} from "@/lib/queries";
import { formatDatumLang, formatZeitraum } from "@/lib/datetime";
import { terminWarnung } from "@/lib/ferien";
import { hatAktiveFibsAnmeldung } from "@/lib/fibs/status";
import {
  ebeneKlassen,
  formatLabel,
  niveaustufeLabel,
  organisationsformLabel,
  ortAnzeige,
  schulartLabel,
} from "@/constants/fortbildung";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatumsBlock } from "@/components/public/DatumsBlock";
import { Anmeldestatus } from "@/components/public/Anmeldestatus";
import { T } from "@/texte/de";

async function ladeFortbildung(slug: string) {
  return prisma.fortbildung.findFirst({
    where: { AND: [{ slug }, oeffentlicheFortbildungWhere()] },
    select: oeffentlicheFortbildungSelect,
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const fortbildung = await ladeFortbildung(slug);
  if (!fortbildung) return { title: T.aussen.fortbildungDetail.nichtGefunden };

  return {
    title: fortbildung.titel,
    description: `${formatDatumLang(fortbildung.beginn)} · ${ortAnzeige(fortbildung.ortText, fortbildung.veranstaltungsort) ?? T.allgemein.ortNachAbsprache}`,
  };
}

export default async function FortbildungDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const fortbildung = await ladeFortbildung(slug);
  if (!fortbildung) notFound();

  const abgesagt = fortbildung.status === "ABGESAGT";
  const hinweis = terminWarnung(fortbildung.beginn, fortbildung.ende);

  // Kompetenzen nach Bereich gruppieren, damit "KB 3" nicht fünfmal dasteht.
  const bereiche = new Map<string, string[]>();
  for (const { kompetenz } of fortbildung.kompetenzen) {
    const bereich = kompetenz.parentCode ?? kompetenz.code;
    const liste = bereiche.get(bereich) ?? [];
    if (kompetenz.parentCode) liste.push(`${kompetenz.code} ${kompetenz.titel}`);
    bereiche.set(bereich, liste);
  }

  const ebene = ebeneKlassen(fortbildung.organisationsform);
  const fibsAnmeldungAktiv = hatAktiveFibsAnmeldung(fortbildung);
  const teilnahmeSchulintern =
    fortbildung.organisationsform === "SCHILF" && !fibsAnmeldungAktiv;

  return (
    <article className="mx-auto max-w-3xl">
      <Link
        href="/fortbildungen"
        className="mb-8 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {T.aussen.fortbildungDetail.zurUebersicht}
      </Link>

      <header
        className={`flex flex-col gap-4 border-l-4 pl-5 sm:flex-row sm:gap-6 ${ebene.kante}`}
      >
        <DatumsBlock
          datum={fortbildung.beginn}
          organisationsform={fortbildung.organisationsform}
          gross
        />

        <div className="min-w-0 flex-1">
          <div className="mb-2.5 flex flex-wrap items-center gap-2">
            <span className={`etikett px-1.5 py-0.5 ${ebene.flaeche}`}>
              {organisationsformLabel(fortbildung.organisationsform)}
            </span>
            <span className="etikett border px-1.5 py-0.5 text-muted-foreground">
              {formatLabel(fortbildung.format)}
            </span>
            {fortbildung.niveaustufe ? (
              <span className="etikett border px-1.5 py-0.5 text-muted-foreground">
                {niveaustufeLabel(fortbildung.niveaustufe)}
              </span>
            ) : null}
          </div>

          <h1 className="break-words text-3xl leading-[1.05] font-bold tracking-tight text-balance sm:text-4xl">
            {fortbildung.titel}
          </h1>
          {fortbildung.kurztitel ? (
            <p className="mt-2 text-lg text-muted-foreground text-pretty">
              {fortbildung.kurztitel}
            </p>
          ) : null}
        </div>
      </header>

      {abgesagt ? (
        <p className="mt-6 rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {T.aussen.fortbildungDetail.abgesagtHinweis}
        </p>
      ) : null}

      {hinweis && (hinweis.art === "ferien" || hinweis.art === "feiertag") ? (
        <p className="mt-6 rounded-xl bg-ferien-weich px-4 py-3 text-sm text-ferien">
          {hinweis.text}
        </p>
      ) : null}

      <dl className="mt-8 grid gap-5 border-y bg-card px-1 py-6 sm:grid-cols-2">
        <Angabe icon={CalendarDays} label={T.aussen.fortbildungDetail.labelTermin}>
          <span className="zahl">
            {formatZeitraum(fortbildung.beginn, fortbildung.ende)}
          </span>
          {fortbildung.beginn ? (
            <span className="block text-xs text-muted-foreground">
              {formatDatumLang(fortbildung.beginn)}
            </span>
          ) : null}
        </Angabe>

        <Angabe
          icon={fortbildung.veranstaltungsort?.istOnline ? Globe : MapPin}
          label={T.aussen.fortbildungDetail.labelVeranstaltungsort}
        >
          {ortAnzeige(fortbildung.ortText, fortbildung.veranstaltungsort) ?? T.allgemein.ortNachAbsprache}
        </Angabe>

        {fortbildung.maxTn ? (
          <Angabe icon={Users} label={T.aussen.fortbildungDetail.labelPlaetze}>
            <span className="zahl">{T.aussen.fortbildungDetail.plaetzeMaximal(fortbildung.maxTn)}</span> {T.aussen.fortbildungDetail.teilnehmende}
          </Angabe>
        ) : null}

        <Angabe label={T.aussen.fortbildungDetail.labelZielgruppe}>
          {fortbildung.schularten.map(schulartLabel).join(", ")}
          {fortbildung.fach ? (
            <span className="block text-xs">{T.aussen.fortbildungDetail.fach(fortbildung.fach)}</span>
          ) : null}
        </Angabe>
      </dl>

      <div
        className="beschreibung mt-8"
        // Der Inhalt wurde beim Speichern serverseitig auf eine enge
        // Element-Allowlist gefiltert (src/lib/sanitize.ts).
        dangerouslySetInnerHTML={{ __html: fortbildung.beschreibungHtml }}
      />

      {fortbildung.referenten.length > 0 ? (
        <section className="mt-8">
          <h2 className="etikett mb-2 text-muted-foreground">{T.aussen.fortbildungDetail.leitung}</h2>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {fortbildung.referenten.map(({ referent, rolle }) => (
              <li key={referent.id}>
                {/* Die Auswahl der Angebote liefert nur öffentliche Personen, der Steckbrief existiert also. */}
                <Link
                  href={`/referenten/${referent.id}`}
                  className="font-medium text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:decoration-primary"
                >
                  {referent.vorname} {referent.nachname}
                </Link>
                {referent.organisation ? ` · ${referent.organisation}` : ""}
                {rolle ? ` (${rolle})` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {bereiche.size > 0 ? (
        <section className="mt-8">
          <h2 className="etikett mb-2 text-muted-foreground">
            {T.aussen.fortbildungDetail.kompetenzenTitel}
          </h2>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {[...bereiche.entries()]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([bereich, unter]) => (
                <li key={bereich}>
                  <Link
                    href={`/fortbildungen?kb=${bereich}`}
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    {T.aussen.fortbildungDetail.kompetenzbereich(bereich)}
                  </Link>
                  {unter.length > 0 ? <> — {unter.sort().join(", ")}</> : null}
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      {fortbildung.schlagworte.length > 0 ? (
        <section className="mt-8">
          <h2 className="etikett mb-2 text-muted-foreground">{T.aussen.fortbildungDetail.schlagworte}</h2>
          <div className="flex flex-wrap gap-1.5">
            {fortbildung.schlagworte.map(({ schlagwort }) => (
              <Link
                key={schlagwort.id}
                href={`/fortbildungen?schlagwort=${encodeURIComponent(schlagwort.name)}`}
              >
                <Badge variant="secondary">{schlagwort.name}</Badge>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {!abgesagt ? (
        <section className="mt-10 border-t pt-6" aria-labelledby="anmeldung">
          <h2 id="anmeldung" className="etikett mb-3 text-muted-foreground">
            {teilnahmeSchulintern ? T.aussen.fortbildungDetail.teilnahme : T.aussen.fortbildungDetail.anmeldung}
          </h2>
          <Anmeldestatus
            fibsUrl={fortbildung.fibsUrl}
            inFibs={fortbildung.inFibs}
            organisationsform={fortbildung.organisationsform}
          />

          <div className="mt-3 flex flex-wrap items-center gap-3">
            {fibsAnmeldungAktiv && fortbildung.fibsUrl ? (
              <Button nativeButton={false}
                render={<a href={fortbildung.fibsUrl} target="_blank" rel="noopener noreferrer">
                    {T.aussen.fortbildungDetail.zurAnmeldungFibs}
                    <ExternalLink className="size-4" aria-hidden />
                  </a>
                }
              />
            ) : null}

            {fortbildung.beginn ? (
            <Button nativeButton={false}
              variant="outline"
              render={<a href={`/api/ics?slug=${fortbildung.slug}`}>
                  <CalendarPlus className="size-4" aria-hidden />
                  {T.aussen.fortbildungDetail.terminSpeichern}
                </a>
              }
            />
            ) : null}

            {fortbildung.fibsLehrgangsnummer ? (
              <span className="text-sm text-muted-foreground">
                {T.aussen.fortbildungDetail.fibsNummer}{" "}
                <span className="zahl">{fortbildung.fibsLehrgangsnummer}</span>
              </span>
            ) : null}
          </div>
        </section>
      ) : (
        <div className="mt-10 border-t pt-6">
          {fortbildung.beginn ? (
          <Button nativeButton={false}
            variant="outline"
            render={<a href={`/api/ics?slug=${fortbildung.slug}`}>
                <CalendarPlus className="size-4" aria-hidden />
                {T.aussen.fortbildungDetail.terminSpeichern}
              </a>
            }
          />
          ) : null}
        </div>
      )}
    </article>
  );
}

function Angabe({
  icon: Icon,
  label,
  children,
}: {
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      {Icon ? (
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      ) : (
        <span className="w-4 shrink-0" aria-hidden />
      )}
      <div>
        <dt className="etikett text-muted-foreground">{label}</dt>
        <dd className="text-sm">{children}</dd>
      </div>
    </div>
  );
}
