/**
 * Klartext-Transaktionsmails, siehe src/lib/mail.ts und die beiden
 * Auslöser in src/actions/fortbildung.ts (Einreichen) und
 * src/actions/freigabe.ts (Zurückweisen). Wortgleich abgenommen, nur
 * Platzhalter befüllen.
 */
export const mails = {
  bestaetigung: {
    betreff: (titel: string) => `Dein Thema „${titel}“ ist eingegangen`,
    text: (angaben: {
      vorname: string;
      titel: string;
      format: string;
      termin: string;
      zielgruppe: string;
      link: string;
    }) => `Hallo ${angaben.vorname},

danke für dein Thema. Die Beratung digitale Bildung prüft es und gibt es danach frei.

Deine Angaben im Überblick:
Titel: ${angaben.titel}
Format: ${angaben.format}
Termin: ${angaben.termin}
Zielgruppe: ${angaben.zielgruppe}

Ergänzen oder ändern kannst du das Thema jederzeit hier:
${angaben.link}

Viele Grüße
Vorname Nachname
Beratung digitale Bildung, Schulamt Aichach-Friedberg`,
  },

  freigabe: {
    betreff: (titel: string) => `Dein Thema „${titel}“ ist freigegeben`,
    text: (angaben: { vorname: string; titel: string; link: string }) => `Hallo ${angaben.vorname},

dein Thema „${angaben.titel}“ ist jetzt auf der Webseite zu sehen:
${angaben.link}

Viele Grüße
Vorname Nachname
Beratung digitale Bildung, Schulamt Aichach-Friedberg`,
  },

  /**
   * Hinweis an die Dienstmail (MAIL_BCC, siehe src/lib/mail.ts), wenn eine
   * Referentin oder ein Referent ein bereits freigegebenes Thema ändert.
   * Geht NICHT an den Referenten selbst — dort ist es keine neue Freigabe,
   * die Änderung ist sofort online. Admin-Änderungen lösen diese Mail nicht
   * aus, siehe saveFortbildung() in src/actions/fortbildung.ts.
   */
  geaendertNachFreigabe: {
    betreff: (titel: string) => `Geändert: „${titel}“`,
    text: (angaben: {
      name: string;
      titel: string;
      linkAdmin: string;
      linkOeffentlich: string;
    }) => `${angaben.name} hat das freigegebene Thema „${angaben.titel}“ geändert. Die Änderung ist schon online.
Im Admin ansehen: ${angaben.linkAdmin}
Öffentlich: ${angaben.linkOeffentlich}`,
  },

  /**
   * Einladung per Mail aus dem Zugangs-Dialog (Personenverwaltung, Admin).
   *
   * Anders als die drei Mails oben wird dieser Text im Dialog vor dem Senden
   * angezeigt und ist für die eine Mail änderbar. `{Link}` bleibt bewusst ein
   * sichtbarer Platzhalter — der echte Link entsteht erst beim Senden (neuer
   * Zugangstoken) und ersetzt ihn dort. `neu`: Vorlage der Beratung
   * (Stand 27.09.2026). `reset`: eigener Kurztext für
   * Personen mit bereits gesetztem Passwort, noch ohne Abnahme.
   */
  einladung: {
    neu: {
      betreff: "Dein Zugang zum Referentenportal",
      text: (angaben: { vorname: string }) => `Liebe ${angaben.vorname},

hier ist dein persönlicher Link zum neuen Referentenportal:
{Link}

Über fortbildung.example.org sammeln wir ab diesem Jahr unsere Fortbildungen statt über die TaskCard. Lehrkräfte finden dort alle Angebote und SchiLf auf Abruf, dazu ein kurzes Profil von jedem aus dem Team. Ich prüfe eure Einträge und schalte sie frei. Daraus entsteht auch der Katalog fürs Schulamt.

Bitte leg zuerst dein Profil an: Stammschule, Schwerpunkte und ein paar Sätze zu dir. Dazu gern ein Foto, ein Avatar geht genauso. Profil und Foto erscheinen im Teambereich der Webseite.

Danach kannst du deine Fortbildungen eintragen. Zwischendurch kannst du jederzeit speichern. Nach dem Einreichen bekommst du eine kurze Bestätigung per Mail.

Der Link gilt 14 Tage und nur einmal. Danach meldest du dich unter fortbildung.example.org/login an.

Wenn etwas hakt oder unklar ist, gib mir bitte kurz Bescheid.

Liebe Grüße
Vorname`,
    },
    reset: {
      betreff: "Neues Passwort für das Referentenportal",
      text: (angaben: { vorname: string }) => `Liebe ${angaben.vorname},

hier ist dein Link, um ein neues Passwort festzulegen:
{Link}

Der Link gilt 14 Tage und nur einmal. Danach meldest du dich wie gewohnt unter fortbildung.example.org/login an.

Liebe Grüße
Vorname`,
    },
  },

  rueckweisung: {
    betreff: (titel: string) => `Bitte anpassen: „${titel}“`,
    text: (angaben: {
      vorname: string;
      titel: string;
      begruendung: string;
      link: string;
    }) => `Hallo ${angaben.vorname},

dein Thema „${angaben.titel}“ braucht noch eine Anpassung:

${angaben.begruendung}

Hier kommst du direkt zum Thema:
${angaben.link}

Danach reichst du es einfach erneut ein.

Viele Grüße
Vorname Nachname
Beratung digitale Bildung, Schulamt Aichach-Friedberg`,
  },
} as const;
