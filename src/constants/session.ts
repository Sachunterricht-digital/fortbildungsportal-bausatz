/**
 * Eigenes Modul, damit `proxy.ts` den Cookie-Namen importieren kann, ohne
 * `lib/auth.ts` mitzuziehen — dort hängen Prisma und next/headers dran, die im
 * Proxy nicht laufen dürfen.
 */
export const SESSION_COOKIE = "session_token";

/** Sitzungsdauer in Sekunden: acht Stunden, also ein Arbeitstag. */
export const SESSION_DAUER_SEKUNDEN = 60 * 60 * 8;

/**
 * Wert für das `Secure`-Attribut des Sitzungscookies.
 *
 * Ohne explizite Einstellung bleibt das sichere Standardverhalten erhalten:
 * Produktion nur über HTTPS, lokale Entwicklung auch über HTTP. Der Wert
 * `false` ist ausschließlich für einen vorübergehenden direkten LAN-Zugriff
 * gedacht; hinter einem TLS-Reverse-Proxy muss er `true` sein.
 */
export function sitzungsCookieSicher(
  wert: string | undefined,
  istProduktion: boolean,
): boolean {
  if (wert === undefined || wert.trim() === "") return istProduktion;

  const normalisiert = wert.trim().toLowerCase();
  if (normalisiert === "true") return true;
  if (normalisiert === "false") return false;

  throw new Error("SESSION_COOKIE_SECURE muss true oder false sein.");
}

/** Liest die Version aus einem bereits kryptographisch geprüften JWT-Claim. */
export function liesSessionVersion(wert: unknown): number | null {
  return typeof wert === "number" && Number.isSafeInteger(wert) && wert >= 0
    ? wert
    : null;
}
