/**
 * Sichtbare Texte des öffentlichen Bereichs (Startseite, Fortbildungsliste,
 * Detailseite, Kalender, Systemtext-Seiten, Referenten-Registrierung) sowie
 * Titel/Metadata in src/app/layout.tsx und sichtbare Kalendertexte in
 * src/app/api/ics/route.ts.
 */
export const aussen = {
  layout: {
    skipLink: "Zum Inhalt springen",
    startseiteAriaLabel: "Fortbildungen, Startseite",
    marke: "Fortbildungen",
    nav: {
      alleFortbildungen: "Alle Fortbildungen",
      kalender: "Kalender",
      referenten: "Referenten",
      kataloge: "Kataloge",
      redaktion: "Referentenzugang",
    },
    footer: {
      impressum: "Impressum",
      datenschutz: "Datenschutz",
      kalenderAbo: "Kalender-Abo",
      anmeldungReferenten: "Anmeldung für Referenten",
    },
  },

  start: {
    suchPlatzhalter: "Thema oder Fach",
    suchAriaLabel: "Fortbildungen durchsuchen",
    suchButton: "Suchen",
    kalenderansicht: "Kalenderansicht",
    aufAbrufZeile: (n: number) => `${n} Angebote auf Abruf`,
    naechsteTermineTitel: "Nächste Termine",
    alleAnzeigen: (anzahl: number) => `Alle ${anzahl} anzeigen`,
    leerTitel: "Derzeit ist nichts ausgeschrieben.",
    leerText: "Neue Angebote erscheinen hier, sobald sie veröffentlicht sind.",
    angebote: {
      reiterAriaLabel: "Ansicht der Angebote",
      reiterSchilf: "SchiLf",
      reiterTermine: "Reg. Fortbildungen",
      reiterKalender: "Kalender",
      mehrAnzeigen: "Mehr anzeigen",
      wenigerAnzeigen: "Weniger anzeigen",
      schilfLeerText: "Derzeit gibt es keine Angebote ohne Termin.",
      alleFortbildungen: "Alle Fortbildungen",
      digCompEdu: (bereiche: string) => `DigCompEdu: ${bereiche}`,
    },
    kalenderAboFett: "Kalender abonnieren:",
    kalenderAboText:
      "Neue Termine erscheinen automatisch in Outlook, Apple Kalender oder Thunderbird.",
    kalenderAboButton: "Kalender abonnieren",
  },

  fortbildungenListe: {
    metaTitel: "Alle Fortbildungen",
    metaBeschreibung: "Fortbildungen und SchiLf-Angebote für Grund- und Mittelschulen im Landkreis Aichach-Friedberg.",
    titel: "Fortbildungen",
    keinTreffer: "Kein Treffer",
    anzahlAngebote: (n: number) => `${n} ${n === 1 ? "Angebot" : "Angebote"}`,
    fuerAuswahl: " für Ihre Auswahl",
    inklVergangene: ", inklusive vergangener Termine",
    schnellzugriffBald: "Nächste 4 Wochen",
    schnellzugriffOnline: "Online",
    schnellzugriffGrundschule: "Grundschule",
    schnellzugriffMittelschule: "Mittelschule",
    schnellzugriffSchuljahr: "Noch dieses Schuljahr",
    auswegOhneVorsatz: "ohne",
    auswegVergangeneAnzeigen: "auch vergangene Termine anzeigen",
  },

  fortbildungDetail: {
    nichtGefunden: "Diese Fortbildung wurde nicht gefunden.",
    zurUebersicht: "Zur Übersicht",
    abgesagtHinweis: "Diese Veranstaltung wurde abgesagt.",
    labelTermin: "Termin",
    labelVeranstaltungsort: "Veranstaltungsort",
    labelPlaetze: "Plätze",
    labelZielgruppe: "Zielgruppe",
    plaetzeMaximal: (n: number) => `maximal ${n}`,
    teilnehmende: "Teilnehmende",
    fach: (fach: string) => `Fach: ${fach}`,
    leitung: "Referent",
    kompetenzenTitel: "Kompetenzen nach DigCompEdu Bavaria",
    kompetenzbereich: (bereich: string) => `Kompetenzbereich ${bereich}`,
    schlagworte: "Schlagworte",
    teilnahme: "Teilnahme",
    anmeldung: "Anmeldung",
    zurAnmeldungFibs: "Zur Anmeldung in FIBS",
    terminSpeichern: "Termin speichern (.ics)",
    fibsNummer: "FIBS-Nummer",
  },

  kalenderSeite: {
    metaTitel: "Kalender",
    metaBeschreibung:
      "Monatsübersicht der Fortbildungen mit bayerischen Ferien und Feiertagen.",
    anzahlTermine: (n: number) => `${n} ${n === 1 ? "Termin" : "Termine"} im Zeitraum`,
    zurueck: "Zurück",
    heute: "Heute",
    weiter: "Weiter",
    vorherigerMonatAria: "Vorheriger Monat",
    naechsterMonatAria: "Nächster Monat",
    legendeRegional: "RLFB (regional)",
    legendeSchilf: "SchiLf",
    legendeFerien: "Bayerische Schulferien",
    legendeFeiertag: "Feiertag",
    ferienGepflegtBis: (datum: string) => `Ferien eingetragen bis ${datum}`,
  },

  monatskalender: {
    kwSpalte: "KW",
    mobilKopf: (kw: number, tag: number, wochentag: string) =>
      `KW ${kw} · ${tag}. ${wochentag}`,
    keinTermin: "In diesem Monat ist kein Termin ausgeschrieben.",
  },

  filterLeiste: {
    suchPlatzhalter: "Titel, Thema, Fach oder Ort",
    suchAriaLabel: "Volltextsuche",
    filterLabel: "Filter",
    filterUntertitel: "(Schulart, Format, Kompetenzbereich …)",
    labelSchulart: "Schulart",
    labelFormat: "Format",
    labelArt: "Art",
    labelKompetenzbereich: "Kompetenzbereich",
    labelNiveaustufe: "Niveaustufe",
    labelSchlagwort: "Schlagwort",
    kompetenzbereichOption: (code: string, titel: string) => `KB ${code} · ${titel}`,
    labelAb: "Ab",
    labelBis: "Bis",
    vergangeneAnzeigen: "Vergangene Termine anzeigen",
    zuruecksetzen: "Zurücksetzen",
  },

  schnellzugriffe: {
    schnellFinden: "Schnell finden",
    gesetzt: "Aktive Filter",
    chipEntfernenTitel: (art: string, wert: string) => `${art}: ${wert} entfernen`,
    alleEntfernen: "alle entfernen",
  },

  leerZustand: {
    titel: "Dazu gibt es derzeit kein Angebot.",
    ohneFilterText: "Neue Fortbildungen erscheinen hier, sobald sie veröffentlicht sind.",
    keinTrefferTrotzWeniger: "Auch mit weniger Filtern ergibt sich kein Treffer.",
    alleFilterZuruecksetzen: "Alle Filter zurücksetzen",
    dasWuerdeHelfen: "Mit weniger Filtern:",
    treffer: (n: number) => `${n} Treffer`,
  },

  fortbildungKarte: {
    abgesagt: "Abgesagt",
    plaetze: (n: number) => `${n} Plätze`,
  },

  anmeldestatus: {
    offenTitel: "Anmeldung geöffnet",
    offenText: "Die verbindliche Anmeldung ist in FIBS möglich.",
    schulinternTitel: "Schulinterne Teilnahme",
    schulinternText:
      "Die Schule organisiert die Teilnahme selbst. Eine Anmeldung über FIBS entfällt.",
    ohneLinkTitel: "In FIBS ausgeschrieben",
    ohneLinkText: "Der direkte Anmeldelink wird noch ergänzt.",
    folgtTitel: "Anmeldung folgt",
    folgtText:
      "Die Fortbildung ist in Vorbereitung. Eine Anmeldung ist noch nicht möglich.",
  },

  monatsGruppen: {
    anzahlTermine: (n: number) => `${n} ${n === 1 ? "Termin" : "Termine"}`,
  },

  systemtextSeite: {
    keinText: "Der Text folgt.",
  },

  /** Fehlerseite 404 für alle Adressen, die es nicht gibt (`not-found.tsx`). */
  nichtGefunden: {
    titel: "Diese Seite wurde nicht gefunden.",
    zurStartseite: "Zur Startseite",
  },

  rechtliches: {
    datenschutzMetaTitel: "Datenschutz",
    datenschutzUeberschrift: "Datenschutzerklärung",
    impressumMetaTitel: "Impressum",
    impressumUeberschrift: "Impressum",
  },

  registrierung: {
    metaTitel: "Registrierung für Referenten",
    titel: "Registrierung für Referenten",
    einleitung:
      "Legen Sie hier Ihr Profil für die Startseite an und tragen Sie Ihre eigenen Themen ein.",
    ungueltigTitel: "Dieser Link ist nicht mehr gültig",
    ungueltigText:
      "Der Link ist abgelaufen oder wurde ersetzt. Einen neuen Link erhalten Sie bei Vorname Nachname.",
    zurAnmeldung: "Zur Anmeldung",
  },

  rootLayout: {
    titelStandard: (kurzname: string) => `Fortbildungen · ${kurzname}`,
    titelTemplate: (kurzname: string) => `%s · ${kurzname}`,
  },

  ics: {
    kalenderName: (kurzname: string) => `Fortbildungen ${kurzname}`,
    abgesagtPrefix: (titel: string) => `ABGESAGT: ${titel}`,
    anmeldungFibsLink: (url: string) => `Anmeldung über FIBS: ${url}`,
    teilnahmeSchulintern: "Die Schule organisiert die Teilnahme selbst.",
    fibsOhneLink: "In FIBS ausgeschrieben. Sie finden die Fortbildung dort über die Suche.",
    anmeldungFolgt: "Anmeldung über FIBS folgt.",
    details: (url: string) => `Details: ${url}`,
  },
} as const;
