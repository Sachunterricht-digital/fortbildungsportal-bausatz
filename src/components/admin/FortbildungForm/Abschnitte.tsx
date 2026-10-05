"use client";

import { CalendarOff, CalendarRange, Info } from "lucide-react";

import {
  NIVEAUSTUFEN,
  ORGANISATIONSFORMEN,
  SCHULARTEN_AUSWAHL,
  STATUS,
  STATUS_FUER_REFERENTEN,
  VERANSTALTUNGSFORMATE,
  organisationsformenAuswahl,
  terminOptional,
} from "@/constants/fortbildung";
import { AUSGEGRAUT } from "@/constants/funktionen";
import { cn } from "@/lib/utils";
import { T } from "@/texte/de";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { DigCompAccordion } from "./DigCompAccordion";
import { DatumZeitAuswahl } from "./DatumZeitAuswahl";
import { ReferentenPicker } from "./ReferentenPicker";
import { RichTextEditor } from "./RichTextEditor";
import { SchlagwortInput } from "./SchlagwortInput";
import { Terminumfeld } from "./Terminumfeld";
import type { FortbildungState } from "./state";
import type {
  FortbildungWerte,
  KompetenzBereichOption,
  ReferentOption,
} from "./types";

/**
 * Die fünf Feldgruppen der Fortbildung.
 *
 * Wizard und Bearbeiten-Ansicht rendern dieselben Komponenten — nur die
 * Rahmung unterscheidet sich (Schritte gegenüber Reitern). Damit kann eine
 * Feldänderung nicht in einer der beiden Ansichten vergessen werden.
 */

interface GemeinsameProps {
  /**
   * Redaktionsfelder (Kurztitel, Fach, DigCompEdu, FIBS) sieht nur, wer die
   * Kataloge fürs Schulamt zusammenstellt. Referenten tragen sie nicht ein.
   */
  redaktion?: boolean;
  zustand: FortbildungState;
  fehler: Record<string, string>;
  fortbildung?: FortbildungWerte;
  /** Steuert, ob Veröffentlichen zur Auswahl steht. */
  darfVeroeffentlichen?: boolean;
}

// ---------------------------------------------------------------------------

