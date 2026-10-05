import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { REGISTRIERUNG_GUELTIGKEIT_TAGE } from "@/constants/registrierung";

function hashe(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Erzeugt einen 256-Bit-Token. Der Klartext verlässt diese Funktion nur als
 * Link; in der Datenbank liegt ausschließlich sein SHA-256-Hash.
 */
export async function erzeugeReferentenRegistrierungslink(
  erstelltVonId: string,
  maxNutzungen: number,
): Promise<{ token: string; gueltigBis: Date }> {
  const token = randomBytes(32).toString("base64url");
  const gueltigBis = new Date(
    Date.now() + REGISTRIERUNG_GUELTIGKEIT_TAGE * 24 * 60 * 60 * 1000,
  );

  // Es gibt immer nur einen aktiven allgemeinen Link. Beim Erzeugen eines
  // neuen Links wird ein möglicherweise weitergeleiteter älterer Link sofort
  // unwirksam, ohne den Vorgang bereits registrierter Personen zu berühren.
  await prisma.$transaction([
    prisma.referentenRegistrierungslink.updateMany({
      where: { aktiv: true },
      data: { aktiv: false },
    }),
    prisma.referentenRegistrierungslink.create({
      data: {
        tokenHash: hashe(token),
        expiresAt: gueltigBis,
        maxNutzungen,
        erstelltVonId,
      },
    }),
  ]);

  return { token, gueltigBis };
}

/** Prüft nur die Link-Gültigkeit; der Link bleibt dabei wiederverwendbar. */
export async function pruefeReferentenRegistrierungslink(
  token: string,
): Promise<boolean> {
  if (token.length < 40 || token.length > 200) return false;

  const link = await prisma.referentenRegistrierungslink.findUnique({
    where: { tokenHash: hashe(token) },
    select: { aktiv: true, expiresAt: true, nutzungen: true, maxNutzungen: true },
  });

  return Boolean(
    link?.aktiv &&
      link.expiresAt > new Date() &&
      link.nutzungen < link.maxNutzungen,
  );
}

/** Vollständiger Link für die Weitergabe durch Redaktion oder Administration. */
export function referentenRegistrierungsLink(token: string): string {
  const basis = process.env.APP_BASE_URL ?? "http://localhost:3000";
  return `${basis.replace(/\/+$/, "")}/referenten-registrierung?token=${encodeURIComponent(token)}`;
}

/** Nur für die Server Action: der Hash wird nie an den Client zurückgegeben. */
export function hashRegistrierungsToken(token: string): string {
  return hashe(token);
}
