-- Migration: Add RecurringJournalTemplate and Sync Streak fields
-- Created: 2026-07-13

-- Add sync streak fields to user_levels
ALTER TABLE "user_levels" ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMP;
ALTER TABLE "user_levels" ADD COLUMN IF NOT EXISTS "streak_days" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "user_levels" ADD COLUMN IF NOT EXISTS "longest_streak" INTEGER NOT NULL DEFAULT 0;

-- Create RecurringJournalTemplate table
CREATE TABLE IF NOT EXISTS "recurring_journal_templates" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "frequency" TEXT NOT NULL,
    "entries" JSONB NOT NULL,
    "start_date" TIMESTAMP NOT NULL,
    "end_date" TIMESTAMP,
    "last_run_date" TIMESTAMP,
    "next_run_date" TIMESTAMP,
    "day_of_month" INTEGER,
    "day_of_week" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_journal_templates_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "recurring_journal_templates_company_id_is_active" ON "recurring_journal_templates"("company_id", "is_active");
CREATE INDEX IF NOT EXISTS "recurring_journal_templates_company_id_next_run_date" ON "recurring_journal_templates"("company_id", "next_run_date");
CREATE INDEX IF NOT EXISTS "recurring_journal_templates_next_run_date" ON "recurring_journal_templates"("next_run_date");

-- Add foreign keys
ALTER TABLE "recurring_journal_templates" ADD CONSTRAINT "recurring_journal_templates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recurring_journal_templates" ADD CONSTRAINT "recurring_journal_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
