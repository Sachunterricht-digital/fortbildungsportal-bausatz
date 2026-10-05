import Link from "next/link";
import { redirect } from "next/navigation";
import { istEinrichtungOffen } from "@/lib/schulamt";
import {
  CalendarDays,
  CalendarPlus,
  ChevronDown,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  FileText,
  Globe2,
  PencilLine,
  Send,
  ShieldCheck,
  UserCog,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { ERFASSER, fortbildungScope, requireRole } from "@/lib/auth";
import { HinweisLeiste } from "@/components/admin/HinweisLeiste";
import {
  darfFreigeben,
  NACHBEREITUNG_RUECKBLICK_TAGE,
} from "@/constants/fortbildung";
import { AUSGEGRAUT } from "@/constants/funktionen";
import { baueUrl, filterZuWhere, leseFilter, type SuchParameter } from "@/lib/filter";
import { aktuellesSchuljahr, schuljahrZeitraum } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { AdminFilterLeiste } from "@/components/admin/AdminFilterLeiste";
import { FortbildungTabelle } from "@/components/admin/FortbildungTabelle";
import { FreigabenBereich } from "@/components/admin/FreigabenBereich";
import { NachbereitungsBereich } from "@/components/admin/NachbereitungsBereich";
import { SchuljahrWahl } from "@/components/admin/SchuljahrWahl";
import { T } from "@/texte/de";

export const metadata = { title: T.zugang.admin.seitenTitel };

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<SuchParameter>;
}) {
  const user = await requireRole(...ERFASSER);
  if (user.role === "ADMIN" && await istEinrichtungOffen()) redirect("/admin/einrichtung");
  const params = await searchParams;
  const filter = leseFilter(params);
  const scope = fortbildungScope(user);
  const istAdmin = darfFreigeben(user.role);
  const darfNachbereiten =
    !AUSGEGRAUT.nachbereitung && (user.role === "ADMIN" || user.role === "REFERENT");
  const bereichParam = Array.isArray(params.bereich) ? params.bereich[0] : params.bereich;
  const aktiverBereich =
    bereichParam === "freigaben" && istAdmin
      ? "freigaben"
      : bereichParam === "nachbereitung" && darfNachbereiten
        ? "nachbereitung"
        : null;
  const fibsAktiv =
    aktiverBereich === null &&
    filter.status === "VEROEFFENTLICHT" &&
    filter.fibs === "offen-ausschreibung";
  const freigabenUrl = `${baueUrl("/admin", params, { bereich: "freigaben" })}#arbeitsbereich`;
  const nachbereitungUrl = `${baueUrl("/admin", params, { bereich: "nachbereitung" })}#arbeitsbereich`;
  const fibsUrl = `${baueUrl(
    "/admin",
    params,
    fibsAktiv
      ? { status: undefined, fibs: undefined }
      : {
          status: "VEROEFFENTLICHT",
          fibs: "offen-ausschreibung",
          bereich: undefined,
        },
  )}#fortbildungslisten`;
  const uebersichtUrl = baueUrl(
    "/admin",
    params,
    fibsAktiv
      ? { bereich: undefined, status: undefined, fibs: undefined }
      : { bereich: undefined },
  );
  const uebersichtAktiv = aktiverBereich === null && !fibsAktiv;
  const where = { AND: [scope, filterZuWhere(filter)] };

  const laufendes = aktuellesSchuljahr();
  const kennzahlJahr = filter.schuljahr ?? laufendes;
  const { start, ende } = schuljahrZeitraum(kennzahlJahr);
  const jetzt = new Date();
  const nachbereitungsGrenze = new Date(
    jetzt.getTime() - NACHBEREITUNG_RUECKBLICK_TAGE * 24 * 60 * 60 * 1000,
  );

  const [fortbildungen, schlagworte, kennzahlen] = await Promise.all([
    prisma.fortbildung.findMany({
      where,
      orderBy: { beginn: { sort: "desc", nulls: "last" } },
      take: 300,
      select: {
        id: true,
        slug: true,
        titel: true,
        kurztitel: true,
        organisationsform: true,
        format: true,
        beginn: true,
        ende: true,
        maxTn: true,
        tnTatsaechlich: true,
        status: true,
        inFibs: true,
        fibsLehrgangsnummer: true,
        quelle: true,
        ortText: true,
        veranstaltungsort: { select: { name: true, ort: true, istOnline: true } },
        referenten: { select: { referent: { select: { vorname: true, nachname: true } } } },
      },
    }),
    prisma.schlagwort.findMany({
      // Filteroption: Schlagworte, die nur an archivierten Themen hängen,
      // führen sonst ins Leere, weil die Liste das Archiv nicht durchsucht.
      where: { fortbildungen: { some: { fortbildung: { status: { not: "ARCHIVIERT" } } } } },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
    Promise.all([
      prisma.fortbildung.count({ where: { AND: [scope, { beginn: { gte: start, lte: ende } }, { status: { not: "ARCHIVIERT" } }] } }),
      prisma.fortbildung.count({ where: { AND: [scope, { status: "EINGEREICHT" }] } }),
      prisma.fortbildung.count({
        where: {
          AND: [
            scope,
            { status: "VEROEFFENTLICHT" },
            { organisationsform: { not: "SCHILF" } },
            { inFibs: false },
            { ende: { gte: jetzt } },
          ],
        },
      }),
      darfNachbereiten
        ? prisma.fortbildung.count({
            where: {
              AND: [
                scope,
                ...(user.role === "REFERENT"
                  ? [{ organisationsform: "SCHILF" }]
                  : []),
                { ende: { lt: jetzt, gte: nachbereitungsGrenze } },
                { status: { in: ["VEROEFFENTLICHT", "ARCHIVIERT"] } },
                user.role === "ADMIN"
                  ? {
                      OR: [
                        { tnTatsaechlich: null },
                        { teilnahmebestaetigungenReferentenVersandtAm: null },
                        { teilnahmebestaetigungenTeilnehmendeVersandtAm: null },
                        { organisationsform: "SCHILF", inFibs: false },
                      ],
                    }
                  : { tnTatsaechlich: null },
              ],
            },
          })
        : Promise.resolve(0),
      Promise.all([
        prisma.fortbildung.findFirst({ where: { AND: [scope, { beginn: { not: null } }] }, orderBy: { beginn: "asc" }, select: { beginn: true } }),
        prisma.fortbildung.findFirst({ where: { AND: [scope, { beginn: { not: null } }] }, orderBy: { beginn: "desc" }, select: { beginn: true } }),
      ]).then(([erste, letzte]) => vorhandeneSchuljahre(erste?.beginn, letzte?.beginn, laufendes)),
    ]),
  ]);

  const [imSchuljahr, zurFreigabe, ohneFibs, offeneMeldungen, jahrgaenge] = kennzahlen;
  const gruppen = gruppiereFortbildungen(fortbildungen);

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm text-muted-foreground">{T.zugang.admin.verwaltung(kennzahlJahr)}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
            {user.role === "REFERENT" ? T.zugang.admin.titelReferent : T.zugang.admin.titelStandard}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">{T.zugang.admin.beschreibung}</p>
          <div className="mt-3"><SchuljahrWahl params={params} jahrgaenge={jahrgaenge} aktuell={laufendes} /></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button nativeButton={false} render={<Link href="/admin/fortbildungen/neu"><CalendarPlus className="size-4" aria-hidden />{T.zugang.admin.neueFortbildung}</Link>} />
          <Button nativeButton={false} variant="outline" render={<Link href="/admin/konto#profil"><UserCog className="size-4" aria-hidden />Profil verwalten</Link>} />
          <details className="group relative">
            <summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-xs transition-colors hover:bg-accent [&::-webkit-details-marker]:hidden">
              <Download className="size-4" aria-hidden />{T.zugang.admin.export}<ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="absolute right-0 z-10 mt-2 grid min-w-48 gap-1 rounded-xl border bg-popover p-1.5 text-sm shadow-lg">
              <a className="flex items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-accent" href={baueUrl("/api/admin/export", params, {})}><FileSpreadsheet className="size-4" aria-hidden />{T.zugang.admin.excelExportieren}</a>
              <a className="flex items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-accent" title={T.zugang.admin.pdfBerichtTitel} href={baueUrl("/api/admin/export/pdf", params, {})}><FileText className="size-4" aria-hidden />{T.zugang.admin.pdfBericht}</a>
            </div>
          </details>
        </div>
      </div>

      <HinweisLeiste userId={user.id} rolle={user.role} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kachel
          wert={imSchuljahr}
          label={T.zugang.admin.kachelTermine(kennzahlJahr)}
          icon={CalendarDays}
          href={uebersichtUrl}
          aktiv={uebersichtAktiv}
        />
        {istAdmin ? (
          <Kachel
            wert={zurFreigabe}
            label={T.zugang.admin.kachelFreigaben}
            icon={ShieldCheck}
            hervorheben={zurFreigabe > 0}
            aktiv={aktiverBereich === "freigaben"}
            href={freigabenUrl}
          />
        ) : null}
        <Kachel
          wert={ohneFibs}
          label={T.zugang.admin.kachelFibs}
          icon={Globe2}
          hervorheben={ohneFibs > 0}
          aktiv={fibsAktiv}
          href={fibsUrl}
        />
        {darfNachbereiten ? (
          <Kachel
            wert={offeneMeldungen}
            label={
              user.role === "ADMIN"
                ? T.zugang.admin.kachelNachbereitungAdmin
                : T.zugang.admin.kachelNachbereitungReferent
            }
            icon={ClipboardCheck}
            hervorheben={offeneMeldungen > 0}
            aktiv={aktiverBereich === "nachbereitung"}
            href={nachbereitungUrl}
          />
        ) : null}
      </div>

      <WorkflowHinweis istAdmin={istAdmin} freigabenUrl={freigabenUrl} />

      {aktiverBereich ? (
        <section id="arbeitsbereich" className="scroll-mt-6 space-y-3" aria-label={T.zugang.admin.arbeitsbereich}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-2">
            <p className="etikett text-primary">{T.zugang.admin.arbeitsbereich}</p>
            <Button nativeButton={false} size="sm" variant="outline" render={<Link href={uebersichtUrl}>{T.zugang.admin.zurUebersicht}</Link>} />
          </div>
          {aktiverBereich === "freigaben" ? <FreigabenBereich eingebettet /> : <NachbereitungsBereich eingebettet />}
        </section>
      ) : null}

      <div id="fortbildungslisten" className="scroll-mt-6">
        <AdminFilterLeiste params={params} schlagworte={schlagworte.map((s) => s.name)} />
      </div>

      {fortbildungen.length === 0 ? (
        <div className="border border-l-4 border-l-primary bg-card py-16 text-center">
          <Download className="mx-auto mb-3 size-6 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">{T.zugang.admin.keineFortbildungVorspann} <Link href="/admin/fortbildungen/neu" className="text-foreground underline underline-offset-4">{T.zugang.admin.neueAnlegen}</Link>.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {gruppen.map((gruppe) => (
            <section key={gruppe.id} aria-labelledby={`gruppe-${gruppe.id}`}>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2 border-b pb-2">
                <div>
                  <p className="etikett text-primary">{gruppe.eyebrow}</p>
                  <h2 id={`gruppe-${gruppe.id}`} className="mt-0.5 text-lg font-semibold tracking-tight">
                    {gruppe.titel}
                    <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full border border-border bg-muted px-1.5 py-0.5 align-middle text-xs font-medium leading-none text-muted-foreground">
                      <span className="sr-only">{T.zugang.admin.anzahlSr}</span>{gruppe.fortbildungen.length}
                    </span>
                  </h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">{gruppe.beschreibung}</p>
                </div>
                {gruppe.id === "eingereicht" && istAdmin ? <Button nativeButton={false} size="sm" render={<Link href={freigabenUrl}><ShieldCheck className="size-3.5" aria-hidden />{T.zugang.admin.freigabenOeffnen}</Link>} /> : null}
              </div>
              {gruppe.id === "abgeschlossen" ? (
                <details className="group/archiv">
                  <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-primary [&::-webkit-details-marker]:hidden">
                    <ChevronDown className="size-4 transition-transform group-open/archiv:rotate-180" aria-hidden />
                    <span className="group-open/archiv:hidden">{T.zugang.admin.archivAnzeigen}</span>
                    <span className="hidden group-open/archiv:inline">{T.zugang.admin.archivAusblenden}</span>
                  </summary>
                  <div className="mt-3">
                    <FortbildungTabelle fortbildungen={gruppe.fortbildungen} />
                  </div>
                </details>
              ) : (
                <FortbildungTabelle fortbildungen={gruppe.fortbildungen} />
              )}
            </section>
          ))}
        </div>
      )}

      {fortbildungen.length === 300 ? <p className="text-xs text-muted-foreground">{T.zugang.admin.limitHinweis}</p> : null}
    </div>
  );
}

function WorkflowHinweis({ istAdmin, freigabenUrl }: { istAdmin: boolean; freigabenUrl: string }) {
  const icons = [PencilLine, Send, ShieldCheck, Globe2, CheckCircle2];
  const schritte = T.zugang.admin.workflow.schritte.map((schritt, index) => ({
    ...schritt,
    icon: icons[index]!,
  }));
  return (
    <details className="group rounded-2xl border bg-card px-4 py-3 shadow-sm" aria-labelledby="workflow-titel">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <div><p className="text-sm font-semibold">{T.zugang.admin.workflow.titel}</p><p className="mt-0.5 text-xs text-muted-foreground">{T.zugang.admin.workflow.unterzeile}</p></div>
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="mt-4 border-t pt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 id="workflow-titel" className="text-sm font-semibold">{T.zugang.admin.workflow.ueberschrift}</h2>
          {istAdmin ? <Button nativeButton={false} size="sm" render={<Link href={freigabenUrl}>{T.zugang.admin.workflow.bearbeiten}</Link>} /> : <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{T.zugang.admin.workflow.hinweisOhneAdmin}</p>}
        </div>
        <ol className="mt-3 grid gap-2 sm:grid-cols-5">
          {schritte.map(({ icon: Icon, titel, text }, index) => (
            <li key={titel} className="flex gap-2 rounded-xl border bg-background p-2.5 sm:block">
              <span className="zahl flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground sm:mb-2">{index + 1}</span>
              <div><p className="flex items-center gap-1.5 text-xs font-semibold"><Icon className="size-3.5 shrink-0 text-primary" aria-hidden />{titel}</p><p className="mt-0.5 text-xs leading-snug text-muted-foreground">{text}</p></div>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">{T.zugang.admin.workflow.fussnote}</p>
      </div>
    </details>
  );
}

function gruppiereFortbildungen<
  T extends { status: string; inFibs: boolean; organisationsform: string },
>(fortbildungen: T[]) {
  const g = T.zugang.admin.gruppen;
  return [
    { id: "entwuerfe", ...g.entwuerfe, fortbildungen: fortbildungen.filter((f) => f.status === "ENTWURF") },
    { id: "eingereicht", ...g.eingereicht, fortbildungen: fortbildungen.filter((f) => f.status === "EINGEREICHT") },
    { id: "ohne-fibs", ...g.ohneFibs, fortbildungen: fortbildungen.filter((f) => f.status === "VEROEFFENTLICHT" && !f.inFibs && f.organisationsform !== "SCHILF") },
    { id: "schilf-nachtrag", ...g.schilfNachtrag, fortbildungen: fortbildungen.filter((f) => f.status === "VEROEFFENTLICHT" && !f.inFibs && f.organisationsform === "SCHILF") },
    { id: "in-fibs", ...g.inFibs, fortbildungen: fortbildungen.filter((f) => f.status === "VEROEFFENTLICHT" && f.inFibs) },
    { id: "abgeschlossen", ...g.abgeschlossen, fortbildungen: fortbildungen.filter((f) => f.status === "ARCHIVIERT" || f.status === "ABGESAGT") },
  ].filter((gruppe) => gruppe.fortbildungen.length > 0);
}

function Kachel({
  wert,
  label,
  icon: Icon,
  hervorheben,
  aktiv,
  href,
}: {
  wert: number;
  label: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  hervorheben?: boolean;
  aktiv?: boolean;
  href?: string;
}) {
  const inhalt = (
    <div className="grid h-[140px] grid-rows-[1.25rem_1fr_2.5rem] p-4 max-[360px]:h-[160px] max-[360px]:grid-rows-[1.25rem_1fr_3.75rem] sm:h-[160px] sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <Icon className={`size-5 shrink-0 ${aktiv ? "text-primary-foreground" : "text-primary"}`} aria-hidden />
        {hervorheben && !aktiv ? <span className="size-2 shrink-0 rounded-full bg-ferien" aria-label={T.zugang.admin.offeneAufgabe} /> : null}
      </div>
      <p className={`zahl self-end text-3xl leading-none font-semibold sm:text-4xl ${aktiv ? "text-primary-foreground" : "text-foreground"}`}>{String(wert).padStart(2, "0")}</p>
      <p className={`min-h-10 pt-2 text-sm leading-snug ${aktiv ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{label}</p>
    </div>
  );
  const klassen = `rounded-2xl border shadow-sm transition-colors ${aktiv ? "border-primary bg-primary shadow-md" : "border-border bg-card"}`;

  return href ? (
    <Link
      href={href}
      aria-current={aktiv ? "page" : undefined}
      className={`${klassen} block ${aktiv ? "hover:bg-primary/90" : "hover:bg-accent"} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
    >
      {inhalt}
    </Link>
  ) : (
    <div className={klassen}>{inhalt}</div>
  );
}

function vorhandeneSchuljahre(erste: Date | null | undefined, letzte: Date | null | undefined, laufendes: string): string[] {
  const jahre = new Set<string>([laufendes]);
  if (erste && letzte) {
    const von = Number(aktuellesSchuljahr(erste).slice(0, 4));
    const bis = Number(aktuellesSchuljahr(letzte).slice(0, 4));
    for (let jahr = von; jahr <= bis; jahr += 1) jahre.add(`${jahr}/${jahr + 1}`);
  }
  return [...jahre].sort().reverse();
}
