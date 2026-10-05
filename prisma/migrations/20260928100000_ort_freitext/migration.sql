-- Ort als Freitext statt feste Ortsliste. Grund: Bei SchiLf vereinbaren Schule
-- und Referent den Ort individuell, bei RLFB ist FIBS maßgeblich, der Katalog
-- ans Schulamt ist ohnehin Text. "veranstaltungsortId" und das Modell
-- "Veranstaltungsort" bleiben bestehen (FIBS-Import und Archiv unberührt).
ALTER TABLE "Fortbildung" ADD COLUMN "ortText" TEXT;

-- Bestehende Zuordnungen als Text übernehmen: Name des Veranstaltungsorts,
-- bei abweichender Ortschaft mit ", {ort}" ergänzt, bei Online-Orten "online".
UPDATE "Fortbildung" f
SET "ortText" = CASE
  WHEN v."istOnline" THEN 'online'
  WHEN v."ort" IS NOT NULL AND position(v."ort" IN v."name") = 0
    THEN v."name" || ', ' || v."ort"
  ELSE v."name"
END
FROM "Veranstaltungsort" v
WHERE f."veranstaltungsortId" = v."id";
