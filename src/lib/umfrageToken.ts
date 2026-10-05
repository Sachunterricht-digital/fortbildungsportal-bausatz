import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { prisma } from "@/lib/prisma";

/**
 * Persönlicher Link einer Umfrage-Teilnahme ohne Login.
 *
 * Token = `<teilnehmerId>.<HMAC-SHA256(teilnehmerId)>`. Es wird nichts
 * gespeichert: Der Link lässt sich für Erinnerungen jederzeit neu berechnen,
 * und ohne das Server-Secret ist er nicht zu fälschen. Als Secret dient
 * `JWT_SECRET` (dasselbe wie für die Sitzungen). Konsequenz: Wird das Secret
 * gewechselt, sind auch alle Umfrage-Links ungültig. Ein fester Präfix trennt
 * die Verwendung, damit ein Sitzungs-JWT nie als Umfrage-Signatur taugt.
 */

const PRAEFIX = "umfrage-link:";

function schluessel(): string {
  const wert = process.env.JWT_SECRET;
  if (!wert || wert.length < 32) {
    throw new Error("JWT_SECRET fehlt oder ist zu kurz.");
  }
  return wert;
}

function signatur(teilnehmerId: string): string {
  return createHmac("sha256", schluessel())
    .update(PRAEFIX + teilnehmerId)
    .digest("base64url");
}

export function erzeugeUmfrageToken(teilnehmerId: string): string {
  return `${teilnehmerId}.${signatur(teilnehmerId)}`;
}

/** Vollständiger Link für Mail und „Link kopieren“. */
export function umfrageLink(teilnehmerId: string): string {
  const basis = process.env.APP_BASE_URL ?? "http://localhost:3000";
  return `${basis.replace(/\/+$/, "")}/umfrage/${erzeugeUmfrageToken(teilnehmerId)}`;
}

/**
 * Prüft die Signatur in konstanter Zeit und gibt die teilnehmerId zurück,
 * oder null bei jeder Abweichung. Sagt nichts darüber, ob es den Teilnehmer
 * noch gibt, das prüft `ladeTeilnehmerZuToken`.
 */
export function pruefeUmfrageToken(token: string): string | null {
  if (typeof token !== "string" || token.length > 200) return null;
  const punkt = token.indexOf(".");
  if (punkt < 1) return null;

  const id = token.slice(0, punkt);
  const gegeben = Buffer.from(token.slice(punkt + 1));
  const erwartet = Buffer.from(signatur(id));
  if (gegeben.length !== erwartet.length) return null;
  return timingSafeEqual(gegeben, erwartet) ? id : null;
}

/** Teilnehmer zu einem gültigen Token samt Umfrage und Person, sonst null. */
export async function ladeTeilnehmerZuToken(token: string) {
  const id = pruefeUmfrageToken(token);
  if (!id) return null;

  return prisma.umfrageTeilnehmer.findUnique({
    where: { id },
    include: {
      referent: {
        select: {
          id: true,
          vorname: true,
          nachname: true,
          email: true,
          aktiv: true,
          kurzprofil: true,
          portraetAm: true,
          userId: true,
          user: { select: { id: true, isActive: true, passwordHash: true } },
        },
      },
      umfrage: {
        include: {
          termine: { orderBy: { reihenfolge: "asc" } },
        },
      },
      antworten: true,
    },
  });
}
