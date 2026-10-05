import "server-only";

/**
 * Abruf der FIBS-Seite.
 *
 * WICHTIG — bitte vor dem Scharfschalten lesen:
 * Automatisiertes Auslesen von FIBS kann den Nutzungsbedingungen des
 * Bayerischen Staatsministeriums bzw. der ALP Dillingen widersprechen. Der
 * Import ist deshalb standardmäßig AUS (`FIBS_IMPORT_ENABLED=false`) und muss
 * bewusst eingeschaltet werden. Vorher:
 *
 *   1. Nutzungsbedingungen von FIBS prüfen.
 *   2. robots.txt prüfen — das macht `robotsErlaubt()` unten automatisch.
 *   3. Besser noch: bei der ALP Dillingen nach einer offiziellen
 *      Exportmöglichkeit oder Schnittstelle fragen. Dann entfällt das
 *      Auslesen der Webseite ganz und nur dieses Modul wird ersetzt.
 *
 * Der Abruf ist zusätzlich gedrosselt und identifiziert sich mit einer
 * Kontaktadresse im User-Agent, damit der Betreiber uns erreichen kann.
 */

const PAUSE_MS = 2000;
const ZEITLIMIT_MS = 15_000;

let letzterAbruf = 0;

export function importAktiv(): boolean {
  return process.env.FIBS_IMPORT_ENABLED === "true";
}

export function basisUrl(): string {
  return (process.env.FIBS_BASE_URL ?? "https://fibs.alp.dillingen.de").replace(
    /\/+$/,
    "",
  );
}

function userAgent(): string {
  const kontakt = process.env.FIBS_USER_AGENT_CONTACT ?? "kein-kontakt-hinterlegt";
  return `Fortbildungsportal/1.0 (Schulamt; ${kontakt})`;
}

/** Wartet, damit zwischen zwei Abrufen mindestens PAUSE_MS liegen. */
async function drosseln(): Promise<void> {
  const wartezeit = letzterAbruf + PAUSE_MS - Date.now();
  if (wartezeit > 0) {
    await new Promise((fertig) => setTimeout(fertig, wartezeit));
  }
  letzterAbruf = Date.now();
}

/**
 * Prüft die robots.txt der FIBS-Seite. Verweigert der Betreiber den Zugriff
 * auf den Suchpfad, bricht der Import ab statt sich darüber hinwegzusetzen.
 */
export async function robotsErlaubt(pfad: string): Promise<boolean> {
  try {
    const antwort = await fetch(`${basisUrl()}/robots.txt`, {
      headers: { "User-Agent": userAgent() },
      signal: AbortSignal.timeout(ZEITLIMIT_MS),
      cache: "no-store",
    });

    // Keine robots.txt bedeutet: keine Einschränkung.
    if (!antwort.ok) return true;

    const text = await antwort.text();
    return !verbotenLautRobots(text, pfad);
  } catch {
    // Im Zweifel nicht abrufen.
    return false;
  }
}

/**
 * Minimale robots.txt-Auswertung für den Abschnitt "User-agent: *".
 * Kein vollständiger Parser — reicht aber, um ein ausgesprochenes Verbot
 * nicht zu übergehen.
 */
function verbotenLautRobots(robots: string, pfad: string): boolean {
  let imAllgemeinenAbschnitt = false;

  for (const rohzeile of robots.split(/\r?\n/)) {
    const zeile = rohzeile.split("#")[0]!.trim();
    if (!zeile) continue;

    const [feldRoh, ...rest] = zeile.split(":");
    const feld = feldRoh!.trim().toLowerCase();
    const wert = rest.join(":").trim();

    if (feld === "user-agent") {
      imAllgemeinenAbschnitt = wert === "*";
      continue;
    }

    if (imAllgemeinenAbschnitt && feld === "disallow" && wert) {
      if (wert === "/" || pfad.startsWith(wert)) return true;
    }
  }

  return false;
}

/**
 * Holt die Suchergebnisseite zu einem Begriff.
 *
 * Der Pfad ist eine Annahme über die FIBS-Suche und muss beim ersten echten
 * Lauf gegen die tatsächliche Seite geprüft werden — deshalb liegt er hier an
 * einer Stelle und nicht verteilt im Code.
 */
export async function holeSuchergebnis(begriff: string): Promise<string> {
  if (!importAktiv()) {
    throw new Error(
      "Der FIBS-Import ist deaktiviert. Zum Aktivieren FIBS_IMPORT_ENABLED=true setzen — vorher bitte die Nutzungsbedingungen prüfen.",
    );
  }

  const pfad = `/lehrgangssuche?suchbegriff=${encodeURIComponent(begriff)}`;

  if (!(await robotsErlaubt(pfad))) {
    throw new Error(
      `Die robots.txt von ${basisUrl()} untersagt den automatisierten Abruf von ${pfad}. Der Import wurde abgebrochen.`,
    );
  }

  await drosseln();

  const antwort = await fetch(`${basisUrl()}${pfad}`, {
    headers: {
      "User-Agent": userAgent(),
      Accept: "text/html",
      "Accept-Language": "de-DE",
    },
    signal: AbortSignal.timeout(ZEITLIMIT_MS),
    cache: "no-store",
  });

  if (!antwort.ok) {
    throw new Error(`FIBS antwortete mit Status ${antwort.status}.`);
  }

  return antwort.text();
}
