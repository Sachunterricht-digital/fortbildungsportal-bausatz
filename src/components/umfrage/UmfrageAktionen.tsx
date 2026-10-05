"use client";

import { useActionState, useState } from "react";
import { Bell, CalendarCheck, Lock, LockOpen, Mail, Trash2, UserPlus } from "lucide-react";

import {
  fuegePersonenHinzu,
  legeTerminFest,
  loescheUmfrage,
  oeffneUmfrage,
  schliesseUmfrage,
  sendeUmfrageEinladungen,
  sendeUmfrageErinnerungen,
  type UmfrageMailState,
} from "@/actions/umfrage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UMFRAGE_GRENZEN } from "@/constants/umfrage";
import type { FormularState } from "@/lib/validation/fortbildung";
import { T } from "@/texte/de";

const TD = T.umfrage.detail;
const TM = T.umfrage.mail;

export interface MailVorlage {
  betreff: string;
  text: string;
  /** Wie viele Personen die Mail bekämen */
  anzahl: number;
}

export function UmfrageAktionen({
  umfrageId,
  titel,
  offen,
  einladung,
  erinnerung,
  verfuegbarePersonen,
  termine,
}: {
  umfrageId: string;
  titel: string;
  offen: boolean;
  einladung: MailVorlage;
  erinnerung: MailVorlage;
  verfuegbarePersonen: Array<{ id: string; name: string; organisation: string | null }>;
  termine: Array<{ id: string; label: string }>;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={TD.aktionen}>
      <MailDialog art="EINLADUNG" umfrageId={umfrageId} vorlage={einladung} offen={offen} />
      <MailDialog art="ERINNERUNG" umfrageId={umfrageId} vorlage={erinnerung} offen={offen} />
      <PersonenDialog umfrageId={umfrageId} personen={verfuegbarePersonen} />
      {offen ? (
        <>
          <FestlegenDialog umfrageId={umfrageId} termine={termine} />
          <BestaetigungsDialog
            ausloeser={
              <Button variant="outline">
                <Lock className="size-3.5" aria-hidden />
                {TD.schliessenKnopf}
              </Button>
            }
            titel={T.umfrage.schliessen.titel}
            beschreibung={T.umfrage.schliessen.beschreibung}
            bestaetigen={T.umfrage.schliessen.bestaetigen}
            aktion={schliesseUmfrage.bind(null, umfrageId)}
          />
        </>
      ) : (
        <form action={oeffneUmfrage.bind(null, umfrageId)}>
          <Button type="submit" variant="outline">
            <LockOpen className="size-3.5" aria-hidden />
            {TD.oeffnenKnopf}
          </Button>
        </form>
      )}
      <BestaetigungsDialog
        ausloeser={
          <Button variant="destructive">
            <Trash2 className="size-3.5" aria-hidden />
            {TD.loeschenKnopf}
          </Button>
        }
        titel={T.umfrage.loeschen.titel}
        beschreibung={T.umfrage.loeschen.beschreibung(titel)}
        bestaetigen={T.umfrage.loeschen.bestaetigen}
        aktion={loescheUmfrage.bind(null, umfrageId)}
        gefahr
      />
    </div>
  );
}

