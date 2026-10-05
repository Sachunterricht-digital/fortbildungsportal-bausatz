import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { sperreReferent, sperreUser } from "@/lib/sperren";

/**
 * Einmal-Token für „Zugang einrichten" und „Passwort zurücksetzen".
 *
 * Es gibt bewusst keinen Mailversand: Für diese Anwendung ist kein Mailserver
 * eingerichtet, und einen zu behaupten wäre schlimmer als keinen zu haben.
 * Stattdessen erzeugt die Administration einen Link, kopiert ihn und gibt ihn
 * der Person auf dem üblichen Dienstweg. Der Link ist einmalig verwendbar und
 * läuft ab.
 *
 * Eigene Datei ohne `server-only`-Markierung (siehe src/lib/zugang.ts): Der
 * normale App-Code importiert weiterhin aus `@/lib/zugang`, das die
 * Markierung trägt und diese Datei nur weiterreicht. `scripts/zugangslink.ts`
 * läuft als eigenständiges tsx-Skript ohne Next.js-Bundler — „server-only"
 * wirft dort schon beim Import, weil das Modul die Bundler-Bedingung nie
 * gesetzt sieht. Dieser Kern bleibt deshalb ungeschützt importierbar, die
 * Logik selbst existiert dadurch nur an dieser einen Stelle.
 */

const GUELTIGKEIT_TAGE = 14;

export type Zweck = "EINLADUNG" | "PASSWORT_RESET";

function hashe(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Erzeugt ein neues Token und gibt den Klartext zurück — der ist nur in
 * diesem Moment bekannt, gespeichert wird ausschließlich der Hash.
 *
 * Alles geschieht in einer Transaktion unter `FOR UPDATE` der `User`-Zeile.
 * Zwei gleichzeitige Aufrufe für dasselbe Konto laufen dadurch nacheinander
 * und hinterlassen genau ein offenes Token (Reihenfolge der Sperren im
 * ganzen Projekt: Umfrage, Referent, User, Zugangstoken).
 *
 * Standard: ältere, noch offene Token des Kontos werden gleich entwertet,
 * sonst kursieren mehrere gültige Links für denselben Zugang. Mit
 * `aeltereBehalten` bleiben sie vorerst bestehen. Das braucht der
 * Mailversand: Erst wenn die Mail wirklich raus ist, entwertet
 * `entwerteAeltereZugangstoken` die alten, bei einem Fehler entfernt
 * `loescheZugangstoken` nur das neue.
 */
export async function erzeugeZugangstoken(
  userId: string,
  zweck: Zweck,
  optionen: { aeltereBehalten?: boolean } = {},
): Promise<{ id: string; token: string; gueltigBis: Date }> {
  const token = randomBytes(32).toString("base64url");
  const gueltigBis = new Date(
    Date.now() + GUELTIGKEIT_TAGE * 24 * 60 * 60 * 1000,
  );

  const id = await prisma.$transaction(async (tx) => {
    await sperreUser(tx, userId);
    if (!optionen.aeltereBehalten) {
      await tx.zugangstoken.deleteMany({ where: { userId, usedAt: null } });
    }
    const neu = await tx.zugangstoken.create({
      data: { tokenHash: hashe(token), userId, zweck, expiresAt: gueltigBis },
      select: { id: true },
    });
    return neu.id;
  });

  return { id, token, gueltigBis };
}

/**
 * Entwertet alle anderen noch offenen Token des Kontos, nachdem das neue
 * (`behalteId`) erfolgreich verschickt wurde.
 */
export async function entwerteAeltereZugangstoken(
  userId: string,
  behalteId: string,
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    await sperreUser(tx, userId);
    const weg = await tx.zugangstoken.deleteMany({
      where: { userId, usedAt: null, id: { not: behalteId } },
    });
    return weg.count;
  });
}

