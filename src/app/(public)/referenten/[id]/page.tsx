import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ChevronLeft, Info } from "lucide-react";

import { AbrufKarte, TerminKarte } from "@/components/public/AngebotsKarten";
import { FunktionsBadgeEtikett } from "@/components/public/MitgliedKarten";
import { Portraet } from "@/components/public/Portraet";
import { Slider } from "@/components/public/Slider";
import { Badge } from "@/components/ui/badge";
import { profilText } from "@/lib/mitglieder";
import { ladeSteckbrief } from "@/lib/mitgliederDaten";
import { prisma } from "@/lib/prisma";
import { oeffentlicheReferentWhere } from "@/lib/queries";
import { T } from "@/texte/de";

// Die Seite liest bei jedem Aufruf aus der Datenbank.
export const dynamic = "force-dynamic";

const S = T.referenten.steckbrief;
const A = T.aussen.start.angebote;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const person = await prisma.referent.findFirst({
    where: { AND: [{ id }, oeffentlicheReferentWhere()] },
    select: { vorname: true, nachname: true },
  });
  return { title: person ? `${person.vorname} ${person.nachname}` : S.nichtGefunden };
}

/**
 * Steckbrief eines Mitglieds: Porträt, Funktion, Stammschule, Schwerpunkte,
 * Kurzprofil, darunter die Angebote als zwei Slider. Keine Kontaktdaten.
 * Unbekannte, stillgelegte und verborgene Personen gibt es hier nicht (404).
 */
export default async function Steckbrief({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const daten = await ladeSteckbrief(id);
  if (!daten) notFound();

  const { karte, person, termine, abruf } = daten;
  const profil = profilText(person.kurzprofil);

  return (
    <article className="mx-auto max-w-3xl">
      <header className="flex flex-col gap-4 border-l-4 border-marke-gelb pl-5 sm:flex-row sm:gap-6">
        <Portraet
          id={karte.id}
          initialen={karte.initialen}
          fotoVersion={karte.fotoVersion}
          alt={T.referenten.portraetAlt(karte.name)}
          gross
        />
        <div className="min-w-0 flex-1">
          <div className="mb-2.5 flex flex-wrap items-center gap-2">
            <FunktionsBadgeEtikett funktion={karte.funktion} />
          </div>
          <h1 className="text-3xl leading-[1.05] font-bold tracking-tight [overflow-wrap:anywhere] sm:text-4xl">
            {karte.name}
          </h1>
          {karte.schule ? (
            <p className="mt-2 text-lg text-muted-foreground">{S.stammschule(karte.schule)}</p>
          ) : null}
          {karte.schwerpunkte.length > 0 ? (
            <ul className="mt-3.5 flex flex-wrap gap-1.5" aria-label={T.referenten.schwerpunkteAriaLabel}>
              {karte.schwerpunkte.map((s) => (
                <li key={s} className="min-w-0">
                  {/* Im Steckbrief bricht ein langer Schwerpunkt um, auf den Karten wird er gekürzt. */}
                  <Badge
                    variant="secondary"
                    className="h-auto max-w-full py-px text-left whitespace-normal [overflow-wrap:anywhere]"
                  >
                    {s}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </header>

      <div className="mt-8 max-w-[62ch] leading-[1.7]">
        {profil ? (
          <p className="whitespace-pre-line">{profil}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{S.profilLeer}</p>
        )}
      </div>

      <p className="mt-8 flex items-start gap-2.5 border-y border-border bg-card px-1 py-4 text-sm leading-5">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span>
          {S.anfrageVor}{" "}
          <Link href="/#kontakt" className="text-primary underline underline-offset-[3px]">
            {S.anfrageLink}
          </Link>
        </span>
      </p>

      <section className="mt-10 border-t border-border pt-6" aria-labelledby="angebote-reg">
        {termine.length > 0 ? (
          <Slider
            ariaLabel={S.regAriaLabel(karte.name)}
            kopf={<Ueberschrift id="angebote-reg">{A.reiterTermine}</Ueberschrift>}
          >
            {termine.map((f) => (
              <TerminKarte key={f.id} fortbildung={f} />
            ))}
          </Slider>
        ) : (
          <>
            <div className="mb-3.5">
              <Ueberschrift id="angebote-reg">{A.reiterTermine}</Ueberschrift>
            </div>
            <Leer text={S.regLeer} />
          </>
        )}
      </section>

      <section className="mt-8" aria-labelledby="angebote-schilf">
        {abruf.length > 0 ? (
          <Slider
            ariaLabel={S.schilfAriaLabel(karte.name)}
            kopf={<Ueberschrift id="angebote-schilf">{A.reiterSchilf}</Ueberschrift>}
          >
            {abruf.map((f) => (
              <AbrufKarte key={f.id} fortbildung={f} />
            ))}
          </Slider>
        ) : (
          <>
            <div className="mb-3.5">
              <Ueberschrift id="angebote-schilf">{A.reiterSchilf}</Ueberschrift>
            </div>
            <Leer text={S.schilfLeer} />
          </>
        )}
      </section>

      <div className="mt-10 border-t border-border pt-6">
        <Link
          href="/referenten"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {S.zurueck}
        </Link>
      </div>
    </article>
  );
}

function Ueberschrift({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-xl leading-7 font-bold tracking-tight">
      {children}
    </h2>
  );
}

/** Leerzustand einer Gruppe: ein Satz und der Weg zu allen Angeboten. */
function Leer({ text }: { text: string }) {
  return (
    <div className="py-1">
      <p className="text-sm leading-5 text-muted-foreground">{text}</p>
      <Link href="/fortbildungen" className="group mt-3 inline-flex items-center gap-1.5 text-sm text-primary">
        {A.alleFortbildungen}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </div>
  );
}
