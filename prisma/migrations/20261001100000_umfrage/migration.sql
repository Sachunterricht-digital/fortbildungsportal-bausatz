-- CreateTable
CREATE TABLE "Umfrage" (
    "id" TEXT NOT NULL,
    "titel" TEXT NOT NULL,
    "beschreibung" TEXT,
    "ort" TEXT,
    "uhrzeit" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OFFEN',
    "festgelegterTerminId" TEXT,
    "erstelltVonId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Umfrage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UmfrageTermin" (
    "id" TEXT NOT NULL,
    "umfrageId" TEXT NOT NULL,
    "datum" DATE NOT NULL,
    "reihenfolge" INTEGER NOT NULL,

    CONSTRAINT "UmfrageTermin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UmfrageTeilnehmer" (
    "id" TEXT NOT NULL,
    "umfrageId" TEXT NOT NULL,
    "referentId" TEXT NOT NULL,
    "eingeladenAm" TIMESTAMPTZ(3),
    "erinnertAm" TIMESTAMPTZ(3),
    "geantwortetAm" TIMESTAMPTZ(3),
    "kommentar" VARCHAR(300),

    CONSTRAINT "UmfrageTeilnehmer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UmfrageAntwort" (
    "id" TEXT NOT NULL,
    "teilnehmerId" TEXT NOT NULL,
    "terminId" TEXT NOT NULL,
    "wert" TEXT NOT NULL,

    CONSTRAINT "UmfrageAntwort_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Umfrage_status_idx" ON "Umfrage"("status");

-- CreateIndex
CREATE INDEX "UmfrageTermin_umfrageId_reihenfolge_idx" ON "UmfrageTermin"("umfrageId", "reihenfolge");

-- CreateIndex
CREATE INDEX "UmfrageTeilnehmer_referentId_idx" ON "UmfrageTeilnehmer"("referentId");

-- CreateIndex
CREATE UNIQUE INDEX "UmfrageTeilnehmer_umfrageId_referentId_key" ON "UmfrageTeilnehmer"("umfrageId", "referentId");

-- CreateIndex
CREATE INDEX "UmfrageAntwort_terminId_idx" ON "UmfrageAntwort"("terminId");

-- CreateIndex
CREATE UNIQUE INDEX "UmfrageAntwort_teilnehmerId_terminId_key" ON "UmfrageAntwort"("teilnehmerId", "terminId");

-- AddForeignKey
ALTER TABLE "Umfrage" ADD CONSTRAINT "Umfrage_erstelltVonId_fkey" FOREIGN KEY ("erstelltVonId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Umfrage" ADD CONSTRAINT "Umfrage_festgelegterTerminId_fkey" FOREIGN KEY ("festgelegterTerminId") REFERENCES "UmfrageTermin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UmfrageTermin" ADD CONSTRAINT "UmfrageTermin_umfrageId_fkey" FOREIGN KEY ("umfrageId") REFERENCES "Umfrage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UmfrageTeilnehmer" ADD CONSTRAINT "UmfrageTeilnehmer_umfrageId_fkey" FOREIGN KEY ("umfrageId") REFERENCES "Umfrage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UmfrageTeilnehmer" ADD CONSTRAINT "UmfrageTeilnehmer_referentId_fkey" FOREIGN KEY ("referentId") REFERENCES "Referent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UmfrageAntwort" ADD CONSTRAINT "UmfrageAntwort_teilnehmerId_fkey" FOREIGN KEY ("teilnehmerId") REFERENCES "UmfrageTeilnehmer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UmfrageAntwort" ADD CONSTRAINT "UmfrageAntwort_terminId_fkey" FOREIGN KEY ("terminId") REFERENCES "UmfrageTermin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

