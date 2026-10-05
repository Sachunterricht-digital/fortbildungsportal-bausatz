import { useSyncExternalStore } from "react";

/**
 * Gemeinsamer Merker der Umfrageseite: Gibt es Eingaben, die noch nicht
 * gespeichert sind? Antwortformular (Termine), Onboarding und „Weiter zum
 * Profil“ sind getrennte Komponenten unter einer Server-Seite. Ein Modul-Merker
 * reicht, weil alle im selben Client-Bundle laufen. Zwei Quellen melden
 * getrennt, damit Hinweise nennen können, was offen ist. Wer den Stand
 * anzeigt, liest ihn über `useOffeneQuellen`, der Hinweis verschwindet dann
 * sofort, wenn gespeichert ist.
 */
export type Quelle = "termine" | "onboarding";

const BIT = { termine: 1, onboarding: 2 } as const;

let offen = 0;
let verlassenErlaubt = false;
const hoerer = new Set<() => void>();

function setze(quelle: Quelle, wert: boolean): void {
  const neu = wert ? offen | BIT[quelle] : offen & ~BIT[quelle];
  if (neu === offen) return;
  offen = neu;
  if (offen === 0) verlassenErlaubt = false;
  hoerer.forEach((h) => h());
}

export function setzeTermineUngespeichert(wert: boolean): void {
  setze("termine", wert);
}

export function setzeOnboardingUngespeichert(wert: boolean): void {
  setze("onboarding", wert);
}

/** Irgendetwas offen (Termine oder Onboarding)? */
export function termineUngespeichert(): boolean {
  return offen !== 0;
}

export function offeneQuellen(): { termine: boolean; onboarding: boolean } {
  return { termine: (offen & BIT.termine) !== 0, onboarding: (offen & BIT.onboarding) !== 0 };
}

function abonnieren(h: () => void): () => void {
  hoerer.add(h);
  return () => {
    hoerer.delete(h);
  };
}

/** Live-Stand beider Quellen. Der Snapshot ist eine Zahl, also stabil. */
export function useOffeneQuellen(): { termine: boolean; onboarding: boolean } {
  const stand = useSyncExternalStore(
    abonnieren,
    () => offen,
    () => 0,
  );
  return { termine: (stand & BIT.termine) !== 0, onboarding: (stand & BIT.onboarding) !== 0 };
}

/** Die Person will trotz offener Eingaben weiter, der Verlassen-Dialog entfällt. */
export function erlaubeVerlassen(): void {
  verlassenErlaubt = true;
}

export function verlassenOhneNachfrage(): boolean {
  return offen === 0 || verlassenErlaubt;
}
