import type { Metadata } from "next";
import { AlertCircle, CalendarCheck, Clock, MapPin } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { ladeTeilnehmerZuToken } from "@/lib/umfrageToken";
import { aktuellesSchuljahr, formatKalendertagKurz, schuljahrZeitraum } from "@/lib/datetime";
import {
  UmfrageMatrix,
  type MatrixTermin,
  type MatrixZeile,
} from "@/components/umfrage/UmfrageMatrix";
import { UmfrageAntwortFormular } from "@/components/umfrage/UmfrageAntwortFormular";
import { OnboardingFormular } from "@/components/umfrage/OnboardingFormular";
import { OnboardingPortal } from "@/components/umfrage/OnboardingPortal";
import { OnboardingProfilKnopf } from "@/components/umfrage/OnboardingProfilKnopf";
import { T } from "@/texte/de";

const TX = T.umfrage.oeffentlich;
const TO = T.onboarding;

export const metadata: Metadata = {
  title: TX.seitenTitel,
  // Der Link ist persönlich: nicht indexieren und den Pfad nicht als Referrer weitergeben.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const dynamic = "force-dynamic";

export default async function UmfrageSeite({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const teilnehmer = await ladeTeilnehmerZuToken(token);

  if (!teilnehmer || !teilnehmer.referent.aktiv) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm text-center">
          <AlertCircle className="mx-auto mb-4 size-7 text-muted-foreground" aria-hidden />
          <h1 className="text-xl font-semibold tracking-tight">{TX.ungueltigTitel}</h1>
          <p className="mt-2 text-sm text-muted-foreground text-pretty">{TX.ungueltigText}</p>
        </div>
      </main>
    );
  }

  const { umfrage } = teilnehmer;
  const offen = umfrage.status === "OFFEN";

  // Öffentlich erscheinen nur Personen, die geantwortet haben, und nur mit
  // Namen. Keine Mail, keine Schule, keine Offenen.
  const antworten = await prisma.umfrageTeilnehmer.findMany({
    where: { umfrageId: umfrage.id, geantwortetAm: { not: null } },
    select: {
      id: true,
      kommentar: true,
      geantwortetAm: true,
      referent: { select: { vorname: true, nachname: true } },
      antworten: { select: { terminId: true, wert: true } },
    },
  });
  antworten.sort(
    (a, b) =>
      Number(b.id === teilnehmer.id) - Number(a.id === teilnehmer.id) ||
      a.referent.nachname.localeCompare(b.referent.nachname, "de") ||
      a.referent.vorname.localeCompare(b.referent.vorname, "de"),
  );

  const termine: MatrixTermin[] = umfrage.termine.map((t) => ({
    id: t.id,
    label: formatKalendertagKurz(t.datum),
    festgelegt: t.id === umfrage.festgelegterTerminId,
  }));
  const zeilen: MatrixZeile[] = antworten.map((a) => ({
    id: a.id,
    name: `${a.referent.vorname} ${a.referent.nachname}`,
    eigene: a.id === teilnehmer.id,
    kommentar: a.kommentar,
    werte: Object.fromEntries(a.antworten.map((w) => [w.terminId, w.wert])),
  }));

  // Onboarding: nur die eigene Zeile und die eigene Nummer werden geladen
  // (Person aus dem Token), Angaben anderer Personen gelangen nie in diese Seite.
  const [onboarding, eigenesTelefon] = offen
    ? await Promise.all([
        prisma.referentOnboarding.findUnique({
          where: { referentId: teilnehmer.referent.id },
          select: {
            kontaktwege: true,
            weitereFormate: true,
            zeiten: true,
            bemerkung: true,
          },
        }),
        prisma.referent.findUnique({
          where: { id: teilnehmer.referent.id },
          select: { telefon: true },
        }),
      ])
    : [null, null];

  const festgelegt = termine.find((t) => t.festgelegt);
  const vorname = teilnehmer.referent.vorname.trim() || teilnehmer.referent.nachname;

  // Profil-Anstoß nach dem Speichern, nur für Personen mit richtigem Konto.
  const user = teilnehmer.referent.user;
  const hatZugang = Boolean(user?.passwordHash && user.isActive);
  const fehlt: string[] = [];
  if (hatZugang) {
    if (!teilnehmer.referent.portraetAm) fehlt.push(TX.danke.fehltFoto);
    if (!teilnehmer.referent.kurzprofil?.trim()) fehlt.push(TX.danke.fehltKurzprofil);
    const { start } = schuljahrZeitraum(aktuellesSchuljahr());
    const eingereicht = await prisma.fortbildung.count({
      where: {
        eingereichtAm: { gte: start },
        OR: [
          { referenten: { some: { referentId: teilnehmer.referent.id } } },
          ...(user ? [{ createdById: user.id }] : []),
        ],
      },
    });
    if (eingereicht === 0) fehlt.push(TX.danke.fehltThema);
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8 sm:py-12">
      <header className="space-y-3">
        <p className="font-heading text-sm font-bold tracking-tight text-primary">
          {T.aussen.layout.marke}
        </p>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-balance sm:text-3xl">
          {umfrage.titel}
        </h1>
        {umfrage.ort || umfrage.uhrzeit ? (
          <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {umfrage.ort ? (
              <li className="flex items-center gap-1.5">
                <MapPin className="size-4 text-muted-foreground" aria-hidden />
                <span className="sr-only">{TX.ort}:</span>
                {umfrage.ort}
              </li>
            ) : null}
            {umfrage.uhrzeit ? (
              <li className="flex items-center gap-1.5">
                <Clock className="size-4 text-muted-foreground" aria-hidden />
                <span className="sr-only">{TX.uhrzeit}:</span>
                {umfrage.uhrzeit}
              </li>
            ) : null}
          </ul>
        ) : null}
        {umfrage.beschreibung ? (
          <p className="max-w-prose text-sm whitespace-pre-line text-muted-foreground text-pretty">
            {umfrage.beschreibung}
          </p>
        ) : null}
      </header>

      {!offen ? (
        <div role="status" className="space-y-1 border border-border bg-muted/50 p-4 text-sm">
          <p className="font-medium">{TX.geschlossenTitel}</p>
          <p className="text-muted-foreground">{TX.geschlossenText}</p>
          {festgelegt ? (
            <p className="flex items-center gap-1.5 pt-1 font-semibold text-primary">
              <CalendarCheck className="size-4" aria-hidden />
              {TX.festgelegt(festgelegt.label)}
            </p>
          ) : null}
        </div>
      ) : (
        <UmfrageAntwortFormular
          token={token}
          vorname={vorname}
          termine={termine.map(({ id, label }) => ({ id, label }))}
          startWerte={Object.fromEntries(teilnehmer.antworten.map((w) => [w.terminId, w.wert]))}
          startKommentar={teilnehmer.kommentar ?? ""}
          profil={{ hatZugang, fehlt }}
        />
      )}

      <section className="space-y-2" aria-labelledby="alle-antworten">
        <h2 id="alle-antworten" className="font-heading text-lg font-bold tracking-tight">
          {TX.tabelleTitel}
        </h2>
        <UmfrageMatrix termine={termine} zeilen={zeilen} />
      </section>

      <section id="onboarding" className="scroll-mt-6 space-y-6" aria-labelledby="onboarding-titel">
        <header className="space-y-1">
          <h2 id="onboarding-titel" className="font-heading text-xl font-bold tracking-tight text-primary text-balance sm:text-2xl">
            {TO.titel}
          </h2>
          <p className="text-sm text-muted-foreground">{TO.untertitel}</p>
        </header>

        {offen ? (
          <OnboardingFormular
            token={token}
            start={{
              kontaktwege: onboarding?.kontaktwege ?? [],
              telefon: eigenesTelefon?.telefon ?? "",
              weitereFormate: onboarding?.weitereFormate ?? false,
              zeiten: onboarding?.zeiten ?? [],
              bemerkung: onboarding?.bemerkung ?? "",
            }}
          />
        ) : null}

        <OnboardingPortal />

        <OnboardingProfilKnopf token={token} hatZugang={hatZugang} />

        <p className="text-sm text-muted-foreground">{TO.schlusszeile}</p>
      </section>
    </main>
  );
}
