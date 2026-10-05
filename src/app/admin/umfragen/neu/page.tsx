import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { requireRole } from "@/lib/auth";
import { UmfrageForm } from "@/components/umfrage/UmfrageForm";
import { ladeEmpfaengerOptionen, vorausgewaehlt } from "@/lib/umfrageAdmin";
import { T } from "@/texte/de";

export const metadata = { title: T.umfrage.form.titelNeu };

export default async function NeueUmfrage() {
  await requireRole("ADMIN");
  const personen = await ladeEmpfaengerOptionen();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/umfragen" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" aria-hidden />
          {T.umfrage.form.zurueck}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{T.umfrage.form.titelNeu}</h1>
      </div>
      <UmfrageForm
        umfrageId={null}
        personen={personen}
        start={{
          titel: "",
          beschreibung: "",
          ort: "",
          uhrzeit: "",
          termine: [""],
          empfaenger: vorausgewaehlt(personen),
          bestehend: [],
        }}
      />
    </div>
  );
}
