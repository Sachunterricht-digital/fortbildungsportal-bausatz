-- CreateTable
CREATE TABLE "ReferentenRegistrierungslink" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "nutzungen" INTEGER NOT NULL DEFAULT 0,
    "maxNutzungen" INTEGER NOT NULL DEFAULT 25,
    "letzteNutzungAm" TIMESTAMPTZ(3),
    "erstelltVonId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferentenRegistrierungslink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReferentenRegistrierungslink_tokenHash_key" ON "ReferentenRegistrierungslink"("tokenHash");

-- CreateIndex
CREATE INDEX "ReferentenRegistrierungslink_expiresAt_idx" ON "ReferentenRegistrierungslink"("expiresAt");

-- CreateIndex
CREATE INDEX "ReferentenRegistrierungslink_aktiv_expiresAt_idx" ON "ReferentenRegistrierungslink"("aktiv", "expiresAt");

-- CreateIndex
CREATE INDEX "ReferentenRegistrierungslink_erstelltVonId_idx" ON "ReferentenRegistrierungslink"("erstelltVonId");

-- AddForeignKey
ALTER TABLE "ReferentenRegistrierungslink" ADD CONSTRAINT "ReferentenRegistrierungslink_erstelltVonId_fkey" FOREIGN KEY ("erstelltVonId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
