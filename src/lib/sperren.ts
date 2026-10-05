import type { Prisma } from "@prisma/client";

/**
 * Zeilensperren (`SELECT … FOR UPDATE`) für Abläufe, die sich unter Postgres
 * `READ COMMITTED` sonst überholen könnten. Gilt nur innerhalb einer
 * interaktiven Transaktion und bis zu deren Ende.
 *
 * Feste Reihenfolge im ganzen Projekt, damit keine zwei Abläufe sich
 * gegenseitig festhalten: Umfrage, dann Referent, dann User, dann
 * Zugangstoken. Wer mehrere Zeilen sperrt, nimmt sie in dieser Reihenfolge.
 *
 * Eigene Datei ohne `server-only`, weil `zugangKern.ts` (läuft auch als
 * tsx-Skript ohne Bundler) sie braucht.
 */
type Tx = Pick<Prisma.TransactionClient, "$queryRaw">;

/** Sperrt die Umfrage und liefert ihren Status, `null` wenn es sie nicht gibt. */
export async function sperreUmfrage(tx: Tx, id: string): Promise<{ status: string } | null> {
  const zeilen = await tx.$queryRaw<Array<{ status: string }>>`
    SELECT "status" FROM "Umfrage" WHERE "id" = ${id} FOR UPDATE`;
  return zeilen[0] ?? null;
}

/** Sperrt die Person und liefert `aktiv`, `null` wenn es sie nicht gibt. */
export async function sperreReferent(tx: Tx, id: string): Promise<{ aktiv: boolean } | null> {
  const zeilen = await tx.$queryRaw<Array<{ aktiv: boolean }>>`
    SELECT "aktiv" FROM "Referent" WHERE "id" = ${id} FOR UPDATE`;
  return zeilen[0] ?? null;
}

/** Sperrt die User-Zeile. */
export async function sperreUser(tx: Tx, id: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${id} FOR UPDATE`;
}
