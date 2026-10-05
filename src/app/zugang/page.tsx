import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

import { grundFuerUngueltigenLink, pruefeZugangstoken } from "@/lib/zugang";
import { PasswortFormular } from "@/components/admin/PasswortFormular";
import { T } from "@/texte/de";

export const metadata: Metadata = {
  title: T.zugang.zugangSeite.seitenTitel,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ZugangSeite({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const eintrag = token ? await pruefeZugangstoken(token) : null;
  const schonPasswort =
    !eintrag && token ? (await grundFuerUngueltigenLink(token)) === "PASSWORT_GESETZT" : false;
  const Z = T.zugang.zugangSeite;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        {eintrag ? (
          <>
            <div className="mb-8 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- Illustration wie auf der Startseite */}
              <img src="/bilder/banner-landkreis.webp" alt="" aria-hidden width={1536} height={512} className="mx-auto mb-5 block h-auto w-full" />
              <h1 className="text-xl font-semibold tracking-tight">
                {eintrag.zweck === "EINLADUNG"
                  ? T.zugang.zugangSeite.einladungTitel
                  : T.zugang.zugangSeite.resetTitel}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground text-pretty">
                {eintrag.zweck === "EINLADUNG"
                  ? T.zugang.zugangSeite.einladungText(eintrag.name ?? eintrag.email)
                  : T.zugang.zugangSeite.resetText(eintrag.email)}
              </p>
            </div>

            <PasswortFormular token={token!} email={eintrag.email} />
          </>
        ) : (
          <div className="text-center">
            <AlertCircle
              className="mx-auto mb-4 size-7 text-muted-foreground"
              aria-hidden
            />
            <h1 className="text-xl font-semibold tracking-tight">
              {schonPasswort ? Z.passwortGesetztTitel : Z.ungueltigTitel}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground text-pretty">
              {schonPasswort ? Z.passwortGesetztText : Z.ungueltigText}
            </p>
            <p className="mt-8">
              <Link
                href="/login"
                className="text-sm underline underline-offset-4 hover:text-foreground"
              >
                {T.zugang.zugangSeite.zurAnmeldung}
              </Link>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
