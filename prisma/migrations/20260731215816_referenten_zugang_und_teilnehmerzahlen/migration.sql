-- AlterTable
ALTER TABLE "Fortbildung" ADD COLUMN     "tnBemerkung" TEXT,
ADD COLUMN     "tnGemeldetAm" TIMESTAMP(3),
ADD COLUMN     "tnGemeldetVonId" TEXT,
ADD COLUMN     "tnTatsaechlich" INTEGER;

-- AlterTable
ALTER TABLE "Referent" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Zugangstoken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "zweck" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Zugangstoken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Zugangstoken_tokenHash_key" ON "Zugangstoken"("tokenHash");

-- CreateIndex
CREATE INDEX "Zugangstoken_userId_idx" ON "Zugangstoken"("userId");

-- CreateIndex
CREATE INDEX "Zugangstoken_expiresAt_idx" ON "Zugangstoken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Referent_userId_key" ON "Referent"("userId");

-- AddForeignKey
ALTER TABLE "Zugangstoken" ADD CONSTRAINT "Zugangstoken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fortbildung" ADD CONSTRAINT "Fortbildung_tnGemeldetVonId_fkey" FOREIGN KEY ("tnGemeldetVonId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referent" ADD CONSTRAINT "Referent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

