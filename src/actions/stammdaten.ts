"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { AuthError, requireRole } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import { zuFeldFehlern, type FormularState } from "@/lib/validation/fortbildung";
import { normalisiereSchlagwort, schlagwortSchluessel } from "@/lib/schlagwort";
import { loeschePortraet } from "@/lib/portraet";
import { sperreReferent } from "@/lib/sperren";
import { telefonFeld } from "@/lib/validation/profil";
import { FUNKTION_VALUES } from "@/constants/fortbildung";

/**
 * Stammdaten: Referenten, Schlagworte, Veranstaltungsorte.
 *
 * Alle Aktionen prüfen die Rolle selbst — Server Actions sind eigene
 * Endpunkte, der Guard im Layout schützt sie nicht.
 */

async function rolle() {
  return requireRole("ADMIN", "REDAKTEUR");
}

function alsFehler(error: unknown): FormularState | null {
  return error instanceof AuthError ? { fehler: { _: error.message } } : null;
}

// ---------------------------------------------------------------------------
// Referenten
// ---------------------------------------------------------------------------

const ReferentSchema = z.object({
  vorname: z.string().trim().min(1, "Bitte den Vornamen angeben.").max(80),
  nachname: z.string().trim().min(1, "Bitte den Nachnamen angeben.").max(80),
  organisation: z.string().trim().max(120).optional().transform((w) => w || null),
  email: z
    .string()
    .trim()
    .optional()
    .transform((w) => w || null)
    .refine(
      (w) => w === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(w),
      "Bitte eine gültige E-Mail-Adresse eingeben.",
    ),
  telefon: telefonFeld(),
  funktion: z.enum(FUNKTION_VALUES).catch("REFERENT"),
  schwerpunkte: z.string().trim().max(200).optional().transform((w) => w || null),
  kurzprofil: z.string().trim().max(1000).optional().transform((w) => w || null),
  notiz: z.string().trim().max(1000).optional().transform((w) => w || null),
  // Neu angelegte Personen sind standardmäßig öffentlich sichtbar (siehe auch
  // den Prisma-Default und das defaultChecked im Anlegen-Dialog).
  oeffentlichSichtbar: z.coerce.boolean().default(true),
});

export async function speichereReferent(
  id: string | null,
  _bisher: FormularState,
  formData: FormData,
): Promise<FormularState> {
  let user;
  try {
    user = await rolle();
  } catch (error) {
    const fehler = alsFehler(error);
    if (fehler) return fehler;
    throw error;
  }

  const geparst = ReferentSchema.safeParse({
    vorname: formData.get("vorname") ?? "",
    nachname: formData.get("nachname") ?? "",
    organisation: formData.get("organisation") ?? "",
    email: formData.get("email") ?? "",
    telefon: formData.get("telefon") ?? "",
    funktion: formData.get("funktion") ?? "",
    schwerpunkte: formData.get("schwerpunkte") ?? "",
    kurzprofil: formData.get("kurzprofil") ?? "",
    notiz: formData.get("notiz") ?? "",
    oeffentlichSichtbar: formData.get("oeffentlichSichtbar") === "on",
  });

  if (!geparst.success) return { fehler: zuFeldFehlern(geparst.error) };

  const wirdAngelegt = id === null;
  let kontoMailGeaendert = false;

  if (id) {
    // Hängt an der Person ein Konto und ändert sich hier die Mail, wandert
    // die Login-Mail des Kontos in derselben Transaktion mit — Referenten
    // können ihre Mail nicht selbst ändern (siehe actions/profil.ts), sonst
    // käme niemand mehr an die neue Adresse heran.
    const bisheriger = await prisma.referent.findUnique({
      where: { id },
      select: { userId: true },
    });
    const neueLoginMail = geparst.data.email?.trim().toLowerCase() ?? null;

    if (bisheriger?.userId && neueLoginMail) {
      const konto = await prisma.user.findUnique({
        where: { id: bisheriger.userId },
        select: { email: true },
      });

      if (konto && konto.email !== neueLoginMail) {
        const belegt = await prisma.user.findFirst({
          where: { email: neueLoginMail, NOT: { id: bisheriger.userId } },
          select: { id: true },
        });
        if (belegt) {
          return {
            fehler: {
              email: "Diese Mailadresse gehört schon zu einem anderen Konto.",
            },
          };
        }

        await prisma.$transaction([
          prisma.referent.update({ where: { id }, data: geparst.data }),
          prisma.user.update({
            where: { id: bisheriger.userId },
            data: { email: neueLoginMail },
          }),
        ]);
        kontoMailGeaendert = true;
      }
    }

    if (!kontoMailGeaendert) {
      await prisma.referent.update({ where: { id }, data: geparst.data });
    }
  } else {
    const neu = await prisma.referent.create({ data: geparst.data });
    id = neu.id;
  }

  await auditLog({
    userId: user.id,
    aktion: wirdAngelegt ? "CREATE" : "UPDATE",
    entitaet: "Referent",
    entitaetId: id,
    details: kontoMailGeaendert ? { kontoMailGeaendert: true } : undefined,
  });

  revalidatePath("/admin/referenten");
  revalidatePath("/admin/konto");
  return { erfolg: true, meldung: "Gespeichert." };
}

