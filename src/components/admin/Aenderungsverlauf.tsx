import { prisma } from "@/lib/prisma";
import { formatDatumZeit } from "@/lib/datetime";
import { statusLabel } from "@/constants/fortbildung";

/**
 * Änderungsverlauf einer Fortbildung.
 *
 * Das Protokoll wird ohnehin für die Rechenschaftspflicht geschrieben
 * (Art. 5 Abs. 2 DSGVO). Es hier zu zeigen kostet nichts und beantwortet die
 * Frage, die im Freigabeprozess ständig aufkommt: Wer hat wann was gemacht?
 */
export async function Aenderungsverlauf({ id }: { id: string }) {
  const eintraege = await prisma.auditLog.findMany({
    where: { entitaet: { in: ["Fortbildung", "Aushang"] }, entitaetId: id },
    orderBy: { at: "desc" },
    take: 30,
    include: { user: { select: { name: true, email: true } } },
  });

  if (eintraege.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Noch keine Änderungen protokolliert.
      </p>
    );
  }

  return (
    <ol className="space-y-0">
      {eintraege.map((eintrag, i) => (
        <li key={eintrag.id} className="flex gap-3">
          {/* Zeitstrahl: Punkt plus Linie, außer beim letzten Eintrag */}
          <div className="flex flex-col items-center pt-1.5">
            <span className="size-2 shrink-0 bg-primary/40" aria-hidden />
            {i < eintraege.length - 1 ? (
              <span className="w-px flex-1 bg-border" aria-hidden />
            ) : null}
          </div>

          <div className="pb-4">
            <p className="text-sm">{beschreibe(eintrag)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground zahl">
              {formatDatumZeit(eintrag.at)}
              {eintrag.user
                ? ` · ${eintrag.user.name ?? eintrag.user.email}`
                : " · System"}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

interface Protokolleintrag {
  aktion: string;
  entitaet: string;
  details: unknown;
}

/**
 * Übersetzt einen Protokolleintrag in einen lesbaren Satz.
 *
 * Die Details sind bewusst schlank protokolliert (siehe src/lib/audit.ts),
 * deshalb wird hier aus wenigen Merkmalen der passende Satz gebildet statt
 * ein Feld-für-Feld-Vergleich angezeigt.
 */
function beschreibe(eintrag: Protokolleintrag): string {
  const details = (eintrag.details ?? {}) as Record<string, unknown>;

  if (eintrag.entitaet === "Aushang") return "Aushang als PDF erzeugt";

  if (eintrag.aktion === "CREATE") {
    return details.kopieVon ? "Als Kopie angelegt" : "Angelegt";
  }
  if (eintrag.aktion === "DELETE") return "Gelöscht";

  if (details.freigegeben) return "Freigegeben und veröffentlicht";
  if (details.zurueckgewiesen) return "Zur Überarbeitung zurückgewiesen";
  if (details.inFibs === true) return "Als in FIBS eingetragen markiert";
  if (details.inFibs === false) return "FIBS-Markierung zurückgenommen";
  if (details.tnMeldungZurueckgenommen) return "Teilnehmermeldung zurückgenommen";
  if (typeof details.tnTatsaechlich === "number") {
    return `Teilnehmerzahl gemeldet: ${details.tnTatsaechlich}`;
  }
  if (details.teilnahmebestaetigung === "REFERENTEN") {
    return details.versandt
      ? "Teilnahmebestätigungen an Referent:innen in FIBS bestätigt"
      : "Versandbestätigung an Referent:innen zurückgenommen";
  }
  if (details.teilnahmebestaetigung === "TEILNEHMENDE") {
    return details.versandt
      ? "Teilnahmebestätigungen an Teilnehmende in FIBS bestätigt"
      : "Versandbestätigung an Teilnehmende zurückgenommen";
  }
  if (typeof details.status === "string") {
    return `Bearbeitet, Status: ${statusLabel(details.status)}`;
  }

  return "Bearbeitet";
}
