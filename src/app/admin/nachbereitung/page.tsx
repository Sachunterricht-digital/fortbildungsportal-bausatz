import { requireRole } from "@/lib/auth";
import { AUSGEGRAUT } from "@/constants/funktionen";
import { NachbereitungsBereich } from "@/components/admin/NachbereitungsBereich";
import { T } from "@/texte/de";

export const metadata = { title: "Nachbereitung" };
export const dynamic = "force-dynamic";

export default async function NachbereitungSeite() {
  await requireRole("ADMIN", "REFERENT");

  if (AUSGEGRAUT.nachbereitung) {
    return (
      <div className="max-w-4xl">
        <h1 className="text-2xl font-semibold tracking-tight">Nachbereitung</h1>
        <p className="mt-4 text-sm text-muted-foreground">{T.allgemein.kommtSpaeter}</p>
      </div>
    );
  }

  return <NachbereitungsBereich />;
}
