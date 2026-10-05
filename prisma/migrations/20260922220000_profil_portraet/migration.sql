-- Profilfoto: Zeitpunkt des letzten Uploads, zugleich Cache-Schlüssel.
ALTER TABLE "Referent" ADD COLUMN "portraetAm" TIMESTAMPTZ(3);
