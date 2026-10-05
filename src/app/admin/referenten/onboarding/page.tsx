import Link from "next/link";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { formatDatum } from "@/lib/datetime";
import type { SuchParameter } from "@/lib/filter";
import { OnboardingLoeschen } from "@/components/admin/OnboardingLoeschen";
import { buttonVariants } from "@/components/ui/button";
import { KONTAKTWEGE, KONTAKTWEG_VALUES, kontaktwegLabel, zeitenKompakt } from "@/constants/onboarding";
import type { Kontaktweg } from "@/constants/onboarding";
import { cn } from "@/lib/utils";

export const metadata = { title: "Onboarding-Angaben" };
export const dynamic = "force-dynamic";

const BASIS = "/admin/referenten/onboarding";

function einzeln(params: SuchParameter, name: string): string | undefined {
  const wert = params[name];
  return (Array.isArray(wert) ? wert[0] : wert)?.trim() || undefined;
}

/**
 * Onboarding-Angaben aller aktiven Personen. Nur für die Administration. Hier
 * steht die Telefonnummer aus dem Profil (`Referent.telefon`). Filter in der URL:
 * `?formate=1` (weitere Formate), `?kontakt=MAIL|TELEFON|MESSENGER`,
 * `?offen=1` (noch nichts gespeichert).
 */
export default async function OnboardingAngabenSeite({
  searchParams,
}: {
  searchParams: Promise<SuchParameter>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;

  const formate = einzeln(params, "formate") === "1";
  const offen = einzeln(params, "offen") === "1";
  const kontaktRoh = einzeln(params, "kontakt");
  const kontakt = (KONTAKTWEG_VALUES as readonly string[]).includes(kontaktRoh ?? "")
    ? (kontaktRoh as Kontaktweg)
    : undefined;

  const onboardingFilter: Prisma.ReferentOnboardingWhereInput = {
    ...(formate ? { weitereFormate: true } : {}),
    ...(kontakt ? { kontaktwege: { has: kontakt } } : {}),
  };
  const nurMitAngaben = formate || kontakt;

  const personen = await prisma.referent.findMany({
    where: {
      aktiv: true,
      ...(offen
        ? { onboarding: null }
        : nurMitAngaben
          ? { onboarding: { is: onboardingFilter } }
          : {}),
    },
    orderBy: [{ nachname: "asc" }, { vorname: "asc" }],
    select: {
      id: true,
      vorname: true,
      nachname: true,
      organisation: true,
      telefon: true,
      onboarding: {
        select: {
          kontaktwege: true,
          weitereFormate: true,
          zeiten: true,
          bemerkung: true,
          updatedAt: true,
        },
      },
    },
  });

  const mitAngaben = personen.filter((p) => p.onboarding).length;

  function link(aenderung: Record<string, string | undefined>): string {
    const neu = new URLSearchParams();
    const aktuell: Record<string, string | undefined> = {
      formate: formate ? "1" : undefined,
      kontakt,
      offen: offen ? "1" : undefined,
      ...aenderung,
    };
    for (const [schluessel, wert] of Object.entries(aktuell)) if (wert) neu.set(schluessel, wert);
    const text = neu.toString();
    return text ? `${BASIS}?${text}` : BASIS;
  }

  const filterKnopf = (aktiv: boolean) =>
    cn(buttonVariants({ variant: aktiv ? "default" : "outline", size: "sm" }));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/referenten" className="text-sm text-primary underline-offset-4 hover:underline">
          Zurück zu den Referenten
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Onboarding-Angaben</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Angaben der aktiven Personen aus dem Onboarding unter der Terminumfrage. Das Telefon ist
          das Feld „Telefon“ im Profil der Person: Was sie hier einträgt, steht dort, und umgekehrt.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter">
        <Link href={BASIS} className={filterKnopf(!formate && !kontakt && !offen)}>
          Alle
        </Link>
        <Link
          href={link({ formate: formate ? undefined : "1", offen: undefined })}
          className={filterKnopf(formate)}
          aria-current={formate ? "true" : undefined}
        >
          Weitere Formate
        </Link>
        {KONTAKTWEGE.map((weg) => (
          <Link
            key={weg.value}
            href={link({ kontakt: kontakt === weg.value ? undefined : weg.value, offen: undefined })}
            className={filterKnopf(kontakt === weg.value)}
            aria-current={kontakt === weg.value ? "true" : undefined}
          >
            {weg.label}
          </Link>
        ))}
        <Link
          href={offen ? BASIS : `${BASIS}?offen=1`}
          className={filterKnopf(offen)}
          aria-current={offen ? "true" : undefined}
        >
          Noch offen
        </Link>
      </div>

      <p className="text-sm text-muted-foreground" data-testid="onboarding-zaehler">
        {personen.length} {personen.length === 1 ? "Person" : "Personen"}, {mitAngaben} mit Angaben
      </p>

      {personen.length === 0 ? (
        <p className="text-sm text-muted-foreground">Keine Personen für diesen Filter.</p>
      ) : (
        <div className="relative overflow-x-auto border border-border bg-card">
          <table className="w-full text-sm" data-testid="onboarding-tabelle">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">Name</th>
                <th className="px-3 py-2.5 font-medium">Telefon</th>
                <th className="px-3 py-2.5 font-medium">Kontaktwege</th>
                <th className="px-3 py-2.5 font-medium">Weitere Formate</th>
                <th className="px-3 py-2.5 font-medium">Zeiten</th>
                <th className="px-3 py-2.5 font-medium">Bemerkung</th>
                <th className="px-3 py-2.5 font-medium">Stand</th>
                <th className="px-3 py-2.5 font-medium">
                  <span className="sr-only">Aktionen</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {personen.map((p) => {
                const name = `${p.vorname} ${p.nachname}`.trim();
                const o = p.onboarding;
                return (
                  <tr key={p.id} data-zeile={name} className="border-b border-border/70 align-top last:border-b-0">
                    <td className="px-3 py-2.5">
                      <span className="font-medium">{name}</span>
                      {p.organisation ? (
                        <span className="block text-xs text-muted-foreground">{p.organisation}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{p.telefon ?? "–"}</td>
                    {o ? (
                      <>
                        <td className="px-3 py-2.5">
                          {o.kontaktwege.length ? o.kontaktwege.map(kontaktwegLabel).join(", ") : "–"}
                        </td>
                        <td className="px-3 py-2.5">{o.weitereFormate ? "Ja" : "Nein"}</td>
                        <td className="px-3 py-2.5">{zeitenKompakt(o.zeiten) || "–"}</td>
                        <td className="max-w-64 px-3 py-2.5 text-pretty">{o.bemerkung ?? "–"}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{formatDatum(o.updatedAt)}</td>
                        <td className="px-3 py-2.5">
                          <OnboardingLoeschen referentId={p.id} name={name} />
                        </td>
                      </>
                    ) : (
                      <>
                        <td colSpan={5} className="px-3 py-2.5 text-muted-foreground">
                          Noch nichts gespeichert
                        </td>
                        <td />
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