/** Entfernt ein einzelnes Token, etwa wenn die Mail dazu nicht rausging. */
export async function loescheZugangstoken(id: string): Promise<void> {
  await prisma.zugangstoken.deleteMany({ where: { id } });
}

export interface GeprueftesToken {
  id: string;
  userId: string;
  zweck: Zweck;
  name: string | null;
  email: string;
}

/** Prüft ein Token, ohne es zu verbrauchen. */
export async function pruefeZugangstoken(
  token: string,
): Promise<GeprueftesToken | null> {
  const eintrag = await prisma.zugangstoken.findUnique({
    where: { tokenHash: hashe(token) },
    include: { user: { select: { id: true, name: true, email: true, isActive: true } } },
  });

  if (!eintrag) return null;
  if (eintrag.usedAt) return null;
  if (eintrag.expiresAt < new Date()) return null;
  if (!eintrag.user.isActive) return null;

  return {
    id: eintrag.id,
    userId: eintrag.user.id,
    zweck: eintrag.zweck as Zweck,
    name: eintrag.user.name,
    email: eintrag.user.email,
  };
}

/**
 * Warum ein Link auf /zugang nicht (mehr) gilt. `PASSWORT_GESETZT`: Es ist ein
 * Einladungslink, das Konto ist aktiv und hat inzwischen ein Passwort, etwa
 * weil die Person über die Umfrage oder einen zweiten Link schon eines gesetzt
 * hat. Sonst `UNGUELTIG`. Verrät nichts über fremde Konten, weil nur kennt, wer
 * den Link hat.
 */
export async function grundFuerUngueltigenLink(
  token: string,
): Promise<"PASSWORT_GESETZT" | "UNGUELTIG"> {
  const eintrag = await prisma.zugangstoken.findUnique({
    where: { tokenHash: hashe(token) },
    select: { zweck: true, user: { select: { isActive: true, passwordHash: true } } },
  });
  if (eintrag?.zweck === "EINLADUNG" && eintrag.user.isActive && eintrag.user.passwordHash) {
    return "PASSWORT_GESETZT";
  }
  return "UNGUELTIG";
}

/**
 * Verbraucht einen Zugangstoken und setzt zugleich ein neues Passwort.
 *
 * Die bedingte Aktualisierung ist der entscheidende Schritt: Nur der erste
 * Request, der einen noch offenen und nicht abgelaufenen Token vorfindet,
 * erhält `count === 1`. Erst dann wird im selben Datenbank-Commit das
 * Passwort gesetzt. So kann ein Einladungslink auch bei parallelen Requests
 * nicht zweimal verwendet werden.
 */
export async function verbraucheTokenUndSetzePasswort(
  token: string,
  passwordHash: string,
): Promise<{ userId: string; zweck: Zweck; sessionVersion: number } | null> {
  const tokenHash = hashe(token);
  const jetzt = new Date();

  return prisma.$transaction(async (tx) => {
    const eintrag = await tx.zugangstoken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, zweck: true },
    });
    if (!eintrag) return null;

    // Gleiche Sperrreihenfolge wie beim Erzeugen: erst die User-Zeile.
    await sperreUser(tx, eintrag.userId);

    const verbraucht = await tx.zugangstoken.updateMany({
      where: {
        id: eintrag.id,
        usedAt: null,
        expiresAt: { gt: jetzt },
        user: { isActive: true },
      },
      data: { usedAt: jetzt },
    });
    if (verbraucht.count !== 1) return null;

    // Alle anderen offenen Token desselben Kontos und Zwecks sind damit
    // erledigt: Ein später noch auftauchender zweiter Link setzt kein
    // Passwort mehr.
    await tx.zugangstoken.updateMany({
      where: {
        userId: eintrag.userId,
        zweck: eintrag.zweck,
        usedAt: null,
        id: { not: eintrag.id },
      },
      data: { usedAt: jetzt },
    });

    const user = await tx.user.update({
      where: { id: eintrag.userId },
      data: {
        passwordHash,
        // Alle bereits ausgegebenen JWTs werden ungültig; die neue Sitzung
        // erhält weiter unten genau diese erhöhte Version.
        sessionVersion: { increment: 1 },
      },
      select: { id: true, sessionVersion: true },
    });

    return {
      userId: user.id,
      zweck: eintrag.zweck as Zweck,
      sessionVersion: user.sessionVersion,
    };
  });
}

