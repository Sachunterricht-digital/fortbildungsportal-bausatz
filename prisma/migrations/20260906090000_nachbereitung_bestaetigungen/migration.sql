-- Die Anwendung speichert keine Teilnehmerlisten oder FIBS-Nachrichten.
-- Sie protokolliert ausschließlich, dass die Administration die beiden
-- Versandvorgänge erledigt hat, inklusive Zeitpunkt und verantwortlichem Konto.
ALTER TABLE "Fortbildung"
  ADD COLUMN "teilnahmebestaetigungenReferentenVersandtAm" TIMESTAMPTZ(3),
  ADD COLUMN "teilnahmebestaetigungenReferentenVersandtVonId" TEXT,
  ADD COLUMN "teilnahmebestaetigungenTeilnehmendeVersandtAm" TIMESTAMPTZ(3),
  ADD COLUMN "teilnahmebestaetigungenTeilnehmendeVersandtVonId" TEXT;

ALTER TABLE "Fortbildung"
  ADD CONSTRAINT "Fortbildung_teilnahmebestaetigungenReferentenVersandtVonId_fkey"
    FOREIGN KEY ("teilnahmebestaetigungenReferentenVersandtVonId")
    REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Fortbildung_teilnahmebestaetigungenTeilnehmendeVersandtVonId_fkey"
    FOREIGN KEY ("teilnahmebestaetigungenTeilnehmendeVersandtVonId")
    REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Fortbildung_teilnahmebestaetigungenReferentenVersandtAm_idx"
  ON "Fortbildung"("teilnahmebestaetigungenReferentenVersandtAm");

CREATE INDEX "Fortbildung_teilnahmebestaetigungenTeilnehmendeVersandtAm_idx"
  ON "Fortbildung"("teilnahmebestaetigungenTeilnehmendeVersandtAm");
