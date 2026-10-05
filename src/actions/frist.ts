"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { AuthError, requireRole } from "@/lib/auth";
import { fromDatetimeLocalValue } from "@/lib/datetime";
import { FRIST_SCHLUESSEL } from "@/lib/frist";
import type { FormularState } from "@/lib/validation/fortbildung";
import { T } from "@/texte/de";

/** Setzt oder entfernt die Frist. Leeres Datum entfernt sie. */
export async function speichereFrist(
  _bisher: FormularState,
  formData: FormData,
): Promise<FormularState> {
  let user;
  try {
    user = await requireRole("ADMIN");
  } catch (error) {
    if (error instanceof AuthError) return { fehler: { _: error.message } };
    throw error;
  }

  const tag = formData.get("frist")?.toString().trim() ?? "";

  if (tag === "") {
    await prisma.systemSetting.deleteMany({ where: { id: FRIST_SCHLUESSEL } });
  } else {
    // Frist gilt bis zum Ende des Stichtags, Berliner Zeit.
    const datum = /^\d{4}-\d{2}-\d{2}$/.test(tag) ? fromDatetimeLocalValue(`${tag}T23:59`) : null;
    if (!datum) return { fehler: { frist: T.frist.ungueltig } };
    await prisma.systemSetting.upsert({
      where: { id: FRIST_SCHLUESSEL },
      create: { id: FRIST_SCHLUESSEL, value: datum.toISOString() },
      update: { value: datum.toISOString() },
    });
  }

  await auditLog({
    userId: user.id,
    aktion: "UPDATE",
    entitaet: "SystemSetting",
    entitaetId: FRIST_SCHLUESSEL,
    details: { frist: tag || null },
  });

  revalidatePath("/admin", "layout");
  return { erfolg: true, meldung: tag ? T.frist.gespeichert : T.frist.entfernt };
}