export function EckdatenFelder({
  zustand,
  fehler,
  fortbildung,
  darfVeroeffentlichen = true,
  redaktion = true,
  zeigeVeroeffentlichung = true,
}: GemeinsameProps & { zeigeVeroeffentlichung?: boolean }) {
  const freiwillig = terminOptional(zustand.organisationsform, zustand.format);
  const orgAuswahl = organisationsformenAuswahl(zustand.organisationsform);

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Feld
        className="md:col-span-2"
        label={T.maske.abschnitte.titelLabel}
        pflicht
        fehler={fehler.titel}
      >
        <Input
          name="titel"
          value={zustand.titel}
          onChange={(e) => zustand.setTitel(e.target.value)}
          maxLength={200}
          required
          className="w-full"
          aria-invalid={Boolean(fehler.titel)}
        />
      </Feld>

      {redaktion ? (
        <Feld
          className="md:col-span-2"
          label={T.maske.abschnitte.kurztitelLabel}
          hinweis={T.maske.abschnitte.kurztitelHinweis}
          fehler={fehler.kurztitel}
        >
          <Input
            name="kurztitel"
            value={zustand.kurztitel}
            onChange={(e) => zustand.setKurztitel(e.target.value)}
            maxLength={100}
            className="w-full"
          />
        </Feld>
      ) : null}

      <Feld
        label={T.maske.abschnitte.organisationsformLabel}
        pflicht
        fehler={fehler.organisationsform}
        hinweis={
          ORGANISATIONSFORMEN.find((o) => o.value === zustand.organisationsform)
            ?.beschreibung
        }
      >
        <Select
          name="organisationsform"
          value={zustand.organisationsform}
          onValueChange={(wert) => zustand.setOrganisationsform(String(wert))}
          items={orgAuswahl.map((o) => ({ value: o.value, label: o.label }))}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {orgAuswahl.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Feld>

      <Feld label={T.maske.abschnitte.maxTnLabel} pflicht={!freiwillig} fehler={fehler.maxTn}>
        <Input
          name="maxTn"
          type="number"
          min={1}
          max={1000}
          step={1}
          value={zustand.maxTn}
          onChange={(e) => zustand.setMaxTn(e.target.value)}
          required={!freiwillig}
          className="w-full"
          aria-invalid={Boolean(fehler.maxTn)}
        />
      </Feld>

      <Feld label={T.maske.abschnitte.formatLabel} pflicht fehler={fehler.format}>
        <Select
          name="format"
          value={zustand.format}
          onValueChange={(wert) => zustand.formatWechseln(String(wert))}
          items={VERANSTALTUNGSFORMATE.map((f) => ({ value: f.value, label: f.label }))}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VERANSTALTUNGSFORMATE.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Feld>

      <Feld
        label={T.maske.abschnitte.ortLabel}
        pflicht={!freiwillig}
        fehler={fehler.ortText}
      >
        <Input
          name="ortText"
          value={zustand.ortText}
          onChange={(e) => zustand.setOrtText(e.target.value)}
          maxLength={150}
          placeholder={T.maske.abschnitte.ortPlatzhalter}
          required={!freiwillig}
          className="w-full"
          aria-invalid={Boolean(fehler.ortText)}
        />
      </Feld>

      {freiwillig ? (
        // SchiLf und Video-Tutorial haben nie einen festen Termin: Die Felder
        // entfallen ganz, die Schule vereinbart den Termin direkt.
        <p className="text-sm text-muted-foreground md:col-span-2">
          {zustand.organisationsform === "SCHILF"
            ? T.maske.abschnitte.terminSchilfHinweis
            : T.maske.abschnitte.terminVideoHinweis}
        </p>
      ) : (
        <>
          <Feld label={T.maske.abschnitte.beginnLabel} pflicht fehler={fehler.beginn} hinweis={T.maske.abschnitte.terminEingabeHinweis}>
            <DatumZeitAuswahl
              name="beginn"
              label={T.maske.abschnitte.beginnLabel}
              wert={zustand.beginn}
              onChange={zustand.beginnSetzen}
              ungueltig={Boolean(fehler.beginn)}
            />
          </Feld>

          <Feld label={T.maske.abschnitte.endeLabel} pflicht fehler={fehler.ende} hinweis={T.maske.abschnitte.terminEingabeHinweis}>
            <DatumZeitAuswahl
              name="ende"
              label={T.maske.abschnitte.endeLabel}
              wert={zustand.ende}
              onChange={zustand.setEnde}
              ungueltig={Boolean(fehler.ende)}
            />
          </Feld>
        </>
      )}

      {zustand.terminHinweis ? (
        <div className="md:col-span-2">
          <TerminWarnung
            art={zustand.terminHinweis.art}
            text={zustand.terminHinweis.text}
          />
        </div>
      ) : null}

      {!AUSGEGRAUT.terminabgleich ? (
        <div className="md:col-span-2">
          <p className="mb-3 flex items-center gap-2 text-sm font-medium">
            <CalendarRange className="size-4 text-muted-foreground" aria-hidden />
            {T.maske.abschnitte.terminumfeldUeberschrift}
          </p>
          <Terminumfeld
            beginn={zustand.beginn}
            ende={zustand.ende}
            referentIds={zustand.referenten}
            eigeneId={fortbildung?.id}
          />
        </div>
      ) : null}

      {zeigeVeroeffentlichung ? (
        <div className="md:col-span-2">
          <VeroeffentlichungFelder
            zustand={zustand}
            fehler={fehler}
            fortbildung={fortbildung}
            darfVeroeffentlichen={darfVeroeffentlichen}
            redaktion={redaktion}
          />
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function VeroeffentlichungFelder({
  zustand,
  fehler,
  darfVeroeffentlichen = true,
  redaktion = true,
  statusUeberKnoepfe = false,
}: GemeinsameProps & {
  /** Der Status kommt aus den Knöpfen (Wizard, Referenten), nicht aus dem Auswahlfeld. */
  statusUeberKnoepfe?: boolean;
}) {
  // Referentinnen und Referenten reichen ein; veröffentlicht wird von der
  // Administration. Die Server Action prüft das noch einmal.
  const auswahl = darfVeroeffentlichen
    ? STATUS
    : STATUS.filter((s) => STATUS_FUER_REFERENTEN.includes(s.value));

  // Ein bereits veröffentlichtes Thema bleibt für Referentinnen und
  // Referenten inhaltlich offen (siehe STATUS_REFERENT_BEARBEITBAR), einen
  // Statuswechsel dürfen sie dabei aber nicht auslösen. Die Auswahl fehlt in
  // `auswahl` deshalb bewusst — statt der Select-Box steht hier nur der
  // feststehende Status, ein verstecktes Feld hält ihn beim Speichern.
  const bereitsVeroeffentlicht = !darfVeroeffentlichen && zustand.status === "VEROEFFENTLICHT";

  return (
    <div className="border bg-muted/30 p-4">
      <p className="mb-4 flex items-center gap-2 text-sm font-medium">
        <Info className="size-4 text-muted-foreground" aria-hidden />
        {darfVeroeffentlichen
          ? T.maske.abschnitte.veroeffentlichungTitelAdmin
          : T.maske.abschnitte.veroeffentlichungTitelReferent}
      </p>

      {!darfVeroeffentlichen ? (
        <p className="mb-4 text-sm text-muted-foreground text-pretty">
          {bereitsVeroeffentlicht
            ? T.maske.abschnitte.veroeffentlichungHinweisReferentVeroeffentlicht
            : T.maske.abschnitte.veroeffentlichungHinweisReferent}
        </p>
      ) : null}

      <div className="grid gap-5 md:grid-cols-3">
        {statusUeberKnoepfe && !bereitsVeroeffentlicht ? (
          <input type="hidden" name="status" value={zustand.status} />
        ) : bereitsVeroeffentlicht ? (
          <Feld label={T.maske.abschnitte.statusLabel}>
            <input type="hidden" name="status" value="VEROEFFENTLICHT" />
            <p className="text-sm">
              {STATUS.find((s) => s.value === "VEROEFFENTLICHT")?.label}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {STATUS.find((s) => s.value === "VEROEFFENTLICHT")?.beschreibung}
            </p>
          </Feld>
        ) : (
          <Feld label={T.maske.abschnitte.statusLabel} fehler={fehler.status}>
            <Select
              name="status"
              value={zustand.status}
              onValueChange={(wert) => zustand.setStatus(String(wert))}
              items={auswahl.map((s) => ({ value: s.value, label: s.label }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {auswahl.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {STATUS.find((s) => s.value === zustand.status)?.beschreibung}
            </p>
          </Feld>
        )}

        {redaktion ? (
          <>
        <Feld label={T.maske.abschnitte.fibsNummerLabel} fehler={fehler.fibsLehrgangsnummer}>
          <Input
            name="fibsLehrgangsnummer"
            value={zustand.fibsLehrgangsnummer}
            onChange={(e) => zustand.setFibsLehrgangsnummer(e.target.value)}
            placeholder={T.maske.abschnitte.fibsNummerPlatzhalter}
            className="w-full"
          />
        </Feld>

        <Feld
          label={T.maske.abschnitte.fibsUrlLabel}
          fehler={fehler.fibsUrl}
          hinweis={T.maske.abschnitte.fibsUrlHinweis}
        >
          <Input
            name="fibsUrl"
            type="url"
            value={zustand.fibsUrl}
            onChange={(e) => zustand.setFibsUrl(e.target.value)}
            placeholder={T.maske.abschnitte.fibsUrlPlatzhalter}
            className="w-full"
            aria-invalid={Boolean(fehler.fibsUrl)}
          />
        </Feld>
          </>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function BeschreibungFelder({ zustand, fehler }: GemeinsameProps) {
  return (
    <Feld
      label={T.maske.abschnitte.beschreibungLabel}
      pflicht
      fehler={fehler.beschreibungHtml}
      hinweis={T.maske.abschnitte.beschreibungHinweis}
    >
      <RichTextEditor
        wert={zustand.beschreibung}
        onChange={zustand.setBeschreibung}
        fehlerhaft={Boolean(fehler.beschreibungHtml)}
      />
    </Feld>
  );
}

// ---------------------------------------------------------------------------

export function ZielgruppeFelder({
  zustand,
  fehler,
  redaktion = true,
  schlagwortVorschlaege,
  pflichtSchlagworte,
}: GemeinsameProps & { schlagwortVorschlaege: string[]; pflichtSchlagworte: string[] }) {
  return (
    <div className="space-y-6">
      <Feld label={T.maske.abschnitte.schulartenLabel} pflicht fehler={fehler.schularten}>
        <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {SCHULARTEN_AUSWAHL.map((schulart) => (
            <label
              key={schulart.value}
              className="flex items-center gap-2.5 px-2.5 py-1.5 transition-colors hover:bg-accent/50"
            >
              <Checkbox
                name="schularten"
                value={schulart.value}
                checked={zustand.schularten.includes(schulart.value)}
                onCheckedChange={(checked) =>
                  zustand.setSchularten(
                    checked
                      ? [...zustand.schularten, schulart.value]
                      : zustand.schularten.filter((s) => s !== schulart.value),
                  )
                }
              />
              <span className="text-sm">{schulart.label}</span>
            </label>
          ))}
        </div>
      </Feld>

      {redaktion ? (
        <Feld
          label={T.maske.abschnitte.fachLabel}
          hinweis={T.maske.abschnitte.fachHinweis}
          fehler={fehler.fach}
          className="max-w-sm"
        >
          <Input
            name="fach"
            value={zustand.fach}
            onChange={(e) => zustand.setFach(e.target.value)}
            maxLength={100}
            className="w-full"
          />
        </Feld>
      ) : null}

      <Feld
        label={T.maske.abschnitte.schlagworteLabel}
        fehler={fehler.schlagworte}
        hinweis={
          pflichtSchlagworte.length
            ? T.maske.abschnitte.schlagwortePflichtHinweis
            : T.maske.abschnitte.schlagworteHinweis
        }
      >
        <SchlagwortInput
          pflicht={pflichtSchlagworte}
          werte={zustand.schlagworte}
          onChange={zustand.setSchlagworte}
          vorschlaege={schlagwortVorschlaege}
        />
      </Feld>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function DigCompFelder({
  zustand,
  fehler,
  kompetenzBereiche,
}: GemeinsameProps & { kompetenzBereiche: KompetenzBereichOption[] }) {
  return (
    <div className="space-y-6">
      <Feld label={T.maske.abschnitte.niveaustufeLabel} pflicht fehler={fehler.niveaustufe} className="max-w-xs">
        <Select
          value={zustand.niveaustufe}
          onValueChange={(wert) => zustand.setNiveaustufe(String(wert))}
          items={NIVEAUSTUFEN.map((n) => ({ value: n.value, label: n.label }))}
        >
          <SelectTrigger className="w-full" aria-invalid={Boolean(fehler.niveaustufe)}>
            <SelectValue placeholder={T.maske.abschnitte.niveaustufePlatzhalter} />
          </SelectTrigger>
          <SelectContent>
            {NIVEAUSTUFEN.map((n) => (
              <SelectItem key={n.value} value={n.value}>
                {n.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Feld>

      <Feld
        label={T.maske.abschnitte.kompetenzenLabel}
        pflicht
        fehler={fehler.kompetenzen}
        hinweis={T.maske.abschnitte.kompetenzenHinweis}
      >
        <DigCompAccordion
          bereiche={kompetenzBereiche}
          ausgewaehlt={zustand.kompetenzen}
          onChange={zustand.setKompetenzen}
        />
      </Feld>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function ReferentenFelder({
  zustand,
  fehler,
  referenten,
}: GemeinsameProps & { referenten: ReferentOption[] }) {
  return (
    <Feld
      label={T.maske.abschnitte.referentenLabel}
      pflicht
      fehler={fehler.referenten}
      hinweis={T.maske.abschnitte.referentenHinweis}
    >
      <ReferentenPicker
        referenten={referenten}
        ausgewaehlt={zustand.referenten}
        onChange={zustand.setReferenten}
      />
    </Feld>
  );
}

// ---------------------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------------------

export function Feld({
  label,
  pflicht,
  hinweis,
  fehler,
  className,
  children,
}: {
  label: string;
  pflicht?: boolean;
  hinweis?: string;
  fehler?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="flex items-center gap-1">
        {label}
        {pflicht ? (
          <span className="text-destructive" aria-label={T.maske.abschnitte.pflichtfeldAriaLabel}>
            *
          </span>
        ) : null}
      </Label>

      {children}

      {fehler ? (
        <p role="alert" className="text-sm text-destructive">
          {fehler}
        </p>
      ) : hinweis ? (
        <p className="text-xs text-muted-foreground">{hinweis}</p>
      ) : null}
    </div>
  );
}

/**
 * Hinweis auf Ferien, Feiertage und Wochenenden.
 *
 * Bewusst nur ein Hinweis, keine Sperre: Eine SchiLf am Buß- und Bettag oder
 * ein Studientag in den Ferien kann gewollt sein. Der häufigere Fall ist aber
 * der Tippfehler im Datum — und den fängt der Hinweis ab, bevor der Termin
 * veröffentlicht ist.
 */
export function TerminWarnung({ art, text }: { art: string; text: string }) {
  const dringend = art === "ferien" || art === "feiertag";

  return (
    <p
      className={cn(
        "flex items-start gap-2 px-4 py-3 text-sm",
        dringend ? "bg-ferien-weich text-ferien" : "bg-muted text-muted-foreground",
      )}
    >
      <CalendarOff className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        {text}
        {dringend ? (
          <span className="block text-xs opacity-80">
            {T.maske.abschnitte.terminWarnungZusatz}
          </span>
        ) : null}
      </span>
    </p>
  );
}