/**
 * Referenten werden deaktiviert statt gelöscht, solange sie an Fortbildungen
 * hängen — sonst verlöre die Historie ihre Referentenangabe. Ohne
 * Zuordnungen wird wirklich gelöscht (Art. 17 DSGVO, Recht auf Löschung).
 */
export async function entferneReferent(id: string): Promise<void> {
  const user = await requireRole("ADMIN");

  const anzahl = await prisma.fortbildungReferent.count({ where: { referentId: id } });

  if (anzahl > 0) {
    // Stilllegen nimmt auch die Onboarding-Angaben mit: Eine
    // ausgeschiedene Person soll keine Kontaktdaten mehr hinterlassen.
    // Die Person wird dabei gesperrt (FOR UPDATE): Ein gerade laufendes
    // öffentliches Speichern (Onboarding, Antwort) wartet und sieht danach
    // `aktiv = false`, statt die Onboarding-Zeile nach dem Löschen neu anzulegen.
    await prisma.$transaction(async (tx) => {
      await sperreReferent(tx, id);
      await tx.referent.update({ where: { id }, data: { aktiv: false } });
      await tx.referentOnboarding.deleteMany({ where: { referentId: id } });
    });
    await auditLog({
      userId: user.id,
      aktion: "UPDATE",
      entitaet: "Referent",
      entitaetId: id,
      details: { deaktiviert: true, zuordnungen: anzahl },
    });
  } else {
    // Endgültiges Löschen reißt das verknüpfte Konto mit — sonst blockiert
    // ein verwaistes Konto die Mailadresse dauerhaft für einen neuen Zugang.
    // Offene Zugangstoken hängen per Cascade am Konto und verschwinden damit
    // automatisch mit. Das Porträt liegt außerhalb der Datenbank im
    // Upload-Volume und wird danach separat entfernt.
    const referent = await prisma.referent.findUnique({
      where: { id },
      select: { userId: true, portraetAm: true, user: { select: { role: true } } },
    });

    await prisma.$transaction(async (tx) => {
      await tx.referent.delete({ where: { id } });
      // Ein Admin-Konto (Admin als Referent) bleibt immer bestehen.
      if (referent?.userId && referent.user?.role !== "ADMIN") {
        await tx.user.delete({ where: { id: referent.userId } });
      }
    });

    if (referent?.portraetAm) {
      try {
        await loeschePortraet(id);
      } catch (error) {
        console.error("Porträt beim Löschen der Person nicht entfernt:", id, error);
      }
    }

    await auditLog({
      userId: user.id,
      aktion: "DELETE",
      entitaet: "Referent",
      entitaetId: id,
      details: { kontoGeloescht: Boolean(referent?.userId && referent.user?.role !== "ADMIN") },
    });
  }

  revalidatePath("/admin/referenten");
}

// ---------------------------------------------------------------------------
// Schlagworte
// ---------------------------------------------------------------------------

