"use client";

import { useMemo, useState } from "react";

import { formatDatumZeitEingabe, parseDatumZeitEingabe } from "@/lib/datetime";
import { terminWarnung } from "@/lib/ferien";
import { SCHULARTEN_STANDARD, terminOptional } from "@/constants/fortbildung";
import type { FortbildungWerte } from "./types";
import { T } from "@/texte/de";

/**
 * Der gemeinsame Formularzustand von Wizard und Bearbeiten-Ansicht.
 *
 * Auch einfache Textfelder bleiben kontrolliert: React setzt unkontrollierte
 * Felder nach einer Server Action zurück, selbst bei zurückgegebenen Fehlern.
 */
export function useFortbildungState(
  fortbildung: FortbildungWerte | undefined,
  /** Bei neuen Fortbildungen vorausgewählt, z. B. die einreichende Person selbst. */
  vorbelegteReferenten: string[] = [],
) {
  const [titel, setTitel] = useState(fortbildung?.titel ?? "");
  const [kurztitel, setKurztitel] = useState(fortbildung?.kurztitel ?? "");
  // Neue Themen starten als SchiLf auf Abruf, die meisten Referenten bieten SchiLf an.
  const [maxTn, setMaxTn] = useState(fortbildung ? String(fortbildung.maxTn ?? "") : "");
  const [fach, setFach] = useState(fortbildung?.fach ?? "");
  const [fibsLehrgangsnummer, setFibsLehrgangsnummer] = useState(fortbildung?.fibsLehrgangsnummer ?? "");
  const [fibsUrl, setFibsUrl] = useState(fortbildung?.fibsUrl ?? "");
  const [format, setFormat] = useState(fortbildung?.format ?? "PRAESENZ");
  const [ortText, setOrtText] = useState(fortbildung?.ortText ?? "");
  const [organisationsform, setOrganisationsform] = useState(
    fortbildung?.organisationsform ?? "SCHILF",
  );
  const [status, setStatus] = useState(fortbildung?.status ?? "ENTWURF");
  const [niveaustufe, setNiveaustufe] = useState(fortbildung?.niveaustufe ?? "");
  const [beschreibung, setBeschreibung] = useState(
    fortbildung?.beschreibungHtml ?? "",
  );
  const [schularten, setSchularten] = useState<string[]>(
    fortbildung?.schularten ?? SCHULARTEN_STANDARD,
  );
  const [schlagworte, setSchlagworte] = useState<string[]>(
    fortbildung?.schlagwortNamen ?? [],
  );
  const [kompetenzen, setKompetenzen] = useState<string[]>(
    fortbildung?.kompetenzCodes ?? [],
  );
  const [referenten, setReferenten] = useState<string[]>(
    fortbildung?.referentIds ?? vorbelegteReferenten,
  );

  // Beginn und Ende im State, damit die Ferien-Warnung schon beim Tippen
  // erscheint und nicht erst nach dem Speichern.
  const [beginn, setBeginn] = useState(formatDatumZeitEingabe(fortbildung?.beginn));
  const [ende, setEnde] = useState(formatDatumZeitEingabe(fortbildung?.ende));

  const terminHinweis = useMemo(() => {
    const von = parseDatumZeitEingabe(beginn);
    if (!von) return null;
    const bis = parseDatumZeitEingabe(ende) ?? von;
    return terminWarnung(von, bis < von ? von : bis);
  }, [beginn, ende]);

  function formatWechseln(neu: string) {
    setFormat(neu);
    terminLeerenFalls(organisationsform, neu);
  }

  /** Termin leeren, sobald er entfällt, damit kein halber Termin mitgeschickt wird. */
  function terminLeerenFalls(organisation: string, fmt: string) {
    if (terminOptional(organisation, fmt)) {
      setBeginn("");
      setEnde("");
    }
  }

  function organisationsformWechseln(neu: string) {
    setOrganisationsform(neu);
    terminLeerenFalls(neu, format);
    // Bei SchiLf auf Abruf passt die Vorbelegung von 20 Plätzen nicht, sie wird geleert.
    if (neu === "SCHILF" && maxTn === "20" && !fortbildung) setMaxTn("");
  }

  function beginnSetzen(wert: string) {
    setBeginn(wert);
    // Ende sinnvoll vorbelegen: zwei Stunden später ist der typische
    // Zuschnitt einer regionalen Fortbildung.
    if (!ende && wert) {
      const start = parseDatumZeitEingabe(wert);
      if (start) {
        setEnde(formatDatumZeitEingabe(new Date(start.getTime() + 2 * 60 * 60 * 1000)));
      }
    }
  }

  return {
    titel, setTitel,
    kurztitel, setKurztitel,
    maxTn, setMaxTn,
    fach, setFach,
    fibsLehrgangsnummer, setFibsLehrgangsnummer,
    fibsUrl, setFibsUrl,
    format,
    formatWechseln,
    ortText,
    setOrtText,
    organisationsform,
    setOrganisationsform: organisationsformWechseln,
    status,
    setStatus,
    niveaustufe,
    setNiveaustufe,
    beschreibung,
    setBeschreibung,
    schularten,
    setSchularten,
    schlagworte,
    setSchlagworte,
    kompetenzen,
    setKompetenzen,
    referenten,
    setReferenten,
    beginn,
    beginnSetzen,
    ende,
    setEnde,
    terminHinweis,
  };
}

