/**
 * Prüft ein Weiterleitungsziel nach dem Login (`?weiter=`). Erlaubt sind nur
 * relative Pfade auf dieser Seite, sonst wäre der Login ein Sprungbrett auf
 * fremde Seiten (Open Redirect).
 *
 * Abgelehnt werden: alles, was nicht mit `/` beginnt, `//` am Anfang,
 * Backslashes an jeder Stelle (Browser lesen `/\evil` wie `//evil`),
 * Steuerzeichen und alles, dessen Auflösung gegen eine Fremd-Origin
 * einen anderen Ursprung ergibt. Fällt etwas durch, gilt `/admin`.
 * Der Pfad wird unverändert zurückgegeben (inklusive Query und Hash).
 */
export const STANDARD_ZIEL = "/admin";

export function sichereWeiterleitung(weiter: string | null | undefined): string {
  if (typeof weiter !== "string" || weiter.length === 0 || weiter.length > 2000) {
    return STANDARD_ZIEL;
  }
  if (!weiter.startsWith("/") || weiter.startsWith("//")) return STANDARD_ZIEL;
  if (weiter.includes("\\")) return STANDARD_ZIEL;
  if (/[\u0000-\u001f\u007f-\u009f]/.test(weiter)) return STANDARD_ZIEL;
  try {
    if (new URL(weiter, "http://x").origin !== "http://x") return STANDARD_ZIEL;
  } catch {
    return STANDARD_ZIEL;
  }
  return weiter;
}
