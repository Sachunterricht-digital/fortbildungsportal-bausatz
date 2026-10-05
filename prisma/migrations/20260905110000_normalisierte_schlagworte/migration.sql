-- Ein sichtbares Schlagwort behält seine gewählte Schreibweise. Der separate
-- Schlüssel verhindert aber globale Dubletten wie „Digital" und „digital".
--
-- `lower()` ist hier absichtlich nicht verwendet: Das Ergebnis hängt von der
-- PostgreSQL-Collation ab und kann bei Ä/Ö/Ü/ẞ von JavaScript abweichen. Die
-- exakt gleiche ASCII-/Deutsch-Faltung steht in src/lib/schlagwort.ts.
ALTER TABLE "Schlagwort" ADD COLUMN "normalisiert" TEXT;

UPDATE "Schlagwort"
SET "normalisiert" = translate(
  btrim(regexp_replace(replace("name", chr(160), ' '), E'[\\t\\n\\v\\f\\r ]+', ' ', 'g')),
  'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜẞ',
  'abcdefghijklmnopqrstuvwxyzäöüß'
);

-- Ältere Daten können sich nur in Schreibweise oder Leerzeichen
-- unterscheiden. Zuerst zeigen alle Verknüpfungen auf einen kanonischen
-- Datensatz. INSERT ... ON CONFLICT verhindert dabei Konflikte im
-- zusammengesetzten Primärschlüssel (fortbildungId, schlagwortId).
CREATE TEMP TABLE "_SchlagwortDubletten" AS
SELECT
  "id" AS "doppeltId",
  first_value("id") OVER (
    PARTITION BY "normalisiert"
    ORDER BY "istPflicht" DESC, "fuerFibsImport" DESC, "createdAt", "id"
  ) AS "kanonischId"
FROM "Schlagwort";

INSERT INTO "FortbildungSchlagwort" ("fortbildungId", "schlagwortId")
SELECT DISTINCT verknuepfung."fortbildungId", dublette."kanonischId"
FROM "FortbildungSchlagwort" AS verknuepfung
JOIN "_SchlagwortDubletten" AS dublette
  ON dublette."doppeltId" = verknuepfung."schlagwortId"
ON CONFLICT ("fortbildungId", "schlagwortId") DO NOTHING;

DELETE FROM "FortbildungSchlagwort" AS verknuepfung
USING "_SchlagwortDubletten" AS dublette
WHERE verknuepfung."schlagwortId" = dublette."doppeltId"
  AND dublette."doppeltId" <> dublette."kanonischId";

-- Kein Flag geht beim Zusammenführen verloren: Der kanonische Eintrag wird
-- Pflicht- bzw. FIBS-Suchbegriff, wenn es irgendeine Variante bereits war.
WITH flaggen AS (
  SELECT
    dublette."kanonischId",
    bool_or(schlagwort."istPflicht") AS "istPflicht",
    bool_or(schlagwort."fuerFibsImport") AS "fuerFibsImport"
  FROM "_SchlagwortDubletten" AS dublette
  JOIN "Schlagwort" AS schlagwort ON schlagwort."id" = dublette."doppeltId"
  GROUP BY dublette."kanonischId"
)
UPDATE "Schlagwort" AS schlagwort
SET
  "istPflicht" = flaggen."istPflicht",
  "fuerFibsImport" = flaggen."fuerFibsImport"
FROM flaggen
WHERE schlagwort."id" = flaggen."kanonischId";

DELETE FROM "Schlagwort" AS schlagwort
USING "_SchlagwortDubletten" AS dublette
WHERE schlagwort."id" = dublette."doppeltId"
  AND dublette."doppeltId" <> dublette."kanonischId";

DROP TABLE "_SchlagwortDubletten";

ALTER TABLE "Schlagwort" ALTER COLUMN "normalisiert" SET NOT NULL;

CREATE UNIQUE INDEX "Schlagwort_normalisiert_key" ON "Schlagwort"("normalisiert");