/**
 * Vergleich in konstanter Zeit — verhindert, dass sich ein Token über
 * Antwortzeiten Zeichen für Zeichen erraten lässt.
 */
export function tokenGleich(a: string, b: string): boolean {
  const pufferA = Buffer.from(a);
  const pufferB = Buffer.from(b);
  if (pufferA.length !== pufferB.length) return false;
  return timingSafeEqual(pufferA, pufferB);
}

/** Vollständiger Link, den die Administration weitergibt. */
export function zugangsLink(token: string): string {
  const basis = process.env.APP_BASE_URL ?? "http://localhost:3000";
  return `${basis.replace(/\/+$/, "")}/zugang?token=${encodeURIComponent(token)}`;
}

// ---------------------------------------------------------------------------
// Konto zu einer Person sicherstellen
// ---------------------------------------------------------------------------

export type KontoErgebnis =
  | { ok: true; userId: string; email: string; neuAngelegt: boolean }
  | { ok: false; grund: "PERSON_FEHLT" }
  | { ok: false; grund: "OHNE_MAIL" }
  | { ok: false; grund: "MAIL_BELEGT"; email: string };

/**
 * Stellt sicher, dass zu einer Person ein Konto existiert.
 *
 * Hat die Person schon eines, bleibt es unverändert. Sonst legt diese
 * Funktion eines an (ohne Passwort — das setzt die Person selbst über den
 * Einladungslink) und verknüpft es mit dem Referenteneintrag. Gemeinsamer
 * Kern von `richteZugangEin` (Admin-Knopf „Zugang einrichten") und
 * `scripts/zugangslink.ts` (Wartung ohne Admin-Sitzung) — beide Wege dürfen
 * diese Logik nicht doppelt pflegen.
 */
export async function sichergestelltesKontoFuerReferent(
  referentId: string,
): Promise<KontoErgebnis> {
  // Die Person wird gesperrt (FOR UPDATE): Zwei gleichzeitige Aufrufe für
  // dieselbe Person laufen nacheinander, der zweite findet das Konto des
  // ersten, statt es ein zweites Mal anzulegen (Mail ist eindeutig, das gäbe
  // einen Fehler). Reihenfolge der Sperren: Referent vor User.
  return prisma.$transaction(async (tx): Promise<KontoErgebnis> => {
    if (!(await sperreReferent(tx, referentId))) return { ok: false, grund: "PERSON_FEHLT" };
    const referent = await tx.referent.findUnique({
      where: { id: referentId },
      select: { id: true, vorname: true, nachname: true, email: true, userId: true },
    });

    if (!referent) return { ok: false, grund: "PERSON_FEHLT" };
    if (!referent.email) return { ok: false, grund: "OHNE_MAIL" };

    const email = referent.email.trim().toLowerCase();

    if (referent.userId) {
      return { ok: true, userId: referent.userId, email, neuAngelegt: false };
    }

    const belegt = await tx.user.findUnique({ where: { email } });
    if (belegt) return { ok: false, grund: "MAIL_BELEGT", email };

    const user = await tx.user.create({
      data: {
        email,
        name: `${referent.vorname} ${referent.nachname}`,
        role: "REFERENT",
        // Kein Passwort: Das setzt die Person selbst über den Einladungslink.
        passwordHash: null,
      },
      select: { id: true },
    });

    await tx.referent.update({
      where: { id: referentId },
      data: { userId: user.id },
    });

    return { ok: true, userId: user.id, email, neuAngelegt: true };
  });
}
