import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  Download,
  Info,
  LayoutList,
  Mail,
  Search,
  Target,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import {
  fortbildungKachelSelect,
  oeffentlicheFortbildungWhere,
  startAngebotSelect,
  type StartAngebot,
} from "@/lib/queries";
import { berlinIsoDatum, formatDatum, formatMonatJahr, formatZeit } from "@/lib/datetime";
import {
  angebotsEtikett,
  organisationsformKurz,
  ortFuerKarte,
  schulartLabel,
} from "@/constants/fortbildung";
import { Monatskalender } from "@/components/public/Monatskalender";
import { MitgliedKarteKlein } from "@/components/public/MitgliedKarten";
import { Slider } from "@/components/public/Slider";
import { ladeMitglieder } from "@/lib/mitgliederDaten";
import {
  StartAngebote,
  type StartAngebotKarte,
  type StartAnsicht,
  type StartTermin,
} from "@/components/public/StartAngebote";
import { T } from "@/texte/de";

// Die Seite liest bei jedem Aufruf aus der Datenbank. Ohne diese Zeile
// würde Next die Inhalte beim Bauen einfrieren.
export const dynamic = "force-dynamic";

const V = T.vorstellung;

/**
 * Startseite als Heftseite: links eine schmale Randspalte mit Stichwort und
 * Kurznotiz, rechts der Inhalt, dazwischen eine durchgehende Linie.
 * Bilder: KI-generiert, Quelle in design/banner/HERKUNFT.txt.
 */
