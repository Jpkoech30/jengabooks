-- Add taxRate column to chart_of_accounts for VAT rate mapping
-- 16 = standard, 8 = reduced, 0 = zero-rated, null = exempt

ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS tax_rate DOUBLE PRECISION;
