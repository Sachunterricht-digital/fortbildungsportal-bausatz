import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck, ChevronLeft, Clock, MapPin, Pencil } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { umfrageLink } from "@/lib/umfrageToken";
import { formatDatum, formatKalendertagKurz } from "@/lib/datetime";
import { buttonVariants } from "@/components/ui/button";
import { UmfrageMatrix, type MatrixTermin, type MatrixZeile } from "@/components/umfrage/UmfrageMatrix";
import { UmfrageAktionen } from "@/components/umfrage/UmfrageAktionen";
import { LinkKopierenKnopf } from "@/components/umfrage/LinkKopierenKnopf";
import { cn } from "@/lib/utils";
import { T } from "@/texte/de";

export const metadata = { title: T.umfrage.liste.titel };

export default async function UmfrageDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ gespeichert?: string }>;
}) {
  await requireRole("ADMIN");
  const { id } = await params;
  const { gespeichert } = await searchParams;
  const TD = T.umfrage.detail;

  const umfrage = await prisma.umfrage.findUnique({
    where: { id },
    include: {
      termine: { orderBy: { reihenfolge: "asc" } },
      teilnehmer: {
        include: {
          referent: { select: { vorname: true, nachname: true, email: true, aktiv: true } },
          antworten: { select: { terminId: true, wert: true } },
        },
      },
    },
  });
  if (!umfrage) notFound();

  const teilnehmer = [...umfrage.teilnehmer].sort(
    (a, b) =>
      a.referent.nachname.localeCompare(b.referent.nachname, "de") ||
      a.referent.vorname.localeCompare(b.referent.vorname, "de"),
  );

  const termine: MatrixTermin[] = umfrage.termine.map((t) => ({
    id: t.id,
    label: formatKalendertagKurz(t.datum),
    festgelegt: t.id === umfrage.festgelegterTerminId,
  }));
  const festgelegt = termine.find((t) => t.festgelegt);

  const nochNicht = <span className="text-muted-foreground">{TD.nochNicht}</span>;
  const zeilen: MatrixZeile[] = teilnehmer.map((t) => {
    const name = `${t.referent.vorname} ${t.referent.nachname}`;
    return {
      id: t.id,
      name,
      offen: !t.geantwortetAm,
      kommentar: t.kommentar,
      werte: Object.fromEntries(t.antworten.map((a) => [a.terminId, a.wert])),
      zusatz: [
        t.eingeladenAm ? formatDatum(t.eingeladenAm) : t.referent.email?.trim() ? nochNicht : <span className="text-muted-foreground">{TD.ohneMail}</span>,
        t.erinnertAm ? formatDatum(t.erinnertAm) : nochNicht,
        t.geantwortetAm ? formatDatum(t.geantwortetAm) : nochNicht,
        <LinkKopierenKnopf key="link" link={umfrageLink(t.id)} name={name} />,
      ],
    };
  });

  const geantwortet = teilnehmer.filter((t) => t.geantwortetAm).length;
  const mitMail = (t: (typeof teilnehmer)[number]) => Boolean(t.referent.email?.trim() && t.referent.aktiv);
  const einzuladen = teilnehmer.filter((t) => !t.eingeladenAm && mitMail(t)).length;
  const zuErinnern = teilnehmer.filter((t) => t.eingeladenAm && !t.geantwortetAm && mitMail(t)).length;

  const imUmfrage = new Set(teilnehmer.map((t) => t.referentId));
  const alle = await prisma.referent.findMany({
    where: { aktiv: true, id: { notIn: [...imUmfrage] } },
    orderBy: [{ nachname: "asc" }, { vorname: "asc" }],
    select: { id: true, vorname: true, nachname: true, organisation: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/umfragen" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" aria-hidden />
          {TD.zurueck}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{umfrage.titel}</h1>
          <Link href={`/admin/umfragen/${id}/bearbeiten`} className={cn(buttonVariants({ variant: "outline" }))}>
            <Pencil className="size-3.5" aria-hidden />
            {TD.bearbeiten}
          </Link>
        </div>
        <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <li>
            {TD.status}:{" "}
            <span className="font-medium text-foreground">
              {T.umfrage.status[umfrage.status as "OFFEN" | "GESCHLOSSEN"] ?? umfrage.status}
            </span>
          </li>
          <li>
            {TD.antworten}:{" "}
            <span className="font-mono text-foreground">
              {T.umfrage.liste.quote(geantwortet, teilnehmer.length)}
            </span>
          </li>
          {umfrage.ort ? (
            <li className="flex items-center gap-1.5">
              <MapPin className="size-3.5" aria-hidden />
              {umfrage.ort}
            </li>
          ) : null}
          {umfrage.uhrzeit ? (
            <li className="flex items-center gap-1.5">
              <Clock className="size-3.5" aria-hidden />
              {umfrage.uhrzeit}
            </li>
          ) : null}
          {festgelegt ? (
            <li className="flex items-center gap-1.5 font-medium text-primary">
              <CalendarCheck className="size-3.5" aria-hidden />
              {TD.festgelegt(festgelegt.label)}
            </li>
          ) : null}
        </ul>
        {umfrage.beschreibung ? (
          <p className="mt-2 max-w-prose text-sm whitespace-pre-line text-muted-foreground">{umfrage.beschreibung}</p>
        ) : null}
        {gespeichert ? (
          <p role="status" className="mt-2 text-sm text-primary">
            {T.umfrage.form.gespeichert}
          </p>
        ) : null}
      </div>

      <UmfrageAktionen
        umfrageId={id}
        titel={umfrage.titel}
        offen={umfrage.status === "OFFEN"}
        einladung={{
          betreff: T.umfrage.mails.einladung.betreff(umfrage.titel),
          text: T.umfrage.mails.einladung.text({ titel: umfrage.titel }),
          anzahl: einzuladen,
        }}
        erinnerung={{
          betreff: T.umfrage.mails.erinnerung.betreff(umfrage.titel),
          text: T.umfrage.mails.erinnerung.text({ titel: umfrage.titel }),
          anzahl: zuErinnern,
        }}
        verfuegbarePersonen={alle.map((r) => ({
          id: r.id,
          name: `${r.vorname} ${r.nachname}`,
          organisation: r.organisation,
        }))}
        termine={termine.map(({ id: terminId, label }) => ({ id: terminId, label }))}
      />

      <section className="space-y-2" aria-labelledby="matrix">
        <h2 id="matrix" className="font-semibold tracking-tight">
          {TD.matrixTitel}
        </h2>
        <UmfrageMatrix
          termine={termine}
          zeilen={zeilen}
          zusatzSpalten={[TD.spalteEingeladen, TD.spalteErinnert, TD.spalteGeantwortet, TD.spalteLink]}
          leerText={TD.keineTeilnehmer}
        />
      </section>
    </div>
  );
}
