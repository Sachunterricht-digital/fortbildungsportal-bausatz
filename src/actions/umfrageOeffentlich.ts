"use server";

/**
 * Aktionen der öffentlichen Umfrageseite `/umfrage/<token>`.
 *
 * Bewusste Ausnahme von der Regel „jede Server Action prüft die Rolle über
 * requireRole()“ (siehe AGENTS.md, Projektkonventionen): Wer den persönlichen
 * Link hat, braucht kein Konto. Statt der Rolle prüft jede Aktion hier das
 * signierte Token (src/lib/umfrageToken.ts) und arbeitet ausschließlich mit
 * den Daten dieses einen Teilnehmers. Abschließende Liste der Aktionen:
 * Antwort speichern, Zugang einrichten, Onboarding speichern.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { sperreReferent, sperreUmfrage } from "@/lib/sperren";
import { ladeTeilnehmerZuToken } from "@/lib/umfrageToken";
import {
  erzeugeZugangstoken,
  sichergestelltesKontoFuerReferent,
} from "@/lib/zugang";
import { AntwortWertSchema, UMFRAGE_GRENZEN } from "@/constants/umfrage";
import { OnboardingSchema } from "@/constants/onboarding";
import type { FormularState } from "@/lib/validation/fortbildung";
import { T } from "@/texte/de";

const TX = T.umfrage.oeffentlich;
const TO = T.onboarding;

/**
 * Speichert die eigene Antwort. Jede Zeile des Formulars heißt
 * `wert-<terminId>`. Termine, die nicht zur Umfrage dieses Teilnehmers
 * gehören, werden nie gelesen: Die Schleife läuft über die Termine aus der
 * Datenbank, nicht über das, was der Browser schickt.
 */
export async function speichereUmfrageAntwort(
  token: string,
  _bisher: FormularState,
  formData: FormData,
): Promise<FormularState> {
  const teilnehmer = await ladeTeilnehmerZuToken(token);
  if (!teilnehmer || !teilnehmer.referent.aktiv) {
    return { fehler: { _: TX.fehler.linkUngueltig } };
  }
  if (teilnehmer.umfrage.status !== "OFFEN") {
    return { fehler: { _: TX.fehler.geschlossen } };
  }

  const werte: Array<{ terminId: string; wert: string }> = [];
  for (const termin of teilnehmer.umfrage.termine) {
    const geprueft = AntwortWertSchema.safeParse(formData.get(`wert-${termin.id}`));
    if (!geprueft.success) {
      return { fehler: { werte: TX.fehler.werteFehlen } };
    }
    werte.push({ terminId: termin.id, wert: geprueft.data });
  }

  const kommentar = (formData.get("kommentar") ?? "").toString().trim();
  if (kommentar.length > UMFRAGE_GRENZEN.kommentar) {
    return { fehler: { kommentar: TX.fehler.kommentarZuLang(UMFRAGE_GRENZEN.kommentar) } };
  }

  const gespeichert = await prisma.$transaction(async (tx) => {
    // Umfrage und Person werden gesperrt (FOR UPDATE, Reihenfolge Umfrage vor
    // Referent): Schließen, Termine ändern und Stilllegen warten, bis dieses
    // Speichern fertig ist, und umgekehrt sieht dieses Speichern danach den
    // neuen Stand. Ohne Sperre wäre unter READ COMMITTED eine Antwort nach dem
    // Schließen möglich.
    const aktuell = await sperreUmfrage(tx, teilnehmer.umfrageId);
    if (aktuell?.status !== "OFFEN") return "GESCHLOSSEN" as const;
    const person = await sperreReferent(tx, teilnehmer.referent.id);
    if (!person?.aktiv) return "UNGUELTIG" as const;

    // Die Termine neu lesen: Die Administration kann sie seit dem Laden der
    // Seite geändert haben. Es braucht genau eine Antwort je aktuellem Termin.
    const termineJetzt = await tx.umfrageTermin.findMany({
      where: { umfrageId: teilnehmer.umfrageId },
      select: { id: true },
    });
    const wertJeTermin = new Map(werte.map((w) => [w.terminId, w.wert]));
    if (termineJetzt.some((t) => !wertJeTermin.has(t.id))) return "WERTE" as const;

    const eigene = await tx.umfrageTeilnehmer.findUnique({
      where: { id: teilnehmer.id },
      select: { id: true },
    });
    if (!eigene) return "UNGUELTIG" as const;

    for (const t of termineJetzt) {
      const wert = wertJeTermin.get(t.id)!;
      await tx.umfrageAntwort.upsert({
        where: { teilnehmerId_terminId: { teilnehmerId: teilnehmer.id, terminId: t.id } },
        create: { teilnehmerId: teilnehmer.id, terminId: t.id, wert },
        update: { wert },
      });
    }
    await tx.umfrageTeilnehmer.update({
      where: { id: teilnehmer.id },
      data: { geantwortetAm: new Date(), kommentar: kommentar || null },
    });
    return "OK" as const;
  });

  if (gespeichert === "GESCHLOSSEN") return { fehler: { _: TX.fehler.geschlossen } };
  if (gespeichert === "UNGUELTIG") return { fehler: { _: TX.fehler.linkUngueltig } };
  if (gespeichert === "WERTE") return { fehler: { werte: TX.fehler.werteFehlen } };

  await auditLog({
    aktion: "UPDATE",
    entitaet: "UmfrageTeilnehmer",
    entitaetId: teilnehmer.id,
    details: { umfrageId: teilnehmer.umfrageId, antwort: true },
  });

  revalidatePath(`/umfrage/${token}`);
  revalidatePath(`/admin/umfragen/${teilnehmer.umfrageId}`);
  revalidatePath("/admin/umfragen");

  return { erfolg: true };
}

