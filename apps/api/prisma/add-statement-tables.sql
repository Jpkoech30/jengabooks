-- Create statement_uploads table
CREATE TABLE IF NOT EXISTS "statement_uploads" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "institution" TEXT NOT NULL DEFAULT 'OTHER',
    "detectedBy" TEXT NOT NULL DEFAULT 'AUTO',
    "statementPeriodStart" TIMESTAMP(3),
    "statementPeriodEnd" TIMESTAMP(3),
    "accountNumber" TEXT,
    "openingBalance" DOUBLE PRECISION,
    "closingBalance" DOUBLE PRECISION,
    "totalMoneyIn" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalMoneyOut" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING_PARSING',
    "transactionCount" INTEGER DEFAULT 0,
    "parsedData" JSONB,
    "errorMessage" TEXT,
    "templateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    CONSTRAINT "statement_uploads_pkey" PRIMARY KEY ("id")
);

-- Create parsing_templates table
CREATE TABLE IF NOT EXISTS "parsing_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "fileFormat" TEXT NOT NULL,
    "columnMapping" JSONB NOT NULL DEFAULT '{}',
    "headerSignature" TEXT,
    "regexPatterns" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "parsing_templates_pkey" PRIMARY KEY ("id")
);

-- Add indexes
CREATE INDEX IF NOT EXISTS "statement_uploads_tenant_id_status_idx" ON "statement_uploads" ("tenantId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "parsing_templates_tenant_id_institution_idx" ON "parsing_templates" ("tenantId", "institution");

-- Add foreign keys (only if they don't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'statement_uploads_tenantId_fkey') THEN
        ALTER TABLE "statement_uploads" ADD CONSTRAINT "statement_uploads_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'statement_uploads_uploadedBy_fkey') THEN
        ALTER TABLE "statement_uploads" ADD CONSTRAINT "statement_uploads_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'statement_uploads_templateId_fkey') THEN
        ALTER TABLE "statement_uploads" ADD CONSTRAINT "statement_uploads_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "parsing_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'parsing_templates_tenantId_fkey') THEN
        ALTER TABLE "parsing_templates" ADD CONSTRAINT "parsing_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
