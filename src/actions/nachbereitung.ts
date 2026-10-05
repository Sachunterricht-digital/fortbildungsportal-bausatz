"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { AuthError, darfBearbeiten, requireRole, type SessionUser } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import { AUSGEGRAUT } from "@/constants/funktionen";
import { T } from "@/texte/de";
import type { FormularState } from "@/lib/validation/fortbildung";

const MeldungSchema = z.object({
  tnTatsaechlich: z.coerce
    .number({ message: "Bitte eine Zahl eintragen." })
    .int("Bitte eine ganze Zahl eintragen.")
    .min(0, "Weniger als null Teilnehmende gibt es nicht.")
    .max(2000, "Diese Zahl ist nicht plausibel."),
  tnBemerkung: z
    .string()
    .trim()
    .max(300, "Die Bemerkung ist zu lang.")
    .optional()
    .transform((w) => w || null),
});

const BestaetigungsVersandSchema = z.object({
  empfaenger: z.enum(["REFERENTEN", "TEILNEHMENDE"]),
  versandt: z.boolean(),
});

const FibsNachtragSchema = z.object({ eingetragen: z.boolean() });

const NACHBEREITUNGS_STATUS = new Set(["VEROEFFENTLICHT", "ARCHIVIERT"]);

/**
 * Meldet die tatsächliche Teilnehmerzahl einer bereits gelaufenen Veranstaltung.
 *
 * Ausschließlich die Administration sowie Referentinnen und Referenten für
 * eigene beziehungsweise zugeordnete SchiLf dürfen Teilnehmerzahlen melden.
 * Redaktion hat dafür bewusst keine Berechtigung.
 */
export async function meldeTeilnehmerzahl(
  id: string,
  _bisher: FormularState,
  formData: FormData,
): Promise<FormularState> {
  let user;
  try {
    user = await requireRole("ADMIN", "REFERENT");
  } catch (error) {
    if (error instanceof AuthError) return { fehler: { _: error.message } };
    throw error;
  }

  if (AUSGEGRAUT.nachbereitung) {
    return { fehler: { _: T.allgemein.kommtSpaeter } };
  }

  const geparst = MeldungSchema.safeParse({
    tnTatsaechlich: formData.get("tnTatsaechlich"),
    tnBemerkung: formData.get("tnBemerkung") ?? "",
  });

  if (!geparst.success) {
    const problem = geparst.error.issues[0]!;
    return { fehler: { [problem.path.join(".") || "_"]: problem.message } };
  }

  const fortbildung = await prisma.fortbildung.findUnique({
    where: { id },
    select: { beginn: true, ende: true, maxTn: true, titel: true, organisationsform: true, status: true },
  });
  if (!fortbildung) return { fehler: { _: "Diese Veranstaltung gibt es nicht mehr." } };

  if (!(await darfTeilnehmerzahlMelden(user, id, fortbildung.organisationsform))) {
    return {
      fehler: {
        _: "Teilnehmerzahlen dürfen nur von der Administration oder von Referent:innen für eigene SchiLf gemeldet werden.",
      },
    };
  }

  if (!NACHBEREITUNGS_STATUS.has(fortbildung.status)) {
    return {
      fehler: {
        _: "Teilnehmerzahlen lassen sich nur für veröffentlichte oder archivierte Veranstaltungen nachtragen.",
      },
    };
  }

  // Eine Zahl für einen Termin, der noch gar nicht stattgefunden hat, ist
  // fast immer ein Versehen. Ohne Termin (SchiLf auf Abruf, Video-Tutorial)
  // gibt es keine Nachbereitung.
  if (!fortbildung.ende || fortbildung.ende > new Date()) {
    return {
      fehler: {
        _: "Diese Veranstaltung hat noch nicht stattgefunden — eine Teilnehmerzahl lässt sich erst danach melden.",
      },
    };
  }

  await prisma.fortbildung.update({
    where: { id },
    data: {
      tnTatsaechlich: geparst.data.tnTatsaechlich,
      tnBemerkung: geparst.data.tnBemerkung,
      tnGemeldetAm: new Date(),
      tnGemeldetVonId: user.id,
    },
  });

  await auditLog({
    userId: user.id,
    aktion: "UPDATE",
    entitaet: "Fortbildung",
    entitaetId: id,
    details: { tnTatsaechlich: geparst.data.tnTatsaechlich },
  });

  revalidatePath("/admin/nachbereitung");
  revalidatePath(`/admin/fortbildungen/${id}`);
  revalidatePath("/admin");

  return {
    erfolg: true,
    meldung:
      fortbildung.maxTn !== null && geparst.data.tnTatsaechlich > fortbildung.maxTn
        ? `${geparst.data.tnTatsaechlich} Teilnehmende gespeichert — mehr als die geplanten ${fortbildung.maxTn} Plätze.`
        : `${geparst.data.tnTatsaechlich} Teilnehmende gespeichert.`,
  };
}

