import Link from "next/link";
import { Globe, MapPin, Pencil } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDatumZeit, formatZeit } from "@/lib/datetime";
import {
  ebeneKlassen,
  formatLabel,
  organisationsformKurz,
  ortAnzeige,
} from "@/constants/fortbildung";
import { cn } from "@/lib/utils";
import {
  FibsKennzeichen,
  StatusKennzeichen,
} from "@/components/admin/Kennzeichen";
import { T } from "@/texte/de";

interface Zeile {
  id: string;
  titel: string;
  kurztitel: string | null;
  organisationsform: string;
  format: string;
  beginn: Date | null;
  ende: Date | null;
  maxTn: number | null;
  tnTatsaechlich: number | null;
  status: string;
  inFibs: boolean;
  fibsLehrgangsnummer: string | null;
  quelle: string;
  ortText: string | null;
  veranstaltungsort: { name: string; ort: string | null; istOnline: boolean } | null;
  referenten: Array<{ referent: { vorname: string; nachname: string } }>;
}

export function FortbildungTabelle({ fortbildungen }: { fortbildungen: Zeile[] }) {
  return (
    <>
      {/* Unterhalb der Desktopbreite sind Karten besser lesbar als eine
          zusammengequetschte Tabelle. Sie enthalten dieselben Arbeitshinweise
          wie die sechs Spalten der großen Ansicht. */}
      <div className="grid gap-3 xl:hidden">
        {fortbildungen.map((f) => {
          const ebene = ebeneKlassen(f.organisationsform);
          return (
            <Link
              key={f.id}
              href={`/admin/fortbildungen/${f.id}`}
              className={cn(
                "rounded-2xl border border-l-4 bg-card p-4 shadow-sm outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring",
                ebene.kante,
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="zahl text-xs text-muted-foreground">
                    {f.beginn && f.ende
                      ? T.zugang.fortbildungTabelle.zeitraum(formatDatumZeit(f.beginn), formatZeit(f.ende))
                      : T.allgemein.aufAbruf}
                  </p>
                  <h3 className="mt-1 font-semibold leading-snug">{f.titel}</h3>
                </div>
                <Pencil className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={cn("inline-flex max-w-full rounded-full px-2 py-1 text-xs font-medium break-words", ebene.flaeche)}>
                  {organisationsformKurz(f.organisationsform)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatLabel(f.format)}
                </span>
                {f.quelle === "FIBS_IMPORT" ? (
                  <Badge variant="outline">{T.zugang.fortbildungTabelle.ausFibs}</Badge>
                ) : null}
                <StatusKennzeichen status={f.status} />
                <FibsKennzeichen
                  inFibs={f.inFibs}
                  lehrgangsnummer={f.fibsLehrgangsnummer}
                  organisationsform={f.organisationsform}
                  ausfuehrlich
                />
              </div>

              <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                <p className="flex items-start gap-1.5">
                  {f.veranstaltungsort?.istOnline ? (
                    <Globe className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  ) : (
                    <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  )}
                  <span>
                    {ortAnzeige(f.ortText, f.veranstaltungsort) ?? T.allgemein.ortNachAbsprache}
                  </span>
                </p>
                <p>
                  {f.referenten.length === 0
                    ? T.zugang.fortbildungTabelle.keineReferenten
                    : f.referenten
                        .map((r) => `${r.referent.vorname} ${r.referent.nachname}`)
                        .join(", ")}
                </p>
                <p className="zahl">
                  {T.zugang.fortbildungTabelle.tn(
                    f.tnTatsaechlich ?? T.zugang.fortbildungTabelle.leer,
                    f.maxTn ?? T.allgemein.ohneAngabe,
                  )}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border bg-card shadow-sm xl:block">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[14%] whitespace-normal">Termin</TableHead>
            <TableHead className="w-[28%] whitespace-normal">Fortbildung</TableHead>
            <TableHead className="w-[20%] whitespace-normal">Ort &amp; Leitung</TableHead>
            <TableHead
              className="w-[9%] whitespace-normal text-right"
              title="Tatsächliche Teilnehmerzahl von geplanten Plätzen"
            >
              TN / Plätze
            </TableHead>
            <TableHead className="whitespace-normal">Bearbeitungsstand</TableHead>
            <TableHead className="w-20 whitespace-normal text-right">Aktion</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {fortbildungen.map((f) => (
            <TableRow key={f.id}>
              <TableCell className="zahl whitespace-normal py-5">
                {formatDatumZeit(f.beginn)}
                {f.ende ? (
                  <span className="zahl block text-xs text-muted-foreground">
                    {T.zugang.fortbildungTabelle.bis(formatZeit(f.ende))}
                  </span>
                ) : null}
              </TableCell>

              <TableCell className="whitespace-normal py-5">
                <Link
                  href={`/admin/fortbildungen/${f.id}`}
                  className="block min-w-0 break-words font-medium leading-snug [overflow-wrap:anywhere] underline-offset-4 hover:underline"
                >
                  {f.titel}
                </Link>
                {f.kurztitel ? (
                  <span className="block break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                    {f.kurztitel}
                  </span>
                ) : null}
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                  {/* Dieselbe Farbzuordnung wie im Frontend und im Kalender. */}
                  <span
                    className={`inline-flex max-w-full rounded-full px-2 py-1 text-xs font-medium break-words ${ebeneKlassen(f.organisationsform).flaeche}`}
                  >
                    {organisationsformKurz(f.organisationsform)}
                  </span>
                  <span className="min-w-0 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                    {formatLabel(f.format)}
                  </span>
                  {f.quelle === "FIBS_IMPORT" ? (
                    <Badge variant="outline">{T.zugang.fortbildungTabelle.ausFibs}</Badge>
                  ) : null}
                </div>
              </TableCell>

              <TableCell className="whitespace-normal py-5 text-sm">
                <div className="flex min-w-0 items-start gap-1.5 leading-snug">
                  {f.veranstaltungsort?.istOnline ? (
                    <Globe className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  ) : (
                    <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                    {ortAnzeige(f.ortText, f.veranstaltungsort) ?? T.allgemein.ortNachAbsprache}
                  </span>
                </div>
                <p className="mt-1 break-words text-xs leading-snug text-muted-foreground [overflow-wrap:anywhere]">
                  {f.referenten.length === 0
                    ? T.zugang.fortbildungTabelle.keineReferenten
                    : f.referenten
                        .map((r) => `${r.referent.vorname} ${r.referent.nachname}`)
                        .join(", ")}
                </p>
              </TableCell>

              <TableCell className="zahl whitespace-normal py-5 text-right">
                {f.tnTatsaechlich !== null ? (
                  <span className="font-medium">{f.tnTatsaechlich}</span>
                ) : (
                  <span className="text-muted-foreground">{T.zugang.fortbildungTabelle.leer}</span>
                )}
                <span className="text-muted-foreground"> / {f.maxTn ?? T.allgemein.ohneAngabe}</span>
              </TableCell>

              <TableCell className="whitespace-normal py-5">
                <div className="flex min-w-0 flex-col items-start gap-1.5">
                  <StatusKennzeichen status={f.status} />
                  <FibsKennzeichen
                    inFibs={f.inFibs}
                    lehrgangsnummer={f.fibsLehrgangsnummer}
                    organisationsform={f.organisationsform}
                    ausfuehrlich
                  />
                </div>
              </TableCell>

              <TableCell className="w-20 whitespace-normal px-3 py-5 text-right">
                <Link
                  href={`/admin/fortbildungen/${f.id}`}
                  aria-label={`${f.titel} bearbeiten`}
                  className="ml-auto flex size-7 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Pencil className="size-3.5" />
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </>
  );
}
