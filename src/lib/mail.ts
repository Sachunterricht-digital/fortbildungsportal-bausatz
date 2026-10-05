import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

/**
 * Transaktionsmails der App (Bestätigung beim Einreichen, Rückweisung).
 *
 * Konfiguration ausschließlich über Umgebungsvariablen (SMTP_HOST, SMTP_PORT,
 * SMTP_USER, SMTP_PASS, MAIL_FROM, MAIL_BCC — siehe .env.example). Fehlt
 * SMTP_HOST, ist kein Mailserver eingerichtet (so läuft die Testinstanz): die
 * Mail wird dann nur ins Server-Log geschrieben, nicht versendet.
 *
 * Der Versand darf die eigentliche Aktion (Speichern, Zurückweisen) nie
 * scheitern lassen. Diese Funktion wirft deshalb nie, sondern loggt Fehler
 * über console.error und meldet über den Rückgabewert, ob der Versand
 * geklappt hat — der Aufrufer kann das für einen Audit-Vermerk nutzen.
 */

const STANDARD_ABSENDER = "Fortbildungsportal <noreply@example.org>";
const STANDARD_BCC = "kontakt@example.org";

export interface MailNachricht {
  an: string;
  betreff: string;
  text: string;
  /** Ohne Kopie an MAIL_BCC, etwa bei Serienmails der Umfrage (manche Mailanbieter zählen die Kopie je Domain mit). */
  ohneBcc?: boolean;
}

let transporterCache: Transporter | null | undefined;

/** Einmal aufgebaut, danach wiederverwendet — pro Prozess genügt eine Verbindung. */
function ladeTransporter(): Transporter | null {
  if (transporterCache !== undefined) return transporterCache;

  const host = process.env.SMTP_HOST;
  if (!host) {
    transporterCache = null;
    return transporterCache;
  }

  transporterCache = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    // Port 587 = STARTTLS, keine implizite TLS-Verbindung von Anfang an.
    secure: false,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });

  return transporterCache;
}

/**
 * Vorname für die Anrede in einer Mail: erstes Wort von `name` (bei Referenten
 * und Zugängen immer "Vorname Nachname", siehe actions/zugang.ts und
 * actions/referentenRegistrierung.ts). Ohne Namen bleibt die Mail-Adresse als
 * Rückfallebene.
 */
export function vornameAus(name: string | null | undefined, email: string): string {
  const erster = name?.trim().split(/\s+/)[0];
  return erster ? erster : email;
}

/**
 * Versendet eine Klartext-Mail. BCC geht an jede Mail (MAIL_BCC, Standard
 * siehe oben), außer bei `ohneBcc`. Gibt `true` zurück, wenn die Mail verschickt oder — ohne
 * SMTP_HOST — bewusst nur geloggt wurde, `false` bei einem echten Fehler.
 */
export async function sendeMail({ an, betreff, text, ohneBcc = false }: MailNachricht): Promise<boolean> {
  if (!an) {
    console.error("Mailversand übersprungen: keine Empfängeradresse.", { betreff });
    return false;
  }

  const von = process.env.MAIL_FROM || STANDARD_ABSENDER;
  const bcc = ohneBcc ? undefined : process.env.MAIL_BCC || STANDARD_BCC;
  const client = ladeTransporter();

  if (!client) {
    // Testinstanz ohne Mailserver: bewusst kein Fehler, nur das Log.
    console.log("Mail (kein SMTP_HOST gesetzt, nur geloggt):", {
      von,
      an,
      bcc,
      betreff,
      text,
    });
    return true;
  }

  try {
    await client.sendMail({ from: von, to: an, bcc, subject: betreff, text });
    return true;
  } catch (error) {
    console.error("Mailversand fehlgeschlagen:", error, { an, betreff });
    return false;
  }
}
