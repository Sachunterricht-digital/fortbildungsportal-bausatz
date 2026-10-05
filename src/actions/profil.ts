"use server";

import { revalidatePath } from "next/cache";
import sharp from "sharp";

import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { AuthError, requireUser, type SessionUser } from "@/lib/auth";
import { loeschePortraet, schreibePortraet } from "@/lib/portraet";
import { zuFeldFehlern, type FormularState } from "@/lib/validation/fortbildung";
import {
  ERLAUBTE_FOTO_TYPEN,
  HEIC_FOTO_ENDUNGEN,
  HEIC_FOTO_TYPEN,
  MAX_FOTO_BYTES,
  ProfilSchema,
} from "@/lib/validation/profil";
import { T } from "@/texte/de";

/**
 * Eigenes Profil speichern. Jede Person bearbeitet nur den Verzeichniseintrag,
 * der an ihrem Konto hängt. Fehlt er (z. B. beim Admin-Konto), wird er angelegt.
 */
export async function speichereEigenesProfil(
  _bisher: FormularState,
  formData: FormData,
): Promise<FormularState> {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof AuthError) return { fehler: { _: error.message } };
    throw error;
  }

  const geparst = ProfilSchema.safeParse({
    vorname: formData.get("vorname") ?? "",
    nachname: formData.get("nachname") ?? "",
    organisation: formData.get("organisation") ?? "",
    funktion: formData.get("funktion") ?? "",
    telefon: formData.get("telefon") ?? "",
    schwerpunkte: formData.get("schwerpunkte") ?? "",
    kurzprofil: formData.get("kurzprofil") ?? "",
  });
  if (!geparst.success) return { fehler: zuFeldFehlern(geparst.error) };

  // Vorhandenen Verzeichniseintrag mit derselben Mail an das Konto hängen,
  // statt eine zweite Person anzulegen (z. B. nach dem Archivimport).
  await verknuepfeReferentMitKonto(user);

  const referent = await prisma.referent.upsert({
    where: { userId: user.id },
    update: geparst.data,
    create: { ...geparst.data, email: user.email, userId: user.id },
    select: { id: true },
  });

  await auditLog({
    userId: user.id,
    aktion: "UPDATE",
    entitaet: "Referent",
    entitaetId: referent.id,
    details: { quelle: "eigenes Profil" },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/konto");
  revalidatePath("/admin/referenten");
  return { erfolg: true, meldung: T.profil.gespeichert };
}

/**
 * Verknüpft einen bestehenden, noch kontolosen Verzeichniseintrag mit
 * derselben Mail an das Konto (z. B. nach dem Archivimport). Legt nichts an.
 */
async function verknuepfeReferentMitKonto(user: SessionUser): Promise<void> {
  const verknuepft = await prisma.referent.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (verknuepft) return;

  const passend = await prisma.referent.findFirst({
    where: { userId: null, email: { equals: user.email, mode: "insensitive" } },
    select: { id: true },
  });
  if (passend) {
    await prisma.referent.update({ where: { id: passend.id }, data: { userId: user.id } });
  }
}

/** Den mit dem Konto verknüpften Referenten laden, ohne einen anzulegen. */
async function ladeVerknuepftenReferenten(
  user: SessionUser,
): Promise<{ id: string } | null> {
  await verknuepfeReferentMitKonto(user);
  return prisma.referent.findUnique({ where: { userId: user.id }, select: { id: true } });
}

/** Dateiendung in Kleinbuchstaben, nur Buchstaben und Ziffern, höchstens 8 Zeichen. */
function dateiEndung(name: string): string {
  const punkt = name.lastIndexOf(".");
  if (punkt < 0) return "";
  return name.slice(punkt + 1).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
}

/**
 * Jede Ablehnung eines Foto-Uploads ins Protokoll und ins Server-Log.
 * Bewusst nur Grund, MIME-Typ, Endung und Größe: keine Bilddaten, kein
 * voller Dateiname.
 */
async function protokolliereAblehnung(
  userId: string,
  referentId: string | null,
  grund: "falscher_typ" | "zu_gross" | "unlesbar" | "heic" | "profil_nicht_gespeichert",
  datei: File,
): Promise<void> {
  const details = {
    grund,
    mimeType: datei.type.slice(0, 100),
    endung: dateiEndung(datei.name),
    groesseKb: Math.round(datei.size / 1024),
  };
  console.warn(
    `Foto-Upload abgelehnt: referentId=${referentId ?? "-"} grund=${details.grund} mimeType=${details.mimeType || "-"} endung=${details.endung || "-"} groesseKb=${details.groesseKb}`,
  );
  await auditLog({
    userId,
    aktion: "UPLOAD_ABGELEHNT",
    entitaet: "Referent",
    entitaetId: referentId,
    details,
  });
}

/**
 * Profilfoto hochladen: auf 512×512 zuschneiden, verlustarm als WebP
 * speichern und Metadaten (EXIF, GPS) dabei verwerfen.
 *
 * Nur für das eigene Profil. Wer noch keinen verknüpften Verzeichniseintrag
 * hat, bekommt eine Meldung statt eines Absturzes — das Profil muss zuerst
 * einmal gespeichert werden.
 */
export async function speichereProfilfoto(
  _bisher: FormularState,
  formData: FormData,
): Promise<FormularState> {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof AuthError) return { fehler: { _: error.message } };
    throw error;
  }

  const referent = await ladeVerknuepftenReferenten(user);
  const datei = formData.get("foto");
  const hatDatei = datei instanceof File && datei.size > 0;

  if (!referent) {
    if (hatDatei) await protokolliereAblehnung(user.id, null, "profil_nicht_gespeichert", datei);
    return { fehler: { _: T.profil.fotoZuerstProfilSpeichern } };
  }
  if (!hatDatei) return { fehler: { foto: T.profil.fotoKeineDatei } };

  const endung = dateiEndung(datei.name);
  if (
    (HEIC_FOTO_TYPEN as readonly string[]).includes(datei.type.toLowerCase()) ||
    (HEIC_FOTO_ENDUNGEN as readonly string[]).includes(endung)
  ) {
    await protokolliereAblehnung(user.id, referent.id, "heic", datei);
    return { fehler: { foto: T.profil.fotoHeic } };
  }
  if (!ERLAUBTE_FOTO_TYPEN.includes(datei.type as (typeof ERLAUBTE_FOTO_TYPEN)[number])) {
    await protokolliereAblehnung(user.id, referent.id, "falscher_typ", datei);
    return { fehler: { foto: T.profil.fotoFalscherTyp } };
  }
  if (datei.size > MAX_FOTO_BYTES) {
    await protokolliereAblehnung(user.id, referent.id, "zu_gross", datei);
    return { fehler: { foto: T.profil.fotoZuGross } };
  }

  const eingabe = Buffer.from(await datei.arrayBuffer());
  let zugeschnitten: Buffer;
  try {
    // `animated: false` (Standard): bei animiertem GIF zählt nur das erste Bild.
    zugeschnitten = await sharp(eingabe, { animated: false })
      .resize(512, 512, { fit: "cover", position: "attention" })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    // Beschädigte oder falsch benannte Datei: Meldung statt Serverfehler.
    await protokolliereAblehnung(user.id, referent.id, "unlesbar", datei);
    return { fehler: { foto: T.profil.fotoUnlesbar } };
  }
  // Bewusst kein withMetadata(): sharp verwirft EXIF/GPS standardmäßig beim
  // Neucodieren, das ist hier der ganze Zweck.

  await schreibePortraet(referent.id, zugeschnitten);

  await prisma.referent.update({
    where: { id: referent.id },
    data: { portraetAm: new Date() },
  });

  await auditLog({
    userId: user.id,
    aktion: "UPDATE",
    entitaet: "Referent",
    entitaetId: referent.id,
    details: { quelle: "Profilfoto" },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/konto");
  revalidatePath("/admin/referenten");
  return { erfolg: true, meldung: T.profil.fotoGespeichert };
}

/** Profilfoto entfernen: Datei löschen und `portraetAm` zurücksetzen. */
export async function entferneProfilfoto(
  _bisher: FormularState,
  _formData: FormData,
): Promise<FormularState> {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof AuthError) return { fehler: { _: error.message } };
    throw error;
  }

  const referent = await ladeVerknuepftenReferenten(user);
  if (!referent) return { fehler: { _: T.profil.fotoZuerstProfilSpeichern } };

  await loeschePortraet(referent.id);
  await prisma.referent.update({ where: { id: referent.id }, data: { portraetAm: null } });

  await auditLog({
    userId: user.id,
    aktion: "UPDATE",
    entitaet: "Referent",
    entitaetId: referent.id,
    details: { quelle: "Profilfoto entfernt" },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/konto");
  revalidatePath("/admin/referenten");
  return { erfolg: true, meldung: T.profil.fotoGeloescht };
}
