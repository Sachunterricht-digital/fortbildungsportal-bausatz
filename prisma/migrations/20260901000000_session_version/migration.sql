-- Bestehende Sitzungen können nach einem Passwortwechsel gezielt entwertet
-- werden, ohne dafür eine separate Session-Tabelle zu brauchen.
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
