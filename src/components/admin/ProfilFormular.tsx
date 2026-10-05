"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { entferneProfilfoto, speichereEigenesProfil, speichereProfilfoto } from "@/actions/profil";
import { FUNKTIONEN } from "@/constants/fortbildung";
import type { FormularState } from "@/lib/validation/fortbildung";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MAX_FOTO_BYTES, TELEFON_MAX } from "@/lib/validation/profil";
import { useUngespeicherteAenderungen } from "@/lib/useUngespeicherteAenderungen";
import { T } from "@/texte/de";

export interface ProfilWerte {
  vorname: string;
  nachname: string;
  organisation: string | null;
  funktion: string;
  telefon: string | null;
  schwerpunkte: string | null;
  kurzprofil: string | null;
  referentId: string | null;
  portraetAm: Date | null;
}

export function ProfilFormular({
  werte,
  istAdmin = false,
}: {
  werte: ProfilWerte;
  /**
   * Referenten sehen unter dem Knopf den Hinweis, dass das Profil sofort im
   * Teambereich erscheint, Admins nicht. Der Knopf heißt für alle gleich.
   */
  istAdmin?: boolean;
}) {
  const [state, formAction, profilLaeuft] = useActionState<FormularState, FormData>(
    speichereEigenesProfil,
    {},
  );
  const fehler = state.fehler ?? {};
  // Ein Foto ist gewählt, aber noch nicht hochgeladen. Der große Knopf speichert
  // nur die Felder, der Hinweis steht deshalb auch neben ihm.
  const [fotoOffen, setFotoOffen] = useState(false);

  // Ungespeicherte Änderungen: Die Felder hier sind unkontrolliert, deshalb
  // genügt eine einzige delegierte change-Prüfung am Formular statt der
  // Signatur-Logik wie im Fortbildungsformular (siehe FortbildungForm/Wizard.tsx).
  const { markiereGeaendert, markiereGespeichert } = useUngespeicherteAenderungen();
  useEffect(() => {
    if (state.fehler) markiereGeaendert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div className="space-y-4">
      <PortraetBox istAdmin={istAdmin} referentId={werte.referentId} portraetAm={werte.portraetAm} vorname={werte.vorname} nachname={werte.nachname} onFotoOffen={setFotoOffen} />

      <form
        onChange={markiereGeaendert}
        // onSubmit in einer Transition statt action: Sonst setzt React 19 die
        // Felder nach dem Speichern auf die Startwerte zurück, auch bei Fehlern.
        onSubmit={(e) => {
          e.preventDefault();
          markiereGespeichert();
          const daten = new FormData(e.currentTarget);
          startTransition(() => formAction(daten));
        }}
        className="space-y-4 border bg-card p-5"
      >
      <div>
        <h2 className="font-semibold tracking-tight">{T.profil.ueberschrift}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{T.profil.hinweis}</p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          {T.profil.funktion} <span className="text-destructive">*</span>
        </legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {FUNKTIONEN.map((f) => (
            <label key={f.value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="funktion"
                value={f.value}
                defaultChecked={werte.funktion === f.value}
                required
                className="size-4 accent-primary"
              />
              {f.label}
            </label>
          ))}
        </div>
        {fehler.funktion ? (
          <p role="alert" className="text-sm text-destructive">{fehler.funktion}</p>
        ) : null}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Feld name="vorname" label={T.profil.vorname} pflicht wert={werte.vorname} fehler={fehler.vorname} />
        <Feld name="nachname" label={T.profil.nachname} pflicht wert={werte.nachname} fehler={fehler.nachname} />
        <Feld name="organisation" label={T.profil.stammschule} pflicht wert={werte.organisation ?? ""} fehler={fehler.organisation} />
        <Feld name="telefon" label={T.profil.telefon} wert={werte.telefon ?? ""} fehler={fehler.telefon} hinweis={T.profil.telefonHinweis} typ="tel" maxLength={TELEFON_MAX} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="schwerpunkte">{T.profil.schwerpunkte}</Label>
        <Input
          id="schwerpunkte"
          name="schwerpunkte"
          defaultValue={werte.schwerpunkte ?? ""}
          maxLength={200}
          className="w-full"
          aria-invalid={Boolean(fehler.schwerpunkte)}
        />
        {fehler.schwerpunkte ? (
          <p role="alert" className="text-sm text-destructive">{fehler.schwerpunkte}</p>
        ) : (
          <p className="text-xs text-muted-foreground">{T.profil.schwerpunkteHinweis}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="kurzprofil">{T.profil.kurzprofil}</Label>
        <Textarea
          id="kurzprofil"
          name="kurzprofil"
          rows={4}
          maxLength={1000}
          defaultValue={werte.kurzprofil ?? ""}
          className="w-full"
          aria-invalid={Boolean(fehler.kurzprofil)}
        />
        {fehler.kurzprofil ? (
          <p role="alert" className="text-sm text-destructive">{fehler.kurzprofil}</p>
        ) : (
          <p className="text-xs text-muted-foreground">{T.profil.kurzprofilHinweis}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <SpeichernKnopf laeuft={profilLaeuft} istAdmin={istAdmin} />
        {state.erfolg ? <span className="text-sm text-primary">{state.meldung}</span> : null}
        {fehler._ ? (
          <span role="alert" className="text-sm text-destructive">{fehler._}</span>
        ) : null}
      </div>
      {fotoOffen ? (
        <p role="status" className="text-sm font-medium">{T.profil.fotoOffenBeimProfil}</p>
      ) : null}
      {istAdmin ? null : (
        <p className="text-xs text-muted-foreground">{T.profil.veroeffentlichtHinweis}</p>
      )}
      </form>
    </div>
  );
}

/** pending kommt aus useActionState: das Formular sendet per Transition, nicht über action. */
function SpeichernKnopf({ laeuft: pending, istAdmin }: { laeuft: boolean; istAdmin: boolean }) {
  return (
    <Button type="submit" disabled={pending}>
      {pending ? T.profil.speichert : istAdmin ? T.profil.speichern : T.profil.speichernUndVeroeffentlichen}
    </Button>
  );
}

function PortraetBox({
  istAdmin,
  referentId,
  portraetAm,
  vorname,
  nachname,
  onFotoOffen,
}: {
  istAdmin: boolean;
  referentId: string | null;
  portraetAm: Date | null;
  vorname: string;
  nachname: string;
  /** Meldet, ob ein Foto gewählt, aber noch nicht hochgeladen ist. */
  onFotoOffen: (offen: boolean) => void;
}) {
  const [fotoState, fotoAction, fotoLaeuft] = useActionState<FormularState, FormData>(
    speichereProfilfoto,
    {},
  );
  const [entfernenState, entfernenAction] = useActionState<FormularState, FormData>(
    entferneProfilfoto,
    {},
  );
  // Beide Formulare behalten ihren Zustand. Angezeigt wird nur die Meldung
  // der zuletzt abgeschickten Aktion, sonst steht nach Entfernen und neuem
  // Hochladen noch „Foto wurde entfernt“ da.
  const [zuletzt, setZuletzt] = useState<"foto" | "entfernen" | null>(null);
  const fotoFehler = zuletzt === "foto" ? (fotoState.fehler ?? {}) : {};
  // Gewählte, aber noch nicht hochgeladene Datei und Größenprüfung im Browser.
  const [gewaehltBei, setGewaehltBei] = useState<FormularState | null>(null);
  const gewaehlt = gewaehltBei === fotoState;
  const [zuGross, setZuGross] = useState(false);
  const fotoFormRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (zuletzt === "foto" && fotoState.erfolg) {
      fotoFormRef.current?.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fotoState]);
  const initialen = `${vorname.charAt(0)}${nachname.charAt(0)}`.toUpperCase() || "?";

  return (
    <div className="space-y-3 border bg-card p-5">
      <div>
        <h2 className="font-semibold tracking-tight">{T.profil.foto}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{istAdmin ? T.profil.fotoHinweisAdmin : T.profil.fotoHinweis}</p>
      </div>

      <div className="flex items-center gap-4">
        {referentId && portraetAm ? (
          // eslint-disable-next-line @next/next/no-img-element -- eigene, nicht optimierbare Route, kein externes Bild
          <img
            src={`/api/portraet/${referentId}?v=${portraetAm.getTime()}`}
            alt=""
            className="size-20 rounded-full border object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="flex size-20 items-center justify-center rounded-full border bg-muted text-lg font-semibold text-muted-foreground"
          >
            {initialen}
          </div>
        )}

        {referentId ? (
          <div className="flex flex-1 flex-col gap-3">
            <form
              ref={fotoFormRef}
              onSubmit={(e) => {
                e.preventDefault();
                if (zuGross || fotoLaeuft) return;
                setZuletzt("foto");
                onFotoOffen(false);
                const daten = new FormData(e.currentTarget);
                startTransition(() => fotoAction(daten));
              }}
              className="flex flex-wrap items-center gap-3"
            >
              <Input
                type="file"
                name="foto"
                accept="image/jpeg,image/png,image/webp,image/gif"
                aria-invalid={Boolean(fotoFehler.foto) || zuGross}
                onChange={(e) => {
                  const datei = e.currentTarget.files?.[0];
                  const zugross = Boolean(datei && datei.size > MAX_FOTO_BYTES);
                  setGewaehltBei(datei ? fotoState : null);
                  setZuGross(zugross);
                  setZuletzt(null);
                  onFotoOffen(Boolean(datei) && !zugross);
                }}
                className="max-w-xs"
              />
              <FotoSpeichernKnopf laeuft={fotoLaeuft} />
            </form>

            {portraetAm ? (
              <form action={entfernenAction} onSubmit={() => setZuletzt("entfernen")}>
                <FotoEntfernenKnopf />
              </form>
            ) : null}

            {zuGross ? (
              <p role="alert" className="text-sm text-destructive">{T.profil.fotoZuGross}</p>
            ) : gewaehlt ? (
              <p className="text-sm text-muted-foreground">{T.profil.fotoNochNichtGespeichert}</p>
            ) : fotoFehler.foto ? (
              <p role="alert" className="text-sm text-destructive">{fotoFehler.foto}</p>
            ) : fotoFehler._ ? (
              <p role="alert" className="text-sm text-destructive">{fotoFehler._}</p>
            ) : zuletzt === "foto" && fotoState.erfolg ? (
              <p className="text-sm text-primary">{fotoState.meldung}</p>
            ) : null}

            {zuletzt !== "entfernen" ? null : entfernenState.fehler?._ ? (
              <p role="alert" className="text-sm text-destructive">{entfernenState.fehler._}</p>
            ) : entfernenState.erfolg ? (
              <p className="text-sm text-primary">{entfernenState.meldung}</p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{T.profil.fotoZuerstProfilSpeichern}</p>
        )}
      </div>
    </div>
  );
}

function FotoSpeichernKnopf({ laeuft: pending }: { laeuft: boolean }) {
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? T.profil.fotoSpeichertGerade : T.profil.fotoAuswaehlen}
    </Button>
  );
}

function FotoEntfernenKnopf() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" disabled={pending}>
      {pending ? T.profil.fotoEntferntGerade : T.profil.fotoEntfernen}
    </Button>
  );
}

function Feld({
  name,
  label,
  wert,
  fehler,
  hinweis,
  pflicht = false,
  typ = "text",
  maxLength,
}: {
  name: string;
  label: string;
  wert: string;
  fehler?: string;
  hinweis?: string;
  pflicht?: boolean;
  typ?: string;
  maxLength?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>
        {label}
        {pflicht ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Input
        id={name}
        name={name}
        type={typ}
        defaultValue={wert}
        required={pflicht}
        maxLength={maxLength}
        className="w-full"
        aria-invalid={Boolean(fehler)}
      />
      {fehler ? (
        <p role="alert" className="text-sm text-destructive">{fehler}</p>
      ) : hinweis ? (
        <p className="text-xs text-muted-foreground">{hinweis}</p>
      ) : null}
    </div>
  );
}
