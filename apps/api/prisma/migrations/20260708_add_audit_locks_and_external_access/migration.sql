-- CreateTable: audit_locks (fiscal period lock-down for audit compliance)
-- Supports FULL, MODULE_SPECIFIC, and ROLE_BASED lock types
CREATE TABLE "audit_locks" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "lockType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "lockedById" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3),
    "unlockReason" TEXT,
    "unlockRequestedById" TEXT,
    "modules" JSONB,
    "roleOverrides" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_locks_pkey" PRIMARY KEY ("id")
);

-- CreateTable: external_access (temporary access grants for external auditors/banks/KRA)
CREATE TABLE "external_access" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "grantorId" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientEmail" TEXT,
    "accessLevel" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastAccessedAt" TIMESTAMP(3),
    "purpose" TEXT NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable: external_access_logs (audit trail for all external access actions)
CREATE TABLE "external_access_logs" (
    "id" TEXT NOT NULL,
    "accessId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: audit_locks unique constraint (prevent overlapping lock periods per company/fiscal year)
CREATE UNIQUE INDEX "audit_locks_company_id_fiscal_year_period_start_key" ON "audit_locks"("companyId", "fiscalYear", "periodStart");

-- CreateIndex: audit_locks company index (RLS filtering)
CREATE INDEX "audit_locks_company_id_idx" ON "audit_locks"("companyId");

-- CreateIndex: audit_locks fiscal year index (period queries)
CREATE INDEX "audit_locks_fiscal_year_idx" ON "audit_locks"("fiscalYear");

-- CreateIndex: audit_locks company + status index (active lock queries)
CREATE INDEX "audit_locks_company_id_status_idx" ON "audit_locks"("companyId", "status");

-- CreateIndex: audit_locks overlap detection index
CREATE INDEX "audit_locks_company_id_fiscal_year_period_start_period_end_idx" ON "audit_locks"("companyId", "fiscalYear", "periodStart", "periodEnd");

-- CreateIndex: external_access company index (RLS filtering)
CREATE INDEX "external_access_company_id_idx" ON "external_access"("companyId");

-- CreateIndex: external_access token index (quick auth lookup)
CREATE UNIQUE INDEX "external_access_access_token_key" ON "external_access"("accessToken");

-- CreateIndex: external_access expiry index (auto-expiry queries)
CREATE INDEX "external_access_expires_at_idx" ON "external_access"("expiresAt");

-- CreateIndex: external_access company + revoked status index
CREATE INDEX "external_access_company_id_is_revoked_idx" ON "external_access"("companyId", "isRevoked");

-- CreateIndex: external_access_logs access FK index
CREATE INDEX "external_access_logs_access_id_idx" ON "external_access_logs"("accessId");

-- CreateIndex: external_access_logs access + timestamp index (audit trail queries)
CREATE INDEX "external_access_logs_access_id_created_at_idx" ON "external_access_logs"("accessId", "createdAt");

-- CreateForeignKey: audit_locks → companies
ALTER TABLE "audit_locks" ADD CONSTRAINT "audit_locks_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateForeignKey: audit_locks → users (lockedBy)
ALTER TABLE "audit_locks" ADD CONSTRAINT "audit_locks_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateForeignKey: audit_locks → users (unlockRequestedBy)
ALTER TABLE "audit_locks" ADD CONSTRAINT "audit_locks_unlockRequestedById_fkey" FOREIGN KEY ("unlockRequestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateForeignKey: external_access → companies
ALTER TABLE "external_access" ADD CONSTRAINT "external_access_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateForeignKey: external_access → users (grantor)
ALTER TABLE "external_access" ADD CONSTRAINT "external_access_grantorId_fkey" FOREIGN KEY ("grantorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateForeignKey: external_access_logs → external_access
ALTER TABLE "external_access_logs" ADD CONSTRAINT "external_access_logs_accessId_fkey" FOREIGN KEY ("accessId") REFERENCES "external_access"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
