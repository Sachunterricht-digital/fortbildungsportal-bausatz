/**
 * Gemeinsame FIBS-Logik für öffentliche Hinweise und interne Berichte.
 *
 * Bei SchiLf bedeutet `inFibs` üblicherweise einen nachträglichen Eintrag und
 * nicht, dass vor dem Termin eine öffentliche Anmeldung in FIBS möglich ist.
 */

export type FibsAnmeldestatus =
  | "FIBS_OFFEN"
  | "FIBS_OHNE_LINK"
  | "FIBS_FOLGT"
  | "SCHILF_INTERN";

export function bestimmeFibsAnmeldestatus({
  organisationsform,
  inFibs,
  fibsUrl,
}: {
  organisationsform: string;
  inFibs: boolean;
  fibsUrl: string | null;
}): FibsAnmeldestatus {
  // Ein Link kann bereits vorgemerkt sein. Erst die eigene FIBS-Markierung
  // bestätigt, dass die verbindliche Anmeldung tatsächlich geöffnet ist.
  // SchiLf werden schulintern organisiert und erst nach dem Termin in FIBS
  // dokumentiert. Ein späterer Eintrag ist nie ein Anmeldelink.
  if (organisationsform === "SCHILF") return "SCHILF_INTERN";

  if (inFibs && fibsUrl) return "FIBS_OFFEN";

  return inFibs ? "FIBS_OHNE_LINK" : "FIBS_FOLGT";
}

export function hatAktiveFibsAnmeldung(daten: {
  organisationsform: string;
  inFibs: boolean;
  fibsUrl: string | null;
}): boolean {
  return bestimmeFibsAnmeldestatus(daten) === "FIBS_OFFEN";
}

/** Kontextabhängiger FIBS-Text für Tabellen und Berichte. */
export function fibsStatusText({
  organisationsform,
  inFibs,
  ende,
  status,
  jetzt = new Date(),
}: {
  organisationsform: string;
  inFibs: boolean;
  /** null bei SchiLf auf Abruf — dafür gibt es keinen Nachtrag nach Termin. */
  ende: Date | null;
  status?: string;
  jetzt?: Date;
}): string {
  if (organisationsform !== "SCHILF") {
    return inFibs ? "eingetragen" : "nicht eingetragen";
  }

  if (inFibs) return "nachgetragen";
  if (status && !["VEROEFFENTLICHT", "ARCHIVIERT"].includes(status)) {
    return "noch nicht vorgesehen";
  }
  if (ende === null) return "auf Abruf";
  return ende < jetzt ? "Nachtrag offen" : "Nachtrag nach Termin";
}
