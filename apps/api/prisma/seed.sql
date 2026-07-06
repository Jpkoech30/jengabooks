-- Seed data for JengaBooks
-- Run: wsl bash -c "docker exec -i jengabooks_postgres psql -U admin -d jengabooks" < apps/api/prisma/seed.sql

-- Create demo company
INSERT INTO companies (id, name, tier, "kraPin", "isActive", "createdAt", "updatedAt")
VALUES ('demo-company-001', 'Demo Accounting Firm', 'GOLD', 'P051234567A', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Create admin user (password: 'password123' hashed with bcrypt)
INSERT INTO users (id, email, password, name, "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-001', 'admin@jengabooks.com', '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQkfAjkMBcGmEG0qGqYR7fMAg.VVqq', 'Admin User', true, NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- Link admin to company as FIRM_OWNER
INSERT INTO company_members (id, "userId", "companyId", role, "isActive")
VALUES ('demo-membership-001', 'demo-user-001', 'demo-company-001', 'FIRM_OWNER', true)
ON CONFLICT ("userId", "companyId") DO NOTHING;

-- Create default chart of accounts
INSERT INTO chart_of_accounts (id, "companyId", code, name, type, "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'demo-company-001', '1000', 'Cash', 'ASSET', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'demo-company-001', '1100', 'Accounts Receivable', 'ASSET', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'demo-company-001', '2000', 'Accounts Payable', 'LIABILITY', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'demo-company-001', '3000', 'Owner Equity', 'EQUITY', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'demo-company-001', '4000', 'Sales Revenue', 'INCOME', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'demo-company-001', '5000', 'Cost of Goods Sold', 'EXPENSE', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'demo-company-001', '6000', 'Operating Expenses', 'EXPENSE', true, NOW(), NOW())
ON CONFLICT ("companyId", code) DO NOTHING;

-- Create default fiscal period (current year)
INSERT INTO fiscal_periods (id, "companyId", name, "startDate", "endDate", status, "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'demo-company-001', 'FY 2026', '2026-01-01 00:00:00+00', '2026-12-31 23:59:59+00', 'OPEN', NOW(), NOW())
ON CONFLICT ("companyId", name) DO NOTHING;

-- Create sample journal entries
DO $$
DECLARE
  cash_acc_id text;
  revenue_acc_id text;
  expense_acc_id text;
BEGIN
  SELECT id INTO cash_acc_id FROM chart_of_accounts WHERE "companyId" = 'demo-company-001' AND code = '1000' LIMIT 1;
  SELECT id INTO revenue_acc_id FROM chart_of_accounts WHERE "companyId" = 'demo-company-001' AND code = '4000' LIMIT 1;
  SELECT id INTO expense_acc_id FROM chart_of_accounts WHERE "companyId" = 'demo-company-001' AND code = '6000' LIMIT 1;

  -- Sample income entry (debit cash, credit revenue)
  INSERT INTO journal_entries (id, "companyId", "accountId", description, amount, direction, reference, "serialNumber", "entryDate", version, "postedById", "createdAt", "updatedAt")
  VALUES (gen_random_uuid()::text, 'demo-company-001', cash_acc_id, 'Consulting fee received', 50000, 'DEBIT', 'INV-001', 'JE-00001', '2026-06-15 00:00:00+00', 1, 'demo-user-001', NOW(), NOW());

  INSERT INTO journal_entries (id, "companyId", "accountId", description, amount, direction, reference, "serialNumber", "entryDate", version, "postedById", "createdAt", "updatedAt")
  VALUES (gen_random_uuid()::text, 'demo-company-001', revenue_acc_id, 'Consulting fee received', 50000, 'CREDIT', 'INV-001', 'JE-00002', '2026-06-15 00:00:00+00', 1, 'demo-user-001', NOW(), NOW());

  -- Sample expense entry (debit expense, credit cash)
  INSERT INTO journal_entries (id, "companyId", "accountId", description, amount, direction, reference, "serialNumber", "entryDate", version, "postedById", "createdAt", "updatedAt")
  VALUES (gen_random_uuid()::text, 'demo-company-001', expense_acc_id, 'Office rent payment', 15000, 'DEBIT', 'RENT-JUN', 'JE-00003', '2026-06-01 00:00:00+00', 1, 'demo-user-001', NOW(), NOW());

  INSERT INTO journal_entries (id, "companyId", "accountId", description, amount, direction, reference, "serialNumber", "entryDate", version, "postedById", "createdAt", "updatedAt")
  VALUES (gen_random_uuid()::text, 'demo-company-001', cash_acc_id, 'Office rent payment', 15000, 'CREDIT', 'RENT-JUN', 'JE-00004', '2026-06-01 00:00:00+00', 1, 'demo-user-001', NOW(), NOW());
END $$;

-- Create initial XP and level
INSERT INTO xp_records (id, "userId", "companyId", points, reason, "createdAt")
VALUES (gen_random_uuid()::text, 'demo-user-001', 'demo-company-001', 100, 'Completed company setup', NOW());

INSERT INTO user_levels (id, "userId", "companyId", level, "totalXp", "updatedAt")
VALUES (gen_random_uuid()::text, 'demo-user-001', 'demo-company-001', 2, 100, NOW())
ON CONFLICT ("userId", "companyId") DO NOTHING;

SELECT 'Seed completed successfully!' AS result;