export default async function Startseite({
  searchParams,
}: {
  searchParams: Promise<{ ansicht?: string | string[] }>;
}) {
  const { ansicht: ansichtParam } = await searchParams;
  const roh = Array.isArray(ansichtParam) ? ansichtParam[0] : ansichtParam;
  const ansicht: StartAnsicht = roh === "termine" || roh === "kalender" ? roh : "schilf";

  const jetzt = new Date();
  const kommend = { AND: [oeffentlicheFortbildungWhere(), { ende: { gte: jetzt } }] };

  const [naechste, anzahlKommend, abruf, mitglieder] = await Promise.all([
    prisma.fortbildung.findMany({
      where: kommend,
      orderBy: { beginn: "asc" },
      take: 8,
      select: fortbildungKachelSelect,
    }),
    prisma.fortbildung.count({ where: kommend }),
    // Angebote ohne Termin: SchiLf, Micro-SchiLf, Video-Tutorials auf Abruf.
    prisma.fortbildung.findMany({
      where: { AND: [oeffentlicheFortbildungWhere(), { beginn: null, status: { not: "ABGESAGT" } }] },
      orderBy: { titel: "asc" },
      select: startAngebotSelect,
    }),
    ladeMitglieder(),
  ]);

  // Kalender: der Monat des nächsten Termins, sonst der laufende Monat.
  const [kJahr, kMonat] = berlinIsoDatum(naechste[0]?.beginn ?? jetzt).split("-").map(Number) as [number, number];
  const kIndex = kMonat - 1;
  const monatsTermine = await prisma.fortbildung.findMany({
    where: {
      AND: [
        oeffentlicheFortbildungWhere(),
        { beginn: { lte: new Date(Date.UTC(kJahr, kIndex + 1, 10)) } },
        { ende: { gte: new Date(Date.UTC(kJahr, kIndex - 1, 20)) } },
      ],
    },
    orderBy: { beginn: "asc" },
    select: fortbildungKachelSelect,
  });
  const monatsSchluessel = `${kJahr}-${String(kMonat).padStart(2, "0")}`;

  const angebote = abruf.map(zuKarte);
  const termine: StartTermin[] = naechste.map((f) => ({
    id: f.id,
    slug: f.slug,
    titel: f.titel,
    datum: formatDatum(f.beginn),
    zeit: f.beginn && f.ende ? `${formatZeit(f.beginn)}–${formatZeit(f.ende)}` : null,
    badge: organisationsformKurz(f.organisationsform),
    ort: ortFuerKarte(f),
  }));
  const formate = [V.formate.rlfb, V.formate.schilf, V.formate.micro, V.formate.online, V.formate.video];

  return (
    <div className="grid gap-y-14 lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-x-10 lg:gap-y-20">
      {/* Kopf */}
      <Rand sichtbar>
        {/* eslint-disable-next-line @next/next/no-img-element -- statische Datei, keine Optimierung nötig */}
        <img src="/bilder/bdb-logo.svg" alt={V.start.logoAlt} className="w-[5.5rem] lg:ml-auto lg:w-[7.7rem]" />
      </Rand>
      <Inhalt>
        <figure className="mb-5 w-full max-w-sm sm:max-w-md">
          {/* eslint-disable-next-line @next/next/no-img-element -- Illustration, feste Größe */}
          <img src="/bilder/banner-landkreis.webp" alt="" width={1536} height={512} className="block h-auto w-full" />
        </figure>
        <h1 className="max-w-[20ch] text-4xl leading-[1.06] font-bold tracking-[-0.03em] text-primary text-balance sm:text-5xl">
          {V.start.motto}
        </h1>
        <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-foreground/80">{V.start.begruessungText}</p>

        {/* Einfaches GET-Formular: funktioniert auch ohne JavaScript. */}
        <form action="/fortbildungen" className="mt-8 flex max-w-xl flex-col gap-2 sm:flex-row sm:gap-0">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              name="q"
              placeholder={T.aussen.start.suchPlatzhalter}
              aria-label={T.aussen.start.suchAriaLabel}
              className="h-12 w-full rounded-md border border-input bg-card pr-4 pl-10 text-base outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring sm:rounded-r-none"
            />
          </div>
          <button
            type="submit"
            className="h-12 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:rounded-l-none"
          >
            {T.aussen.start.suchButton}
          </button>
        </form>
      </Inhalt>

      {/* Angebote: SchiLf, regionale Fortbildungen, Kalender */}
      <Rand icon={CalendarDays} />
      <Inhalt>
        <StartAngebote
          start={ansicht}
          angebote={angebote}
          termine={termine}
          anzahlKommend={anzahlKommend}
          kalender={
            <>
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="text-xl font-semibold tracking-tight">
                  {formatMonatJahr(new Date(Date.UTC(kJahr, kIndex, 15)))}
                </h2>
                <Link href={`/kalender?monat=${monatsSchluessel}`} className="text-sm text-primary underline-offset-4 hover:underline">
                  {T.aussen.start.kalenderansicht}
                </Link>
              </div>
              <Monatskalender jahr={kJahr} monatsIndex={kIndex} fortbildungen={monatsTermine} />
            </>
          }
        />
      </Inhalt>

      {/* Wer wir sind: direkt unter den Angeboten, mit den Mitgliedern */}
      <Rand icon={Info} />
      <Inhalt>
        <div className="max-w-[64ch]">
          <h3 className="mb-1.5 font-semibold">{V.start.werWirSindTitel}</h3>
          <p className="text-muted-foreground">{V.start.werWirSindText}</p>
        </div>
        {mitglieder.length > 0 ? (
          <Slider
            className="mt-6"
            ariaLabel={T.referenten.slider.ariaLabel}
            fuss={
              <Link href="/referenten" className="group inline-flex items-center gap-1.5 text-sm text-primary">
                {T.referenten.slider.alleMitglieder}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            }
          >
            {mitglieder.map((m) => (
              <MitgliedKarteKlein key={m.id} mitglied={m} />
            ))}
          </Slider>
        ) : null}
      </Inhalt>

      {/* Formate */}
      <Rand icon={LayoutList}>
        <p className="font-semibold text-primary">{V.formate.uebersichtLabel}</p>
        {formate.map((t) => (
          <p key={t}>{t.split(":")[0]}</p>
        ))}
      </Rand>
      <Inhalt>
        <h2 className="mb-5 text-2xl font-semibold tracking-tight">{V.formate.titel}</h2>
        <dl className="divide-y divide-border">
          <Format text={V.formate.rlfb} weg={V.start.wegRlfb} />
          <Format text={V.formate.schilf} weg={V.start.wegSchilf} />
          <Format text={V.formate.micro} />
          <Format text={V.formate.online} />
          <Format text={V.formate.video} />
        </dl>
        <p className="mt-5 text-sm text-muted-foreground">{V.formate.individuell}</p>
      </Inhalt>

      {/* Kataloge: Platzhalter, bis die PDFs vorliegen */}
      <Rand icon={Download} />
      <Inhalt>
        <h2 className="mb-5 text-2xl font-semibold tracking-tight">{V.kataloge.titel}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <KatalogKarte titel={V.kataloge.fortbildungskatalog} />
          <KatalogKarte titel={V.kataloge.schilfKatalog} />
        </div>
      </Inhalt>

      {/* DigCompEdu, Kontakt */}
      <Rand icon={Target} />
      <Inhalt schmal>
        <h3 className="mb-1.5 font-semibold">{V.digcomp.titel}</h3>
        <p className="text-muted-foreground">{V.digcomp.text}</p>
      </Inhalt>

      <Rand icon={Mail} />
      <Inhalt id="kontakt">
        <div className="flex items-end justify-between gap-6">
          <div className="max-w-[60ch]">
            <h3 className="mb-1.5 font-semibold">{V.kontakt.titel}</h3>
            <p className="text-muted-foreground">{V.kontakt.text}</p>
            <p className="mt-2 inline-flex max-w-full items-center gap-2 font-medium text-primary select-all">
              <Mail className="size-4 shrink-0" aria-hidden />
              <a href={`mailto:${V.kontakt.mail}`} className="min-w-0 [overflow-wrap:anywhere] underline-offset-4 hover:underline">
                {V.kontakt.mail}
              </a>
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- kleine Figur nach dem Flyer 25/26 */}
          <img src="/bilder/figur-laptop.webp" alt="" width={536} height={420} className="hidden w-56 shrink-0 sm:block lg:w-64" />
        </div>
      </Inhalt>

      <Rand icon={CalendarPlus} />
      <Inhalt>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-[60ch]">
            <strong className="font-semibold">{T.aussen.start.kalenderAboFett}</strong> {T.aussen.start.kalenderAboText}
          </p>
          <a
            href="/api/ics"
            className="shrink-0 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {T.aussen.start.kalenderAboButton}
          </a>
        </div>
      </Inhalt>
    </div>
  );
}

