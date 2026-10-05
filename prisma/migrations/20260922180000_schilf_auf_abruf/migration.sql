-- SchiLf auf Abruf und Video-Tutorials haben keinen festen Termin, keinen Ort
-- und keine Teilnehmerhöchstzahl. Die Pflicht prüft die Anwendung je nach
-- Organisationsform und Format (src/lib/validation/fortbildung.ts).
ALTER TABLE "Fortbildung"
  ALTER COLUMN "beginn" DROP NOT NULL,
  ALTER COLUMN "ende" DROP NOT NULL,
  ALTER COLUMN "veranstaltungsortId" DROP NOT NULL,
  ALTER COLUMN "maxTn" DROP NOT NULL;
