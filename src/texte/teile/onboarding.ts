/**
 * Texte des Onboardings unter der Terminumfrage (`/umfrage/<token>#onboarding`).
 *
 * Die drei Kurztexte
 * `erfolg`, `fehler.handynummer` und `fehler.bemerkungZuLang` sind abgenommen.
 * `fehler.eingabe` ist neu und noch nicht abgenommen. Sonst gelten die Texte
 * der öffentlichen Umfrageseite (`T.umfrage.oeffentlich`).
 */
export const onboarding = {
  titel: "Willkommen im Referentennetzwerk",
  untertitel: "Onboarding",

  kontakt: {
    titel: "Kontaktmöglichkeiten",
    legende: "Bevorzugter Kontaktweg, Mehrfachauswahl möglich",
    handynummerLabel: "Handynummer",
    handynummerOptional: "(optional)",
    handynummerHinweis:
      "Nur für die Beratung digitale Bildung sichtbar. Alternativ per Dienstmail an kontakt@example.org",
  },

  formate: {
    titel: "Weitere Formate",
    einleitung:
      "In diesem Jahr kommen viele neue Formate dazu, etwa Ankerschultreffen und Vernetzungstreffen. Möglich ist Mitarbeit bei Begleitung, Organisation oder Unterstützung. Sie zählt wie eine Fortbildung auf die Anrechnungsstunden.",
    zustimmung: "Bei weiteren Formaten arbeite ich auf Anfrage gern mit, Themen nach Absprache.",
    zeitenFrage: "Wenn ja, passen mir meist diese Zeiten (freiwillig):",
    zeitenTabelle: "Montag bis Freitag, jeweils vormittags und nachmittags.",
    bemerkungLabel: "Bemerkung",
    bemerkungBeispiel: ", zum Beispiel: Montag erst ab 14 Uhr.",
  },

  speichern: "Speichern",
  speichernLaeuft: "Wird gespeichert …",
  erfolg: "Gespeichert.",
  erfolgTermineOffen: "Gespeichert. Die Terminauswahl oben ist noch nicht gespeichert.",
  ungespeichert: "Noch nicht gespeichert.",
  weiterOffen: (termine: boolean, onboarding: boolean) =>
    `${
      termine && onboarding
        ? "Terminauswahl und Onboarding sind noch nicht gespeichert."
        : termine
          ? "Die Terminauswahl oben ist noch nicht gespeichert."
          : "Die Angaben im Onboarding sind noch nicht gespeichert."
    } Bitte erst dort speichern. Ein weiterer Klick geht ohne diese Angaben weiter.`,

  portal: {
    titel: "Das Portal in drei Schritten",
    schritte: [
      {
        titel: "Profil anlegen",
        text: "Stammschule, Schwerpunkte, Kurzprofil und gern ein Foto. Das Profil erscheint im Teambereich der Webseite.",
        bild: "/bilder/onboarding/1-profil.png",
        breite: 512,
        hoehe: 572,
        schmal: true,
      },
      {
        titel: "Themen eintragen",
        text: "Schritt für Schritt, zwischendurch jederzeit speichern.",
        bild: "/bilder/onboarding/2-themen-assistent-schritt-1.png",
        breite: 792,
        hoehe: 462,
        schmal: false,
      },
      {
        titel: "Einreichen",
        text: "Das Thema wird geprüft und freigeschaltet. Eine Bestätigung kommt per Mail.",
        zusatz:
          "Nach dem Einreichen gebe ich die Themen in der Regel direkt frei. Bei Unsicherheit mit dem DigCompEdu-Bereich ergänze ich das im Anschluss.",
        bild: "/bilder/onboarding/3-pruefen.png",
        breite: 792,
        hoehe: 300,
        schmal: false,
      },
    ],
    uebersicht: {
      text: "So sieht es danach aus:",
      link: "Alle Fortbildungen",
      neuerTab: "(öffnet in neuem Tab)",
      href: "/fortbildungen",
    },
  },

  weiterZumProfil: "Weiter zum Profil",

  schlusszeile: "Fragen gern an kontakt@example.org",

  fehler: {
    handynummer: "Die Telefonnummer ist zu lang, höchstens 40 Zeichen.",
    bemerkungZuLang: "Die Bemerkung darf höchstens 300 Zeichen haben.",
    eingabe: "Die Angaben konnten nicht gespeichert werden. Bitte die Seite neu laden.",
    telefonGeaendert: "Die Telefonnummer wurde inzwischen geändert. Bitte die Seite neu laden.",
  },
} as const;
