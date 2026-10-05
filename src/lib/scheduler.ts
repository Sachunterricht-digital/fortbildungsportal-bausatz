import "server-only";

import { letzterLauf, runRetention } from "@/lib/retention";

/**
 * Startet den Löschlauf einmal täglich aus dem laufenden Prozess heraus.
 *
 * Absichtlich ohne externe Cron-Abhängigkeit, damit das Löschkonzept auch
 * dann greift, wenn niemand einen Systemdienst einrichtet. Wer lieber einen
 * echten Cronjob nutzt: /api/cron/cleanup mit CRON_SECRET aufrufen und hier
 * über RETENTION_SCHEDULER=off abschalten.
 */

const PRUEF_INTERVALL_MS = 60 * 60 * 1000; // stündlich nachsehen
const MINDEST_ABSTAND_MS = 20 * 60 * 60 * 1000; // höchstens einmal am Tag

let gestartet = false;

export function startRetentionScheduler(): void {
  if (gestartet) return;
  if (process.env.RETENTION_SCHEDULER === "off") {
    console.log("[Löschlauf] Zeitsteuerung ist abgeschaltet (RETENTION_SCHEDULER=off).");
    return;
  }

  gestartet = true;

  const pruefen = async () => {
    try {
      const letzte = await letzterLauf();
      const faellig =
        !letzte || Date.now() - letzte.getTime() >= MINDEST_ABSTAND_MS;

      if (!faellig) return;

      // Bevorzugt nachts laufen lassen. Ist der Lauf schon deutlich
      // überfällig (Server war aus), sofort nachholen.
      const stunde = new Date().getHours();
      const nachtfenster = stunde >= 1 && stunde <= 5;
      const ueberfaellig =
        letzte && Date.now() - letzte.getTime() >= 36 * 60 * 60 * 1000;

      if (nachtfenster || ueberfaellig || !letzte) {
        await runRetention();
      }
    } catch (error) {
      console.error("[Löschlauf] fehlgeschlagen:", error);
    }
  };

  // Nicht sofort beim Start — erst kurz warten, damit der Bootvorgang nicht
  // durch eine Datenbanktransaktion verzögert wird.
  setTimeout(() => void pruefen(), 30_000);
  setInterval(() => void pruefen(), PRUEF_INTERVALL_MS);
}
