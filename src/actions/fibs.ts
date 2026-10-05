"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import { AUSGEGRAUT } from "@/constants/funktionen";
import { runFibsImport } from "@/lib/fibs/importer";
import type { FibsImportErgebnis } from "@/lib/fibs/types";
import { T } from "@/texte/de";

export interface ImportState {
  ergebnis?: FibsImportErgebnis;
  fehler?: string;
}

/**
 * Startet einen FIBS-Import.
 *
 * Ohne ausdrückliches Häkchen läuft nur der Trockenlauf: Die Vorschau zeigt,
 * was passieren würde, geschrieben wird nichts. Das echte Übernehmen ist der
 * ADMIN-Rolle vorbehalten.
 */
export async function starteFibsImport(
  _bisher: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const uebernehmen = formData.get("uebernehmen") === "on";

  const user = uebernehmen
    ? await requireRole("ADMIN")
    : await requireRole("ADMIN", "REDAKTEUR");

  if (AUSGEGRAUT.fibsImport) {
    return { fehler: T.allgemein.kommtSpaeter };
  }

  const ergebnis = await runFibsImport({ dryRun: !uebernehmen });

  await auditLog({
    userId: user.id,
    aktion: "IMPORT",
    entitaet: "Fortbildung",
    details: {
      dryRun: ergebnis.dryRun,
      gefunden: ergebnis.gefunden,
      neu: ergebnis.neu,
      aktualisiert: ergebnis.aktualisiert,
      fehler: ergebnis.fehler ?? null,
    },
  });

  if (uebernehmen) {
    revalidatePath("/admin");
    revalidatePath("/fortbildungen");
  }

  return { ergebnis, fehler: ergebnis.fehler };
}
