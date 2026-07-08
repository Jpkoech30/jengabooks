-- Row-Level Security (RLS) Policies for Tenant Data Isolation
-- Works with RlsSetterInterceptor which sets app.current_company via:
-- SELECT set_config('app.current_company', $1, true)

-- Enable RLS on all tenant-scoped tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE mpesa_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_feedback_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE wizard_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE statement_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE parsing_templates ENABLE ROW LEVEL SECURITY;

-- Create policies: each table filters by its company/tenant column
-- Uses current_setting('app.current_company', true) set by RlsSetterInterceptor
-- Note: etims_submissions links through invoices table, handled by application code
CREATE POLICY tenant_isolation ON companies FOR ALL
  USING (id = current_setting('app.current_company', true)::text);

CREATE POLICY tenant_isolation ON company_members FOR ALL
  USING ("companyId" = current_setting('app.current_company', true)::text);

CREATE POLICY tenant_isolation ON chart_of_accounts FOR ALL
  USING ("companyId" = current_setting('app.current_company', true)::text);

CREATE POLICY tenant_isolation ON journal_entries FOR ALL
  USING ("companyId" = current_setting('app.current_company', true)::text);

CREATE POLICY tenant_isolation ON fiscal_periods FOR ALL
  USING ("companyId" = current_setting('app.current_company', true)::text);

CREATE POLICY tenant_isolation ON invoices FOR ALL
  USING ("companyId" = current_setting('app.current_company', true)::text);

CREATE POLICY tenant_isolation ON mpesa_transactions FOR ALL
  USING ("companyId" = current_setting('app.current_company', true)::text);

CREATE POLICY tenant_isolation ON bank_transactions FOR ALL
  USING ("companyId" = current_setting('app.current_company', true)::text);

CREATE POLICY tenant_isolation ON category_rules FOR ALL
  USING ("companyId" = current_setting('app.current_company', true)::text);

CREATE POLICY tenant_isolation ON pending_reviews FOR ALL
  USING ("companyId" = current_setting('app.current_company', true)::text);

CREATE POLICY tenant_isolation ON xp_records FOR ALL
  USING ("companyId" = current_setting('app.current_company', true)::text);

CREATE POLICY tenant_isolation ON user_levels FOR ALL
  USING ("companyId" = current_setting('app.current_company', true)::text);

CREATE POLICY tenant_isolation ON business_health_scores FOR ALL
  USING ("companyId" = current_setting('app.current_company', true)::text);

CREATE POLICY tenant_isolation ON ai_feedback_logs FOR ALL
  USING ("companyId" = current_setting('app.current_company', true)::text);

CREATE POLICY tenant_isolation ON sync_logs FOR ALL
  USING ("companyId" = current_setting('app.current_company', true)::text);

CREATE POLICY tenant_isolation ON audit_logs FOR ALL
  USING ("companyId" = current_setting('app.current_company', true)::text);

CREATE POLICY tenant_isolation ON wizard_progress FOR ALL
  USING ("companyId" = current_setting('app.current_company', true)::text);

CREATE POLICY tenant_isolation ON statement_uploads FOR ALL
  USING ("tenantId" = current_setting('app.current_company', true)::text);

CREATE POLICY tenant_isolation ON parsing_templates FOR ALL
  USING ("tenantId" = current_setting('app.current_company', true)::text);
