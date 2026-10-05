import "server-only";

import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Ablage der Profilfotos.
 *
 * Liegt bewusst außerhalb des Repos/Images in einem Docker-Volume
 * (`UPLOAD_DIR`, siehe `docker-compose.yml`), damit ein `rsync --delete`
 * beim Deploy die Bilder nicht mitreißt. Dateiname ist immer
 * `<referentId>.webp` — die ID kommt ausschließlich aus der Datenbank,
 * nie direkt aus einer URL (siehe `/api/portraet/[id]`).
 */

function uploadsBasis(): string {
  return process.env.UPLOAD_DIR ?? "/app/uploads";
}

function portraetsOrdner(): string {
  return path.join(uploadsBasis(), "portraets");
}

export function portraetPfad(referentId: string): string {
  return path.join(portraetsOrdner(), `${referentId}.webp`);
}

/** Speichert die bereits zugeschnittenen WebP-Bytes für den Referenten. */
export async function schreibePortraet(referentId: string, daten: Buffer): Promise<void> {
  await mkdir(portraetsOrdner(), { recursive: true });
  await writeFile(portraetPfad(referentId), daten);
}

/** Löscht das Foto, falls vorhanden. Fehlt die Datei bereits, ist das kein Fehler. */
export async function loeschePortraet(referentId: string): Promise<void> {
  try {
    await unlink(portraetPfad(referentId));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

/** Existenzprüfung ohne die Datei zu lesen — für schnelle Vorabchecks. */
export async function portraetExistiert(referentId: string): Promise<boolean> {
  try {
    await access(portraetPfad(referentId));
    return true;
  } catch {
    return false;
  }
}

/** Liest die Bilddatei, oder null, wenn sie fehlt (z. B. Datenstand ohne Datei). */
export async function lesePortraet(referentId: string): Promise<Buffer | null> {
  try {
    return await readFile(portraetPfad(referentId));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
