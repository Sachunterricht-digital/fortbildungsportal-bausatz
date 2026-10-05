-- FIBS verwendet für DigCompEdu Bavaria drei zusammengefasste Niveaustufen:
-- I/II, III/IV und V/VI. Bestehende Einzelwerte werden verlustfrei der
-- gemeinsamen mittleren Gruppe zugeordnet.
UPDATE "Fortbildung"
SET "niveaustufe" = 'NIVEAU_III_IV'
WHERE "niveaustufe" IN ('NIVEAU_III', 'NIVEAU_IV');
