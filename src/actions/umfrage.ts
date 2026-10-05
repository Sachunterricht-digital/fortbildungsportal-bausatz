"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { AuthError, requireRole, type SessionUser } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import { sendeMail } from "@/lib/mail";
import { sperreUmfrage } from "@/lib/sperren";
import {
  erzeugeZugangstoken,
  loescheZugangstoken,
  sichergestelltesKontoFuerReferent,
  zugangsLink,
} from "@/lib/zugang";
import { umfrageLink } from "@/lib/umfrageToken";
import { berlinIsoDatum, kalendertagAusIso } from "@/lib/datetime";
import { UMFRAGE_GRENZEN } from "@/constants/umfrage";
import { zuFeldFehlern, type FormularState } from "@/lib/validation/fortbildung";
import { T } from "@/texte/de";

const TF = T.umfrage.form;
const TM = T.umfrage.mail;

/** Lesen und Schreiben aller Umfragen ist Sache der Administration. */
async function pruefeAdmin(): Promise<
  { ok: true; admin: SessionUser } | { ok: false; fehler: Record<string, string> }
> {
  try {
    return { ok: true, admin: await requireRole("ADMIN") };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, fehler: { _: error.message } };
    throw error;
  }
}

function neuLaden(umfrageId?: string) {
  revalidatePath("/admin/umfragen");
  if (umfrageId) revalidatePath(`/admin/umfragen/${umfrageId}`);
}

// ---------------------------------------------------------------------------
// Anlegen und Bearbeiten
// ---------------------------------------------------------------------------

const optionalerText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, TF.fehler.textZuLang(max))
    .optional()
    .transform((wert) => wert || null);

const UmfrageSchema = z.object({
  titel: z
    .string()
    .trim()
    .min(1, TF.fehler.titelFehlt)
    .max(UMFRAGE_GRENZEN.titel, TF.fehler.titelZuLang(UMFRAGE_GRENZEN.titel)),
  beschreibung: optionalerText(UMFRAGE_GRENZEN.beschreibung),
  ort: optionalerText(UMFRAGE_GRENZEN.ort),
  uhrzeit: optionalerText(UMFRAGE_GRENZEN.uhrzeit),
  empfaenger: z.array(z.string().min(1).max(100)).min(1, TF.fehler.empfaengerFehlt),
});

function lies(formData: FormData, name: string): string | undefined {
  const wert = formData.get(name);
  return wert === null ? undefined : wert.toString();
}

/**
 * Legt eine Umfrage an (`umfrageId` leer) oder speichert Änderungen. Die
 * Termine kommen als mehrfaches Feld `termin` (ISO-Tag), die Empfänger als
 * mehrfaches Feld `referentId`. Abgewählte Termine und Personen verschwinden
 * samt ihren Antworten (Cascade).
 */
