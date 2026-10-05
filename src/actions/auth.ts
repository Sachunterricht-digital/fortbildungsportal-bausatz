"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import {
  clearSessionCookie,
  getSessionUser,
  setSessionCookie,
  signToken,
} from "@/lib/auth";
import { sichereWeiterleitung } from "@/lib/weiterleitung";
import { createRateLimiter, getClientIp } from "@/lib/rateLimit";
import { T } from "@/texte/de";

/**
 * Zwei Begrenzer: einer pro Konto (gegen das Durchprobieren eines Passworts),
 * einer pro IP (gegen das Durchprobieren vieler Konten von einer Quelle).
 * Modul-Ebene, damit die Zähler zwischen Aufrufen erhalten bleiben.
 */
const proKonto = createRateLimiter(5, 15 * 60);
const proIp = createRateLimiter(20, 15 * 60);

const LoginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, T.zugang.auth.emailFehlt)
    .refine(
      (wert) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(wert),
      T.zugang.auth.emailUngueltig,
    ),
  passwort: z.string().min(1, T.zugang.auth.passwortFehlt),
  weiter: z.string().optional(),
});

export interface LoginState {
  fehler?: string;
  /** Die eingegebene Adresse, damit sie nach einem Fehler im Feld stehen bleibt. */
  email?: string;
}

export async function login(
  _bisher: LoginState,
  formData: FormData,
): Promise<LoginState> {
  // formData.get() liefert null, wenn das Feld fehlt — zod würde daraus eine
  // englische Typmeldung machen. Deshalb hier auf Strings normalisieren.
  const eingegebeneEmail = formData.get("email")?.toString() ?? "";
  const eingabe = LoginSchema.safeParse({
    email: formData.get("email")?.toString() ?? "",
    passwort: formData.get("passwort")?.toString() ?? "",
    weiter: formData.get("weiter")?.toString() || undefined,
  });

  if (!eingabe.success) {
    return {
      fehler: eingabe.error.issues[0]?.message ?? T.zugang.auth.eingabeUnvollstaendig,
      email: eingegebeneEmail,
    };
  }

  const { email, passwort } = eingabe.data;
  const ip = getClientIp(await headers());

  const ipLimit = proIp.pruefen(ip);
  const kontoLimit = proKonto.pruefen(email);

  if (!ipLimit.erlaubt || !kontoLimit.erlaubt) {
    const warten = Math.max(ipLimit.wartesekunden, kontoLimit.wartesekunden);
    return {
      fehler: T.zugang.auth.zuVieleVersuche(Math.ceil(warten / 60)),
      email: eingegebeneEmail,
    };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      passwordHash: true,
      isActive: true,
      sessionVersion: true,
    },
  });

  // Auch bei unbekannter Adresse wird gehasht: Sonst wäre an der Antwortzeit
  // ablesbar, welche Adressen im System existieren. Dasselbe gilt für Konten,
  // deren Zugang eingerichtet, aber noch nicht mit einem Passwort versehen ist.
  const ersatzHash =
    "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv";
  const passt = await bcrypt.compare(passwort, user?.passwordHash ?? ersatzHash);

  if (!user || !user.passwordHash || !passt || !user.isActive) {
    await auditLog({
      userId: user?.id ?? null,
      aktion: "LOGIN_FAILED",
      entitaet: "User",
      entitaetId: user?.id ?? null,
      details: { email, ip },
    });
    // Bewusst dieselbe Meldung für "Konto unbekannt", "Passwort falsch" und
    // "Konto deaktiviert".
    return { fehler: T.zugang.auth.zugangsdatenFalsch, email: eingegebeneEmail };
  }

  proKonto.zuruecksetzen(email);
  proIp.zuruecksetzen(ip);

  await setSessionCookie(await signToken(user.id, user.sessionVersion));
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await auditLog({ userId: user.id, aktion: "LOGIN", entitaet: "User", entitaetId: user.id });

  // Nur interne Pfade als Weiterleitungsziel zulassen (Open Redirect), siehe
  // src/lib/weiterleitung.ts. Dieselbe Prüfung nutzt die Login-Seite.
  redirect(sichereWeiterleitung(eingabe.data.weiter));
}

export async function logout(): Promise<void> {
  const user = await getSessionUser();
  if (user) {
    await auditLog({ userId: user.id, aktion: "LOGOUT", entitaet: "User", entitaetId: user.id });
  }
  await clearSessionCookie();
  redirect("/login");
}
