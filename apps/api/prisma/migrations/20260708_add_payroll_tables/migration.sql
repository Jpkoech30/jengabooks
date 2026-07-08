-- CreateTable: employees
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "kraPin" TEXT NOT NULL,
    "nationalId" TEXT,
    "nhifNumber" TEXT,
    "nssfNumber" TEXT,
    "employeeType" TEXT NOT NULL,
    "taxTreatment" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "terminationDate" TIMESTAMP(3),
    "hireDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable: salary_structures
CREATE TABLE "salary_structures" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "basicPay" DOUBLE PRECISION NOT NULL,
    "housingLevy" DOUBLE PRECISION,
    "benefits" JSONB,
    "deductions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable: payroll_runs
CREATE TABLE "payroll_runs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalGrossPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalNetPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPaye" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalNhif" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalNssf" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalHousingLevy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalEmployerCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "filedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: payroll_entries
CREATE TABLE "payroll_entries" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "grossPay" DOUBLE PRECISION NOT NULL,
    "basicPay" DOUBLE PRECISION NOT NULL,
    "benefitsTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deductionsTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paye" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nhif" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nssf" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "housingLevy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netPay" DOUBLE PRECISION NOT NULL,
    "employerNhif" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "employerNssf" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "employerHousing" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'CALCULATED',
    "paymentDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE INDEX "employees_company_id_idx" ON "employees"("companyId");
CREATE INDEX "salary_structures_employee_id_idx" ON "salary_structures"("employeeId");
CREATE INDEX "payroll_runs_company_id_idx" ON "payroll_runs"("companyId");
CREATE INDEX "payroll_entries_payroll_run_id_idx" ON "payroll_entries"("payrollRunId");
CREATE INDEX "payroll_entries_employee_id_idx" ON "payroll_entries"("employeeId");

-- AddForeignKeys
ALTER TABLE "employees" ADD CONSTRAINT "employees_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "payroll_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