export async function speichereUmfrage(
  umfrageId: string | null,
  _bisher: FormularState,
  formData: FormData,
): Promise<FormularState> {
  const pruefung = await pruefeAdmin();
  if (!pruefung.ok) return { fehler: pruefung.fehler };
  const { admin } = pruefung;

  const geprueft = UmfrageSchema.safeParse({
    titel: lies(formData, "titel") ?? "",
    beschreibung: lies(formData, "beschreibung"),
    ort: lies(formData, "ort"),
    uhrzeit: lies(formData, "uhrzeit"),
    empfaenger: formData.getAll("referentId").map(String),
  });
  if (!geprueft.success) return { fehler: zuFeldFehlern(geprueft.error) };
  const eingabe = geprueft.data;

  // Termine: jeder muss ein echter Kalendertag sein, doppelte sind Fehler.
  const roheTermine = formData.getAll("termin").map((w) => w.toString().trim()).filter(Boolean);
  if (roheTermine.length === 0) return { fehler: { termine: TF.fehler.terminFehlt } };
  if (roheTermine.length > UMFRAGE_GRENZEN.termineMax) {
    return { fehler: { termine: TF.fehler.zuvieleTermine(UMFRAGE_GRENZEN.termineMax) } };
  }
  const tage = roheTermine.map((iso) => ({ iso, datum: kalendertagAusIso(iso) }));
  if (tage.some((t) => t.datum === null)) return { fehler: { termine: TF.fehler.terminUngueltig } };
  if (new Set(tage.map((t) => t.iso)).size !== tage.length) {
    return { fehler: { termine: TF.fehler.terminDoppelt } };
  }
  const termine = tage
    .map((t) => ({ iso: t.iso, datum: t.datum as Date }))
    .sort((a, b) => a.iso.localeCompare(b.iso));

  // Nur Personen, die es gibt (verhindert Fremdschlüsselfehler bei Unsinn).
  const referentIds = [...new Set(eingabe.empfaenger)];
  const vorhanden = await prisma.referent.findMany({
    where: { id: { in: referentIds } },
    select: { id: true },
  });
  const gueltigeIds = vorhanden.map((r) => r.id);
  if (gueltigeIds.length === 0) return { fehler: { empfaenger: TF.fehler.empfaengerFehlt } };

  const felder = {
    titel: eingabe.titel,
    beschreibung: eingabe.beschreibung,
    ort: eingabe.ort,
    uhrzeit: eingabe.uhrzeit,
  };

  if (!umfrageId) {
    const neu = await prisma.umfrage.create({
      data: {
        ...felder,
        erstelltVonId: admin.id,
        termine: {
          create: termine.map((t, index) => ({ datum: t.datum, reihenfolge: index })),
        },
        teilnehmer: { create: gueltigeIds.map((referentId) => ({ referentId })) },
      },
      select: { id: true },
    });

    await auditLog({
      userId: admin.id,
      aktion: "CREATE",
      entitaet: "Umfrage",
      entitaetId: neu.id,
      details: { termine: termine.length, teilnehmer: gueltigeIds.length },
    });
    neuLaden();
    redirect(`/admin/umfragen/${neu.id}?gespeichert=1`);
  }

  let gefunden: boolean;
  try {
    gefunden = await prisma.$transaction(async (tx) => {
      // Umfrage sperren (FOR UPDATE): Antworten, Schließen und ein zweites
      // Speichern warten, bis dieser Abgleich fertig ist. Der Bestand der
      // Termine wird erst hier gelesen, nicht davor, sonst legen zwei
      // gleichzeitige Speichern denselben neuen Tag doppelt an.
      if (!(await sperreUmfrage(tx, umfrageId))) return false;
      const bestehendeTermine = await tx.umfrageTermin.findMany({ where: { umfrageId } });

      await tx.umfrage.update({ where: { id: umfrageId }, data: felder });

      // Termine abgleichen: gleicher Tag bleibt (samt Antworten), Rest wird
      // gelöscht oder neu angelegt, die Reihenfolge folgt dem Datum.
      const alt = new Map(bestehendeTermine.map((t) => [berlinIsoDatum(t.datum), t]));
      const neueIso = new Set(termine.map((t) => t.iso));
      const wegfall = bestehendeTermine.filter((t) => !neueIso.has(berlinIsoDatum(t.datum)));
      if (wegfall.length > 0) {
        await tx.umfrageTermin.deleteMany({ where: { id: { in: wegfall.map((t) => t.id) } } });
      }
      for (const [index, t] of termine.entries()) {
        const vorhandenerTermin = alt.get(t.iso);
        if (vorhandenerTermin) {
          await tx.umfrageTermin.update({
            where: { id: vorhandenerTermin.id },
            data: { reihenfolge: index },
          });
        } else {
          await tx.umfrageTermin.create({
            data: { umfrageId, datum: t.datum, reihenfolge: index },
          });
        }
      }

      await tx.umfrageTeilnehmer.deleteMany({
        where: { umfrageId, referentId: { notIn: gueltigeIds } },
      });
      await tx.umfrageTeilnehmer.createMany({
        data: gueltigeIds.map((referentId) => ({ umfrageId, referentId })),
        skipDuplicates: true,
      });

      // Wer schon als fertig galt, aber für einen aktuellen Termin keine
      // Antwort hat (neuer Termin), gilt wieder als offen: Erinnerungen
      // erreichen die Person und sie kann ergänzen. Die vorhandenen Antworten
      // und der Kommentar bleiben.
      await tx.$executeRaw`
        UPDATE "UmfrageTeilnehmer" t
        SET "geantwortetAm" = NULL
        WHERE t."umfrageId" = ${umfrageId}
          AND t."geantwortetAm" IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM "UmfrageTermin" m
            WHERE m."umfrageId" = t."umfrageId"
              AND NOT EXISTS (
                SELECT 1 FROM "UmfrageAntwort" a
                WHERE a."teilnehmerId" = t."id" AND a."terminId" = m."id"
              )
          )`;
      return true;
    });
  } catch (error) {
    // Eindeutigkeit (umfrageId, datum): Fängt, was der Abgleich nicht
    // verhindert hat, als dieselbe Meldung wie ein doppeltes Datum im Formular.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { fehler: { termine: TF.fehler.terminDoppelt } };
    }
    throw error;
  }
  if (!gefunden) return { fehler: { _: TF.fehler.nichtGefunden } };

  await auditLog({
    userId: admin.id,
    aktion: "UPDATE",
    entitaet: "Umfrage",
    entitaetId: umfrageId,
    details: { termine: termine.length, teilnehmer: gueltigeIds.length },
  });

  neuLaden(umfrageId);
  return { erfolg: true, meldung: TF.gespeichert };
}

