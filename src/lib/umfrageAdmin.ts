import "server-only";

import { prisma } from "@/lib/prisma";
import { berlinIsoDatum } from "@/lib/datetime";
import type { EmpfaengerOption } from "@/components/umfrage/UmfrageForm";

/** Alle Personen als Checkliste, sortiert nach Nachnamen. */
export async function ladeEmpfaengerOptionen(): Promise<EmpfaengerOption[]> {
  const referenten = await prisma.referent.findMany({
    orderBy: [{ nachname: "asc" }, { vorname: "asc" }],
    select: { id: true, vorname: true, nachname: true, organisation: true, email: true, aktiv: true },
  });
  return referenten.map((r) => ({
    id: r.id,
    name: `${r.vorname} ${r.nachname}`,
    organisation: r.organisation,
    hatMail: Boolean(r.email?.trim()),
    aktiv: r.aktiv,
  }));
}

/** Vorausgewählt: aktiv und mit Mailadresse. */
export function vorausgewaehlt(personen: EmpfaengerOption[]): string[] {
  return personen.filter((p) => p.aktiv && p.hatMail).map((p) => p.id);
}

export function isoTage(termine: Array<{ datum: Date }>): string[] {
  return termine.map((t) => berlinIsoDatum(t.datum));
}
