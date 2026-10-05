/**
 * Einheitliche Schreibweise für freie Schlagworte.
 *
 * `normalisiert` ist der technische Schlüssel in der Datenbank; der sichtbare
 * Name bleibt in der Schreibweise, in der er erstmals angelegt wurde. So wird
 * aus „  Digitale   Medien  “ überall derselbe Begriff, ohne die Lesbarkeit
 * durch Kleinschreibung zu verschlechtern.
 */
export function normalisiereSchlagwort(wert: string): string {
  // Absichtlich kein `toLocaleLowerCase()`: PostgreSQLs `lower()` richtet sich
  // nach der Datenbank-Collation und wäre etwa bei C.UTF-8 nicht zwingend mit
  // der JavaScript-Implementierung für Ä/Ö/Ü/ẞ identisch. Die Zeichenmenge
  // unten und ihr SQL-Gegenstück in der Migration sind daher bewusst klein,
  // aber für deutsche Schlagworte deterministisch gleich.
  return wert
    .replace(/[\t\n\v\f\r \u00a0]+/g, " ")
    .replace(/^ +| +$/g, "");
}

/** Schlüssel für Vergleiche und den eindeutigen Datenbankwert. */
export function schlagwortSchluessel(wert: string): string {
  return normalisiereSchlagwort(wert).replace(
    /[ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜẞ]/g,
    (zeichen) =>
      (
        {
          Ä: "ä",
          Ö: "ö",
          Ü: "ü",
          ẞ: "ß",
        } as Record<string, string>
      )[zeichen] ?? zeichen.toLowerCase(),
  );
}

/**
 * Leere und doppelte Eingaben entfernen. Die Reihenfolge bleibt erhalten,
 * damit die gewählte Reihenfolge der Chips nicht überraschend springt.
 */
export function normalisiereSchlagwortListe(werte: string[]): string[] {
  const gesehen = new Set<string>();
  const ergebnis: string[] = [];

  for (const wert of werte) {
    const name = normalisiereSchlagwort(wert);
    const schluessel = schlagwortSchluessel(name);
    if (!name || gesehen.has(schluessel)) continue;
    gesehen.add(schluessel);
    ergebnis.push(name);
  }

  return ergebnis;
}