export async function speichereSchlagwort(
  _bisher: FormularState,
  formData: FormData,
): Promise<FormularState> {
  try {
    await rolle();
  } catch (error) {
    const fehler = alsFehler(error);
    if (fehler) return fehler;
    throw error;
  }

  const name = normalisiereSchlagwort((formData.get("name") ?? "").toString());
  if (name.length < 2) {
    return { fehler: { name: "Ein Schlagwort braucht mindestens 2 Zeichen." } };
  }
  if (name.length > 60) {
    return { fehler: { name: "Ein Schlagwort darf höchstens 60 Zeichen haben." } };
  }

  const normalisiert = schlagwortSchluessel(name);
  const vorhanden = await prisma.schlagwort.findUnique({ where: { normalisiert } });
  if (vorhanden) return { fehler: { name: "Dieses Schlagwort gibt es bereits." } };

  await prisma.schlagwort.create({ data: { name, normalisiert } });
  revalidatePath("/admin/schlagworte");
  return { erfolg: true, meldung: `„${name}" wurde angelegt.` };
}

/** Steuert, mit welchen Begriffen der FIBS-Import sucht. */
export async function setzeFibsSuche(id: string, aktiv: boolean): Promise<void> {
  await rolle();
  await prisma.schlagwort.update({ where: { id }, data: { fuerFibsImport: aktiv } });
  revalidatePath("/admin/schlagworte");
}

export async function entferneSchlagwort(id: string): Promise<void> {
  const user = await requireRole("ADMIN");

  const schlagwort = await prisma.schlagwort.findUnique({ where: { id } });
  // Pflicht-Schlagworte sind Teil der fachlichen Festlegung des Schulamts und
  // werden von der Server Action ohnehin immer wieder angehängt.
  if (!schlagwort || schlagwort.istPflicht) return;

  await prisma.schlagwort.delete({ where: { id } });
  await auditLog({
    userId: user.id,
    aktion: "DELETE",
    entitaet: "Schlagwort",
    entitaetId: id,
    details: { name: schlagwort.name },
  });

  revalidatePath("/admin/schlagworte");
}

// ---------------------------------------------------------------------------
// Veranstaltungsorte
// ---------------------------------------------------------------------------

const OrtSchema = z.object({
  name: z.string().trim().min(2, "Bitte den Namen des Ortes angeben.").max(150),
  ort: z.string().trim().max(100).optional().transform((w) => w || null),
  strasse: z.string().trim().max(150).optional().transform((w) => w || null),
  schulnummer: z.string().trim().max(20).optional().transform((w) => w || null),
});

export async function speichereOrt(
  _bisher: FormularState,
  formData: FormData,
): Promise<FormularState> {
  try {
    await rolle();
  } catch (error) {
    const fehler = alsFehler(error);
    if (fehler) return fehler;
    throw error;
  }

  const geparst = OrtSchema.safeParse({
    name: formData.get("name") ?? "",
    ort: formData.get("ort") ?? "",
    strasse: formData.get("strasse") ?? "",
    schulnummer: formData.get("schulnummer") ?? "",
  });

  if (!geparst.success) return { fehler: zuFeldFehlern(geparst.error) };

  const vorhanden = await prisma.veranstaltungsort.findFirst({
    where: { name: geparst.data.name, ort: geparst.data.ort },
  });
  if (vorhanden) return { fehler: { name: "Diesen Ort gibt es bereits." } };

  await prisma.veranstaltungsort.create({ data: geparst.data });
  revalidatePath("/admin/orte");
  return { erfolg: true, meldung: `„${geparst.data.name}" wurde angelegt.` };
}

/**
 * Orte werden nur stillgelegt, nie gelöscht: An ihnen hängen vergangene
 * Fortbildungen, deren Ortsangabe erhalten bleiben muss.
 */
export async function setzeOrtAktiv(id: string, aktiv: boolean): Promise<void> {
  await rolle();
  await prisma.veranstaltungsort.update({ where: { id }, data: { aktiv } });
  revalidatePath("/admin/orte");
}
