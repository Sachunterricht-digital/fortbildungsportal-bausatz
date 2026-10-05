/**
 * Einfaches In-Memory-Rate-Limiting für den Login.
 *
 * Bewusst ohne Redis: Die Anwendung läuft als eine Instanz. Bei mehreren
 * Instanzen hinter einem Load Balancer müsste das durch einen gemeinsamen
 * Speicher ersetzt werden — der Schutz wäre sonst pro Instanz statt global.
 */

interface Eintrag {
  versuche: number;
  zuruecksetzenUm: number;
}

export interface RateLimiter {
  /** true = Versuch erlaubt. Zählt den Versuch mit. */
  pruefen(schluessel: string): { erlaubt: boolean; wartesekunden: number };
  /** Nach erfolgreichem Login aufrufen, damit der Zähler wieder frei ist. */
  zuruecksetzen(schluessel: string): void;
}

export function createRateLimiter(
  maxVersuche: number,
  fensterSekunden: number,
): RateLimiter {
  const speicher = new Map<string, Eintrag>();

  function aufraeumen(jetzt: number) {
    for (const [schluessel, eintrag] of speicher) {
      if (eintrag.zuruecksetzenUm <= jetzt) speicher.delete(schluessel);
    }
  }

  return {
    pruefen(schluessel) {
      const jetzt = Date.now();

      // Gelegentlich aufräumen, damit die Map nicht unbegrenzt wächst.
      if (speicher.size > 500) aufraeumen(jetzt);

      const eintrag = speicher.get(schluessel);

      if (!eintrag || eintrag.zuruecksetzenUm <= jetzt) {
        speicher.set(schluessel, {
          versuche: 1,
          zuruecksetzenUm: jetzt + fensterSekunden * 1000,
        });
        return { erlaubt: true, wartesekunden: 0 };
      }

      eintrag.versuche += 1;

      if (eintrag.versuche > maxVersuche) {
        return {
          erlaubt: false,
          wartesekunden: Math.ceil((eintrag.zuruecksetzenUm - jetzt) / 1000),
        };
      }

      return { erlaubt: true, wartesekunden: 0 };
    },

    zuruecksetzen(schluessel) {
      speicher.delete(schluessel);
    },
  };
}

/** Client-IP aus den üblichen Proxy-Headern (NGINX setzt x-forwarded-for). */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unbekannt";
}