/** Karte für den Reiter „SchiLf“: nur vorformatierte Texte, damit nichts Rohes zum Client geht. */
function zuKarte(f: StartAngebot): StartAngebotKarte {
  const bereiche = new Set<string>();
  for (const { kompetenz } of f.kompetenzen) {
    bereiche.add(kompetenz.parent?.titel ?? kompetenz.titel);
  }
  return {
    id: f.id,
    slug: f.slug,
    titel: f.titel,
    badge: angebotsEtikett(f),
    referenten: f.referenten
      .slice(0, 2)
      .map(({ referent: r }) => [`${r.vorname} ${r.nachname}`, r.organisation].filter(Boolean).join(", ")),
    schularten: f.schularten.map(schulartLabel).join(" · "),
    digCompEdu: bereiche.size > 0 ? [...bereiche].join(", ") : null,
  };
}

/** Linke Randspalte: kleines Icon, darunter Stichwort und Kurznotiz. Am Handy nur, wenn `sichtbar`. */
function Rand({
  icon: Icon,
  sichtbar = false,
  children,
}: {
  icon?: React.ElementType;
  sichtbar?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`${sichtbar ? "block" : "hidden lg:block"} text-xs leading-relaxed text-muted-foreground lg:text-right`}>
      {Icon ? <Icon className="mb-1.5 ml-auto size-4 text-primary/70" strokeWidth={1.5} aria-hidden /> : null}
      {children}
    </div>
  );
}

/** Rechte Inhaltsspalte mit der durchgehenden Randlinie. */
function Inhalt({ children, schmal = false, id }: { children: React.ReactNode; schmal?: boolean; id?: string }) {
  return (
    <div id={id} className={`min-w-0 lg:-ml-5 lg:border-l lg:border-primary/50 lg:pl-10 ${schmal ? "max-w-[64ch]" : ""} ${id ? "scroll-mt-20" : ""}`}>
      {children}
    </div>
  );
}

/** Ausgegraute Download-Karte, solange die Katalog-PDFs noch fehlen. */
function KatalogKarte({ titel }: { titel: string }) {
  return (
    <div
      aria-disabled="true"
      title={T.allgemein.kommtSpaeterTitel}
      className="flex cursor-not-allowed items-center gap-3 rounded-md border border-dashed border-border px-4 py-3.5 text-muted-foreground/50"
    >
      <Download className="size-5 shrink-0" aria-hidden />
      <span>
        <span className="block font-semibold">{titel}</span>
        <span className="block text-sm">{V.kataloge.downloadFolgt}</span>
      </span>
    </div>
  );
}

/** "RLFB (regionale Fortbildung): mit festem Termin …" → Name fett, Rest darunter. */
function Format({ text, weg }: { text: string; weg?: string }) {
  const trenner = text.indexOf(":");
  const name = trenner > 0 ? text.slice(0, trenner) : text;
  const rest = trenner > 0 ? text.slice(trenner + 1).trim() : "";
  return (
    <div className="py-4 first:pt-0">
      <dt className="font-semibold text-foreground">{name}</dt>
      <dd className="mt-1 text-sm leading-relaxed text-foreground/80">
        {rest.charAt(0).toUpperCase() + rest.slice(1)}
        {weg ? <span className="mt-1 block text-primary">{weg}</span> : null}
      </dd>
    </div>
  );
}