// ---------------------------------------------------------------------------
// Personen hinzufügen
// ---------------------------------------------------------------------------

export async function fuegePersonenHinzu(
  umfrageId: string,
  _bisher: FormularState,
  formData: FormData,
): Promise<FormularState> {
  const pruefung = await pruefeAdmin();
  if (!pruefung.ok) return { fehler: pruefung.fehler };

  const ids = [...new Set(formData.getAll("referentId").map(String))];
  if (ids.length === 0) return { fehler: { _: T.umfrage.personen.nichtsGewaehlt } };

  const umfrage = await prisma.umfrage.findUnique({ where: { id: umfrageId }, select: { id: true } });
  if (!umfrage) return { fehler: { _: TF.fehler.nichtGefunden } };

  const vorhanden = await prisma.referent.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  const ergebnis = await prisma.umfrageTeilnehmer.createMany({
    data: vorhanden.map((r) => ({ umfrageId, referentId: r.id })),
    skipDuplicates: true,
  });

  await auditLog({
    userId: pruefung.admin.id,
    aktion: "UPDATE",
    entitaet: "Umfrage",
    entitaetId: umfrageId,
    details: { personenHinzugefuegt: ergebnis.count },
  });

  neuLaden(umfrageId);
  return { erfolg: true, meldung: T.umfrage.personen.erfolg(ergebnis.count) };
}

// ---------------------------------------------------------------------------
// Mails: Einladung und Erinnerung
// ---------------------------------------------------------------------------

export interface UmfrageMailState extends FormularState {
  gesendet?: number;
  fehlgeschlagen?: number;
  /** SMTP_HOST ist leer (Testinstanz): nur Server-Log, Vermerke bleiben offen. */
  mailAus?: boolean;
  /** Personen, an die nichts rausging, mit Grund (Klartext). */
  nichtErreicht?: Array<{ name: string; grund: string }>;
}

type MailArt = "EINLADUNG" | "ERINNERUNG";

/** Warum für eine Person kein Zugang für `{Zugang}` entstand. */
type ZugangGrund = keyof typeof TM.grund;

/** Wert für `{Zugang}` und was nach dem Versand mit dem neuen Token geschieht. */
interface ZugangFuerMail {
  link: string;
  /** Nur bei einem neu erzeugten Token (Konto ohne Passwort). */
  token?: { id: string; userId: string };
}

/**
 * Wert für `{Zugang}` einer Person oder der Grund, wenn kein Zugang möglich
 * ist (inaktives Konto, Mail belegt o. ä.): Dann geht an diese Person nichts raus.
 *
 * - Konto mit Passwort: Anmeldelink `<APP_BASE_URL>/login`.
 * - Sonst Konto sicherstellen und ein Einladungstoken zusätzlich zu den
 *   vorhandenen anlegen (`aeltereBehalten`), Link wie im Einladungsversand
 *   (`zugangsLink`, siehe `sendeEinladungPerMail`). Ältere Token bleiben
 *   offen (03.10.: eine Erinnerung darf den Link aus der ersten Mail nicht
 *   entwerten, der Verbrauch eines Tokens entwertet ohnehin alle anderen).
 *   Der Aufrufer löscht bei einem Fehler nur das neue.
 */
