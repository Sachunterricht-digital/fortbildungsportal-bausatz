/**
 * Texte des Teambereichs: Seite „Mitglieder Digi-Team“ (/referenten), der
 * Steckbrief (/referenten/<id>) und der Slider auf der Startseite.
 */
export const referenten = {
  /** Kopf der Seite, das Schuljahr steht in der Kurzform (z. B. „2026/27“). */
  seiteTitel: (schuljahr: string) => `Mitglieder Digi-Team ${schuljahr}`,
  metaTitel: "Mitglieder Digi-Team",
  leer: "Derzeit sind keine Mitglieder eingetragen.",

  slider: {
    ariaLabel: "Mitglieder Digi-Team",
    alleMitglieder: "Alle Mitglieder",
    zurueck: "Zurück",
    weiter: "Weiter",
  },

  funktion: {
    REFERENT: "Referent",
    FACHFUNKTION: "Fachfunktion",
  },

  schwerpunkteAriaLabel: "Schwerpunkte",
  portraetAlt: (name: string) => `Porträt von ${name}`,
  anzahlSchilf: (n: number) => `${n} SchiLf`,
  anzahlFortbildungen: (n: number) => `${n} ${n === 1 ? "Fortbildung" : "Fortbildungen"}`,

  steckbrief: {
    nichtGefunden: "Dieses Mitglied wurde nicht gefunden.",
    stammschule: (schule: string) => `Stammschule: ${schule}`,
    profilLeer: "Das Profil wird gerade ergänzt.",
    anfrageVor: "Anfragen zu SchiLf über die",
    anfrageLink: "Beratung digitale Bildung",
    regLeer: "Derzeit keine regionalen Fortbildungen.",
    schilfLeer: "Derzeit keine SchiLf-Angebote.",
    regAriaLabel: (name: string) => `Regionale Fortbildungen von ${name}`,
    schilfAriaLabel: (name: string) => `SchiLf-Angebote von ${name}`,
    zurueck: "Zurück zu allen Mitgliedern",
  },
} as const;
