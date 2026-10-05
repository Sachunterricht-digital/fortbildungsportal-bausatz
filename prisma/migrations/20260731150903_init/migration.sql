-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fortbildung" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titel" TEXT NOT NULL,
    "kurztitel" TEXT,
    "beschreibungHtml" TEXT NOT NULL,
    "beschreibungText" TEXT NOT NULL,
    "organisationsform" TEXT NOT NULL,
    "maxTn" INTEGER NOT NULL,
    "format" TEXT NOT NULL,
    "beginn" TIMESTAMP(3) NOT NULL,
    "ende" TIMESTAMP(3) NOT NULL,
    "veranstaltungsortId" TEXT NOT NULL,
    "schularten" TEXT[],
    "fach" TEXT,
    "niveaustufe" TEXT,
    "fibsLehrgangsnummer" TEXT,
    "fibsUrl" TEXT,
    "quelle" TEXT NOT NULL DEFAULT 'MANUELL',
    "externalId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ENTWURF',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fortbildung_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Veranstaltungsort" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ort" TEXT,
    "strasse" TEXT,
    "schulnummer" TEXT,
    "istOnline" BOOLEAN NOT NULL DEFAULT false,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Veranstaltungsort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Schlagwort" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "istPflicht" BOOLEAN NOT NULL DEFAULT false,
    "fuerFibsImport" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Schlagwort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FortbildungSchlagwort" (
    "fortbildungId" TEXT NOT NULL,
    "schlagwortId" TEXT NOT NULL,

    CONSTRAINT "FortbildungSchlagwort_pkey" PRIMARY KEY ("fortbildungId","schlagwortId")
);

-- CreateTable
CREATE TABLE "DigCompKompetenz" (
    "code" TEXT NOT NULL,
    "parentCode" TEXT,
    "titel" TEXT NOT NULL,
    "beschreibung" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "istPlatzhalter" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DigCompKompetenz_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "FortbildungKompetenz" (
    "fortbildungId" TEXT NOT NULL,
    "kompetenzCode" TEXT NOT NULL,

    CONSTRAINT "FortbildungKompetenz_pkey" PRIMARY KEY ("fortbildungId","kompetenzCode")
);

-- CreateTable
CREATE TABLE "Referent" (
    "id" TEXT NOT NULL,
    "vorname" TEXT NOT NULL,
    "nachname" TEXT NOT NULL,
    "organisation" TEXT,
    "email" TEXT,
    "telefon" TEXT,
    "notiz" TEXT,
    "oeffentlichSichtbar" BOOLEAN NOT NULL DEFAULT true,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Referent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FortbildungReferent" (
    "fortbildungId" TEXT NOT NULL,
    "referentId" TEXT NOT NULL,
    "rolle" TEXT,

    CONSTRAINT "FortbildungReferent_pkey" PRIMARY KEY ("fortbildungId","referentId")
);

-- CreateTable
CREATE TABLE "FibsImportJob" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'LAEUFT',
    "dryRun" BOOLEAN NOT NULL DEFAULT true,
    "suchbegriffe" TEXT[],
    "gefunden" INTEGER NOT NULL DEFAULT 0,
    "neu" INTEGER NOT NULL DEFAULT 0,
    "aktualisiert" INTEGER NOT NULL DEFAULT 0,
    "uebersprungen" INTEGER NOT NULL DEFAULT 0,
    "fehlermeldung" TEXT,
    "rohdaten" JSONB,

    CONSTRAINT "FibsImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "aktion" TEXT NOT NULL,
    "entitaet" TEXT NOT NULL,
    "entitaetId" TEXT,
    "details" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Fortbildung_slug_key" ON "Fortbildung"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Fortbildung_externalId_key" ON "Fortbildung"("externalId");

-- CreateIndex
CREATE INDEX "Fortbildung_beginn_idx" ON "Fortbildung"("beginn");

-- CreateIndex
CREATE INDEX "Fortbildung_status_beginn_idx" ON "Fortbildung"("status", "beginn");

-- CreateIndex
CREATE INDEX "Fortbildung_organisationsform_idx" ON "Fortbildung"("organisationsform");

-- CreateIndex
CREATE INDEX "Fortbildung_veranstaltungsortId_idx" ON "Fortbildung"("veranstaltungsortId");

-- CreateIndex
CREATE INDEX "Fortbildung_schularten_idx" ON "Fortbildung" USING GIN ("schularten");

-- CreateIndex
CREATE UNIQUE INDEX "Veranstaltungsort_name_ort_key" ON "Veranstaltungsort"("name", "ort");

-- CreateIndex
CREATE UNIQUE INDEX "Schlagwort_name_key" ON "Schlagwort"("name");

-- CreateIndex
CREATE INDEX "FortbildungSchlagwort_schlagwortId_idx" ON "FortbildungSchlagwort"("schlagwortId");

-- CreateIndex
CREATE INDEX "DigCompKompetenz_parentCode_sortOrder_idx" ON "DigCompKompetenz"("parentCode", "sortOrder");

-- CreateIndex
CREATE INDEX "FortbildungKompetenz_kompetenzCode_idx" ON "FortbildungKompetenz"("kompetenzCode");

-- CreateIndex
CREATE INDEX "Referent_nachname_vorname_idx" ON "Referent"("nachname", "vorname");

-- CreateIndex
CREATE INDEX "FortbildungReferent_referentId_idx" ON "FortbildungReferent"("referentId");

-- CreateIndex
CREATE INDEX "FibsImportJob_startedAt_idx" ON "FibsImportJob"("startedAt");

-- CreateIndex
CREATE INDEX "AuditLog_at_idx" ON "AuditLog"("at");

-- CreateIndex
CREATE INDEX "AuditLog_entitaet_entitaetId_idx" ON "AuditLog"("entitaet", "entitaetId");

-- AddForeignKey
ALTER TABLE "Fortbildung" ADD CONSTRAINT "Fortbildung_veranstaltungsortId_fkey" FOREIGN KEY ("veranstaltungsortId") REFERENCES "Veranstaltungsort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fortbildung" ADD CONSTRAINT "Fortbildung_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FortbildungSchlagwort" ADD CONSTRAINT "FortbildungSchlagwort_fortbildungId_fkey" FOREIGN KEY ("fortbildungId") REFERENCES "Fortbildung"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FortbildungSchlagwort" ADD CONSTRAINT "FortbildungSchlagwort_schlagwortId_fkey" FOREIGN KEY ("schlagwortId") REFERENCES "Schlagwort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigCompKompetenz" ADD CONSTRAINT "DigCompKompetenz_parentCode_fkey" FOREIGN KEY ("parentCode") REFERENCES "DigCompKompetenz"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FortbildungKompetenz" ADD CONSTRAINT "FortbildungKompetenz_fortbildungId_fkey" FOREIGN KEY ("fortbildungId") REFERENCES "Fortbildung"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FortbildungKompetenz" ADD CONSTRAINT "FortbildungKompetenz_kompetenzCode_fkey" FOREIGN KEY ("kompetenzCode") REFERENCES "DigCompKompetenz"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FortbildungReferent" ADD CONSTRAINT "FortbildungReferent_fortbildungId_fkey" FOREIGN KEY ("fortbildungId") REFERENCES "Fortbildung"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FortbildungReferent" ADD CONSTRAINT "FortbildungReferent_referentId_fkey" FOREIGN KEY ("referentId") REFERENCES "Referent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