async function bereiteZugangFuerMail(
  referent: { id: string; user: { passwordHash: string | null; isActive: boolean } | null },
  kontext: { adminId: string; umfrageId: string },
): Promise<ZugangFuerMail | { grund: ZugangGrund }> {
  if (referent.user && !referent.user.isActive) return { grund: "KONTO_INAKTIV" };
  if (referent.user?.passwordHash) {
    const basis = process.env.APP_BASE_URL ?? "http://localhost:3000";
    return { link: `${basis.replace(/\/+$/, "")}/login` };
  }

  const konto = await sichergestelltesKontoFuerReferent(referent.id);
  if (!konto.ok) return { grund: konto.grund };

  const { id, token } = await erzeugeZugangstoken(konto.userId, "EINLADUNG", {
    aeltereBehalten: true,
  });
  await auditLog({
    userId: kontext.adminId,
    aktion: "CREATE",
    entitaet: "Zugang",
    entitaetId: konto.userId,
    details: {
      referentId: referent.id,
      zweck: "EINLADUNG",
      mailversand: true,
      ausUmfrage: kontext.umfrageId,
    },
  });
  return { link: zugangsLink(token), token: { id, userId: konto.userId } };
}

/** Erinnerungen höchstens alle fünf Minuten pro Person (Schutz vor Doppelversand). */
const ERINNERUNG_SPERRE_MS = 5 * 60 * 1000;

/**
 * Beansprucht den Versand an eine Person atomar: setzt den Vermerk
 * (`eingeladenAm` bzw. `erinnertAm`) nur, wenn die Bedingung noch gilt.
 * `true` heißt: Dieser Aufruf darf senden.
 */
async function beanspruche(
  art: MailArt,
  teilnehmerId: string,
  umfrageId: string,
  jetzt: Date,
): Promise<boolean> {
  const ergebnis =
    art === "EINLADUNG"
      ? await prisma.umfrageTeilnehmer.updateMany({
          where: { id: teilnehmerId, umfrage: { id: umfrageId, status: "OFFEN" }, eingeladenAm: null },
          data: { eingeladenAm: jetzt },
        })
      : await prisma.umfrageTeilnehmer.updateMany({
          where: {
            id: teilnehmerId,
            umfrage: { id: umfrageId, status: "OFFEN" },
            eingeladenAm: { not: null },
            geantwortetAm: null,
            OR: [
              { erinnertAm: null },
              { erinnertAm: { lt: new Date(jetzt.getTime() - ERINNERUNG_SPERRE_MS) } },
            ],
          },
          data: { erinnertAm: jetzt },
        });
  return ergebnis.count === 1;
}

/**
 * Nimmt die Beanspruchung zurück (Versand fehlgeschlagen oder nur Log):
 * nur, wenn der Vermerk noch genau der eigene ist.
 */
async function gibFrei(
  art: MailArt,
  teilnehmerId: string,
  jetzt: Date,
  vorherErinnert: Date | null,
): Promise<void> {
  if (art === "EINLADUNG") {
    await prisma.umfrageTeilnehmer.updateMany({
      where: { id: teilnehmerId, eingeladenAm: jetzt },
      data: { eingeladenAm: null },
    });
  } else {
    await prisma.umfrageTeilnehmer.updateMany({
      where: { id: teilnehmerId, erinnertAm: jetzt },
      data: { erinnertAm: vorherErinnert },
    });
  }
}

/**
 * Gemeinsamer Kern von Einladung und Erinnerung, Muster wie
 * `sendeEinladungPerMail()` in src/actions/zugang.ts:
 * - Betreff und Text kommen aus dem Dialog (für diese Mail änderbar).
 * - Fehlt `{Link}`, lehnt der Server ab, ein manipuliertes Formular
 *   umgeht die Browser-Prüfung sonst.
 * - `{Vorname}` und `{Link}` werden je Person ersetzt.
 * - Pro Person wird der Versand atomar beansprucht (Vermerk setzen, nur bei
 *   Erfolg senden). Scheitert der Versand, geht der Vermerk zurück.
 * - Ohne `SMTP_HOST` geht nichts raus (nur Log) und die Vermerke
 *   „Eingeladen am“ und „Erinnert am“ bleiben leer, damit nichts als
 *   verschickt gilt, was nie rausging.
 * - Ein Fehler bei einer Person stoppt die anderen nicht. Wer nicht erreicht
 *   wurde, steht mit Grund in der Ergebnismeldung.
 * - Unbekannte Platzhalter (Tippfehler) lehnt der Server ab.
 */
