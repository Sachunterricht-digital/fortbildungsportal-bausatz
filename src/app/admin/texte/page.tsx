import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { letzterLauf } from "@/lib/retention";
import { formatDatumZeit } from "@/lib/datetime";
import { SystemtextFormular } from "@/components/admin/SystemtextFormular";

export const metadata = { title: "Rechtstexte" };
export const dynamic = "force-dynamic";

export default async function TextePage() {
  await requireRole("ADMIN");

  const [texte, letzteBereinigung] = await Promise.all([
    prisma.systemSetting.findMany({
      where: { id: { in: ["impressum", "datenschutz"] } },
    }),
    letzterLauf(),
  ]);

  const wert = (id: string) => texte.find((t) => t.id === id)?.value ?? "";

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Rechtstexte</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Impressum und Datenschutzerklärung, wie sie im öffentlichen Bereich
          erscheinen. Markdown ist erlaubt (## Überschrift, **fett**, Listen mit -).
        </p>
      </div>

      <SystemtextFormular
        id="impressum"
        ueberschrift="Impressum"
        wert={wert("impressum")}
      />

      <SystemtextFormular
        id="datenschutz"
        ueberschrift="Datenschutzerklärung"
        wert={wert("datenschutz")}
      />

      <section className="border bg-muted/30 p-5">
        <h2 className="text-sm font-semibold">Löschlauf</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Vergangene Fortbildungen werden nach zwei Jahren archiviert,
          Referentenzuordnungen nach fünf Jahren aufgelöst, Protokolle nach
          zwölf Monaten gelöscht.
        </p>
        <p className="mt-2 text-sm">
          Zuletzt gelaufen:{" "}
          <span className="zahl">
            {letzteBereinigung ? formatDatumZeit(letzteBereinigung) : "noch nie"}
          </span>
        </p>
      </section>
    </div>
  );
}
