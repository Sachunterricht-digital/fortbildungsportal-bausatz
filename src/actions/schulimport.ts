"use server";

import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { planeSchulimport, SCHULIMPORT_MAX_BYTES, type SchulimportPlan } from "@/lib/schulimport";

export interface SchulimportStand { csv?: string; pruefsumme?: string; plan?: SchulimportPlan; fehler?: string; meldung?: string }
const auswahl = { id: true, name: true, ort: true, strasse: true, schulnummer: true, aktiv: true, istOnline: true, _count: { select: { fortbildungen: true } } } satisfies Prisma.VeranstaltungsortSelect;
function pruefsumme(plan: SchulimportPlan): string { return createHash("sha256").update(JSON.stringify(plan)).digest("hex"); }

export async function pruefeSchulimport(_bisher: SchulimportStand, formData: FormData): Promise<SchulimportStand> {
  await requireRole("ADMIN", "REDAKTEUR");
  const datei = formData.get("datei");
  if (!(datei instanceof File) || !datei.size) return { fehler: "Bitte eine befüllte CSV-Datei auswählen." };
  if (datei.size > SCHULIMPORT_MAX_BYTES) return { fehler: "Die CSV-Datei darf höchstens 128 KB groß sein." };
  let csv;
  try { csv = new TextDecoder("utf-8", { fatal: true }).decode(await datei.arrayBuffer()); }
  catch { return { fehler: "Die Datei ist nicht UTF-8-kodiert. Bitte als CSV UTF-8 speichern." }; }
  const bestand = await prisma.veranstaltungsort.findMany({ select: auswahl, orderBy: { id: "asc" } });
  const plan = planeSchulimport(csv, bestand);
  return { csv, plan, pruefsumme: pruefsumme(plan) };
}

export async function uebernehmeSchulimport(_bisher: SchulimportStand, formData: FormData): Promise<SchulimportStand> {
  const user = await requireRole("ADMIN", "REDAKTEUR");
  const csv = formData.get("csv");
  const gepruefteSumme = formData.get("pruefsumme");
  if (typeof csv !== "string" || typeof gepruefteSumme !== "string" || new TextEncoder().encode(csv).byteLength > SCHULIMPORT_MAX_BYTES) return { fehler: "Bitte die Datei erneut prüfen." };
  try {
    const ergebnis = await prisma.$transaction(async (tx) => {
      const bestand = await tx.veranstaltungsort.findMany({ select: auswahl, orderBy: { id: "asc" } });
      const plan = planeSchulimport(csv, bestand);
      if (plan.fehler.length) return { fehler: "Die Datei enthält Fehler. Bitte korrigieren und erneut prüfen." };
      if (pruefsumme(plan) !== gepruefteSumme) return { fehler: "Die Schuldatei oder das Verzeichnis hat sich seit der Vorschau geändert. Bitte erneut prüfen." };
      let neu = 0, aktualisiert = 0;
      for (const zeile of plan.zeilen) {
        const daten = { name: zeile.daten.name, ort: zeile.daten.ort, strasse: zeile.daten.strasse || null, schulnummer: zeile.daten.schulnummer || null };
        if (zeile.aktion === "neu") { await tx.veranstaltungsort.create({ data: { ...daten, sortOrder: 10 } }); neu++; }
        if (zeile.aktion === "aktualisieren" && zeile.id) { await tx.veranstaltungsort.update({ where: { id: zeile.id }, data: daten }); aktualisiert++; }
      }
      await tx.auditLog.create({ data: { userId: user.id, aktion: "IMPORT", entitaet: "Veranstaltungsort", details: { neu, aktualisiert, unveraendert: plan.zeilen.length - neu - aktualisiert } } });
      return { pruefsumme: gepruefteSumme, meldung: `${neu} Schulen neu angelegt, ${aktualisiert} aktualisiert, ${plan.zeilen.length - neu - aktualisiert} unverändert.` };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 });
    revalidatePath("/", "layout");
    return ergebnis;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) return { fehler: "Das Verzeichnis wurde gleichzeitig geändert. Es wurde nichts übernommen. Bitte erneut prüfen." };
    throw error;
  }
}
