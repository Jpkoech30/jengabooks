-- Fix pillarScores column type: text -> jsonb
-- The Prisma schema defines it as Json, but it was stored as text
ALTER TABLE business_health_scores ALTER COLUMN "pillarScores" TYPE JSONB USING "pillarScores"::JSONB;