/**
 * Platzhalter in geschweiften Klammern, die nicht erlaubt sind: Tippfehler wie
 * `{zugang}` oder eine offene Klammer `{Vorname`, auch einzelne `}`.
 */
function unbekanntePlatzhalter(text: string, erlaubt: string[]): string[] {
  const rest = text.replace(/\{([^{}]*)\}/g, (ganz, name: string) => (erlaubt.includes(name) ? "" : ganz));
  const funde = rest.match(/\{[^{}]*\}|\{[^{}\s]*|\}/g) ?? [];
  return [...new Set(funde)];
}

async function sendeUmfrageMails(
  art: MailArt,
  umfrageId: string,
  formData: FormData,
): Promise<UmfrageMailState> {
  const pruefung = await pruefeAdmin();
  if (!pruefung.ok) return { fehler: pruefung.fehler };

  const betreff = (formData.get("betreff") ?? "").toString().trim();
  const textRoh = (formData.get("text") ?? "").toString();
  if (!betreff || !textRoh.trim()) return { fehler: { _: TM.fehler.unvollstaendig } };
  if (betreff.length > UMFRAGE_GRENZEN.mailBetreff) {
    return { fehler: { betreff: TM.fehler.zuLang(UMFRAGE_GRENZEN.mailBetreff) } };
  }
  if (textRoh.length > UMFRAGE_GRENZEN.mailText) {
    return { fehler: { text: TM.fehler.zuLang(UMFRAGE_GRENZEN.mailText) } };
  }
  const unbekannt = unbekanntePlatzhalter(textRoh, ["Vorname", "Link", "Zugang"]);
  if (unbekannt.length > 0) return { fehler: { text: TM.fehler.platzhalter(unbekannt) } };
  const unbekanntBetreff = unbekanntePlatzhalter(betreff, ["Vorname"]);
  if (unbekanntBetreff.length > 0) {
    return { fehler: { betreff: TM.fehler.platzhalterBetreff(unbekanntBetreff) } };
  }
  // Ohne {Link} bekäme die Person eine Mail ohne ihren persönlichen Zugang.
  if (!textRoh.includes("{Link}")) return { fehler: { text: TM.fehler.linkFehlt } };

  const umfrage = await prisma.umfrage.findUnique({
    where: { id: umfrageId },
    select: { id: true, status: true },
  });
  if (!umfrage) return { fehler: { _: TM.fehler.nichtGefunden } };
  if (umfrage.status !== "OFFEN") return { fehler: { _: TM.fehler.umfrageGeschlossen } };

  const empfaenger = await prisma.umfrageTeilnehmer.findMany({
    where:
      art === "EINLADUNG"
        ? { umfrageId, eingeladenAm: null }
        : { umfrageId, eingeladenAm: { not: null }, geantwortetAm: null },
    include: {
      referent: {
        select: {
          id: true,
          vorname: true,
          nachname: true,
          email: true,
          aktiv: true,
          user: { select: { passwordHash: true, isActive: true } },
        },
      },
    },
    orderBy: [{ referent: { nachname: "asc" } }, { referent: { vorname: "asc" } }],
  });
  const mitMail = empfaenger.filter((t) => t.referent.email?.trim() && t.referent.aktiv);
  if (mitMail.length === 0) return { fehler: { _: TM.fehler.niemand } };

  const mailEingerichtet = Boolean(process.env.SMTP_HOST);
  // Optional: `{Zugang}` nur für diese Mail. Ohne den Platzhalter im Text
  // läuft alles wie bisher, es entsteht weder ein Konto noch ein Token.
  const mitZugang = textRoh.includes("{Zugang}");
  let gesendet = 0;
  let fehlgeschlagen = 0;
  const nichtErreicht: Array<{ name: string; grund: string }> = [];

  for (const teilnehmer of mitMail) {
    // Pro Person atomar beanspruchen: Nur wer den Vermerk setzen konnte,
    // verschickt. Ein zweiter Versand gleichzeitig (zweiter Admin, wiederholte
    // Anfrage) geht bei dieser Person leer aus und überspringt sie.
    const jetzt = new Date();
    const beansprucht = await beanspruche(art, teilnehmer.id, umfrageId, jetzt);
    if (!beansprucht) continue;
    const vorherErinnert = teilnehmer.erinnertAm;
    const gebe = () => gibFrei(art, teilnehmer.id, jetzt, vorherErinnert);

    const vorname = teilnehmer.referent.vorname.trim() || teilnehmer.referent.nachname;
    const name = `${teilnehmer.referent.vorname} ${teilnehmer.referent.nachname}`.trim();
    let zugang: ZugangFuerMail | null = null;
    if (mitZugang) {
      let grund: ZugangGrund = "ZUGANG_FEHLER";
      // Erst direkt vor dem Senden an genau diese Person.
      try {
        const ergebnis = await bereiteZugangFuerMail(teilnehmer.referent, {
          adminId: pruefung.admin.id,
          umfrageId,
        });
        if ("link" in ergebnis) zugang = ergebnis;
        else grund = ergebnis.grund;
      } catch (error) {
        console.error("Zugang für die Umfrage-Mail nicht vorbereitet:", teilnehmer.id, error);
      }
      if (!zugang) {
        await gebe();
        fehlgeschlagen += 1;
        nichtErreicht.push({ name, grund: TM.grund[grund] });
        await auditLog({
          userId: pruefung.admin.id,
          aktion: "MAIL_FEHLER",
          entitaet: "UmfrageTeilnehmer",
          entitaetId: teilnehmer.id,
          details: { umfrageId, art, grund: "ZUGANG", zugangGrund: grund },
        });
        continue;
      }
    }
    const text = textRoh
      .replaceAll("{Vorname}", vorname)
      .replaceAll("{Link}", umfrageLink(teilnehmer.id))
      .replaceAll("{Zugang}", zugang?.link ?? "");
    const betreffPerson = betreff.replaceAll("{Vorname}", vorname);

    let versendet = false;
    try {
      versendet = await sendeMail({
        an: teilnehmer.referent.email!.trim(),
        betreff: betreffPerson,
        text,
        // Serienmail: keine Kopie an die Dienstmail (03.10.), sonst greift
        // eine Grenze des Mailanbieters (z. B. 10 Empfänger pro Domain und Stunde) früher.
        ohneBcc: true,
      });
    } catch (error) {
      console.error("Umfrage-Mail nicht versendet:", teilnehmer.id, error);
    }

    if (!versendet) {
      // Der Vermerk geht zurück, ein neu angelegtes Token wird gelöscht,
      // ältere Links der Person bleiben gültig.
      await gebe();
      if (zugang?.token) await loescheZugangstoken(zugang.token.id);
      fehlgeschlagen += 1;
      nichtErreicht.push({ name, grund: TM.grund.VERSAND });
      await auditLog({
        userId: pruefung.admin.id,
        aktion: "MAIL_FEHLER",
        entitaet: "UmfrageTeilnehmer",
        entitaetId: teilnehmer.id,
        details: { umfrageId, art },
      });
      continue;
    }

    gesendet += 1;
    // Ohne SMTP wurde nichts verschickt (nur Log): Der Vermerk bleibt leer,
    // damit nichts als verschickt gilt, was nie rausging.
    if (!mailEingerichtet) await gebe();
    // Ältere Zugangslinks bleiben offen: Eine Erinnerung darf den Link aus
    // der ersten Mail nicht entwerten. Wer einen Token verbraucht, entwertet
    // alle anderen (verbraucheTokenUndSetzePasswort).
  }

  await auditLog({
    userId: pruefung.admin.id,
    aktion: "UPDATE",
    entitaet: "Umfrage",
    entitaetId: umfrageId,
    details: { mail: art, gesendet, fehlgeschlagen, mailversand: mailEingerichtet },
  });

  neuLaden(umfrageId);

  if (!mailEingerichtet) {
    return {
      erfolg: true,
      gesendet,
      fehlgeschlagen,
      mailAus: true,
      meldung: TM.mailAus + (nichtErreicht.length > 0 ? ` ${TM.nichtErreicht(nichtErreicht)}` : ""),
      nichtErreicht,
    };
  }
  const meldung =
    TM.ergebnis(gesendet, fehlgeschlagen) +
    (nichtErreicht.length > 0 ? ` ${TM.nichtErreicht(nichtErreicht)}` : "");
  return {
    erfolg: fehlgeschlagen === 0,
    gesendet,
    fehlgeschlagen,
    meldung,
    nichtErreicht,
    ...(fehlgeschlagen > 0 ? { fehler: { _: meldung } } : {}),
  };
}

