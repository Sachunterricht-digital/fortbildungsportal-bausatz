"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  CheckCircle2,
  ClipboardCheck,
  Globe,
  MailCheck,
  MapPin,
  Pencil,
  Undo2,
} from "lucide-react";

import {
  meldeTeilnehmerzahl,
  meldungZuruecknehmen,
  setzeSchilfFibsNachtrag,
  setzeTeilnahmebestaetigungsVersand,
} from "@/actions/nachbereitung";
import type { FormularState } from "@/lib/validation/fortbildung";
import { formatDatumZeit, formatZeitraum } from "@/lib/datetime";
import { formatLabel, organisationsformKurz, ortAnzeige } from "@/constants/fortbildung";
import { cn } from "@/lib/utils";
import { T } from "@/texte/de";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface MeldungsZeile {
  id: string;
  titel: string;
  organisationsform: string;
  format: string;
  beginn: Date;
  ende: Date;
  maxTn: number;
  inFibs: boolean;
  fibsEingetragenAm: Date | null;
  tnTatsaechlich: number | null;
  tnBemerkung: string | null;
  tnGemeldetAm: Date | null;
  ortText: string | null;
  veranstaltungsort: { name: string; istOnline: boolean } | null;
  tnGemeldetVon: { name: string | null; email: string } | null;
  teilnahmebestaetigungenReferentenVersandtAm: Date | null;
  teilnahmebestaetigungenReferentenVersandtVon: { name: string | null; email: string } | null;
  teilnahmebestaetigungenTeilnehmendeVersandtAm: Date | null;
  teilnahmebestaetigungenTeilnehmendeVersandtVon: { name: string | null; email: string } | null;
}