/** Nimmt eine Meldung zurück, etwa nach einem Zahlendreher. */
export async function meldungZuruecknehmen(id: string): Promise<void> {
  const user = await requireRole("ADMIN", "REFERENT");
  if (AUSGEGRAUT.nachbereitung) return;
  const fortbildung = await prisma.fortbildung.findUnique({
    where: { id },
    select: { organisationsform: true, ende: true, status: true },
  });
  if (
    !fortbildung ||
    !fortbildung.ende ||
    fortbildung.ende > new Date() ||
    !NACHBEREITUNGS_STATUS.has(fortbildung.status) ||
    !(await darfTeilnehmerzahlMelden(user, id, fortbildung.organisationsform))
  ) {
    return;
  }

  await prisma.fortbildung.update({
    where: { id },
    data: {
      tnTatsaechlich: null,
      tnBemerkung: null,
      tnGemeldetAm: null,
      tnGemeldetVonId: null,
    },
  });

  await auditLog({
    userId: user.id,
    aktion: "UPDATE",
    entitaet: "Fortbildung",
    entitaetId: id,
    details: { tnMeldungZurueckgenommen: true },
  });

  revalidatePath("/admin/nachbereitung");
  revalidatePath(`/admin/fortbildungen/${id}`);
  revalidatePath("/admin");
}

/**
 * Vermerkt eine bereits gelaufene SchiLf nachträglich in FIBS.
 *
 * Anders als die allgemeine FIBS-Markierung darf dieser Nachbereitungsschritt
 * auch bei einer inzwischen archivierten SchiLf ausgeführt werden. Die Action
 * prüft Rolle, Veranstaltungsart, Termin und Status selbst.
 */
export async function setzeSchilfFibsNachtrag(
  id: string,
  eingetragen: boolean,
): Promise<void> {
  const admin = await requireRole("ADMIN");
  if (AUSGEGRAUT.nachbereitung) return;
  const geparst = FibsNachtragSchema.safeParse({ eingetragen });
  if (!geparst.success) return;

  const jetzt = new Date();
  const aktualisiert = await prisma.fortbildung.updateMany({
    where: {
      id,
      organisationsform: "SCHILF",
      ende: { lt: jetzt },
      status: { in: ["VEROEFFENTLICHT", "ARCHIVIERT"] },
      // Ein bereits dokumentierter Versand setzt den FIBS-Nachtrag voraus.
      // Die Markierung darf daher nur zurückgenommen werden, solange noch
      // keine der beiden Versandbestätigungen gesetzt ist.
      ...(geparst.data.eingetragen
        ? {}
        : {
            teilnahmebestaetigungenReferentenVersandtAm: null,
            teilnahmebestaetigungenTeilnehmendeVersandtAm: null,
          }),
    },
    data: {
      inFibs: geparst.data.eingetragen,
      fibsEingetragenAm: geparst.data.eingetragen ? jetzt : null,
      fibsEingetragenVonId: geparst.data.eingetragen ? admin.id : null,
    },
  });

  if (aktualisiert.count === 0) return;

  await auditLog({
    userId: admin.id,
    aktion: "UPDATE",
    entitaet: "Fortbildung",
    entitaetId: id,
    details: {
      inFibs: geparst.data.eingetragen,
      schilfNachtrag: true,
    },
  });

  revalidatePath("/admin/nachbereitung");
  revalidatePath(`/admin/fortbildungen/${id}`);
  revalidatePath("/admin");
}

