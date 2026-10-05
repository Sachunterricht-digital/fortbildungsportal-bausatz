"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { AuthError, requireRole } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import type { FormularState } from "@/lib/validation/fortbildung";

/**
 * Onboarding-Angaben der Referentinnen und Referenten (Kontaktwege, Zeiten,
 * Bemerkung; die Handynummer ist `Referent.telefon`). Das Lesen geschieht in
 * `/admin/referenten/onboarding`, beides nur für die Administration. Eintragen können die Angaben nur die Personen selbst
 * über ihren Umfrage-Link (`speichereOnboarding` in umfrageOeffentlich.ts).
 */

/**
 * Löscht die Angaben einer Person (Art. 17 DSGVO). Die Person selbst, ihr
 * Telefon (gehört zum Profil) und ihre Umfrageantworten bleiben unberührt.
 * Das Protokoll hält nur fest, dass gelöscht wurde, nicht was.
 */
export async function loescheOnboardingAngaben(referentId: string): Promise<FormularState> {
  let user;
  try {
    user = await requireRole("ADMIN");
  } catch (error) {
    if (error instanceof AuthError) return { fehler: { _: error.message } };
    throw error;
  }

  const { count } = await prisma.referentOnboarding.deleteMany({ where: { referentId } });

  if (count > 0) {
    await auditLog({
      userId: user.id,
      aktion: "DELETE",
      entitaet: "ReferentOnboarding",
      entitaetId: referentId,
    });
  }

  revalidatePath("/admin/referenten/onboarding");
  return { erfolg: true };
}