export async function sendeUmfrageEinladungen(
  umfrageId: string,
  _bisher: UmfrageMailState,
  formData: FormData,
): Promise<UmfrageMailState> {
  return sendeUmfrageMails("EINLADUNG", umfrageId, formData);
}

export async function sendeUmfrageErinnerungen(
  umfrageId: string,
  _bisher: UmfrageMailState,
  formData: FormData,
): Promise<UmfrageMailState> {
  return sendeUmfrageMails("ERINNERUNG", umfrageId, formData);
}

// ---------------------------------------------------------------------------
// Status, Termin festlegen, Löschen
// ---------------------------------------------------------------------------

export async function schliesseUmfrage(umfrageId: string): Promise<void> {
  const admin = await requireRole("ADMIN");
  // Gesperrt (FOR UPDATE): Ein gerade laufendes öffentliches Speichern
  // endet vorher, danach kann keines mehr nachkommen.
  await prisma.$transaction(async (tx) => {
    if (!(await sperreUmfrage(tx, umfrageId))) return;
    await tx.umfrage.update({ where: { id: umfrageId }, data: { status: "GESCHLOSSEN" } });
  });
  await auditLog({
    userId: admin.id,
    aktion: "UPDATE",
    entitaet: "Umfrage",
    entitaetId: umfrageId,
    details: { status: "GESCHLOSSEN" },
  });
  neuLaden(umfrageId);
}

