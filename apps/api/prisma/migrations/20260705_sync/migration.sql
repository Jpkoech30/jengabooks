-- AlterTable: Add missing columns to pending_reviews
ALTER TABLE "pending_reviews" ADD COLUMN IF NOT EXISTS "linkedEntityId" TEXT;
ALTER TABLE "pending_reviews" ADD COLUMN IF NOT EXISTS "linkedEntityType" TEXT;
ALTER TABLE "pending_reviews" ADD COLUMN IF NOT EXISTS "confidence" DOUBLE PRECISION;
ALTER TABLE "pending_reviews" ADD COLUMN IF NOT EXISTS "resolutionAction" TEXT;
