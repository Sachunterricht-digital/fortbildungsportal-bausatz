import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

import { ReferentenRegistrierungsFormular } from "@/components/registrierung/ReferentenRegistrierungsFormular";
import { AUSGEGRAUT } from "@/constants/funktionen";
import { pruefeReferentenRegistrierungslink } from "@/lib/referentenRegistrierung";
import { T } from "@/texte/de";

export const metadata: Metadata = {
  title: T.aussen.registrierung.metaTitel,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ReferentenRegistrierungSeite({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const gueltig =
    !AUSGEGRAUT.registrierungslink && token ? await pruefeReferentenRegistrierungslink(token) : false;

  return (
    <div className="flex flex-1 items-center justify-center py-6">
      <div className="w-full max-w-md">
        {gueltig ? (
          <>
            <div className="mb-8 text-center">
              <h1 className="text-xl font-semibold tracking-tight">{T.aussen.registrierung.titel}</h1>
              <p className="mt-1.5 text-sm text-muted-foreground text-pretty">
                {T.aussen.registrierung.einleitung}
              </p>
            </div>
            <ReferentenRegistrierungsFormular token={token!} />
          </>
        ) : (
          <div className="text-center">
            <AlertCircle className="mx-auto mb-4 size-7 text-muted-foreground" aria-hidden />
            <h1 className="text-xl font-semibold tracking-tight">{T.aussen.registrierung.ungueltigTitel}</h1>
            <p className="mt-2 text-sm text-muted-foreground text-pretty">
              {T.aussen.registrierung.ungueltigText}
            </p>
            <p className="mt-8">
              <Link href="/login" className="text-sm underline underline-offset-4 hover:text-foreground">
                {T.aussen.registrierung.zurAnmeldung}
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
