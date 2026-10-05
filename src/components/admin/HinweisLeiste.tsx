import Link from "next/link";
import { CalendarClock, UserRound } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { formatDatum } from "@/lib/datetime";
import { ladeFrist } from "@/lib/frist";
import { profilVollstaendig } from "@/lib/validation/profil";
import { T } from "@/texte/de";

/**
 * Frist und Profilhinweis für angemeldete Personen. Erscheint nur, wenn es
 * etwas zu sagen gibt.
 */
export async function HinweisLeiste({
  userId,
  rolle,
  mitProfil = true,
}: {
  userId: string;
  rolle: string;
  mitProfil?: boolean;
}) {
  const [frist, referent] = await Promise.all([
    ladeFrist(),
    mitProfil
      ? prisma.referent.findUnique({
          where: { userId },
          select: { vorname: true, nachname: true, organisation: true },
        })
      : Promise.resolve(null),
  ]);
  // Nur Referenten (oder wer schon einen Verzeichniseintrag hat) werden ans
  // Profil erinnert, reine Redaktionskonten nicht.
  const profilFehlt =
    mitProfil && (rolle === "REFERENT" || referent !== null) && !profilVollstaendig(referent);

  if (!frist && !profilFehlt) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border bg-card px-4 py-3 text-sm">
      {frist ? (
        <span className="flex items-center gap-2">
          <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
          <span className="zahl">{T.frist.anzeige(formatDatum(frist))}</span>
        </span>
      ) : null}
      {profilFehlt ? (
        <span className="flex items-center gap-2">
          <UserRound className="size-4 text-muted-foreground" aria-hidden />
          {T.profil.unvollstaendig}
          <Link href="/admin/konto#profil" className="font-medium text-primary underline-offset-4 hover:underline">
            {T.profil.vervollstaendigen}
          </Link>
        </span>
      ) : null}
    </div>
  );
}
