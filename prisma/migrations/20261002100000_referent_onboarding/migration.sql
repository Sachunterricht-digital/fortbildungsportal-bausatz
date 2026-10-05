-- CreateTable
CREATE TABLE "ReferentOnboarding" (
    "referentId" TEXT NOT NULL,
    "kontaktwege" TEXT[],
    "weitereFormate" BOOLEAN NOT NULL DEFAULT false,
    "zeiten" TEXT[],
    "bemerkung" VARCHAR(300),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "ReferentOnboarding_pkey" PRIMARY KEY ("referentId")
);

-- CreateIndex
CREATE INDEX "ReferentOnboarding_weitereFormate_idx" ON "ReferentOnboarding"("weitereFormate");

-- AddForeignKey
ALTER TABLE "ReferentOnboarding" ADD CONSTRAINT "ReferentOnboarding_referentId_fkey" FOREIGN KEY ("referentId") REFERENCES "Referent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
