import { ladeSchulamt } from "@/lib/schulamt";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { sichereWeiterleitung } from "@/lib/weiterleitung";
import { LoginForm } from "@/components/admin/LoginForm";
import { T } from "@/texte/de";

export const metadata: Metadata = {
  title: T.zugang.login.seitenTitel,
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  // In Next 16 sind searchParams ein Promise.
  searchParams: Promise<{ weiter?: string }>;
}) {
  const { weiter } = await searchParams;
  // Schon angemeldet: direkt zum Ziel, aber nur zu internen Pfaden (kein Open Redirect).
  if (await getSessionUser()) {
    redirect(sichereWeiterleitung(weiter));
  }
  const schulamt = await ladeSchulamt();

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16 sm:py-24">
      <div className="w-full max-w-sm">
        <div className="mb-6 rounded-2xl border border-border bg-card px-6 py-7 text-center shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element -- Illustration wie auf der Startseite */}
          <img src="/bilder/banner-landkreis.webp" alt="" aria-hidden width={1536} height={512} className="mx-auto mb-5 block h-auto w-full" />
          <h1 className="text-xl font-semibold tracking-tight">{T.zugang.login.kopfTitel}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {T.zugang.login.unterzeile(schulamt.kurzname)}
          </p>
        </div>

        <LoginForm weiter={weiter} />

        <p className="mt-8 text-center text-sm text-muted-foreground">
          <Link href="/" className="underline underline-offset-4 hover:text-foreground">
            {T.zugang.login.zurueck}
          </Link>
        </p>
      </div>
    </main>
  );
}
