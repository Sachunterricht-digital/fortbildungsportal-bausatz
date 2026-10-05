/** Nur die angeklickte Kompetenz ändern; Bereich und Unterkompetenzen sind unabhängig. */
export function kompetenzAuswahlUmschalten(auswahl: string[], code: string, aktiv: boolean): string[] {
  const naechste = new Set(auswahl);
  if (aktiv) naechste.add(code);
  else naechste.delete(code);
  return [...naechste].sort();
}