/** Öffnet wieder und hebt dabei einen festgelegten Termin auf. */
export async function oeffneUmfrage(umfrageId: string): Promise<void> {
  const admin = await requireRole("ADMIN");
  await prisma.$transaction(async (tx) => {
    if (!(await sperreUmfrage(tx, umfrageId))) return;
    await tx.umfrage.update({
      where: { id: umfrageId },
      data: { status: "OFFEN", festgelegterTerminId: null },
    });
  });
  await auditLog({
    userId: admin.id,
    aktion: "UPDATE",
    entitaet: "Umfrage",
    entitaetId: umfrageId,
    details: { status: "OFFEN" },
  });
  neuLaden(umfrageId);
}

export async function legeTerminFest(
  umfrageId: string,
  _bisher: FormularState,
  formData: FormData,
): Promise<FormularState> {
  const pruefung = await pruefeAdmin();
  if (!pruefung.ok) return { fehler: pruefung.fehler };

  const terminId = (formData.get("terminId") ?? "").toString();
  // Der Termin muss zu genau dieser Umfrage gehören. Prüfung und Festlegen
  // laufen unter derselben Sperre (FOR UPDATE auf die Umfrage).
  const festgelegt = await prisma.$transaction(async (tx) => {
    if (!terminId || !(await sperreUmfrage(tx, umfrageId))) return null;
    const termin = await tx.umfrageTermin.findFirst({
      where: { id: terminId, umfrageId },
      select: { id: true },
    });
    if (!termin) return null;
    await tx.umfrage.update({
      where: { id: umfrageId },
      data: { festgelegterTerminId: termin.id, status: "GESCHLOSSEN" },
    });
    return termin.id;
  });
  if (!festgelegt) return { fehler: { terminId: T.umfrage.festlegen.fehler } };

  await auditLog({
    userId: pruefung.admin.id,
    aktion: "UPDATE",
    entitaet: "Umfrage",
    entitaetId: umfrageId,
    details: { festgelegterTerminId: festgelegt, status: "GESCHLOSSEN" },
  });
  neuLaden(umfrageId);
  return { erfolg: true };
}

export async function loescheUmfrage(umfrageId: string): Promise<void> {
  const admin = await requireRole("ADMIN");
  // deleteMany: keine Ausnahme, wenn die Umfrage schon weg ist (Doppelklick).
  const geloescht = await prisma.umfrage.deleteMany({ where: { id: umfrageId } });
  if (geloescht.count > 0) {
    await auditLog({
      userId: admin.id,
      aktion: "DELETE",
      entitaet: "Umfrage",
      entitaetId: umfrageId,
    });
  }
  neuLaden();
  redirect("/admin/umfragen");
}
