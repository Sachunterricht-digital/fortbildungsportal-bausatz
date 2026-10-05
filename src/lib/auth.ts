import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { Rolle } from "@/constants/fortbildung";
import {
  liesSessionVersion,
  SESSION_COOKIE,
  SESSION_DAUER_SEKUNDEN,
  sitzungsCookieSicher,
} from "@/constants/session";

export { SESSION_COOKIE };

const SESSION_DAUER = `${SESSION_DAUER_SEKUNDEN}s`;

function secret(): Uint8Array {
  const wert = process.env.JWT_SECRET;
  if (!wert || wert.length < 32) {
    throw new Error(
      "JWT_SECRET fehlt oder ist zu kurz. Erzeugen mit: openssl rand -base64 48",
    );
  }
  return new TextEncoder().encode(wert);
}

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: Rolle;
  /** Bei der Rolle REFERENT: der zugehörige Eintrag im Referentenverzeichnis. */
  referentId: string | null;
}

/** Darf alles außer Systemverwaltung — also Redaktion und Administration. */
export const REDAKTION: Rolle[] = ["ADMIN", "REDAKTEUR"];

/** Alle, die überhaupt Fortbildungen erfassen dürfen. */
export const ERFASSER: Rolle[] = ["ADMIN", "REDAKTEUR", "REFERENT"];

export async function signToken(
  userId: string,
  sessionVersion: number,
): Promise<string> {
  return new SignJWT({ sub: userId, sv: sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_DAUER)
    .sign(secret());
}

export interface VerifiziertesToken {
  userId: string;
  sessionVersion: number | null;
}

export async function verifyToken(
  token: string,
): Promise<VerifiziertesToken | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.sub !== "string") return null;

    return {
      userId: payload.sub,
      // Tokens vor Einführung der Sitzungsversion werden absichtlich nicht
      // weiter akzeptiert: Ein erneuter Login ist sicherer als eine
      // unkontrollierbare Alt-Sitzung.
      sessionVersion: liesSessionVersion(payload.sv),
    };
  } catch {
    return null;
  }
}

/** Setzt das Sitzungs-Cookie. Nur aus Server Actions oder Route Handlern aufrufbar. */
export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: sitzungsCookieSicher(
      process.env.SESSION_COOKIE_SECURE,
      process.env.NODE_ENV === "production",
    ),
    path: "/",
    maxAge: SESSION_DAUER_SEKUNDEN,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * Die angemeldete Person, oder null.
 *
 * Liest bewusst gegen die Datenbank statt nur das Token auszuwerten: so wirkt
 * ein deaktivierter Zugang sofort und nicht erst nach Ablauf des Tokens.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenDaten = await verifyToken(token);
  if (!tokenDaten) return null;

  const user = await prisma.user.findUnique({
    where: { id: tokenDaten.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      sessionVersion: true,
      referent: { select: { id: true, aktiv: true } },
    },
  });

  if (
    !user ||
    !user.isActive ||
    tokenDaten.sessionVersion !== user.sessionVersion
  ) {
    return null;
  }

  // Ein stillgelegter Referenteneintrag beendet auch den Zugang — sonst
  // bliebe ein ausgeschiedener Referent weiter angemeldet.
  if (user.role === "REFERENT" && !user.referent?.aktiv) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as Rolle,
    referentId: user.referent?.id ?? null,
  };
}

/**
 * Erzwingt eine Anmeldung. Wirft, wenn niemand angemeldet ist.
 *
 * In JEDER Server Action und JEDEM geschützten Route Handler aufrufen — der
 * Guard im Layout und die Prüfung in proxy.ts sind nur vorgelagert, sie
 * schützen die Aktion selbst nicht (Server Actions sind eigene Endpunkte).
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError("Nicht angemeldet.");
  return user;
}

/** Erzwingt eine der angegebenen Rollen. */
export async function requireRole(...rollen: Rolle[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!rollen.includes(user.role)) {
    throw new AuthError("Für diese Aktion fehlt die Berechtigung.");
  }
  return user;
}

/**
 * Einschränkung, welche Fortbildungen eine Person sehen und bearbeiten darf.
 *
 * Redaktion und Administration sehen alles. Referentinnen und Referenten nur
 * das, was sie selbst angelegt haben oder wo sie als Leitung eingetragen sind.
 * Diese eine Funktion wird überall verwendet, damit die Regel nicht an jeder
 * Abfrage neu formuliert — und irgendwann vergessen — wird.
 */
export function fortbildungScope(user: SessionUser): Prisma.FortbildungWhereInput {
  if (REDAKTION.includes(user.role)) return {};

  return {
    OR: [
      { createdById: user.id },
      ...(user.referentId
        ? [{ referenten: { some: { referentId: user.referentId } } }]
        : []),
    ],
  };
}

/** Prüft den Zugriff auf einen konkreten Datensatz. */
export async function darfBearbeiten(
  user: SessionUser,
  fortbildungId: string,
): Promise<boolean> {
  if (REDAKTION.includes(user.role)) return true;

  const treffer = await prisma.fortbildung.findFirst({
    where: { AND: [{ id: fortbildungId }, fortbildungScope(user)] },
    select: { id: true },
  });
  return treffer !== null;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}
