-- AlterTable
ALTER TABLE "Fortbildung" ADD COLUMN     "eingereichtAm" TIMESTAMP(3),
ADD COLUMN     "fibsEingetragenAm" TIMESTAMP(3),
ADD COLUMN     "fibsEingetragenVonId" TEXT,
ADD COLUMN     "freigabeNotiz" TEXT,
ADD COLUMN     "freigegebenAm" TIMESTAMP(3),
ADD COLUMN     "freigegebenVonId" TEXT,
ADD COLUMN     "inFibs" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "Fortbildung" ADD CONSTRAINT "Fortbildung_freigegebenVonId_fkey" FOREIGN KEY ("freigegebenVonId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fortbildung" ADD CONSTRAINT "Fortbildung_fibsEingetragenVonId_fkey" FOREIGN KEY ("fibsEingetragenVonId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