/**
 * „Zugang einrichten“ aus dem Dankeskasten. Nutzt die vorhandene
 * Einladungslogik (`sichergestelltesKontoFuerReferent`, `erzeugeZugangstoken`
 * mit Zweck EINLADUNG) und leitet auf `/zugang?token=…` weiter, genau wie ein
 * Einladungslink aus dem Admin. Der Umfrage-Link geht an dieselbe Mailadresse
 * wie ein Einladungslink, das Vertrauensniveau ist also das gleiche.
 *
 * Wer schon ein Konto mit Passwort hat, bekommt hier keinen Link: Ein
 * Passwort-Reset gehört weiterhin nur der Administration.
 */
export async function richteZugangAusUmfrageEin(
  token: string,
  _bisher: FormularState,
  _formData: FormData,
): Promise<FormularState> {
  const teilnehmer = await ladeTeilnehmerZuToken(token);
  if (!teilnehmer || !teilnehmer.referent.aktiv) {
    return { fehler: { _: TX.fehler.linkUngueltig } };
  }

  const fehlerText = TX.danke.zugangFehler;

  if (teilnehmer.referent.user?.passwordHash) {
    return { fehler: { _: fehlerText.schonVorhanden } };
  }
  if (teilnehmer.referent.user && !teilnehmer.referent.user.isActive) {
    return { fehler: { _: fehlerText.nichtMoeglich } };
  }

  const konto = await sichergestelltesKontoFuerReferent(teilnehmer.referent.id);
  if (!konto.ok) {
    if (konto.grund === "OHNE_MAIL") return { fehler: { _: fehlerText.keineMail } };
    if (konto.grund === "MAIL_BELEGT") return { fehler: { _: fehlerText.mailBelegt } };
    return { fehler: { _: fehlerText.nichtMoeglich } };
  }

  // Ältere Links behalten: Der Zugangslink aus der Einladungsmail bleibt so
  // gültig, bis einer der beiden benutzt ist. Danach erkennt /zugang ihn als
  // verbraucht und schickt zur Anmeldung statt „neuen Link anfordern“.
  const { token: zugangstoken } = await erzeugeZugangstoken(konto.userId, "EINLADUNG", {
    aeltereBehalten: true,
  });

  await auditLog({
    aktion: "CREATE",
    entitaet: "Zugang",
    entitaetId: konto.userId,
    details: {
      referentId: teilnehmer.referent.id,
      zweck: "EINLADUNG",
      ausUmfrage: teilnehmer.umfrageId,
    },
  });

  revalidatePath("/admin/referenten");
  redirect(`/zugang?token=${encodeURIComponent(zugangstoken)}`);
}

/** Feld aus dem Formular als Text. Alles andere (Datei, fehlend) zählt als leer. */
function textFeld(formData: FormData, name: string): string {
  const wert = formData.get(name);
  return typeof wert === "string" ? wert : "";
}

/**
 * Speichert das Onboarding der eigenen Person (Kontaktwege, Handynummer,
 * weitere Formate). Die Person ergibt sich nur aus dem Token und der
 * Datenbank, eine mitgeschickte referentId wird nie gelesen. Geschrieben wird
 * nur die eigene Zeile und nur, solange die Umfrage `OFFEN` ist. Die Antwort
 * auf die Termine (`geantwortetAm`) bleibt unberührt, die Person erscheint
 * dadurch nicht in „Alle Antworten“.
 *
 * Die Handynummer ist `Referent.telefon` der eigenen Person (es gibt nur eine
 * Nummer, sie steht auch im Profil). Das Formular ist mit ihr vorbelegt und
 * schickt den Ausgangswert als verstecktes Feld `telefonAusgang` mit. Nur wenn
 * die Person die Nummer geändert hat, wird sie übernommen (leer heißt leer),
 * und nur, wenn sie in der Datenbank noch dem Ausgangswert entspricht,
 * sonst Fehlermeldung statt Überschreiben. Alles in einer Transaktion unter
 * Sperre von Umfrage und Person.
 *
 * Das Protokoll enthält weder Handynummer noch Bemerkung.
 */
