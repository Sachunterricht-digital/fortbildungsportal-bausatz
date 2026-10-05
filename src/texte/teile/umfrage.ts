/**
 * Texte der Terminumfrage: öffentliche Seite `/umfrage/<token>`, Admin-Bereich
 * `/admin/umfragen` und die Standard-Mails. Entwürfe, die Abnahme durch die Redaktion
 * steht noch aus.
 *
 * In den Mailtexten bleiben `{Vorname}` und `{Link}` als sichtbare Platzhalter
 * stehen. Sie werden erst beim Senden je Person ersetzt, siehe
 * src/actions/umfrage.ts.
 */
export const umfrage = {
  // -------------------------------------------------------------------------
  // Öffentliche Seite
  // -------------------------------------------------------------------------
  oeffentlich: {
    seitenTitel: "Terminumfrage",
    ungueltigTitel: "Dieser Link funktioniert nicht",
    ungueltigText:
      "Der Link ist unvollständig oder nicht mehr gültig. Bitte öffne ihn noch einmal aus der Mail oder melde dich bei der Beratung digitale Bildung.",
    ort: "Ort",
    uhrzeit: "Uhrzeit",
    tabelleTitel: "Alle Antworten",
    spalteName: "Name",
    summeJa: "Ja",
    summeHinweis: "Anzahl der Antworten mit „Ja“",
    keineAntworten: "Noch hat niemand geantwortet.",
    du: "du",
    deineAntwortTitel: "Deine Antwort",
    begruessung: (vorname: string) => `Hallo ${vorname}`,
    antwortHinweis: "Wähle für jeden Termin eine Antwort.",
    terminGruppe: (termin: string) => `Antwort für ${termin}`,
    kommentarLabel: "Kommentar (optional)",
    kommentarHinweis: (max: number) => `Höchstens ${max} Zeichen.`,
    speichern: "Speichern",
    speichernLaeuft: "Wird gespeichert …",
    ungespeichert: "Noch nicht gespeichert.",
    geschlossenTitel: "Die Umfrage ist geschlossen",
    geschlossenText: "Antworten sind nicht mehr möglich. Die Tabelle zeigt den letzten Stand.",
    festgelegt: (termin: string) => `Festgelegter Termin: ${termin}`,
    festgelegtKurz: "Festgelegt",
    deineAntwortLesen: "Deine gespeicherte Antwort",
    keineEigeneAntwort: "Du hast noch nicht geantwortet.",
    kommentarVon: (name: string) => `Kommentar von ${name}`,
    fehler: {
      werteFehlen: "Bitte wähle für jeden Termin eine Antwort.",
      kommentarZuLang: (max: number) => `Der Kommentar darf höchstens ${max} Zeichen haben.`,
      geschlossen: "Die Umfrage ist geschlossen. Deine Antwort wurde nicht gespeichert.",
      linkUngueltig: "Der Link ist nicht mehr gültig. Bitte öffne ihn noch einmal aus der Mail.",
      terminFremd: "Die Termine der Umfrage haben sich geändert. Bitte lade die Seite neu.",
    },
    danke: {
      titel: "Danke für deine Antwort",
      text: "Deine Antwort ist gespeichert. Über denselben Link kannst du sie ändern, solange die Umfrage offen ist.",
      profilTitel: "Dein Profil",
      profilFehlt: "Im Referentenbereich fehlt noch:",
      fehltFoto: "ein Foto",
      fehltKurzprofil: "ein Kurzprofil",
      fehltThema: "ein eingereichtes Thema",
      profilKomplett: "Dein Profil ist vollständig. Danke dafür.",
      freiwillig: "Das ist freiwillig.",
      zumReferentenbereich: "Zum Referentenbereich",
      ohneKontoText:
        "Mit einem Zugang pflegst du dein Profil und reichst Themen ein. Das ist freiwillig.",
      zugangEinrichten: "Zugang einrichten",
      zurAnmeldung: "Zur Anmeldung",
      zugangLaeuft: "Einen Moment …",
      zugangFehler: {
        keineMail:
          "Für dich ist keine Mailadresse hinterlegt. Bitte melde dich bei der Beratung digitale Bildung.",
        mailBelegt:
          "Die Mailadresse gehört schon zu einem anderen Konto. Bitte melde dich bei der Beratung digitale Bildung.",
        nichtMoeglich:
          "Der Zugang lässt sich hier nicht einrichten. Bitte melde dich bei der Beratung digitale Bildung.",
        schonVorhanden: "Du hast schon einen Zugang. Melde dich im Referentenbereich an.",
      },
    },
  },

  // -------------------------------------------------------------------------
  // Admin
  // -------------------------------------------------------------------------
  seitenleiste: "Umfragen",
  liste: {
    titel: "Umfragen",
    beschreibung: "Terminumfragen an Referentinnen und Referenten.",
    neu: "Neue Umfrage",
    leer: "Noch keine Umfragen angelegt.",
    spalteTitel: "Titel",
    spalteStatus: "Status",
    spalteAntworten: "Antworten",
    spalteTermine: "Termine",
    spalteAngelegt: "Angelegt",
    quote: (geantwortet: number, gesamt: number) => `${geantwortet} von ${gesamt}`,
  },
  form: {
    titelNeu: "Neue Umfrage",
    titelBearbeiten: "Umfrage bearbeiten",
    zurueck: "Zurück zu den Umfragen",
    titel: "Titel",
    beschreibung: "Beschreibung (optional)",
    ort: "Ort (optional)",
    uhrzeit: "Uhrzeit (optional)",
    uhrzeitPlatzhalter: "14:00 bis 17:00 Uhr",
    termineTitel: "Termine",
    termineHinweis: "Wähle Tage zur Auswahl. Die Reihenfolge ergibt sich aus dem Datum.",
    terminLabel: (nr: number) => `Termin ${nr}`,
    terminHinzufuegen: "Termin hinzufügen",
    terminEntfernen: (nr: number) => `Termin ${nr} entfernen`,
    empfaengerTitel: "Empfänger",
    empfaengerHinweis: "Vorausgewählt sind aktive Personen mit Mailadresse.",
    empfaengerAbgewaehlt: "Abgewählte Personen werden samt ihrer Antwort entfernt.",
    alleWaehlen: "Alle auswählen",
    keineWaehlen: "Keine auswählen",
    ohneMail: "Keine Mailadresse hinterlegt",
    inaktiv: "Nicht aktiv",
    speichern: "Umfrage speichern",
    speichernLaeuft: "Wird gespeichert …",
    gespeichert: "Umfrage gespeichert.",
    fehler: {
      titelFehlt: "Bitte einen Titel eingeben.",
      titelZuLang: (max: number) => `Der Titel darf höchstens ${max} Zeichen haben.`,
      textZuLang: (max: number) => `Höchstens ${max} Zeichen.`,
      terminFehlt: "Bitte mindestens einen Termin angeben.",
      terminUngueltig: "Mindestens ein Datum ist ungültig.",
      terminDoppelt: "Ein Datum kommt doppelt vor.",
      zuvieleTermine: (max: number) => `Höchstens ${max} Termine.`,
      empfaengerFehlt: "Bitte mindestens eine Person auswählen.",
      nichtGefunden: "Die Umfrage gibt es nicht mehr.",
    },
  },
  detail: {
    zurueck: "Zurück zu den Umfragen",
    bearbeiten: "Bearbeiten",
    status: "Status",
    antworten: "Antworten",
    matrixTitel: "Antworten im Überblick",
    spalteName: "Name",
    spalteEingeladen: "Eingeladen",
    spalteErinnert: "Erinnert",
    spalteGeantwortet: "Geantwortet",
    spalteKommentar: "Kommentar",
    spalteLink: "Link",
    nochNicht: "noch nicht",
    ohneMail: "ohne Mail",
    linkKopieren: "Link kopieren",
    linkKopiert: "Link kopiert",
    linkKopierenFuer: (name: string) => `Link für ${name} kopieren`,
    linkAnzeigen: "Link:",
    keineTeilnehmer: "Noch keine Personen in der Umfrage.",
    festgelegt: (termin: string) => `Festgelegt: ${termin}`,
    aktionen: "Aktionen",
    einladungKnopf: "Einladung per Mail senden",
    erinnerungKnopf: "Erinnerung an alle ohne Antwort",
    personenKnopf: "Personen hinzufügen",
    schliessenKnopf: "Umfrage schließen",
    oeffnenKnopf: "Umfrage wieder öffnen",
    festlegenKnopf: "Termin festlegen",
    loeschenKnopf: "Löschen",
    offenNurOffen: "Mails gehen nur bei einer offenen Umfrage raus.",
  },
  mail: {
    betreff: "Betreff",
    text: "Text",
    platzhalterHinweis:
      "{Vorname}, {Link} und optional {Zugang} werden beim Senden je Person ersetzt. {Zugang} ist der Link zum Profil, bei bestehendem Zugang die Anmeldung. Fehlt {Link}, geht nichts raus.",
    einladungTitel: "Einladung per Mail senden",
    einladungBeschreibung: (anzahl: number) =>
      anzahl === 1
        ? "Die Mail geht an 1 Person, die noch keine Einladung hat."
        : `Die Mail geht an ${anzahl} Personen, die noch keine Einladung haben.`,
    erinnerungTitel: "Erinnerung an alle ohne Antwort",
    erinnerungBeschreibung: (anzahl: number) =>
      anzahl === 1
        ? "Die Mail geht an 1 Person, die eingeladen wurde und noch nicht geantwortet hat."
        : `Die Mail geht an ${anzahl} Personen, die eingeladen wurden und noch nicht geantwortet haben.`,
    niemand: "Es gibt niemanden, an den diese Mail gehen würde.",
    senden: "Senden",
    sendenLaeuft: "Wird gesendet …",
    abbrechen: "Abbrechen",
    fehler: {
      unvollstaendig: "Bitte Betreff und Text ausfüllen.",
      linkFehlt: "Im Text fehlt {Link}. Dort setzt das Portal den persönlichen Link ein.",
      platzhalter: (funde: string[]) =>
        `Unbekannter Platzhalter im Text: ${funde.join(" ")}. Erlaubt sind {Vorname}, {Link} und {Zugang}.`,
      platzhalterBetreff: (funde: string[]) =>
        `Unbekannter Platzhalter im Betreff: ${funde.join(" ")}. Erlaubt ist nur {Vorname}.`,
      zuLang: (max: number) => `Höchstens ${max} Zeichen.`,
      umfrageGeschlossen: "Die Umfrage ist geschlossen. Es geht keine Mail raus.",
      niemand: "Es gibt niemanden, an den diese Mail gehen würde.",
      nichtGefunden: "Die Umfrage gibt es nicht mehr.",
    },
    ergebnis: (gesendet: number, fehlgeschlagen: number) =>
      fehlgeschlagen === 0
        ? `${gesendet} Mail${gesendet === 1 ? "" : "s"} gesendet.`
        : `${gesendet} gesendet, ${fehlgeschlagen} fehlgeschlagen. Bei den Fehlgeschlagenen bleibt der Vermerk offen.`,
    grund: {
      KONTO_INAKTIV: "Konto ist inaktiv",
      MAIL_BELEGT: "Mailadresse gehört schon zu einem anderen Konto",
      OHNE_MAIL: "keine Mailadresse",
      PERSON_FEHLT: "Person nicht gefunden",
      ZUGANG_FEHLER: "Zugang konnte nicht angelegt werden",
      VERSAND: "Versand fehlgeschlagen",
    },
    nichtErreicht: (personen: Array<{ name: string; grund: string }>) =>
      `Nicht erreicht: ${personen.map((p) => `${p.name} (${p.grund})`).join(", ")}.`,
    mailAus:
      "Mailversand ist aus. Die Mails stehen nur im Server-Log, die Vermerke bleiben offen. Bitte die Links einzeln kopieren.",
  },
  personen: {
    titel: "Personen hinzufügen",
    beschreibung: "Wähle Referentinnen und Referenten, die noch nicht in der Umfrage stehen.",
    keine: "Alle Personen sind schon dabei.",
    hinzufuegen: "Hinzufügen",
    hinzufuegenLaeuft: "Wird hinzugefügt …",
    nichtsGewaehlt: "Bitte mindestens eine Person auswählen.",
    erfolg: (anzahl: number) =>
      anzahl === 1 ? "1 Person hinzugefügt." : `${anzahl} Personen hinzugefügt.`,
  },
  festlegen: {
    titel: "Termin festlegen",
    beschreibung: "Der Termin wird in der Umfrage hervorgehoben. Die Umfrage wird dabei geschlossen.",
    waehlen: "Termin wählen",
    speichern: "Festlegen und schließen",
    fehler: "Bitte einen Termin wählen.",
  },
  schliessen: {
    titel: "Umfrage schließen?",
    beschreibung:
      "Danach sind keine Antworten mehr möglich. Die Tabelle bleibt für alle Beteiligten lesbar.",
    bestaetigen: "Umfrage schließen",
  },
  loeschen: {
    titel: "Umfrage löschen?",
    beschreibung: (titel: string) =>
      `„${titel}“ wird endgültig entfernt, samt Terminen und allen Antworten. Das lässt sich nicht rückgängig machen. Die persönlichen Links funktionieren danach nicht mehr.`,
    bestaetigen: "Endgültig löschen",
    abbrechen: "Abbrechen",
  },
  status: {
    OFFEN: "Offen",
    GESCHLOSSEN: "Geschlossen",
  },

  // -------------------------------------------------------------------------
  // Standard-Mails. Die Texte erscheinen vorausgefüllt im Dialog und sind für
  // die eine Mail änderbar.
  // -------------------------------------------------------------------------
  mails: {
    einladung: {
      betreff: (titel: string) => `Terminumfrage: ${titel}`,
      text: (angaben: { titel: string }) => `Hallo {Vorname},

wir suchen einen Termin für „${angaben.titel}“. Bitte trag in der Umfrage ein, an welchen Tagen du kannst:
{Link}

Dein Link gehört nur dir. Du kannst deine Antwort darüber auch später noch ändern.

Viele Grüße
Vorname Nachname
Beratung digitale Bildung, Schulamt Aichach-Friedberg`,
    },
    erinnerung: {
      betreff: (titel: string) => `Erinnerung: Terminumfrage ${titel}`,
      text: (angaben: { titel: string }) => `Hallo {Vorname},

zur Umfrage „${angaben.titel}“ fehlt mir noch deine Antwort. Du brauchst nur kurz anzuklicken, an welchen Tagen du kannst:
{Link}

Danke dir.

Viele Grüße
Vorname Nachname
Beratung digitale Bildung, Schulamt Aichach-Friedberg`,
    },
  },
} as const;
