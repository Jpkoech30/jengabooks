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
