/**
 * Alle sichtbaren Texte der Oberfläche, die Referenten und Öffentlichkeit sehen.
 *
 * Seiten und Komponenten lesen nur von hier (`T.maske…`, `T.zugang…`,
 * `T.aussen…`). Daraus entsteht die Textliste zur Abnahme. Werte-Labels
 * (Formate, Niveaustufen, Status) stehen in `src/constants/fortbildung.ts`.
 * Reine Admin-Bereiche sind bewusst nicht erfasst.
 */
import { allgemein } from "./teile/allgemein";
import { aussen } from "./teile/aussen";
import { frist } from "./teile/frist";
import { mails } from "./teile/mails";
import { maske } from "./teile/maske";
import { onboarding } from "./teile/onboarding";
import { profil } from "./teile/profil";
import { referenten } from "./teile/referenten";
import { umfrage } from "./teile/umfrage";
import { vorstellung } from "./teile/vorstellung";
import { zugang } from "./teile/zugang";

export const T = { allgemein, vorstellung, maske, zugang, profil, frist, aussen, mails, umfrage, onboarding, referenten } as const;
