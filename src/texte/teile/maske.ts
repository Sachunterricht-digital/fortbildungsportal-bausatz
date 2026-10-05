/**
 * Sichtbare Texte der Fortbildungsmaske: Formular (Wizard + Bearbeiten-Reiter),
 * Freigabe-Leiste, die beiden Seiten `neu` und `[id]`, Validierungs- und
 * Server-Action-Meldungen rund um `src/actions/fortbildung.ts` und
 * `src/actions/freigabe.ts`.
 */
export const maske = {
  abschnitteNamen: {
    eckdaten: "Eckdaten",
    beschreibung: "Beschreibung",
    zielgruppe: "Zielgruppe",
    digcomp: "DigCompEdu",
    referenten: "Referenten",
    pruefen: "Prüfen",
  },

  abschnitte: {
    titelLabel: "Lehrgangstitel",
    kurztitelLabel: "Lehrgangskurztitel",
    kurztitelHinweis:
      "Optional. Erscheint in Listen und im Kalender, wenn der volle Titel zu lang ist.",
    organisationsformLabel: "Organisationsform",
    maxTnLabel: "Maximale Teilnehmerzahl",
    formatLabel: "Veranstaltungsformat",
    ortLabel: "Ort",
    ortPlatzhalter: "z. B. GS Musterdorf, Raum 12 oder online",
    beginnLabel: "Beginn",
    endeLabel: "Ende",
    terminSchilfHinweis: "SchiLf ohne festen Termin: Termin und Ort vereinbart die Schule direkt mit der Referentin oder dem Referenten.",
    terminVideoHinweis: "Video-Tutorials haben keinen Termin.",
    terminEingabeHinweis: "Im Kalender auswählen oder TT.MM.JJJJ HH:MM eingeben.",
    terminumfeldUeberschrift: "Was sonst an diesem Tag läuft",

    veroeffentlichungTitelAdmin: "Veröffentlichung und FIBS",
    veroeffentlichungTitelReferent: "Prüfung und Veröffentlichung",
    veroeffentlichungHinweisReferent:
      "Fertige Themen zur Prüfung einreichen. Die Beratung digitale Bildung prüft sie und veröffentlicht sie auf der Startseite. Regionale Fortbildungen gehen danach mit dem Katalog an das Schulamt und erscheinen dort in FIBS.",
    veroeffentlichungHinweisReferentVeroeffentlicht:
      "Änderungen an freigegebenen Themen sind sofort online.",
    statusLabel: "Status",
    fibsNummerLabel: "FIBS-Lehrgangsnummer",
    fibsNummerPlatzhalter: "z. B. E123-4/56/7",
    fibsUrlLabel: "FIBS-Link zur Anmeldung",
    fibsUrlHinweis: "Die verbindliche Anmeldung läuft über FIBS.",
    fibsUrlPlatzhalter: "https://fibs.alp.dillingen.de/…",

    beschreibungLabel: "Lehrgangsbeschreibung",
    beschreibungHinweis:
      "Inhalt, Zielgruppe und was die Teilnehmenden mitbringen.",

    schulartenLabel: "Schularten",
    fachLabel: "Fach",
    fachHinweis: "Optional, z. B. Mathematik oder Deutsch.",
    schlagworteLabel: "Schlagworte",
    schlagwortePflichtHinweis:
      "Die Pflicht-Schlagworte werden immer mitgespeichert.",
    schlagworteHinweis:
      "Passende Begriffe erleichtern die Suche nach dieser Fortbildung.",

    niveaustufeLabel: "Niveaustufe",
    niveaustufePlatzhalter: "Bitte wählen",
    kompetenzenLabel: "Kompetenzbereiche (DigCompEdu Bavaria)",
    kompetenzenHinweis:
      "Mehrfachauswahl möglich. Lehrkräfte können auf der Webseite nach diesen Bereichen filtern.",

    referentenLabel: "Referentinnen und Referenten",
    referentenHinweis:
      "Auf der Webseite erscheinen nur Personen, die im Referentenverzeichnis freigegeben sind.",

    pflichtfeldAriaLabel: "Pflichtfeld",
    terminWarnungZusatz:
      "Nur ein Hinweis. Passt der Termin, einfach weiter ausfüllen.",
  },

  datumZeitAuswahl: {
    platzhalter: "TT.MM.JJJJ HH:MM",
    kalenderOeffnenTitel: "Kalender öffnen",
    auswaehlenAriaLabel: (label: string) => `${label}: Datum und Uhrzeit auswählen`,
    popoverTitel: (label: string) => `${label} auswählen`,
    vorherigerMonatAriaLabel: "Vorheriger Monat",
    naechsterMonatAriaLabel: "Nächster Monat",
    kalendertagGruppeAriaLabel: "Kalendertag wählen",
    uhrzeitLabel: "Uhrzeit",
    stundeAriaLabel: (label: string) => `${label}: Stunde`,
    minuteAriaLabel: (label: string) => `${label}: Minute`,
    uhrSuffix: "Uhr",
    ortszeitHinweis: "Ortszeit Deutschland (Europe/Berlin)",
    zeitumstellungFehler:
      "Diese Uhrzeit existiert wegen der Zeitumstellung nicht. Bitte eine andere wählen.",
    uebernehmen: "Übernehmen",
  },

  digCompAccordion: {
    kbLabel: (code: string) => `KB ${code}`,
    anzahlAusgewaehlt: (n: number) => `${n} ausgewählt`,
    bereichGewaehlt: "Bereich gewählt",
    gesamterBereichLabel: (code: string) => `Gesamter Kompetenzbereich ${code}`,
    einzelneKompetenzenHinweis:
      "Einzelne Kompetenzen lassen sich unten unabhängig vom gesamten Bereich auswählen.",
    platzhalterTitle: "Formulierung noch mit dem offiziellen Rahmen abzugleichen",
    platzhalterHinweis: "(vorläufig)",
    ausgewaehltZeile: (codes: string[]) =>
      `Ausgewählt: ${codes.length === 0 ? "keine Kompetenz" : codes.join(", ")}`,
  },

  fehlerUebersicht: {
    ueberschrift: "Speichern nicht möglich. Bitte diese Angaben prüfen:",
    zumAbschnittSrOnly: "Zum betroffenen Abschnitt",
  },

  form: {
    tabFehlerAriaLabel: "enthält Fehler",
    abbrechen: "Abbrechen",
    wirdGespeichert: "Wird gespeichert …",
    aenderungenSpeichern: "Änderungen speichern",
    ungespeicherteAenderungenVerlassen:
      "Es gibt ungespeicherte Änderungen. Diese Seite trotzdem verlassen?",
  },

  referentenPicker: {
    entfernenAriaLabel: (name: string) => `${name} entfernen`,
    keineReferenten: "Noch keine Referentinnen und Referenten angelegt.",
    jetztAnlegen: "Jetzt anlegen",
    suchePlatzhalter: "Nach Name oder Organisation suchen",
    sucheAriaLabel: "Referenten suchen",
    keinTreffer: (suche: string) => `Kein Treffer für „${suche}“.`,
    neueReferentinAnlegen: "Neue Referentin oder neuen Referenten anlegen",
  },

  richTextEditor: {
    fett: "Fett",
    kursiv: "Kursiv",
    durchgestrichen: "Durchgestrichen",
    ueberschrift: "Überschrift",
    ueberschriftKurz: "H2",
    unterueberschrift: "Unterüberschrift",
    unterueberschriftKurz: "H3",
    aufzaehlung: "Aufzählung",
    nummerierteListe: "Nummerierte Liste",
    zitat: "Zitat",
    linkSetzen: "Link setzen",
    linkEntfernen: "Link entfernen",
    rueckgaengig: "Rückgängig",
    wiederherstellen: "Wiederherstellen",
    linkAdressePrompt: "Adresse des Links:",
  },

  schlagwortInput: {
    pflichtTitle: "Pflicht-Schlagwort, kann nicht entfernt werden",
    schlagwortTitle: (wert: string) => `Schlagwort: ${wert}`,
    entfernenAriaLabel: (wert: string) => `Schlagwort ${wert} entfernen`,
    eingabePlatzhalter: "Schlagwort eingeben, Vorschlag wählen oder Enter drücken",
    eingabeAriaLabel: "Weiteres Schlagwort",
    hinweisText:
      "Bestehende Schlagworte werden vorgeschlagen. Neue Begriffe werden beim Speichern für alle Referentinnen und Referenten verfügbar.",
    maxHinweis: (max: number) => ` Maximal ${max} Schlagworte.`,
    nochMoeglich: (n: number) => ` Noch ${n} möglich.`,
    vorschlaegeLabel: "Vorschläge:",
  },

  terminumfeld: {
    platzhalterHinweis:
      "Sobald ein Beginn eingetragen ist, erscheint hier der Monat mit allen bereits geplanten Veranstaltungen.",
    konfliktTerminHinweis: "Bitte den Termin verschieben oder die Fortbildung anders besetzen.",
    weitereVeranstaltungen: (n: number) =>
      `… und ${n} weitere Veranstaltung${n === 1 ? "" : "en"} am selben Tag, siehe Liste unten.`,
    keineAndereVeranstaltung: "An diesem Tag ist keine andere Veranstaltung geplant.",
    tagBitte: "Bitte möglichst einen anderen Tag wählen.",
    amSelbenTag: (anzahl: number) => `Am selben Tag ${anzahl === 1 ? "läuft" : "laufen"} bereits:`,
    kuerzelRegional: "RLFB",
    kuerzelSchilf: "SchiLf",
    kuerzelSonst: "ALP",
    entwurfHinweis: "(Entwurf)",
    keinTerminAmTag: "An diesem Tag ist sonst nichts geplant.",
  },

  wizard: {
    zurueck: "Zurück",
    weiter: "Weiter",
    abbrechen: "Abbrechen",
    schrittVon: (aktuell: number, gesamt: number) => `Schritt ${aktuell} von ${gesamt}`,
    wirdGespeichert: "Wird gespeichert …",
    alsEntwurfSpeichern: "Als Entwurf speichern",
    zurFreigabeEinreichen: "Zur Freigabe einreichen",
    anlegenUndVeroeffentlichen: "Anlegen und veröffentlichen",
    knopfHinweisReferent:
      "Als Entwurf speichern: noch nicht eingereicht, Weiterarbeiten ist jederzeit möglich. Zur Freigabe einreichen: Das Thema wird geprüft und freigeschaltet, eine Bestätigung kommt per Mail.",
    speichern: "Speichern",
    lueckenHinweis: (liste: string) =>
      `Es fehlt noch: ${liste}. Als Entwurf lässt sich trotzdem speichern. Zum Einreichen müssen alle Angaben vollständig sein.`,
    allesVollstaendig: "Alle Angaben vollständig.",
    zeileTermin: "Termin",
    zeileArt: "Art",
    zeileOrt: "Ort",
    zeileSchularten: "Schularten",
    zeileNiveaustufe: "Niveaustufe",
    zeileReferenten: "Referenten",
    zeileKompetenzen: "Kompetenzen",
    zeileSchlagworte: "Schlagworte",
    zeileStatus: "Status",
    leerwert: "–",
    lueckeKompetenzen: "DigCompEdu-Kompetenzen",
  },

  state: {
    titelZuKurz: "Bitte einen Lehrgangstitel mit mindestens 3 Zeichen angeben.",
    maxTnUngueltig: "Bitte eine Teilnehmerzahl von mindestens 1 angeben.",
    datumUnvollstaendig: "Bitte Datum und Uhrzeit im Format TT.MM.JJJJ HH:MM angeben.",
    ortPflicht: "Bitte einen Ort angeben.",
    beschreibungLeer: "Bitte eine Lehrgangsbeschreibung eingeben.",
    schulartenPflicht: "Bitte mindestens eine Schulart auswählen.",
    niveaustufePflicht: "Bitte die Niveaustufe wählen.",
    kompetenzenPflicht:
      "Bitte mindestens eine Kompetenz zuordnen. Danach filtern Lehrkräfte auf der Webseite.",
    referentenPflicht: "Bitte mindestens eine Referentin oder einen Referenten zuordnen.",
  },

  schritte: {
    hilfeEckdaten:
      "Form und Organisation der Fortbildung. Bei RLFB auch Termin und Ort. Diese Angaben erscheinen im Kalender und in der Suche.",
    hilfeBeschreibung:
      "Inhalt, Zielgruppe und was die Teilnehmenden mitbringen.",
    hilfeZielgruppe: "Schularten und Schlagworte bestimmen, wer die Fortbildung auf der Webseite findet.",
    hilfeDigcomp:
      "Niveaustufe und Kompetenzbereiche nach DigCompEdu Bavaria. Lehrkräfte können auf der Webseite danach filtern.",
    hilfeReferenten: "Wer hält die Fortbildung? Weitere Personen lassen sich ergänzen.",
    hilfePruefen: "Alle Angaben im Überblick vor dem Einreichen.",
  },

  freigabeLeiste: {
    notizLabel: "Was fehlt oder soll geändert werden?",
    notizPlatzhalter:
      "z. B. Bitte die Beschreibung um die technischen Voraussetzungen ergänzen.",
    notizHinweis: (titel: string) =>
      `Der Text erscheint bei „${titel}“ als Hinweis, sobald die einreichende Person die Fortbildung wieder öffnet.`,
    abbrechen: "Abbrechen",
    freigeben: "Freigeben und veröffentlichen",
    wirdFreigegeben: "Wird freigegeben …",
    zurueckweisen: "Zurückweisen",
    wirdGesendet: "Wird gesendet …",
    erstBearbeiten: "Erst bearbeiten",
    fibsNummerBereits: (nummer: string) => `FIBS-Nummer bereits vermerkt: ${nummer}`,
  },

  seiteNeu: {
    bereitsEingetragen: (n: number) => `Bereits eingetragene Themen (${n})`,
    bereitsEingetragenHinweis: "Bitte vorab kurz durchsehen, damit sich Themen nicht doppeln.",
    metaTitel: "Neue Fortbildung",
    zurueckZurUebersicht: "Zurück zur Übersicht",
    ueberschrift: "Neue Fortbildung",
    beschreibungBasis:
      "Schritt für Schritt zur fertigen Ausschreibung. Jeder Schritt wird geprüft, bevor es weitergeht. Als Entwurf lässt sich jederzeit speichern, auch wenn noch etwas fehlt.",
    beschreibungZusatzReferent:
      " Zum Schluss das Thema zur Prüfung einreichen. Veröffentlicht wird es von der Beratung digitale Bildung.",
  },

  seiteBearbeiten: {
    metaTitel: "Fortbildung bearbeiten",
    zurueckZurUebersicht: "Zurück zur Übersicht",
    gespeichertHinweis: "Die Fortbildung wurde gespeichert.",
    fehltRedaktionHinweis:
      "Vor der Freigabe fehlen noch Niveaustufe oder DigCompEdu. Bitte im Reiter DigCompEdu ergänzen und speichern, danach freigeben.",
    ueberschrift: "Fortbildung bearbeiten",
    quelleFibsImport:
      "Aus FIBS importiert. Änderungen hier werden von einem erneuten Import nicht überschrieben.",
    quelleManuell: "Manuell erfasst.",
    freigegebenSuffix: (datum: string, von?: string | null) =>
      ` Freigegeben am ${datum}${von ? ` von ${von}` : ""}.`,
    imFrontendAnsehen: "Auf der Webseite ansehen",
    aushangTitle: "A4-Seite zum Ausdrucken und Aushängen",
    aushang: "Aushang",
    duplizieren: "Duplizieren",
    zurueckgewiesenTitel: "Von der Beratung digitale Bildung zurückgewiesen",
    eingereichtTitel: "Zur Freigabe eingereicht",
    eingereichtAmText: (datum: string) => `Eingereicht am ${datum}.`,
    nachDerFreigabeHinweis: "Nach der Freigabe erscheint die Fortbildung auf der Webseite.",
    veroeffentlichtHinweisReferent:
      "Dieses Thema ist bereits veröffentlicht. Änderungen sind sofort online, eine neue Freigabe braucht es nicht.",
    freigegebenTitel: "Von der Beratung digitale Bildung entschieden",
    freigegebenHinweis:
      "Abgesagte oder archivierte Angebote kann nur noch die Beratung digitale Bildung ändern.",
    zurNachbereitung: "Zur Nachbereitung",
    aenderungsverlauf: "Änderungsverlauf",
  },

  validation: {
    feldPflicht: (feldname: string) => `${feldname} ist ein Pflichtfeld.`,
    datumUnvollstaendig: (feldname: string) =>
      `${feldname}: bitte Datum und Uhrzeit vollständig angeben.`,
    titelZuKurz: "Der Lehrgangstitel muss mindestens 3 Zeichen haben.",
    titelZuLang: "Der Lehrgangstitel darf höchstens 200 Zeichen haben.",
    kurztitelZuLang: "Der Kurztitel darf höchstens 100 Zeichen haben.",
    beschreibungZuLang: "Die Beschreibung ist zu lang.",
    beschreibungLeer: "Bitte eine Lehrgangsbeschreibung eingeben.",
    organisationsformPflicht: "Bitte eine Organisationsform wählen.",
    maxTnKeineZahl: "Bitte eine Zahl für die maximale Teilnehmerzahl angeben.",
    maxTnGanzzahl: "Die maximale Teilnehmerzahl muss eine ganze Zahl sein.",
    maxTnMindestens: "Bitte mindestens 1 Platz angeben.",
    maxTnZuGross: "Bitte höchstens 1000 Plätze angeben.",
    formatPflicht: "Bitte ein Veranstaltungsformat wählen.",
    ortPflicht: "Bitte einen Ort angeben.",
    ortZuLang: "Der Ort darf höchstens 150 Zeichen haben.",
    schulartenPflicht: "Bitte mindestens eine Schulart auswählen.",
    fachZuLang: "Das Fach darf höchstens 100 Zeichen haben.",
    schlagwortZuKurz: "Ein Schlagwort braucht mindestens 2 Zeichen.",
    schlagwortZuLang: "Ein Schlagwort darf höchstens 60 Zeichen haben.",
    schlagworteZuViele: "Bitte höchstens 30 Schlagworte angeben.",
    fibsUrlUngueltig: "Der FIBS-Link muss mit https:// beginnen.",
    endeVorBeginn: "Das Ende muss nach dem Beginn liegen.",
    zeitraumZuLang: "Der Zeitraum ist länger als 30 Tage. Bitte Beginn und Ende prüfen.",
    veroeffentlichenNiveaustufe: "Vor dem Veröffentlichen bitte die Niveaustufe angeben.",
    veroeffentlichenKompetenzen:
      "Vor dem Veröffentlichen bitte mindestens eine DigCompEdu-Kompetenz zuordnen. Sonst findet der Kompetenzfilter die Fortbildung nicht.",
    veroeffentlichenReferenten:
      "Vor dem Veröffentlichen bitte mindestens eine Referentin oder einen Referenten zuordnen.",
    organisationsformAlpGesperrt:
      "ALP Dillingen ist als Organisationsform derzeit gesperrt. Bitte SchiLf oder RLFB wählen.",
  },

  actionsFortbildung: {
    nichtIhreVeranstaltung: "Diese Fortbildung gehört nicht zu den eigenen Veranstaltungen.",
    veroeffentlichenNurAdmin:
      "Das Veröffentlichen übernimmt die Beratung digitale Bildung. Bitte zur Prüfung einreichen.",
    bereitsFreigegeben:
      "Diese Fortbildung ist abgesagt oder archiviert. Ändern kann sie nur noch die Beratung digitale Bildung.",
    unbekannteKompetenzen: (liste: string) =>
      `Unbekannte Kompetenz(en): ${liste}. Bitte die Seite neu laden.`,
    referentenFehlen:
      "Eine ausgewählte Person gibt es nicht mehr. Bitte die Seite neu laden.",
    fortbildungExistiertNicht: "Diese Fortbildung existiert nicht mehr.",
    konflikt:
      "Das Thema wurde inzwischen an anderer Stelle geändert. Bitte die Seite neu laden und die eigenen Angaben erneut eintragen.",
    zurueckAufEntwurfGesperrt:
      "Ein eingereichtes Thema wird hier nicht auf Entwurf zurückgesetzt. Bitte „Zurückweisen“ nutzen, das speichert eine Begründung und informiert per Mail.",
  },

  actionsFreigabe: {
    freigabeNichtMoeglich: (gruende: string) => `Freigabe nicht möglich: ${gruende}`,
    notizZuKurz: "Bitte kurz begründen, was noch fehlt.",
    notizZuLang: "Die Begründung ist zu lang.",
    wartetNichtMehr: "Diese Fortbildung wartet nicht mehr auf Freigabe.",
    zurueckAnEinreichende: "Zurück an die einreichende Person.",
    zwischenzeitlichGeaendert:
      "Das Thema wurde inzwischen geändert. Bitte neu laden und erneut prüfen.",
  },
} as const;
