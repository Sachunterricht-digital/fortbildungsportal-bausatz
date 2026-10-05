/** Daten, die die Serverseite an das Formular reicht. */

export interface KompetenzOption {
  code: string;
  titel: string;
  istPlatzhalter: boolean;
}

export interface KompetenzBereichOption {
  code: string;
  titel: string;
  beschreibung: string | null;
  children: KompetenzOption[];
}

export interface ReferentOption {
  id: string;
  vorname: string;
  nachname: string;
  organisation: string | null;
}

/** Vorbelegung beim Bearbeiten. */
export interface FortbildungWerte {
  id: string;
  titel: string;
  kurztitel: string | null;
  beschreibungHtml: string;
  organisationsform: string;
  maxTn: number | null;
  format: string;
  beginn: Date | null;
  ende: Date | null;
  ortText: string | null;
  schularten: string[];
  fach: string | null;
  niveaustufe: string | null;
  fibsLehrgangsnummer: string | null;
  fibsUrl: string | null;
  status: string;
  kompetenzCodes: string[];
  schlagwortNamen: string[];
  referentIds: string[];
  /** Für die optimistische Sperre beim Speichern (siehe saveFortbildung()). */
  updatedAt: Date;
}
