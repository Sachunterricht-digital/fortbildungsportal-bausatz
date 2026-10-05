"use client";

import { useEffect, useRef, useState } from "react";

import { T } from "@/texte/de";

/**
 * Warnt vor dem Verlassen einer Seite, solange ungespeicherte Änderungen
 * bestehen: beim Schließen des Tabs, Neuladen oder Eingeben einer neuen
 * Adresse über `beforeunload`, und zusätzlich bei jedem Klick auf einen
 * internen Link (Seitenleiste, Kopfzeile, Knöpfe) über einen document-weiten
 * Klick-Abfang — `beforeunload` greift nicht bei einer reinen Next.js-
 * Client-Navigation. Der Abfang sitzt hier zentral, statt an jedem einzelnen
 * „Abbrechen“-Link wiederholt zu werden.
 *
 * Browser-Zurück (Taste, Wischgeste) löst weder beforeunload noch einen Klick
 * aus. Deshalb liegt bei ungespeicherten Änderungen ein zusätzlicher
 * History-Eintrag mit gleicher Adresse obenauf: „Zurück“ verbraucht nur
 * diesen Eintrag (popstate), die Seite bleibt stehen und fragt nach. Bei
 * Bestätigung geht es einen weiteren Schritt zurück, bei Abbruch wird der
 * Eintrag neu gelegt.
 */
export function useUngespeicherteAenderungen() {
  const [geaendert, setGeaendert] = useState(false);
  const geaendertRef = useRef(false);
  /** Liegt unser Zusatzeintrag gerade obenauf im Verlauf? Verhindert Doppelungen. */
  const eintragRef = useRef(false);

  useEffect(() => {
    geaendertRef.current = geaendert;
    if (geaendert && !eintragRef.current) {
      // Den bestehenden State weiterreichen, damit der Next.js-Router den
      // Eintrag als dieselbe Seite erkennt.
      window.history.pushState(window.history.state, "", window.location.href);
      eintragRef.current = true;
    }
  }, [geaendert]);

  useEffect(() => {
    const handler = () => {
      // Der Zusatzeintrag ist verbraucht, egal wie es weitergeht.
      if (!eintragRef.current) return;
      eintragRef.current = false;
      // Nach dem Speichern oder ohne Änderungen: normal zurück, nichts zu fragen.
      if (!geaendertRef.current) return;

      if (window.confirm(T.maske.form.ungespeicherteAenderungenVerlassen)) {
        // Keine weitere Rückfrage beim eigentlichen Verlassen.
        geaendertRef.current = false;
        window.history.back();
      } else {
        window.history.pushState(window.history.state, "", window.location.href);
        eintragRef.current = true;
      }
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  useEffect(() => {
    if (!geaendert) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Für ältere Browser: Ein gesetzter (beliebiger) Wert löst den Dialog aus.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [geaendert]);

  useEffect(() => {
    if (!geaendert) return;

    // Capture-Phase: läuft vor dem eigenen onClick eines Links (next/link
    // hängt seinen Handler in der Ziel-/Bubble-Phase ein), kann die
    // Navigation also zuverlässig anhalten, bevor sie beginnt.
    const handler = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const ziel = (event.target as HTMLElement | null)?.closest("a[href]");
      if (!(ziel instanceof HTMLAnchorElement)) return;
      if (ziel.target && ziel.target !== "_self") return;
      if (ziel.hasAttribute("download")) return;

      const href = ziel.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      // Fremde Adressen fängt beforeunload beim eigentlichen Verlassen ab,
      // ein Sprung innerhalb derselben Seite (Anker) ist unkritisch.
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return;
      }

      if (!window.confirm(T.maske.form.ungespeicherteAenderungenVerlassen)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    };

    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [geaendert]);

  return {
    geaendert,
    markiereGeaendert: () => setGeaendert(true),
    markiereGespeichert: () => setGeaendert(false),
  };
}
