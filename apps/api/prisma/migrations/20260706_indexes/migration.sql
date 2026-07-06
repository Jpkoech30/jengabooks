-- Add indexes on updatedAt columns for sync queries
-- These improve performance of sync queries that filter by updatedAt

CREATE INDEX IF NOT EXISTS "journal_entries_updated_at_idx" ON "journal_entries" ("updatedAt");
CREATE INDEX IF NOT EXISTS "chart_of_accounts_updated_at_idx" ON "chart_of_accounts" ("updatedAt");
CREATE INDEX IF NOT EXISTS "invoices_updated_at_idx" ON "invoices" ("updatedAt");
CREATE INDEX IF NOT EXISTS "mpesa_transactions_updated_at_idx" ON "mpesa_transactions" ("updatedAt");
CREATE INDEX IF NOT EXISTS "bank_transactions_updated_at_idx" ON "bank_transactions" ("updatedAt");
CREATE INDEX IF NOT EXISTS "pending_reviews_updated_at_idx" ON "pending_reviews" ("updatedAt");
CREATE INDEX IF NOT EXISTS "companies_updated_at_idx" ON "companies" ("updatedAt");
CREATE INDEX IF NOT EXISTS "users_updated_at_idx" ON "users" ("updatedAt");
CREATE INDEX IF NOT EXISTS "fiscal_periods_updated_at_idx" ON "fiscal_periods" ("updatedAt");

-- Also add index on entryDate for common report queries
CREATE INDEX IF NOT EXISTS "journal_entries_entry_date_idx" ON "journal_entries" ("entryDate");

-- Create wizard_progress table (missing from init migration)
CREATE TABLE IF NOT EXISTS "wizard_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "xpAwarded" INTEGER NOT NULL DEFAULT 0,
    "badgeAwarded" TEXT,

    CONSTRAINT "wizard_progress_pkey" PRIMARY KEY ("id")
);

-- Create audit_logs table (missing from init migration)
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- Add unique constraint for wizard_progress
CREATE UNIQUE INDEX IF NOT EXISTS "wizard_progress_userId_companyId_step_key" ON "wizard_progress"("userId", "companyId", "step");

-- Add foreign keys for wizard_progress
ALTER TABLE "wizard_progress" ADD CONSTRAINT "wizard_progress_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS "audit_logs_company_id_idx" ON "audit_logs" ("companyId", "createdAt");
CREATE INDEX IF NOT EXISTS "audit_logs_entity_idx" ON "audit_logs" ("entityType", "entityId");
