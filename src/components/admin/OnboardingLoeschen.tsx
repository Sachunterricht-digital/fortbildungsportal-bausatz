"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

import { loescheOnboardingAngaben } from "@/actions/onboardingAdmin";
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

/** „Angaben löschen“ mit Rückfrage. Nicht rückholbar, deshalb ein eigener Dialog. */
export function OnboardingLoeschen({ referentId, name }: { referentId: string; name: string }) {
  const [offen, setOffen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();

  function loesche() {
    starte(async () => {
      const ergebnis = await loescheOnboardingAngaben(referentId);
      if (ergebnis.fehler) {
        setFehler(ergebnis.fehler._ ?? "Die Angaben konnten nicht gelöscht werden.");
        return;
      }
      setFehler(null);
      setOffen(false);
    });
  }

  return (
    <Dialog open={offen} onOpenChange={setOffen}>
      <DialogTrigger
        render={
          <Button variant="destructive" size="sm" aria-label={`Angaben von ${name} löschen`}>
            <Trash2 className="size-3.5" aria-hidden />
            Angaben löschen
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Angaben löschen?</DialogTitle>
          <DialogDescription>
            Kontaktwege, Zeiten und Bemerkung von {name} werden endgültig entfernt. Das lässt sich
            nicht rückgängig machen. Die Person, ihr Telefon im Profil und ihre Umfrageantworten
            bleiben bestehen.
          </DialogDescription>
        </DialogHeader>
        {fehler ? (
          <p role="alert" className="text-sm text-destructive">
            {fehler}
          </p>
        ) : null}
        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Abbrechen</Button>} />
          <Button type="button" variant="destructive" disabled={laeuft} onClick={loesche}>
            Endgültig löschen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
