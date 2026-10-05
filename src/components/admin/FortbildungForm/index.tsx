"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";

import { saveFortbildung } from "@/actions/fortbildung";
import { fehlerTab, type FormularState } from "@/lib/validation/fortbildung";
import { FehlerUebersicht } from "./FehlerUebersicht";
import { useUngespeicherteAenderungen } from "@/lib/useUngespeicherteAenderungen";
import { T } from "@/texte/de";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  BeschreibungFelder,
  DigCompFelder,
  EckdatenFelder,
  ReferentenFelder,
  ZielgruppeFelder,
} from "./Abschnitte";
import { useFortbildungState } from "./state";
import type {
  FortbildungWerte,
  KompetenzBereichOption,
  ReferentOption,
} from "./types";

const ALLE_TABS = [
  { id: "eckdaten", label: T.maske.abschnitteNamen.eckdaten },
  { id: "beschreibung", label: T.maske.abschnitteNamen.beschreibung },
  { id: "zielgruppe", label: T.maske.abschnitteNamen.zielgruppe },
  { id: "digcomp", label: T.maske.abschnitteNamen.digcomp },
  { id: "referenten", label: T.maske.abschnitteNamen.referenten },
] as const;

/** Ohne Redaktionsrechte entfällt der DigCompEdu-Reiter. */
const tabsFuer = (redaktion: boolean) =>
  redaktion ? ALLE_TABS : ALLE_TABS.filter((t) => t.id !== "digcomp");

/**
 * Bearbeiten einer bestehenden Fortbildung.
 *
 * Hier bewusst Reiter statt Schritte: Wer etwas ändern will, springt gezielt
 * zu einem Abschnitt und will nicht durch sechs Schritte geführt werden. Das
 * schrittweise Anlegen übernimmt der Wizard (siehe Wizard.tsx), beide nutzen
 * dieselben Feldgruppen.
 */
export function FortbildungForm({
  fortbildung,
  kompetenzBereiche,
  referenten,
  schlagwortVorschlaege,
  pflichtSchlagworte,
  darfVeroeffentlichen,
  redaktion,
  startTab,
}: {
  fortbildung?: FortbildungWerte;
  kompetenzBereiche: KompetenzBereichOption[];
  referenten: ReferentOption[];
  schlagwortVorschlaege: string[];
  pflichtSchlagworte: string[];
  darfVeroeffentlichen: boolean;
  redaktion: boolean;
  /** Reiter beim Öffnen, etwa nach dem Speichern der zuletzt offene (`?tab=`). */
  startTab?: string;
}) {
  const action = saveFortbildung.bind(null, fortbildung?.id ?? null);
  const [state, formAction] = useActionState<FormularState, FormData>(action, {});
  // Nach dem Speichern bleibt der zuletzt offene Reiter offen:
  // Das Formular schickt ihn als Feld „tab“ mit, die Action hängt ihn an die
  // Weiterleitung, die Seite reicht ihn als startTab zurück.
  const [tab, setTab] = useState<string>(() =>
    tabsFuer(redaktion).some((t) => t.id === startTab) ? (startTab as string) : "eckdaten",
  );

  const zustand = useFortbildungState(fortbildung);

  // Eigenes useMemo, damit das leere Objekt nicht bei jedem Rendern neu
  // entsteht und die abhängigen Memos ständig neu rechnen lässt.
  const fehler = useMemo(() => state.fehler ?? {}, [state.fehler]);

  // Ungespeicherte Änderungen: siehe Wizard.tsx für die gleiche Signatur-Logik.
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

  /** Reiter, in denen mindestens ein Fehler steckt. */
  const fehlerhafteTabs = useMemo(() => {
    const menge = new Set<string>();
    for (const feld of Object.keys(fehler)) {
      const zielTab = fehlerTab(feld);
      if (zielTab) menge.add(zielTab);
    }
    return menge;
  }, [fehler]);

  const gemeinsam = { zustand, fehler, fortbildung, darfVeroeffentlichen, redaktion };

  return (
    <form
      action={formAction}
      noValidate
      className="space-y-6"
      onSubmit={() => {
        gespeicherterStand.current = datenSignatur;
        markiereGespeichert();
      }}
    >
      {/* Verdeckte Pflichtfelder dürfen die Serverprüfung nicht lautlos blockieren. */}
      {/* Werte aus dem State, die kein sichtbares Formularfeld haben. */}
      <input type="hidden" name="beschreibungHtml" value={zustand.beschreibung} />
      <input type="hidden" name="niveaustufe" value={zustand.niveaustufe} />
      <input type="hidden" name="tab" value={tab} />
      {/* Optimistische Sperre: siehe saveFortbildung() in src/actions/fortbildung.ts. */}
      {fortbildung ? (
        <input type="hidden" name="updatedAt" value={fortbildung.updatedAt.toISOString()} />
      ) : null}

      <FehlerUebersicht fehler={fehler} onAbschnitt={(abschnitt) => setTab(abschnitt)} />

      <Tabs value={tab} onValueChange={(wert) => setTab(String(wert))}>
        <TabsList className="w-full justify-start overflow-x-auto">
          {tabsFuer(redaktion).map(({ id, label }) => (
            <TabsTrigger key={id} value={id}>
              {label}
              {fehlerhafteTabs.has(id) ? (
                <span
                  aria-label={T.maske.form.tabFehlerAriaLabel}
                  className="ml-1 size-1.5 bg-destructive"
                />
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="eckdaten" keepMounted className="pt-6">
          <EckdatenFelder {...gemeinsam} />
        </TabsContent>

        <TabsContent value="beschreibung" keepMounted className="pt-6">
          <BeschreibungFelder {...gemeinsam} />
        </TabsContent>

        <TabsContent value="zielgruppe" keepMounted className="pt-6">
          <ZielgruppeFelder
            {...gemeinsam}
            schlagwortVorschlaege={schlagwortVorschlaege}
            pflichtSchlagworte={pflichtSchlagworte}
          />
        </TabsContent>

        <TabsContent value="digcomp" keepMounted className="pt-6">
          <DigCompFelder {...gemeinsam} kompetenzBereiche={kompetenzBereiche} />
        </TabsContent>

        <TabsContent value="referenten" keepMounted className="pt-6">
          <ReferentenFelder {...gemeinsam} referenten={referenten} />
        </TabsContent>
      </Tabs>

      <div className="flex items-center gap-3 border-t pt-6">
        <Speichern />
        <Button
          nativeButton={false}
          variant="ghost"
          render={
            // Warnung bei ungespeicherten Änderungen läuft zentral über den
            // document-weiten Klick-Abfang in useUngespeicherteAenderungen.
            <Link href="/admin">{T.maske.form.abbrechen}</Link>
          }
        />
      </div>
    </form>
  );
}

function Speichern() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? T.maske.form.wirdGespeichert : T.maske.form.aenderungenSpeichern}
    </Button>
  );
}
