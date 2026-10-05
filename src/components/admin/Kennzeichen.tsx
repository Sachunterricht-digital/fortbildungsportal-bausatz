import { CheckCircle2, CircleDashed, Clock, FileEdit, Globe2, XCircle } from "lucide-react";

import { statusLabel } from "@/constants/fortbildung";
import { cn } from "@/lib/utils";

/**
 * Die beiden Kennzeichen, an denen im Redaktionsbereich alles hängt:
 * Wo steht die Fortbildung im Freigabeprozess, und ist sie in FIBS?
 *
 * Bewusst als eigene Bausteine, damit sie in Tabelle, Detailseite und
 * Freigabe-Warteschlange identisch aussehen.
 */

const STATUS_STIL: Record<
  string,
  { klasse: string; icon: React.ComponentType<{ className?: string }> }
> = {
  ENTWURF: { klasse: "bg-muted text-muted-foreground", icon: FileEdit },
  EINGEREICHT: { klasse: "bg-ferien/15 text-foreground", icon: Clock },
  VEROEFFENTLICHT: { klasse: "bg-primary/10 text-primary", icon: CheckCircle2 },
  ABGESAGT: { klasse: "bg-destructive/10 text-destructive", icon: XCircle },
  ARCHIVIERT: { klasse: "bg-muted text-muted-foreground", icon: CircleDashed },
};

export function StatusKennzeichen({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const stil = STATUS_STIL[status] ?? STATUS_STIL.ENTWURF!;
  const Icon = stil.icon;

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium leading-snug break-words",
        stil.klasse,
        className,
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      {statusLabel(status)}
    </span>
  );
}

/**
 * FIBS-Kennzeichen.
 *
 * Zeigt in beide Richtungen an. Bei RLFB/ALP ist ein fehlender Eintrag eine
 * auffällige offene Aufgabe; bei SchiLf dagegen der neutrale Normalfall bis
 * zum nachträglichen Vermerk in der Nachbereitung.
 */
export function FibsKennzeichen({
  inFibs,
  lehrgangsnummer,
  organisationsform,
  className,
  ausfuehrlich = false,
}: {
  inFibs: boolean;
  lehrgangsnummer?: string | null;
  organisationsform?: string | null;
  className?: string;
  ausfuehrlich?: boolean;
}) {
  const istSchilf = organisationsform === "SCHILF";
  const istSchilfNachtrag = !inFibs && istSchilf;

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium leading-snug break-words",
        inFibs
          ? "bg-primary/10 text-primary"
          : istSchilfNachtrag
            ? "border border-border bg-muted text-muted-foreground"
            : "bg-ferien/15 text-foreground",
        className,
      )}
      title={
        inFibs
          ? istSchilf
            ? lehrgangsnummer
              ? `In FIBS erfasst, Lehrgangsnummer ${lehrgangsnummer}`
              : "In FIBS erfasst"
            : lehrgangsnummer
              ? `In FIBS ausgeschrieben, Lehrgangsnummer ${lehrgangsnummer}`
              : "In FIBS ausgeschrieben"
          : istSchilfNachtrag
            ? "SchiLf wird üblicherweise erst nach dem Termin in FIBS vermerkt"
            : "Noch nicht in FIBS ausgeschrieben"
      }
    >
      <Globe2 className="size-3 shrink-0" aria-hidden />
      {inFibs
        ? istSchilf
          ? "in FIBS erfasst"
          : "in FIBS"
        : istSchilfNachtrag
          ? "FIBS-Nachtrag nach Termin"
          : "nicht in FIBS"}
      {ausfuehrlich && inFibs && lehrgangsnummer ? (
        <span className="zahl min-w-0 break-all font-normal opacity-85">· {lehrgangsnummer}</span>
      ) : null}
    </span>
  );
}
