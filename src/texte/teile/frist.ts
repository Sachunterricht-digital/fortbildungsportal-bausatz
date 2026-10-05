export const frist = {
  ueberschrift: "Frist für Themen",
  label: "Einreichen bis",
  speichern: "Frist speichern",
  gespeichert: "Frist gespeichert.",
  entfernt: "Frist entfernt.",
  ungueltig: "Bitte ein gültiges Datum wählen.",
  keine: "Keine Frist gesetzt.",
  anzeige: (datum: string) => `Frist: ${datum}`,
  offenUeberschrift: "Noch nichts eingereicht",
  offenHinweis: (schuljahr: string) =>
    `Referenten ohne eingereichtes Thema im Schuljahr ${schuljahr}. Fachfunktionen sind nicht aufgeführt.`,
  alleEingereicht: "Alle Referenten haben etwas eingereicht.",
  ohneZugang: "noch kein Zugang",
  nieAngemeldet: "nie angemeldet",
} as const;