export async function speichereOnboarding(
  token: string,
  _bisher: FormularState,
  formData: FormData,
): Promise<FormularState> {
  const teilnehmer = await ladeTeilnehmerZuToken(token);
  if (!teilnehmer || !teilnehmer.referent.aktiv) {
    return { fehler: { _: TX.fehler.linkUngueltig } };
  }
  if (teilnehmer.umfrage.status !== "OFFEN") {
    return { fehler: { _: TX.fehler.geschlossen } };
  }

  const geprueft = OnboardingSchema.safeParse({
    kontaktwege: formData.getAll("kontaktweg").filter((w) => typeof w === "string"),
    telefon: textFeld(formData, "telefon"),
    weitereFormate: formData.get("weitereFormate") === "on",
    zeiten: formData.getAll("zeit").filter((w) => typeof w === "string"),
    bemerkung: textFeld(formData, "bemerkung"),
  });
  if (!geprueft.success) {
    const fehler: Record<string, string> = {};
    for (const problem of geprueft.error.issues) {
      const feld = problem.path[0];
      if (feld === "telefon" || feld === "bemerkung") {
        fehler[feld] ??= problem.message;
      } else {
        fehler._ ??= TO.fehler.eingabe;
      }
    }
    return { fehler };
  }
  const { telefon, ...angaben } = geprueft.data;
  const referentId = teilnehmer.referent.id;
  // Die Nummer, die beim Laden der Seite im Feld stand (verstecktes Feld).
  // Fehlt es (alter Tab), gilt der Ausgangswert als unbekannt.
  const ausgangRoh = formData.get("telefonAusgang");
  const ausgang = typeof ausgangRoh === "string" ? ausgangRoh.trim() || null : undefined;

  const gespeichert = await prisma.$transaction(async (tx) => {
    // Umfrage und Person werden gesperrt (FOR UPDATE, Reihenfolge Umfrage vor
    // Referent): Die Administration kann in der Zwischenzeit weder schließen
    // noch stilllegen, ohne dass dieses Speichern es sieht.
    const aktuell = await sperreUmfrage(tx, teilnehmer.umfrageId);
    if (aktuell?.status !== "OFFEN") return "GESCHLOSSEN" as const;
    const person = await sperreReferent(tx, referentId);
    if (!person?.aktiv) return "INAKTIV" as const;

    // Das Telefon wird nur geschrieben, wenn die Person es im Formular
    // geändert hat. Hat zwischenzeitlich jemand (Profil, Administration) eine
    // andere Nummer gespeichert, wird nichts überschrieben.
    const aktuelleNummer = await tx.referent.findUnique({
      where: { id: referentId },
      select: { telefon: true },
    });
    const inDb = aktuelleNummer?.telefon?.trim() || null;
    let telefonSchreiben = false;
    if (telefon !== inDb && telefon !== ausgang) {
      if (ausgang === undefined || inDb !== ausgang) return "TELEFON" as const;
      telefonSchreiben = true;
    }

    await tx.referentOnboarding.upsert({
      where: { referentId },
      create: { referentId, ...angaben },
      update: angaben,
    });
    if (telefonSchreiben) {
      await tx.referent.update({ where: { id: referentId }, data: { telefon } });
    }
    return "OK" as const;
  });

  if (gespeichert === "GESCHLOSSEN") return { fehler: { _: TX.fehler.geschlossen } };
  if (gespeichert === "INAKTIV") return { fehler: { _: TX.fehler.linkUngueltig } };
  if (gespeichert === "TELEFON") return { fehler: { telefon: TO.fehler.telefonGeaendert } };

  await auditLog({
    aktion: "UPDATE",
    entitaet: "ReferentOnboarding",
    entitaetId: referentId,
    details: {
      umfrageId: teilnehmer.umfrageId,
      kontaktwege: angaben.kontaktwege,
      weitereFormate: angaben.weitereFormate,
      zeitenAnzahl: angaben.zeiten.length,
      telefonGesetzt: telefon !== null,
    },
  });

  revalidatePath(`/umfrage/${token}`);
  revalidatePath("/admin/referenten/onboarding");
  revalidatePath("/admin/referenten");
  revalidatePath("/admin/konto");

  return { erfolg: true, meldung: TO.erfolg };
}
