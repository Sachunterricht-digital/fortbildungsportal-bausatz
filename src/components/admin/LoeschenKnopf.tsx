"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import { loeschen } from "@/actions/fortbildung";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Löschen mit Rückfrage. Ein Klick daneben darf keinen Datensatz kosten —
 * und im Gegensatz zum Archivieren ist das hier nicht rückholbar.
 */
export function LoeschenKnopf({ id, titel }: { id: string; titel: string }) {
  const [offen, setOffen] = useState(false);

  return (
    <Dialog open={offen} onOpenChange={setOffen}>
      <DialogTrigger
        render={
          <Button variant="destructive" size="sm">
            <Trash2 className="size-3.5" aria-hidden />
            Löschen
          </Button>
        }
      />

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fortbildung löschen?</DialogTitle>
          <DialogDescription>
            „{titel}“ wird endgültig entfernt, samt Schlagwort-, Kompetenz- und
            Referentenzuordnung. Das lässt sich nicht rückgängig machen.
            <br />
            <br />
            Soll der Eintrag nur aus dem Frontend verschwinden, ist der Status
            „Archiviert“ die bessere Wahl.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Abbrechen</Button>} />
          <form action={loeschen.bind(null, id)}>
            <Button type="submit" variant="destructive">
              Endgültig löschen
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
