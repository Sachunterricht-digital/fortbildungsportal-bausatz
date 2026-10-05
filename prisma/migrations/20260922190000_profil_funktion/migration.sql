-- Profil im Digiteam: Funktion (Referent oder Fachfunktion) und Kurztext.
ALTER TABLE "Referent"
  ADD COLUMN "funktion" TEXT NOT NULL DEFAULT 'REFERENT',
  ADD COLUMN "kurzprofil" TEXT;
