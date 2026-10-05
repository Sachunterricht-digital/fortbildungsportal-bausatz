/**
 * Schalter für vorübergehend stillgelegte Funktionen.
 *
 * Der Code bleibt vollständig erhalten — nur die Oberfläche blendet die
 * betroffenen Bereiche aus bzw. sperrt sie. Wieder einschalten heißt: den
 * jeweiligen Wert auf `false` setzen, sonst nichts.
 */
export const AUSGEGRAUT = {
  fibsImport: true,
  nachbereitung: true,
  auswertung: true,
  aushang: true,
  /** Terminabgleich in der Maske: zeigt RLFB am selben Tag als Bitte, kein Verbot. */
  terminabgleich: false,
  /** Interner Planungskalender für alle Angemeldeten. */
  planungskalender: true,
  /** Installationsassistent für fremde Schulämter. Hier ein Betreiber, deshalb abgetrennt. */
  einrichtung: true,
  alp: true,
  /** Allgemeiner Registrierungslink für viele Personen. Wir laden einzeln ein. */
  registrierungslink: true,
} as const;
