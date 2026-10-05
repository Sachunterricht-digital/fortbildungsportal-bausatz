"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { flushSync, useFormStatus } from "react-dom";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
} from "lucide-react";

import { saveFortbildung } from "@/actions/fortbildung";
import type { FormularState } from "@/lib/validation/fortbildung";
import { formatZeitraum, parseDatumZeitEingabe } from "@/lib/datetime";
import {
  formatLabel,
  niveaustufeLabel,
  organisationsformLabel,
  schulartLabel,
  statusLabel,
} from "@/constants/fortbildung";
import { cn } from "@/lib/utils";
import { useUngespeicherteAenderungen } from "@/lib/useUngespeicherteAenderungen";
import { T } from "@/texte/de";

import { Button } from "@/components/ui/button";

import {
  BeschreibungFelder,
  DigCompFelder,
  EckdatenFelder,
  ReferentenFelder,
  VeroeffentlichungFelder,
  ZielgruppeFelder,
} from "./Abschnitte";
import { schritteFuer, type Schritt } from "./schritte";
import { FehlerUebersicht } from "./FehlerUebersicht";
import { schrittFehler, useFortbildungState } from "./state";
import type {
  KompetenzBereichOption,
  ReferentOption,
} from "./types";

/**
 * Schrittweises Anlegen einer Fortbildung.
 *
 * Der Wizard führt durch alle Abschnitte und prüft jeden Schritt, bevor es
 * weitergeht. Damit lässt sich keine Angabe mehr übersehen, die im
 * Reiterformular in einem geschlossenen Reiter unsichtbar geblieben wäre.
 *
 * Der letzte Schritt fasst alles zusammen. Als Entwurf lässt sich jederzeit
 * speichern — auch unvollständig, sonst ginge angefangene Arbeit verloren.
 * Vollständig sein muss erst, was veröffentlicht wird.
 */