export function TeilnehmerMeldung({
  fortbildung,
  darfBestaetigungen,
}: {
  fortbildung: MeldungsZeile;
  /** Versandvermerke in FIBS sind ausschließlich Aufgabe der Administration. */
  darfBestaetigungen: boolean;
}) {
  const action = meldeTeilnehmerzahl.bind(null, fortbildung.id);
  const [state, formAction] = useActionState<FormularState, FormData>(action, {});

  const gemeldet = fortbildung.tnTatsaechlich !== null;
  const istSchilf = fortbildung.organisationsform === "SCHILF";
  const [bearbeiten, setBearbeiten] = useState(false);
  const zeigeFormular = !gemeldet || bearbeiten || state.erfolg === false;

  const fehler = state.fehler ?? {};

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-5 shadow-sm",
        gemeldet && !bearbeiten && "border-dashed",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline" className="max-w-full break-words">
              {organisationsformKurz(fortbildung.organisationsform)}
            </Badge>
            <span className="text-muted-foreground">
              {formatLabel(fortbildung.format)}
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              {fortbildung.veranstaltungsort?.istOnline ? (
                <Globe className="size-3" aria-hidden />
              ) : (
                <MapPin className="size-3" aria-hidden />
              )}
              {ortAnzeige(fortbildung.ortText, fortbildung.veranstaltungsort) ?? T.allgemein.ortNachAbsprache}
            </span>
          </div>

          <h3 className="font-medium">
            <Link
              href={`/admin/fortbildungen/${fortbildung.id}`}
              className="underline-offset-4 hover:underline"
            >
              {fortbildung.titel}
            </Link>
          </h3>

          <p className="mt-0.5 text-sm text-muted-foreground zahl">
            {formatZeitraum(fortbildung.beginn, fortbildung.ende)} ·{" "}
            {fortbildung.maxTn} Plätze geplant
          </p>
        </div>

        {gemeldet && !bearbeiten ? (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="flex items-center justify-end gap-1.5 text-lg font-semibold zahl">
                <CheckCircle2 className="size-4 text-primary" aria-hidden />
                {fortbildung.tnTatsaechlich}
              </span>
              <span className="text-xs text-muted-foreground">
                Teilnehmende
              </span>
            </div>

            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Meldung ändern"
              title="Meldung ändern"
              onClick={() => setBearbeiten(true)}
            >
              <Pencil className="size-3.5" />
            </Button>
          </div>
        ) : null}
      </div>

      {gemeldet && !bearbeiten ? (
        <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
          {fortbildung.tnBemerkung ? `„${fortbildung.tnBemerkung}" · ` : ""}
          gemeldet am{" "}
          {fortbildung.tnGemeldetAm
            ? formatDatumZeit(fortbildung.tnGemeldetAm)
            : "—"}
          {fortbildung.tnGemeldetVon
            ? ` von ${fortbildung.tnGemeldetVon.name ?? fortbildung.tnGemeldetVon.email}`
            : ""}
        </p>
      ) : null}

      {zeigeFormular ? (
        <form action={formAction} className="mt-4 border-t pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`tn-${fortbildung.id}`}>
                Tatsächliche Teilnehmerzahl
              </Label>
              <Input
                id={`tn-${fortbildung.id}`}
                name="tnTatsaechlich"
                type="number"
                min={0}
                max={2000}
                step={1}
                required
                defaultValue={fortbildung.tnTatsaechlich ?? ""}
                className="w-32"
                aria-invalid={Boolean(fehler.tnTatsaechlich)}
              />
            </div>

            <div className="min-w-56 flex-1 space-y-1.5">
              <Label htmlFor={`bem-${fortbildung.id}`}>
                Bemerkung <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id={`bem-${fortbildung.id}`}
                name="tnBemerkung"
                maxLength={300}
                defaultValue={fortbildung.tnBemerkung ?? ""}
                placeholder="z. B. zwei kurzfristige Absagen"
                className="w-full"
              />
            </div>

            <MeldenKnopf gemeldet={gemeldet} />

            {gemeldet ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setBearbeiten(false)}
              >
                Abbrechen
              </Button>
            ) : null}
          </div>

          {fehler.tnTatsaechlich ? (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {fehler.tnTatsaechlich}
            </p>
          ) : null}
          {fehler._ ? (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {fehler._}
            </p>
          ) : null}
          {state.erfolg ? (
            <p className="mt-2 text-sm text-primary">{state.meldung}</p>
          ) : null}
        </form>
      ) : null}

      {gemeldet && bearbeiten ? (
        <form
          action={meldungZuruecknehmen.bind(null, fortbildung.id)}
          className="mt-3"
        >
          <Button type="submit" variant="ghost" size="sm">
            <Undo2 className="size-3.5" aria-hidden />
            Meldung ganz zurücknehmen
          </Button>
        </form>
      ) : null}

      {darfBestaetigungen && istSchilf ? (
        <FibsNachtrag fortbildung={fortbildung} />
      ) : null}

      {darfBestaetigungen && gemeldet ? (
        <section className="mt-4 border-t pt-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <MailCheck className="size-4 text-muted-foreground" aria-hidden />
            {istSchilf ? "Letzter Schritt: " : ""}Teilnahmebestätigungen in FIBS
          </div>
          {istSchilf && !fortbildung.inFibs ? (
            <p className="mb-3 border-l-2 border-l-ferien bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              Zuerst den FIBS-Nachtrag dieser SchiLf bestätigen. Erst danach
              lassen sich neue Versandbestätigungen setzen.
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <VersandBestaetigung
              fortbildungId={fortbildung.id}
              empfaenger="REFERENTEN"
              label="An Referent:innen"
              versandtAm={fortbildung.teilnahmebestaetigungenReferentenVersandtAm}
              versandtVon={fortbildung.teilnahmebestaetigungenReferentenVersandtVon}
              gesperrt={istSchilf && !fortbildung.inFibs}
            />
            <VersandBestaetigung
              fortbildungId={fortbildung.id}
              empfaenger="TEILNEHMENDE"
              label="An Teilnehmende"
              versandtAm={fortbildung.teilnahmebestaetigungenTeilnehmendeVersandtAm}
              versandtVon={fortbildung.teilnahmebestaetigungenTeilnehmendeVersandtVon}
              gesperrt={istSchilf && !fortbildung.inFibs}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function FibsNachtrag({ fortbildung }: { fortbildung: MeldungsZeile }) {
  return (
    <section className="mt-4 border-t pt-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ClipboardCheck className="size-4 text-muted-foreground" aria-hidden />
            SchiLf: FIBS-Nachtrag nach dem Termin
          </div>
          {fortbildung.inFibs ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Nachtrag erledigt
              {fortbildung.fibsEingetragenAm
                ? ` am ${formatDatumZeit(fortbildung.fibsEingetragenAm)}`
                : ""}
              .
            </p>
          ) : (
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground text-pretty">
              SchiLf werden in der Regel nicht vorab ausgeschrieben. Bitte hier
              vermerken, sobald die gelaufene Veranstaltung in FIBS nachgetragen ist.
            </p>
          )}
        </div>

        <form
          action={setzeSchilfFibsNachtrag.bind(
            null,
            fortbildung.id,
            !fortbildung.inFibs,
          )}
        >
          <FibsNachtragKnopf erledigt={fortbildung.inFibs} />
        </form>
      </div>
    </section>
  );
}

function VersandBestaetigung({
  fortbildungId,
  empfaenger,
  label,
  versandtAm,
  versandtVon,
  gesperrt,
}: {
  fortbildungId: string;
  empfaenger: "REFERENTEN" | "TEILNEHMENDE";
  label: string;
  versandtAm: Date | null;
  versandtVon: { name: string | null; email: string } | null;
  /** Neue Bestätigungen bleiben bis zum FIBS-Nachtrag gesperrt. */
  gesperrt?: boolean;
}) {
  const versandt = versandtAm !== null;
  const action = setzeTeilnahmebestaetigungsVersand.bind(
    null,
    fortbildungId,
    empfaenger,
    !versandt,
  );

  return (
    <div className={cn("rounded-xl border p-3", versandt && "border-dashed bg-primary/5")}>
      <p className="text-sm font-medium">{label}</p>
      {versandt ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Bestätigt am {formatDatumZeit(versandtAm)}
          {versandtVon ? ` von ${versandtVon.name ?? versandtVon.email}` : ""}.
        </p>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          {gesperrt
            ? "Wartet auf den FIBS-Nachtrag."
            : "Versand in FIBS noch nicht bestätigt."}
        </p>
      )}
      <form action={action} className="mt-3">
        <VersandKnopf versandt={versandt} gesperrt={Boolean(gesperrt && !versandt)} />
      </form>
    </div>
  );
}

function FibsNachtragKnopf({ erledigt }: { erledigt: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant={erledigt ? "ghost" : "outline"} size="sm" disabled={pending}>
      {pending
        ? "Wird gespeichert …"
        : erledigt
          ? "Nachtrag zurücknehmen"
          : "Als in FIBS nachgetragen markieren"}
    </Button>
  );
}

function MeldenKnopf({ gemeldet }: { gemeldet: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Wird gespeichert …" : gemeldet ? "Ändern" : "Melden"}
    </Button>
  );
}

function VersandKnopf({
  versandt,
  gesperrt,
}: {
  versandt: boolean;
  gesperrt: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={versandt ? "ghost" : "outline"}
      size="sm"
      disabled={pending || gesperrt}
    >
      {pending
        ? "Wird gespeichert …"
        : versandt
          ? "Bestätigung zurücknehmen"
          : "Als versandt bestätigen"}
    </Button>
  );
}
