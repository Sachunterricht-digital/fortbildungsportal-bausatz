-- Ein Kalendertag darf in einer Umfrage nur einmal vorkommen.
-- Vorher prüfen (muss leer sein):
--   SELECT "umfrageId", "datum", count(*) FROM "UmfrageTermin" GROUP BY 1, 2 HAVING count(*) > 1;

-- CreateIndex
CREATE UNIQUE INDEX "UmfrageTermin_umfrageId_datum_key" ON "UmfrageTermin"("umfrageId", "datum");