export function FortbildungWizard({
  kompetenzBereiche,
  referenten,
  schlagwortVorschlaege,
  pflichtSchlagworte,
  darfVeroeffentlichen,
  redaktion,
  eigeneReferentId,
}: {
  kompetenzBereiche: KompetenzBereichOption[];
  referenten: ReferentOption[];
  schlagwortVorschlaege: string[];
  pflichtSchlagworte: string[];
  darfVeroeffentlichen: boolean;
  redaktion: boolean;
  /** Referenten sind bei ihrem eigenen Thema gleich als Leitung eingetragen. */
  eigeneReferentId?: string | null;
}) {
  const action = saveFortbildung.bind(null, null);
  const [state, formAction] = useActionState<FormularState, FormData>(action, {});

  const [index, setIndex] = useState(0);
  const [lokaleFehler, setLokaleFehler] = useState<Record<string, string>>({});
  const formularRef = useRef<HTMLFormElement>(null);

  const zustand = useFortbildungState(undefined, eigeneReferentId ? [eigeneReferentId] : []);
  const serverFehler = useMemo(() => state.fehler ?? {}, [state.fehler]);
  const fehler = { ...lokaleFehler, ...serverFehler };

  // Ungespeicherte Änderungen: Signatur aus dem gesamten Formularzustand
  // (Setter-Funktionen fallen bei JSON.stringify automatisch weg), verglichen
  // mit dem Stand beim letzten Speichern. Bei einem Fehler beim Speichern
  // (z. B. abgelaufene Sitzung, Konflikt) bleibt die Warnung aktiv.
  const { markiereGeaendert, markiereGespeichert } = useUngespeicherteAenderungen();
  const datenSignatur = JSON.stringify(zustand);
  const gespeicherterStand = useRef(datenSignatur);
  useEffect(() => {
    if (datenSignatur !== gespeicherterStand.current) markiereGeaendert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datenSignatur]);
  useEffect(() => {
    if (state.fehler) markiereGeaendert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const schritte = schritteFuer(redaktion);
  const schritt = schritte[index]!;
  const letzter = index === schritte.length - 1;

  function weiter() {
    const gefunden = schrittFehler(
      schritt.pflichtfelder,
      zustand,
      formularRef.current,
    );

    if (Object.keys(gefunden).length > 0) {
      setLokaleFehler(gefunden);
      return;
    }

    setLokaleFehler({});
    setIndex((i) => Math.min(i + 1, schritte.length - 1));
    formularRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function zurueck() {
    setLokaleFehler({});
    setIndex((i) => Math.max(i - 1, 0));
  }

  /** Bereits abgeschlossene Schritte lassen sich direkt anspringen. */
  function springe(ziel: number) {
    if (ziel > index) return;
    setLokaleFehler({});
    setIndex(ziel);
  }

  const gemeinsam = { zustand, fehler, darfVeroeffentlichen, redaktion };

  return (
    <form
      ref={formularRef}
      action={formAction}
      noValidate
      className="space-y-8"
      onKeyDown={(e) => {
        // Enter in einem einzeiligen Feld darf nicht absenden: sonst löst der
        // Browser den ersten Absende-Knopf aus und der Assistent ist weg.
        // Felder, die Enter selbst behandeln (Schlagworte), setzen defaultPrevented.
        if (e.key !== "Enter" || e.defaultPrevented) return;
        const ziel = e.target;
        if (!(ziel instanceof HTMLInputElement) || ziel.form !== e.currentTarget) return;
        if (ziel.type === "button" || ziel.type === "submit") return;
        e.preventDefault();
        if (!letzter) weiter();
      }}
      onSubmit={() => {
        gespeicherterStand.current = datenSignatur;
        markiereGespeichert();
      }}
    >
      {/* Eine gemeinsame Datumsprüfung statt nativer Prüfung versteckter Felder. */}
      <input type="hidden" name="beschreibungHtml" value={zustand.beschreibung} />
      <input type="hidden" name="niveaustufe" value={zustand.niveaustufe} />

      <Fortschritt index={index} schritte={schritte} onSpringe={springe} />

      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {index + 1}. {schritt.titel}
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground text-pretty">
          {schritt.hilfe}
        </p>
      </div>

      <FehlerUebersicht
        fehler={serverFehler}
        onAbschnitt={(abschnitt, feld) => {
          // Die Status-/FIBS-Felder stehen im Wizard im letzten Schritt.
          const ziel = ["status", "fibsUrl", "fibsLehrgangsnummer"].includes(feld)
            ? schritte.length - 1
            : schritte.findIndex((s) => s.id === abschnitt);
          if (ziel >= 0) { setLokaleFehler({}); setIndex(ziel); }
        }}
      />

      {/*
        Alle Abschnitte bleiben im DOM — sonst fehlten die Felder der noch
        nicht besuchten Schritte beim Absenden. Nur der aktuelle ist sichtbar.
      */}
      <Abschnitt sichtbar={schritt.id === "eckdaten"}>
        <EckdatenFelder {...gemeinsam} zeigeVeroeffentlichung={false} />
      </Abschnitt>

      <Abschnitt sichtbar={schritt.id === "beschreibung"}>
        <BeschreibungFelder {...gemeinsam} />
      </Abschnitt>

      <Abschnitt sichtbar={schritt.id === "zielgruppe"}>
        <ZielgruppeFelder
          {...gemeinsam}
          schlagwortVorschlaege={schlagwortVorschlaege}
          pflichtSchlagworte={pflichtSchlagworte}
        />
      </Abschnitt>

      <Abschnitt sichtbar={schritt.id === "digcomp"}>
        <DigCompFelder {...gemeinsam} kompetenzBereiche={kompetenzBereiche} />
      </Abschnitt>

      <Abschnitt sichtbar={schritt.id === "referenten"}>
        <ReferentenFelder {...gemeinsam} referenten={referenten} />
      </Abschnitt>

      <Abschnitt sichtbar={letzter}>
        <div className="space-y-6">
          <Zusammenfassung
            pflichtSchlagworte={pflichtSchlagworte}
            zustand={zustand}
            referenten={referenten}
            kompetenzBereiche={kompetenzBereiche}
            redaktion={redaktion}
          />
          <VeroeffentlichungFelder
            zustand={zustand}
            fehler={fehler}
            darfVeroeffentlichen={darfVeroeffentlichen}
            redaktion={redaktion}
            statusUeberKnoepfe={!darfVeroeffentlichen}
          />
        </div>
      </Abschnitt>

      <div className="flex flex-wrap items-center gap-3 border-t pt-6">
        {index > 0 ? (
          <Button type="button" variant="outline" onClick={zurueck}>
            <ArrowLeft className="size-4" aria-hidden />
            {T.maske.wizard.zurueck}
          </Button>
        ) : null}

        {letzter && !darfVeroeffentlichen ? (
          <ReferentenKnoepfe
            bereitsVeroeffentlicht={zustand.status === "VEROEFFENTLICHT"}
            setStatus={zustand.setStatus}
          />
        ) : letzter ? (
          <Speichern
            status={zustand.status}
            darfVeroeffentlichen={darfVeroeffentlichen}
          />
        ) : (
          <>
            <Button type="button" onClick={weiter}>
              {T.maske.wizard.weiter}
              <ArrowRight className="size-4" aria-hidden />
            </Button>
            {/* Zwischenstand sichern, ohne erst alle Schritte zu durchlaufen. */}
            <Button type="submit" variant="outline" onClick={() => flushSync(() => zustand.setStatus("ENTWURF"))}>
              {T.maske.wizard.alsEntwurfSpeichern}
            </Button>
          </>
        )}

        <Button
          nativeButton={false}
          variant="ghost"
          render={
            // Warnung bei ungespeicherten Änderungen läuft zentral über den
            // document-weiten Klick-Abfang in useUngespeicherteAenderungen.
            <Link href="/admin">{T.maske.wizard.abbrechen}</Link>
          }
        />

        <span className="ml-auto text-sm text-muted-foreground">
          {T.maske.wizard.schrittVon(index + 1, schritte.length)}
        </span>
      </div>
      {/* Beide Knopfbeschriftungen gibt es nur im letzten Schritt (Statuswahl bestimmt den Knopf). */}
      {letzter && !darfVeroeffentlichen ? (
        <p className="-mt-3 text-xs text-muted-foreground text-pretty">
          {T.maske.wizard.knopfHinweisReferent}
        </p>
      ) : null}
    </form>
  );
}

// ---------------------------------------------------------------------------

function Abschnitt({
  sichtbar,
  children,
}: {
  sichtbar: boolean;
  children: React.ReactNode;
}) {
  return (
    <div hidden={!sichtbar} aria-hidden={!sichtbar}>
      {children}
    </div>
  );
}

function Fortschritt({
  index,
  schritte,
  onSpringe,
}: {
  index: number;
  schritte: Schritt[];
  onSpringe: (ziel: number) => void;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2">
      {schritte.map((schritt, i) => {
        const erledigt = i < index;
        const aktuell = i === index;

        return (
          <li key={schritt.id} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onSpringe(i)}
              disabled={i > index}
              aria-current={aktuell ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 px-2.5 py-1.5 text-sm transition-colors",
                aktuell && "bg-primary/10 font-medium text-primary",
                erledigt && "text-muted-foreground hover:bg-accent hover:text-foreground",
                i > index && "cursor-default text-muted-foreground/50",
              )}
            >
              <span
                className={cn(
                  "zahl flex size-5 shrink-0 items-center justify-center text-xs",
                  aktuell && "bg-primary text-primary-foreground",
                  erledigt && "bg-primary/15 text-primary",
                  i > index && "border border-current",
                )}
              >
                {erledigt ? <Check className="size-3" aria-hidden /> : i + 1}
              </span>
              <span className="hidden sm:inline">{schritt.titel}</span>
            </button>

            {i < schritte.length - 1 ? (
              <span className="h-px w-3 bg-border sm:w-5" aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Letzter Schritt für Referentinnen und Referenten: zwei klare Wege statt
 * Statusfeld. Der Status wird vor dem Absenden synchron gesetzt, damit das
 * versteckte Feld `status` beim Submit schon den richtigen Wert trägt.
 */
function ReferentenKnoepfe({
  bereitsVeroeffentlicht,
  setStatus,
}: {
  bereitsVeroeffentlicht: boolean;
  setStatus: (status: string) => void;
}) {
  const { pending } = useFormStatus();

  if (bereitsVeroeffentlicht) {
    return (
      <Button type="submit" disabled={pending}>
        {pending ? T.maske.wizard.wirdGespeichert : T.maske.wizard.speichern}
      </Button>
    );
  }

  return (
    <>
      <Button
        type="submit"
        disabled={pending}
        onClick={() => flushSync(() => setStatus("EINGEREICHT"))}
      >
        {pending ? T.maske.wizard.wirdGespeichert : T.maske.wizard.zurFreigabeEinreichen}
      </Button>
      <Button
        type="submit"
        variant="outline"
        disabled={pending}
        onClick={() => flushSync(() => setStatus("ENTWURF"))}
      >
        {T.maske.wizard.alsEntwurfSpeichern}
      </Button>
    </>
  );
}

function Speichern({
  status,
  darfVeroeffentlichen,
}: {
  status: string;
  darfVeroeffentlichen: boolean;
}) {
  const { pending } = useFormStatus();

  const beschriftung =
    status === "ENTWURF"
      ? T.maske.wizard.alsEntwurfSpeichern
      : status === "EINGEREICHT"
        ? T.maske.wizard.zurFreigabeEinreichen
        : darfVeroeffentlichen
          ? T.maske.wizard.anlegenUndVeroeffentlichen
          : T.maske.wizard.speichern;

  return (
    <Button type="submit" disabled={pending}>
      {pending ? T.maske.wizard.wirdGespeichert : beschriftung}
    </Button>
  );
}

// ---------------------------------------------------------------------------

/** Letzter Schritt: alle Angaben auf einen Blick, mit Vollständigkeitsprüfung. */
function Zusammenfassung({
  pflichtSchlagworte,
  zustand,
  referenten,
  kompetenzBereiche,
  redaktion,
}: {
  pflichtSchlagworte: string[];
  zustand: ReturnType<typeof useFortbildungState>;
  referenten: ReferentOption[];
  kompetenzBereiche: KompetenzBereichOption[];
  redaktion: boolean;
}) {
  const beginn = parseDatumZeitEingabe(zustand.beginn);
  const ende = parseDatumZeitEingabe(zustand.ende);

  const gewaehlteReferenten = referenten.filter((r) =>
    zustand.referenten.includes(r.id),
  );

  const kompetenzTitel = kompetenzBereiche
    .flatMap((b) => [
      { code: b.code, titel: b.titel },
      ...b.children.map((k) => ({ code: k.code, titel: k.titel })),
    ])
    .filter((k) => zustand.kompetenzen.includes(k.code))
    .map((k) => `${k.code} ${k.titel}`);

  /** Was fehlt, wenn direkt veröffentlicht werden soll. */
  const luecken: string[] = [];
  // Niveaustufe und DigCompEdu ergänzt die Redaktion, Referenten sehen sie nicht.
  if (redaktion && !zustand.niveaustufe) luecken.push(T.maske.wizard.zeileNiveaustufe);
  if (redaktion && zustand.kompetenzen.length === 0) luecken.push(T.maske.wizard.lueckeKompetenzen);
  if (zustand.referenten.length === 0) luecken.push(T.maske.abschnitte.referentenLabel);

  return (
    <div className="space-y-4">
      {luecken.length > 0 ? (
        <p className="flex items-start gap-2 bg-ferien-weich px-4 py-3 text-sm text-ferien">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {T.maske.wizard.lueckenHinweis(luecken.join(", "))}
          </span>
        </p>
      ) : (
        <p className="flex items-start gap-2 bg-primary/10 px-4 py-3 text-sm text-primary">
          <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
          {T.maske.wizard.allesVollstaendig}
        </p>
      )}

      <dl className="grid gap-x-8 gap-y-4 border bg-card p-6 sm:grid-cols-2">
        <Zeile
          label={T.maske.wizard.zeileTermin}
          wert={beginn && ende ? formatZeitraum(beginn, ende) : T.maske.wizard.leerwert}
        />
        <Zeile
          label={T.maske.wizard.zeileArt}
          wert={`${organisationsformLabel(zustand.organisationsform)} · ${formatLabel(zustand.format)}`}
        />
        <Zeile label={T.maske.wizard.zeileOrt} wert={zustand.ortText.trim() || T.maske.wizard.leerwert} />
        <Zeile
          label={T.maske.wizard.zeileSchularten}
          wert={
            zustand.schularten.length > 0
              ? zustand.schularten.map(schulartLabel).join(", ")
              : T.maske.wizard.leerwert
          }
        />
        <Zeile
          label={T.maske.wizard.zeileNiveaustufe}
          wert={zustand.niveaustufe ? niveaustufeLabel(zustand.niveaustufe) : T.maske.wizard.leerwert}
        />
        <Zeile
          label={T.maske.wizard.zeileReferenten}
          wert={
            gewaehlteReferenten.length > 0
              ? gewaehlteReferenten
                  .map((r) => `${r.vorname} ${r.nachname}`)
                  .join(", ")
              : T.maske.wizard.leerwert
          }
        />
        <Zeile
          className="sm:col-span-2"
          label={T.maske.wizard.zeileKompetenzen}
          wert={kompetenzTitel.length > 0 ? kompetenzTitel.join(" · ") : T.maske.wizard.leerwert}
        />
        <Zeile
          className="sm:col-span-2"
          label={T.maske.wizard.zeileSchlagworte}
          wert={[...new Set([...pflichtSchlagworte, ...zustand.schlagworte])].join(", ")}
        />
        <Zeile label={T.maske.wizard.zeileStatus} wert={statusLabel(zustand.status)} />
      </dl>
    </div>
  );
}

function Zeile({
  label,
  wert,
  className,
}: {
  label: string;
  wert: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-pretty">{wert}</dd>
    </div>
  );
}
