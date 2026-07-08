-- Remove RLS policies that were blocking data access
-- The RlsSetterInterceptor uses SET LOCAL which only works within a single transaction,
-- but Prisma auto-commits each query, so the setting is lost between queries.
-- Application-level companyId filtering (already in every service) is sufficient.

DROP POLICY IF EXISTS tenant_isolation ON companies;
DROP POLICY IF EXISTS tenant_isolation ON company_members;
DROP POLICY IF EXISTS tenant_isolation ON chart_of_accounts;
DROP POLICY IF EXISTS tenant_isolation ON journal_entries;
DROP POLICY IF EXISTS tenant_isolation ON fiscal_periods;
DROP POLICY IF EXISTS tenant_isolation ON invoices;
DROP POLICY IF EXISTS tenant_isolation ON etims_submissions;
DROP POLICY IF EXISTS tenant_isolation ON mpesa_transactions;
DROP POLICY IF EXISTS tenant_isolation ON bank_transactions;
DROP POLICY IF EXISTS tenant_isolation ON category_rules;
DROP POLICY IF EXISTS tenant_isolation ON pending_reviews;
DROP POLICY IF EXISTS tenant_isolation ON xp_records;
DROP POLICY IF EXISTS tenant_isolation ON user_levels;
DROP POLICY IF EXISTS tenant_isolation ON business_health_scores;
DROP POLICY IF EXISTS tenant_isolation ON ai_feedback_logs;
DROP POLICY IF EXISTS tenant_isolation ON sync_logs;
DROP POLICY IF EXISTS tenant_isolation ON audit_logs;
DROP POLICY IF EXISTS tenant_isolation ON wizard_progress;
DROP POLICY IF EXISTS tenant_isolation ON statement_uploads;
DROP POLICY IF EXISTS tenant_isolation ON parsing_templates;

ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_periods DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE etims_submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE mpesa_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE category_rules DISABLE ROW LEVEL SECURITY;
ALTER TABLE pending_reviews DISABLE ROW LEVEL SECURITY;
ALTER TABLE xp_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_levels DISABLE ROW LEVEL SECURITY;
ALTER TABLE business_health_scores DISABLE ROW LEVEL SECURITY;
ALTER TABLE ai_feedback_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE wizard_progress DISABLE ROW LEVEL SECURITY;
ALTER TABLE statement_uploads DISABLE ROW LEVEL SECURITY;
ALTER TABLE parsing_templates DISABLE ROW LEVEL SECURITY;