function BestaetigungsDialog({
  ausloeser,
  titel,
  beschreibung,
  bestaetigen,
  aktion,
  gefahr,
}: {
  ausloeser: React.ReactElement;
  titel: string;
  beschreibung: string;
  bestaetigen: string;
  aktion: () => Promise<void>;
  gefahr?: boolean;
}) {
  return (
    <Dialog>
      <DialogTrigger render={ausloeser} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titel}</DialogTitle>
          <DialogDescription>{beschreibung}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost">{T.umfrage.loeschen.abbrechen}</Button>} />
          <form action={aktion}>
            <Button type="submit" variant={gefahr ? "destructive" : "default"}>
              {bestaetigen}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MailDialog({
  art,
  umfrageId,
  vorlage,
  offen,
}: {
  art: "EINLADUNG" | "ERINNERUNG";
  umfrageId: string;
  vorlage: MailVorlage;
  offen: boolean;
}) {
  const einladung = art === "EINLADUNG";
  const Icon = einladung ? Mail : Bell;
  const sperre = !offen || vorlage.anzahl === 0;

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant={einladung ? "default" : "outline"} disabled={sperre} title={!offen ? TD.offenNurOffen : undefined}>
            <Icon className="size-3.5" aria-hidden />
            {einladung ? TD.einladungKnopf : TD.erinnerungKnopf}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{einladung ? TM.einladungTitel : TM.erinnerungTitel}</DialogTitle>
          <DialogDescription>
            {einladung ? TM.einladungBeschreibung(vorlage.anzahl) : TM.erinnerungBeschreibung(vorlage.anzahl)}
          </DialogDescription>
        </DialogHeader>

        <MailFormular art={art} umfrageId={umfrageId} vorlage={vorlage} />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Formular und Ergebnis liegen im DialogContent: Beim Schließen wird der
 * Inhalt abgebaut, beim erneuten Öffnen beginnt der Dialog wieder mit dem
 * Formular (und der Standardvorlage) statt mit dem alten Ergebnis.
 */
function MailFormular({
  art,
  umfrageId,
  vorlage,
}: {
  art: "EINLADUNG" | "ERINNERUNG";
  umfrageId: string;
  vorlage: MailVorlage;
}) {
  const aktion = art === "EINLADUNG" ? sendeUmfrageEinladungen : sendeUmfrageErinnerungen;
  const [state, formAction, laeuft] = useActionState<UmfrageMailState, FormData>(
    aktion.bind(null, umfrageId),
    {},
  );
  const [betreff, setBetreff] = useState(vorlage.betreff);
  const [text, setText] = useState(vorlage.text);

  if (state.erfolg) {
    return (
      <p role="status" className="text-sm text-primary text-pretty">
        {state.meldung}
      </p>
    );
  }
  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={`mail-betreff-${art}`}>{TM.betreff}</Label>
        <Input
          id={`mail-betreff-${art}`}
          name="betreff"
          value={betreff}
          maxLength={UMFRAGE_GRENZEN.mailBetreff}
          onChange={(e) => setBetreff(e.target.value)}
        />
        {state.fehler?.betreff ? (
          <p role="alert" className="text-sm text-destructive">
            {state.fehler.betreff}
          </p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`mail-text-${art}`}>{TM.text}</Label>
        <p className="text-xs text-muted-foreground">{TM.platzhalterHinweis}</p>
        <Textarea
          id={`mail-text-${art}`}
          name="text"
          value={text}
          rows={12}
          className="whitespace-pre-wrap break-words"
          onChange={(e) => setText(e.target.value)}
        />
        {state.fehler?.text ? (
          <p role="alert" className="text-sm text-destructive">
            {state.fehler.text}
          </p>
        ) : null}
      </div>
      {state.fehler?._ ? (
        <p role="alert" className="text-sm text-destructive">
          {state.fehler._}
        </p>
      ) : null}
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="ghost">{TM.abbrechen}</Button>} />
        <Button type="submit" disabled={laeuft}>
          {laeuft ? TM.sendenLaeuft : TM.senden}
        </Button>
      </DialogFooter>
    </form>

  );
}

function PersonenDialog({
  umfrageId,
  personen,
}: {
  umfrageId: string;
  personen: Array<{ id: string; name: string; organisation: string | null }>;
}) {
  const TP = T.umfrage.personen;

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="outline">
            <UserPlus className="size-3.5" aria-hidden />
            {TD.personenKnopf}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{TP.titel}</DialogTitle>
          <DialogDescription>{TP.beschreibung}</DialogDescription>
        </DialogHeader>
        <PersonenFormular umfrageId={umfrageId} personen={personen} />
      </DialogContent>
    </Dialog>
  );
}

/** Im DialogContent, damit der Dialog beim erneuten Öffnen wieder das Formular zeigt. */
function PersonenFormular({
  umfrageId,
  personen,
}: {
  umfrageId: string;
  personen: Array<{ id: string; name: string; organisation: string | null }>;
}) {
  const [state, formAction, laeuft] = useActionState<FormularState, FormData>(
    fuegePersonenHinzu.bind(null, umfrageId),
    {},
  );
  const TP = T.umfrage.personen;

  return (
    <>
      {state.erfolg ? (
        <p role="status" className="text-sm text-primary">
          {state.meldung}
        </p>
      ) : personen.length === 0 ? (
        <p className="text-sm text-muted-foreground">{TP.keine}</p>
      ) : (
        <form action={formAction} className="space-y-3">
          <ul className="max-h-72 space-y-0.5 overflow-y-auto">
            {personen.map((person) => (
              <li key={person.id}>
                <label className="flex cursor-pointer items-center gap-2.5 py-1.5 text-sm">
                  <input
                    type="checkbox"
                    name="referentId"
                    value={person.id}
                    className="size-4 accent-[var(--primary)]"
                  />
                  <span>
                    {person.name}
                    {person.organisation ? (
                      <span className="text-muted-foreground"> · {person.organisation}</span>
                    ) : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {state.fehler?._ ? (
            <p role="alert" className="text-sm text-destructive">
              {state.fehler._}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={laeuft}>
              {laeuft ? TP.hinzufuegenLaeuft : TP.hinzufuegen}
            </Button>
          </DialogFooter>
        </form>
      )}
    </>
  );
}

function FestlegenDialog({
  umfrageId,
  termine,
}: {
  umfrageId: string;
  termine: Array<{ id: string; label: string }>;
}) {
  const [state, formAction, laeuft] = useActionState<FormularState, FormData>(
    legeTerminFest.bind(null, umfrageId),
    {},
  );
  const TF = T.umfrage.festlegen;

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="outline">
            <CalendarCheck className="size-3.5" aria-hidden />
            {TD.festlegenKnopf}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{TF.titel}</DialogTitle>
          <DialogDescription>{TF.beschreibung}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <fieldset className="space-y-1">
            <legend className="sr-only">{TF.waehlen}</legend>
            {termine.map((termin) => (
              <label key={termin.id} className="flex cursor-pointer items-center gap-2.5 py-1.5 text-sm">
                <input type="radio" name="terminId" value={termin.id} className="size-4 accent-[var(--primary)]" />
                {termin.label}
              </label>
            ))}
          </fieldset>
          {state.fehler?.terminId ? (
            <p role="alert" className="text-sm text-destructive">
              {state.fehler.terminId}
            </p>
          ) : null}
          {state.fehler?._ ? (
            <p role="alert" className="text-sm text-destructive">
              {state.fehler._}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={laeuft}>
              {TF.speichern}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