/**
 * Bestätigt getrennt den Versand der FIBS-Teilnahmebestätigungen. Es werden
 * keine Empfängerlisten oder FIBS-Nachrichten gespeichert, nur der Vermerk
 * inklusive Zeitpunkt und administrativem Konto.
 */
export async function setzeTeilnahmebestaetigungsVersand(
  id: string,
  empfaenger: "REFERENTEN" | "TEILNEHMENDE",
  versandt: boolean,
): Promise<void> {
  const admin = await requireRole("ADMIN");
  if (AUSGEGRAUT.nachbereitung) return;
  const geparst = BestaetigungsVersandSchema.safeParse({ empfaenger, versandt });
  if (!geparst.success) return;

  const versand = geparst.data;

  const fortbildung = await prisma.fortbildung.findUnique({
    where: { id },
    select: {
      ende: true,
      status: true,
      organisationsform: true,
      inFibs: true,
      tnTatsaechlich: true,
    },
  });
  if (
    !fortbildung ||
    fortbildung.tnTatsaechlich === null ||
    !fortbildung.ende ||
    fortbildung.ende > new Date() ||
    !NACHBEREITUNGS_STATUS.has(fortbildung.status) ||
    // Für SchiLf ist der FIBS-Eintrag selbst Teil der Nachbereitung. Neue
    // Versandbestätigungen dürfen deshalb erst nach diesem Schritt entstehen.
    // Das Zurücknehmen eines bestehenden Vermerks bleibt zur Korrektur erlaubt.
    (versand.versandt &&
      fortbildung.organisationsform === "SCHILF" &&
      !fortbildung.inFibs)
  ) {
    return;
  }

  const jetzt = new Date();
  const daten =
    versand.empfaenger === "REFERENTEN"
      ? versand.versandt
        ? {
            teilnahmebestaetigungenReferentenVersandtAm: jetzt,
            teilnahmebestaetigungenReferentenVersandtVonId: admin.id,
          }
        : {
            teilnahmebestaetigungenReferentenVersandtAm: null,
            teilnahmebestaetigungenReferentenVersandtVonId: null,
          }
      : versand.versandt
        ? {
            teilnahmebestaetigungenTeilnehmendeVersandtAm: jetzt,
            teilnahmebestaetigungenTeilnehmendeVersandtVonId: admin.id,
          }
        : {
            teilnahmebestaetigungenTeilnehmendeVersandtAm: null,
            teilnahmebestaetigungenTeilnehmendeVersandtVonId: null,
          };

  await prisma.fortbildung.update({ where: { id }, data: daten });

  await auditLog({
    userId: admin.id,
    aktion: "UPDATE",
    entitaet: "Fortbildung",
    entitaetId: id,
    details: { teilnahmebestaetigung: versand.empfaenger, versandt: versand.versandt },
  });

  revalidatePath("/admin/nachbereitung");
  revalidatePath(`/admin/fortbildungen/${id}`);
  revalidatePath("/admin");
}

async function darfTeilnehmerzahlMelden(
  user: SessionUser,
  fortbildungId: string,
  organisationsform: string,
): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  return (
    user.role === "REFERENT" &&
    organisationsform === "SCHILF" &&
    (await darfBearbeiten(user, fortbildungId))
  );
}
