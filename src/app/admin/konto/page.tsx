import { requireUser } from "@/lib/auth";
import { rolleLabel, ROLLEN } from "@/constants/fortbildung";
import { formatDatumZeit } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";
import { PasswortAendernFormular } from "@/components/admin/PasswortAendernFormular";
import { ProfilFormular } from "@/components/admin/ProfilFormular";

export const metadata = { title: "Eigenes Konto" };
export const dynamic = "force-dynamic";

export default async function KontoSeite() {
  const user = await requireUser();

  const konto = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      createdAt: true,
      lastLoginAt: true,
      referent: {
        select: {
          id: true,
          vorname: true,
          nachname: true,
          organisation: true,
          funktion: true,
          telefon: true,
          schwerpunkte: true,
          kurzprofil: true,
          portraetAm: true,
        },
      },
    },
  });

  // Ohne Verzeichniseintrag: Name aus dem Konto vorschlagen.
  const [vorname = "", ...rest] = (user.name ?? "").split(" ");
  const { id: referentId, ...referentWerte } = konto?.referent ?? {
    id: null,
    vorname,
    nachname: rest.join(" "),
    organisation: null,
    funktion: "REFERENT",
    telefon: null,
    schwerpunkte: null,
    kurzprofil: null,
    portraetAm: null,
  };
  const profilWerte = { ...referentWerte, referentId };

  return (
    <div className="max-w-lg space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Eigenes Konto</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {user.name ? `${user.name} · ` : ""}
          {user.email}
        </p>
        {user.role === "REFERENT" ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Neue Mailadresse? Kurze Nachricht an die Beratung digitale Bildung.
          </p>
        ) : null}
      </div>

      <div id="profil">
        <ProfilFormular werte={profilWerte} istAdmin={user.role === "ADMIN"} />
      </div>

      <div id="konto" className="scroll-mt-6 space-y-8">
        <dl className="grid gap-4 border bg-card p-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Rolle</dt>
            <dd className="mt-0.5">{rolleLabel(user.role)}</dd>
            <dd className="mt-1 text-xs text-muted-foreground text-pretty">
              {ROLLEN.find((r) => r.value === user.role)?.beschreibung}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">
              Zuletzt angemeldet
            </dt>
            <dd className="mt-0.5 zahl">
              {konto?.lastLoginAt ? formatDatumZeit(konto.lastLoginAt) : "—"}
            </dd>
            <dt className="mt-3 text-xs font-medium text-muted-foreground">
              Konto angelegt
            </dt>
            <dd className="mt-0.5 zahl">
              {konto?.createdAt ? formatDatumZeit(konto.createdAt) : "—"}
            </dd>
          </div>
        </dl>

        <PasswortAendernFormular />
      </div>
    </div>
  );
}