export type FortbildungState = ReturnType<typeof useFortbildungState>;

/**
 * Prüft einen Wizard-Schritt clientseitig, damit „Weiter" nicht in einen
 * Schritt führt, dessen Voraussetzungen fehlen. Die Server Action prüft
 * dieselben Regeln noch einmal — das hier ist reine Bedienhilfe.
 */
export function schrittFehler(
  pflichtfelder: string[],
  zustand: FortbildungState,
  formular: HTMLFormElement | null,
): Record<string, string> {
  const fehler: Record<string, string> = {};

  const wert = (name: string): string => {
    const feld = formular?.elements.namedItem(name);
    return feld instanceof HTMLInputElement || feld instanceof HTMLTextAreaElement
      ? feld.value.trim()
      : "";
  };
  const beginn = parseDatumZeitEingabe(zustand.beginn);
  const ende = parseDatumZeitEingabe(zustand.ende);
  // SchiLf auf Abruf und Video-Tutorial: leere Termin-, Orts- und TN-Felder sind in Ordnung.
  const freiwillig = terminOptional(zustand.organisationsform, zustand.format);
  const leer: Record<string, boolean> = {
    maxTn: wert("maxTn") === "",
    beginn: zustand.beginn.trim() === "",
    ende: zustand.ende.trim() === "",
    ortText: zustand.ortText.trim() === "",
  };

  for (const feld of pflichtfelder) {
    if (freiwillig && leer[feld]) continue;
    switch (feld) {
      case "titel":
        if (wert("titel").length < 3) {
          fehler.titel = T.maske.state.titelZuKurz;
        }
        break;
      case "maxTn": {
        const zahl = Number(wert("maxTn"));
        if (!Number.isInteger(zahl) || zahl < 1) {
          fehler.maxTn = T.maske.state.maxTnUngueltig;
        }
        break;
      }
      case "beginn":
        if (!beginn) {
          fehler.beginn = T.maske.state.datumUnvollstaendig;
        }
        break;
      case "ende":
        if (!ende) {
          fehler.ende = T.maske.state.datumUnvollstaendig;
        } else if (beginn && ende <= beginn) {
          fehler.ende = T.maske.validation.endeVorBeginn;
        }
        break;
      case "ortText":
        if (!zustand.ortText.trim()) fehler.ortText = T.maske.state.ortPflicht;
        break;
      case "beschreibungHtml":
        if (zustand.beschreibung.replace(/<[^>]*>/g, "").trim().length === 0) {
          fehler.beschreibungHtml = T.maske.state.beschreibungLeer;
        }
        break;
      case "schularten":
        if (zustand.schularten.length === 0) {
          fehler.schularten = T.maske.state.schulartenPflicht;
        }
        break;
      case "niveaustufe":
        if (!zustand.niveaustufe) fehler.niveaustufe = T.maske.state.niveaustufePflicht;
        break;
      case "kompetenzen":
        if (zustand.kompetenzen.length === 0) {
          fehler.kompetenzen = T.maske.state.kompetenzenPflicht;
        }
        break;
      case "referenten":
        if (zustand.referenten.length === 0) {
          fehler.referenten = T.maske.state.referentenPflicht;
        }
        break;
      default:
        break;
    }
  }

  return fehler;
}
