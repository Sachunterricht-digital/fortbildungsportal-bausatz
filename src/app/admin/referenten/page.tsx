import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ReferentenVerwaltung } from "@/components/admin/ReferentenVerwaltung";
import { AUSGEGRAUT } from "@/constants/funktionen";
import { ReferentenRegistrierungslink } from "@/components/admin/ReferentenRegistrierungslink";
import { FristFormular } from "@/components/admin/FristFormular";
import { ladeFrist, referentenOhneEinreichung } from "@/lib/frist";
import { berlinIsoDatum } from "@/lib/datetime";
import { T } from "@/texte/de";

export const metadata = { title: "Referenten" };

export default async function ReferentenPage() {
  const user = await requireRole("ADMIN", "REDAKTEUR");

  const referenten = await prisma.referent.findMany({
    orderBy: [{ aktiv: "desc" }, { nachname: "asc" }, { vorname: "asc" }],
    select: {
      id: true,
      vorname: true,
      nachname: true,
      organisation: true,
      funktion: true,
      schwerpunkte: true,
      kurzprofil: true,
      email: true,
      telefon: true,
      notiz: true,
      oeffentlichSichtbar: true,
      aktiv: true,
      userId: true,
      user: {
        select: { id: true, isActive: true, passwordHash: true, lastLoginAt: true, role: true },
      },
      _count: { select: { fortbildungen: true } },
      // Nur laufende Themen zählen, das Archiv der Vorjahre gehört nicht in diese Übersicht.
      fortbildungen: {
        where: { fortbildung: { status: { not: "ARCHIVIERT" } } },
        select: { fortbildungId: true },
      },
    },
  });

  const [frist, offen] = await Promise.all([ladeFrist(), referentenOhneEinreichung()]);

  // Der Passwort-Hash darf den Server nicht verlassen — für die Anzeige
  // genügt die Information, ob überhaupt schon eines gesetzt wurde.
  const zeilen = referenten.map(({ user, fortbildungen, ...rest }) => ({
    aktuelleThemen: fortbildungen.length,
    ...rest,
    zugang: user
      ? {
          userId: user.id,
          aktiv: user.isActive,
          passwortGesetzt: user.passwordHash !== null,
          lastLoginAt: user.lastLoginAt,
          rolle: user.role,
        }
      : null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Referentinnen und Referenten
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          E-Mail-Adresse, Telefonnummer und Notizen sind reine Innendaten und
          erscheinen nie im öffentlichen Bereich. Ob der Name im Frontend
          genannt wird, steuert der Schalter „Öffentlich sichtbar“ — dafür
          braucht es das Einverständnis der jeweiligen Person.
        </p>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Für bereits eingetragene Personen kann die Administration einen
          einmaligen Zugangslink erzeugen. Neue Personen registrieren sich über
          den allgemeinen, zeitlich begrenzten Link unten selbst. Anschließend
          können sie eigene Fortbildungen anlegen, Teilnehmerzahlen für eigene
          SchiLf nachtragen und alle Termine im Planungskalender überblicken.
        </p>
        {user.role === "ADMIN" ? (
          <p className="mt-2 text-sm">
            <Link
              href="/admin/referenten/onboarding"
              className="text-primary underline-offset-4 hover:underline"
            >
              Onboarding-Angaben
            </Link>
          </p>
        ) : null}
      </div>

      {user.role === "ADMIN" ? (
        <section className="space-y-4 border bg-card p-5">
          <h2 className="font-semibold tracking-tight">{T.frist.ueberschrift}</h2>
          <FristFormular wert={frist ? berlinIsoDatum(frist) : ""} />

          <div>
            <h3 className="text-sm font-medium">
              {T.frist.offenUeberschrift} ({offen.referenten.length})
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {T.frist.offenHinweis(offen.schuljahr)}
            </p>
            {offen.referenten.length === 0 ? (
              <p className="mt-2 text-sm">{T.frist.alleEingereicht}</p>
            ) : (
              <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                {offen.referenten.map((r) => (
                  <li key={r.id}>
                    {r.nachname}, {r.vorname}
                    <span className="text-muted-foreground">
                      {r.organisation ? ` · ${r.organisation}` : ""}
                      {!r.user
                        ? ` · ${T.frist.ohneZugang}`
                        : !r.user.lastLoginAt
                          ? ` · ${T.frist.nieAngemeldet}`
                          : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : null}

      {!AUSGEGRAUT.registrierungslink ? <ReferentenRegistrierungslink /> : null}
      <ReferentenVerwaltung
        referenten={zeilen}
        darfLoeschen={user.role === "ADMIN"}
        darfZugangVerwalten={user.role === "ADMIN"}
        darfZuAdministrationHochstufen={user.role === "ADMIN"}
      />
    </div>
  );
}
