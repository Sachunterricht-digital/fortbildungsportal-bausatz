import "server-only";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Protokolliert Änderungen für die Rechenschaftspflicht (Art. 5 Abs. 2 DSGVO).
 *
 * Bewusst schlank: nur wer, wann, was und welche Felder — keine Kopie der
 * Daten selbst. Ein Volltext-Protokoll wäre eine zweite, ungeschützte
 * Datenhaltung und würde dem Löschkonzept zuwiderlaufen.
 *
 * Das Protokoll darf den eigentlichen Vorgang nie scheitern lassen, deshalb
 * werden Fehler nur geloggt.
 */
export async function auditLog(eintrag: {
  userId?: string | null;
  aktion:
    | "CREATE"
    | "UPDATE"
    | "DELETE"
    | "LOGIN"
    | "LOGIN_FAILED"
    | "LOGOUT"
    | "IMPORT"
    | "RETENTION"
    /** Transaktionsmail (Bestätigung, Rückweisung) konnte nicht versendet werden. */
    | "MAIL_FEHLER"
    /** Foto-Upload wurde abgelehnt (Typ, Größe, unlesbar, HEIC, Profil fehlt). */
    | "UPLOAD_ABGELEHNT";
  entitaet: string;
  entitaetId?: string | null;
  details?: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: eintrag.userId ?? null,
        aktion: eintrag.aktion,
        entitaet: eintrag.entitaet,
        entitaetId: eintrag.entitaetId ?? null,
        details: eintrag.details,
      },
    });
  } catch (error) {
    console.error("Audit-Log konnte nicht geschrieben werden:", error);
  }
}

/** Namen der geänderten Felder ermitteln — für `details` im Protokoll. */
export function geaenderteFelder<T extends Record<string, unknown>>(
  vorher: T,
  nachher: Partial<T>,
): string[] {
  return Object.keys(nachher).filter((key) => {
    const alt = vorher[key];
    const neu = nachher[key];
    if (alt instanceof Date && neu instanceof Date) {
      return alt.getTime() !== neu.getTime();
    }
    if (Array.isArray(alt) && Array.isArray(neu)) {
      return JSON.stringify([...alt].sort()) !== JSON.stringify([...neu].sort());
    }
    return alt !== neu;
  });
}
