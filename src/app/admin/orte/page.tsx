import { redirect } from "next/navigation";

/**
 * Der Ort ist seit der Umstellung auf ein Freitextfeld (src/lib/validation/fortbildung.ts)
 * keine eigene Verwaltungsseite mehr — die feste Ortsliste bleibt nur intern
 * für FIBS-Import und Archiv bestehen (Veranstaltungsort, nicht gelöscht).
 */
export default function OrtePage() {
  redirect("/admin");
}
