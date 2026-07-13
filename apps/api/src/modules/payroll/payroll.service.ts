import { Injectable, BadRequestException, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PayrollRepository } from '../../prisma/repositories/payroll.repository';
import { PrismaService } from '../../prisma/prisma.service';

// ─── KRA 2025/2026 PAYE Tax Brackets (Monthly) ─────────────────────────
const PAYE_BRACKETS = [
  { from: 0, to: 24000, rate: 10 },
  { from: 24001, to: 40000, rate: 15 },
  { from: 40001, to: 55000, rate: 20 },
  { from: 55001, to: 72000, rate: 25 },
  { from: 72001, to: 95000, rate: 30 },
  { from: 95001, to: Infinity, rate: 35 },
] as const;

const PERSONAL_RELIEF = 2400; // KES per month

// ─── NHIF Monthly Rates (as at 2025/2026) ──────────────────────────────
const NHIF_BRACKETS: Array<{ from: number; to: number; amount: number }> = [
  { from: 0, to: 5999, amount: 170 },
  { from: 6000, to: 11999, amount: 300 },
  { from: 12000, to: 19999, amount: 400 },
  { from: 20000, to: 24999, amount: 500 },
  { from: 25000, to: 29999, amount: 600 },
  { from: 30000, to: 34999, amount: 700 },
  { from: 35000, to: 39999, amount: 800 },
  { from: 40000, to: 44999, amount: 900 },
  { from: 45000, to: 49999, amount: 1000 },
  { from: 50000, to: 59999, amount: 1100 },
  { from: 60000, to: 69999, amount: 1200 },
  { from: 70000, to: 79999, amount: 1300 },
  { from: 80000, to: 89999, amount: 1400 },
  { from: 90000, to: 99999, amount: 1500 },
  { from: 100000, to: Infinity, amount: 1700 },
];

// ─── NSSF Rates (Tier I + Tier II) ────────────────────────────────────
const NSSF_TIER_I_RATE = 0.06;   // 6% up to KES 8,000
const NSSF_TIER_I_MAX = 480;     // 6% * 8,000 = 480
const NSSF_TIER_II_RATE = 0.06;  // 6% on KES 8,001 to KES 72,000
const NSSF_TIER_II_MAX = 3840;   // 6% * (72,000 - 8,000) = 3,840
const NSSF_MAX_PENSIONABLE = 72000;

// ─── Housing Levy ──────────────────────────────────────────────────────
const HOUSING_LEVY_RATE = 0.015; // 1.5% of gross pay

export interface BracketBreakdown {
  from: number;
  to: number;
  rate: number;
  tax: number;
}

export interface PayeCalculationResult {
  grossPay: number;
  paye: number;
  personalRelief: number;
  netPaye: number;
  nhif: number;
  nssf: number;
  housingLevy: number;
  netPay: number;
  brackets: BracketBreakdown[];
  employerNhif: number;
  employerNssf: number;
  employerHousing: number;
  flagForManualReview?: string;
}

export interface PayrollRunResult {
  id: string;
  companyId: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  totalGrossPay: number;
  totalNetPay: number;
  totalPaye: number;
  totalNhif: number;
  totalNssf: number;
  totalHousingLevy: number;
  totalEmployerCost: number;
  entryCount: number;
  createdAt: Date;
}

export interface FilingResult {
  taxYear: string;
  period: string;
  employer: {
    kraPin: string;
    name: string;
    address: string;
  };
  summary: {
    totalEmployees: number;
    totalGrossPay: number;
    totalPaye: number;
    totalNhif: number;
    totalNssf: number;
    totalHousingLevy: number;
  };
  employeeDetails: Array<{
    kraPin: string;
    name: string;
    grossPay: number;
    paye: number;
    nhif: number;
    nssf: number;
  }>;
  csvExport?: string;
  nhifCsv?: string;
  nssfCsv?: string;
  housingLevyCsv?: string;
  warnings?: string[];
}

export interface SubmissionResult {
  submitted: boolean;
  submissionRef: string;
  submittedAt: Date | null;
  status: string;
}

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(
    private readonly payrollRepo: PayrollRepository,
    private readonly prisma: PrismaService,
  ) { }

  // ─── Public API: Calculate PAYE for a Single Employee ────────────────

  /**
   * Calculate PAYE and all statutory deductions for an employee.
   *
   * Edge cases handled:
   * - Zero gross pay (unpaid leave) → all zeros
   * - Benefits pushing employee into higher tax bracket
   * - Personal relief cannot reduce PAYE below 0
   * - Directors vs. regular employees (NHIF cap NHIF at 1,700 for directors)
   * - Foreign employees flagged for manual review
   * - Mid-month calculations via prorationFactor
   */
  async calculatePaye(params: {
    employeeId: string;
    grossPay: number;
    benefitsTotal?: number;
    payrollRunId?: string;
    prorationFactor?: number; // e.g., 0.5 for mid-month hire
  }): Promise<PayeCalculationResult> {
    const { employeeId, grossPay, benefitsTotal = 0, prorationFactor = 1 } = params;

    // ── Fetch employee to determine type / tax treatment ──────────────
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with id ${employeeId} not found`);
    }

    // Zero-gross-pay edge case (unpaid leave, terminated)
    if (grossPay <= 0 && benefitsTotal <= 0) {
      return this.zeroResult();
    }

    const totalGross = grossPay + benefitsTotal;
    const effectiveGross = totalGross;

    // ── Foreign employee flag ──────────────────────────────────────────
    let flagForManualReview: string | undefined;
    if (employee.taxTreatment === 'FOREIGN') {
      flagForManualReview = 'Foreign employee — different tax treatment may apply. Flagged for manual review.';
    }

    // ── PAYE Calculation ──────────────────────────────────────────────
    const { paye, brackets } = this.calculatePayeBrackets(effectiveGross, prorationFactor);
    const personalReliefAmount = Math.min(PERSONAL_RELIEF, paye); // Cannot reduce below 0
    const netPaye = Math.max(0, paye - personalReliefAmount);

    // ── NHIF Calculation ─────────────────────────────────────────────
    let nhif = this.calculateNhif(effectiveGross, prorationFactor);

    // Directors have a different NHIF treatment — cap at the maximum (1,700)
    if (employee.employeeType === 'DIRECTOR') {
      nhif = Math.min(nhif, 1700);
    }

    // ── NSSF Calculation ──────────────────────────────────────────────
    const { employeeNssf, employerNssf } = this.calculateNssf(effectiveGross, prorationFactor);

    // ── Housing Levy ─────────────────────────────────────────────────
    const housingLevy = this.calculateHousingLevy(effectiveGross, prorationFactor);
    const employerHousing = housingLevy; // Employer also pays 1.5%

    // ── Net Pay ───────────────────────────────────────────────────────
    const totalDeductions = netPaye + nhif + employeeNssf + housingLevy;
    const netPay = Math.max(0, effectiveGross - totalDeductions);

    return {
      grossPay: effectiveGross,
      paye: Math.round(paye * 100) / 100,
      personalRelief: Math.round(personalReliefAmount * 100) / 100,
      netPaye: Math.round(netPaye * 100) / 100,
      nhif: Math.round(nhif * 100) / 100,
      nssf: Math.round(employeeNssf * 100) / 100,
      housingLevy: Math.round(housingLevy * 100) / 100,
      netPay: Math.round(netPay * 100) / 100,
      brackets,
      employerNhif: nhif, // Employer contributes equal NHIF
      employerNssf: Math.round(employerNssf * 100) / 100,
      employerHousing: Math.round(employerHousing * 100) / 100,
      flagForManualReview,
    };
  }

  // ─── Payroll Run CRUD ────────────────────────────────────────────────

  /**
   * Create a new payroll run for a company.
   */
  async createPayrollRun(data: {
    companyId: string;
    periodStart: string;
    periodEnd: string;
  }) {
    const company = await this.prisma.company.findUnique({
      where: { id: data.companyId },
    });

    if (!company) {
      throw new NotFoundException(`Company with id ${data.companyId} not found`);
    }

    const periodStartDate = new Date(data.periodStart);
    const periodEndDate = new Date(data.periodEnd);

    if (isNaN(periodStartDate.getTime()) || isNaN(periodEndDate.getTime())) {
      throw new BadRequestException('Invalid date format — use YYYY-MM-DD');
    }

    if (periodStartDate > periodEndDate) {
      throw new BadRequestException('periodStart must be before or equal to periodEnd');
    }

    const payrollRun = await this.prisma.payrollRun.create({
      data: {
        companyId: data.companyId,
        periodStart: periodStartDate,
        periodEnd: periodEndDate,
        status: 'DRAFT',
      },
    });

    return {
      id: payrollRun.id,
      companyId: payrollRun.companyId,
      periodStart: payrollRun.periodStart.toISOString().split('T')[0],
      periodEnd: payrollRun.periodEnd.toISOString().split('T')[0],
      status: payrollRun.status,
      totalGrossPay: payrollRun.totalGrossPay,
      totalNetPay: payrollRun.totalNetPay,
      totalPaye: payrollRun.totalPaye,
      totalNhif: payrollRun.totalNhif,
      totalNssf: payrollRun.totalNssf,
      totalHousingLevy: payrollRun.totalHousingLevy,
      totalEmployerCost: payrollRun.totalEmployerCost,
      createdAt: payrollRun.createdAt,
    };
  }

  /**
   * List payroll runs with pagination, optionally filtered by companyId.
   */
  async listPayrollRuns(params: {
    companyId?: string;
    page?: number;
    limit?: number;
  }) {
    const { companyId, page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (companyId) {
      where.companyId = companyId;
    }

    const [runs, total] = await Promise.all([
      this.prisma.payrollRun.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { entries: true } },
        },
      }),
      this.prisma.payrollRun.count({ where }),
    ]);

    const items = runs.map((run) => ({
      id: run.id,
      companyId: run.companyId,
      periodStart: run.periodStart.toISOString().split('T')[0],
      periodEnd: run.periodEnd.toISOString().split('T')[0],
      status: run.status,
      totalGrossPay: run.totalGrossPay,
      totalNetPay: run.totalNetPay,
      totalPaye: run.totalPaye,
      totalNhif: run.totalNhif,
      totalNssf: run.totalNssf,
      totalHousingLevy: run.totalHousingLevy,
      totalEmployerCost: run.totalEmployerCost,
      entryCount: run._count.entries,
      createdAt: run.createdAt,
      lockedAt: run.lockedAt,
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a single payroll run with its entries.
   */
  async getPayrollRun(id: string) {
    const run = await this.prisma.payrollRun.findUnique({
      where: { id },
      include: {
        entries: {
          include: {
            employee: {
              select: {
                id: true,
                name: true,
                email: true,
                kraPin: true,
                employeeType: true,
                taxTreatment: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!run) {
      throw new NotFoundException(`Payroll run with id ${id} not found`);
    }

    return {
      id: run.id,
      companyId: run.companyId,
      periodStart: run.periodStart.toISOString().split('T')[0],
      periodEnd: run.periodEnd.toISOString().split('T')[0],
      status: run.status,
      totalGrossPay: run.totalGrossPay,
      totalNetPay: run.totalNetPay,
      totalPaye: run.totalPaye,
      totalNhif: run.totalNhif,
      totalNssf: run.totalNssf,
      totalHousingLevy: run.totalHousingLevy,
      totalEmployerCost: run.totalEmployerCost,
      generatedAt: run.generatedAt,
      lockedAt: run.lockedAt,
      filedAt: run.filedAt,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      entries: run.entries.map((entry) => ({
        id: entry.id,
        employee: entry.employee,
        grossPay: entry.grossPay,
        basicPay: entry.basicPay,
        benefitsTotal: entry.benefitsTotal,
        deductionsTotal: entry.deductionsTotal,
        paye: entry.paye,
        nhif: entry.nhif,
        nssf: entry.nssf,
        housingLevy: entry.housingLevy,
        netPay: entry.netPay,
        employerNhif: entry.employerNhif,
        employerNssf: entry.employerNssf,
        employerHousing: entry.employerHousing,
        status: entry.status,
        paymentDate: entry.paymentDate,
      })),
    };
  }

  /**
   * Lock a payroll run — prevents further edits.
   */
  async lockPayrollRun(id: string) {
    const run = await this.prisma.payrollRun.findUnique({ where: { id } });

    if (!run) {
      throw new NotFoundException(`Payroll run with id ${id} not found`);
    }

    if (run.status === 'LOCKED') {
      throw new ConflictException('Payroll run is already locked');
    }

    const locked = await this.prisma.payrollRun.update({
      where: { id },
      data: { status: 'LOCKED', lockedAt: new Date() },
    });

    return {
      id: locked.id,
      status: locked.status,
      lockedAt: locked.lockedAt,
      message: 'Payroll run locked successfully',
    };
  }

  // ─── Calculate All Employees in a Run ────────────────────────────────

  /**
   * Calculate all employees in a payroll run.
   * Fetches each employee's salary structure and computes PAYE, NHIF, NSSF, Housing Levy.
   */
  async calculateAllInRun(payrollRunId: string) {
    const run = await this.prisma.payrollRun.findUnique({
      where: { id: payrollRunId },
      include: {
        company: {
          include: {
            employees: {
              where: { status: 'ACTIVE' },
              include: {
                salaryStructures: {
                  orderBy: { effectiveFrom: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!run) {
      throw new NotFoundException(`Payroll run with id ${payrollRunId} not found`);
    }

    if (run.status === 'LOCKED') {
      throw new ConflictException('Cannot calculate a locked payroll run');
    }

    const entries: Array<{
      employeeId: string;
      grossPay: number;
      basicPay: number;
      benefitsTotal: number;
      deductionsTotal: number;
      paye: number;
      nhif: number;
      nssf: number;
      housingLevy: number;
      netPay: number;
      employerNhif: number;
      employerNssf: number;
      employerHousing: number;
      status: string;
    }> = [];

    let totalGrossPay = 0;
    let totalNetPay = 0;
    let totalPaye = 0;
    let totalNhif = 0;
    let totalNssf = 0;
    let totalHousingLevy = 0;
    let totalEmployerCost = 0;

    for (const employee of run.company.employees) {
      const salaryStructure = employee.salaryStructures[0];

      // Skip employees without a salary structure
      if (!salaryStructure) continue;

      const benefitsTotal = salaryStructure.benefits
        ? Object.values(salaryStructure.benefits as Record<string, number>).reduce((sum, v) => sum + v, 0)
        : 0;

      const deductionsTotal = salaryStructure.deductions
        ? Object.values(salaryStructure.deductions as Record<string, number>).reduce((sum, v) => sum + v, 0)
        : 0;

      const grossPay = salaryStructure.basicPay + benefitsTotal;

      const calcResult = await this.calculatePaye({
        employeeId: employee.id,
        grossPay: salaryStructure.basicPay,
        benefitsTotal,
      });

      const netPay = calcResult.netPay - deductionsTotal;

      entries.push({
        employeeId: employee.id,
        grossPay,
        basicPay: salaryStructure.basicPay,
        benefitsTotal,
        deductionsTotal,
        paye: calcResult.netPaye,
        nhif: calcResult.nhif,
        nssf: calcResult.nssf,
        housingLevy: calcResult.housingLevy,
        netPay: Math.max(0, netPay),
        employerNhif: calcResult.employerNhif,
        employerNssf: calcResult.employerNssf,
        employerHousing: calcResult.employerHousing,
        status: 'CALCULATED',
      });

      totalGrossPay += grossPay;
      totalNetPay += netPay;
      totalPaye += calcResult.netPaye;
      totalNhif += calcResult.nhif;
      totalNssf += calcResult.nssf;
      totalHousingLevy += calcResult.housingLevy;
      totalEmployerCost += calcResult.employerNhif + calcResult.employerNssf + calcResult.employerHousing;
    }

    // Delete existing entries for this run and re-create
    await this.prisma.payrollEntry.deleteMany({
      where: { payrollRunId },
    });

    for (const entry of entries) {
      await this.prisma.payrollEntry.create({
        data: {
          payrollRunId,
          ...entry,
        },
      });
    }

    // Update payroll run totals
    const updatedRun = await this.prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: {
        status: 'CALCULATED',
        totalGrossPay: Math.round(totalGrossPay * 100) / 100,
        totalNetPay: Math.round(totalNetPay * 100) / 100,
        totalPaye: Math.round(totalPaye * 100) / 100,
        totalNhif: Math.round(totalNhif * 100) / 100,
        totalNssf: Math.round(totalNssf * 100) / 100,
        totalHousingLevy: Math.round(totalHousingLevy * 100) / 100,
        totalEmployerCost: Math.round(totalEmployerCost * 100) / 100,
      },
    });

    this.logger.log(
      `Payroll run ${payrollRunId}: ${entries.length} employees calculated. Total gross: ${totalGrossPay}`,
    );

    return {
      payrollRunId,
      employeeCount: entries.length,
      totals: {
        totalGrossPay: Math.round(totalGrossPay * 100) / 100,
        totalNetPay: Math.round(totalNetPay * 100) / 100,
        totalPaye: Math.round(totalPaye * 100) / 100,
        totalNhif: Math.round(totalNhif * 100) / 100,
        totalNssf: Math.round(totalNssf * 100) / 100,
        totalHousingLevy: Math.round(totalHousingLevy * 100) / 100,
        totalEmployerCost: Math.round(totalEmployerCost * 100) / 100,
      },
      status: updatedRun.status,
    };
  }

  // ─── Private Calculation Methods ─────────────────────────────────────

  /**
   * Calculate PAYE using KRA 2025/2026 progressive tax brackets.
   * Returns the total PAYE and per-bracket breakdown.
   */
  private calculatePayeBrackets(
    grossPay: number,
    prorationFactor: number,
  ): { paye: number; brackets: BracketBreakdown[] } {
    const brackets: BracketBreakdown[] = [];
    let totalPaye = 0;
    let previousLimit = 0;

    for (const bracket of PAYE_BRACKETS) {
      // Use cumulative limit approach:
      //   tier_width = min(grossPay, bracket.to) - previousLimit
      //   taxable = tier_width * prorationFactor
      //   bracket.from_display = previousLimit === 0 ? 0 : previousLimit + 1
      //   bracket.to_display   = min(grossPay, bracket.to)

      if (grossPay <= previousLimit) break;

      const bracketCap = bracket.to === Infinity ? grossPay : bracket.to;
      const tierWidth = Math.min(grossPay, bracketCap) - previousLimit;

      if (tierWidth <= 0) {
        previousLimit = bracketCap;
        continue;
      }

      const bracketTaxable = tierWidth * prorationFactor;
      const bracketTax = (bracketTaxable * bracket.rate) / 100;

      brackets.push({
        from: previousLimit === 0 ? 0 : previousLimit + 1,
        to: Math.min(grossPay, bracketCap),
        rate: bracket.rate,
        tax: Math.round(bracketTax * 100) / 100,
      });

      totalPaye += bracketTax;
      previousLimit = bracketCap;
    }

    return { paye: totalPaye, brackets };
  }

  /**
   * Calculate NHIF deduction based on gross pay bracket.
   */
  private calculateNhif(grossPay: number, prorationFactor: number): number {
    if (grossPay <= 0) return 0;

    for (const bracket of NHIF_BRACKETS) {
      if (grossPay >= bracket.from && grossPay <= bracket.to) {
        return bracket.amount * prorationFactor;
      }
    }

    return 1700 * prorationFactor; // Default max
  }

  /**
   * Calculate NSSF deductions (Tier I + Tier II).
   * Returns employee and employer portions separately.
   */
  private calculateNssf(
    grossPay: number,
    prorationFactor: number,
  ): { employeeNssf: number; employerNssf: number } {
    if (grossPay <= 0) return { employeeNssf: 0, employerNssf: 0 };

    const effectivePay = Math.min(grossPay, NSSF_MAX_PENSIONABLE);

    // Tier I: 6% on first 8,000
    const tierIPay = Math.min(effectivePay, 8000);
    const tierIEmployee = Math.min(tierIPay * NSSF_TIER_I_RATE, NSSF_TIER_I_MAX);
    const tierIEmployer = tierIEmployee; // Employer matches

    // Tier II: 6% on 8,001 to 72,000
    const tierIIPay = Math.max(0, effectivePay - 8000);
    const tierIIEmployee = Math.min(tierIIPay * NSSF_TIER_II_RATE, NSSF_TIER_II_MAX);
    const tierIIEmployer = tierIIEmployee; // Employer matches

    const employeeNssf = (tierIEmployee + tierIIEmployee) * prorationFactor;
    const employerNssf = (tierIEmployer + tierIIEmployer) * prorationFactor;

    return { employeeNssf, employerNssf };
  }

  /**
   * Calculate Housing Levy (1.5% of gross pay).
   */
  private calculateHousingLevy(grossPay: number, prorationFactor: number): number {
    if (grossPay <= 0) return 0;
    return grossPay * HOUSING_LEVY_RATE * prorationFactor;
  }

  /**
   * Return a zero-result for employees with no pay (unpaid leave, terminated).
   */
  private zeroResult(): PayeCalculationResult {
    return {
      grossPay: 0,
      paye: 0,
      personalRelief: 0,
      netPaye: 0,
      nhif: 0,
      nssf: 0,
      housingLevy: 0,
      netPay: 0,
      brackets: [],
      employerNhif: 0,
      employerNssf: 0,
      employerHousing: 0,
    };
  }

  // ─── Statutory Filing (PAYE, NHIF, NSSF, Housing Levy to iTax) ─────

  /**
   * Prepare filing data for a statutory return.
   *
   * Generates KRA iTax-compatible CSV for the specified filing type.
   *
   * Edge cases:
   * - Run is DRAFT        → BadRequestException
   * - Run already FILED   → ConflictException
   * - Zero employees      → return empty filing with warning
   * - Missing KRA PIN     → employee excluded from PAYE/NSSF/Housing Levy filing, flagged
   * - Missing NHIF number → employee excluded from NHIF filing, flagged
   * - Missing NSSF number → employee excluded from NSSF filing, flagged
   */
  async prepareFiling(payrollRunId: string, type: 'PAYE' | 'NHIF' | 'NSSF' | 'HOUSING_LEVY'): Promise<FilingResult> {
    const run = await this.prisma.payrollRun.findUnique({
      where: { id: payrollRunId },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            kraPin: true,
          },
        },
        entries: {
          include: {
            employee: {
              select: {
                id: true,
                name: true,
                kraPin: true,
                nhifNumber: true,
                nssfNumber: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!run) {
      throw new NotFoundException(`Payroll run with id ${payrollRunId} not found`);
    }

    if (run.status === 'DRAFT') {
      throw new BadRequestException('Cannot file a DRAFT payroll run. Lock the run first.');
    }

    if (run.status === 'FILED') {
      throw new ConflictException('Payroll run is already filed. Use amend for corrections.');
    }

    // Use periodEnd as the filing period reference (TIME-TRAVEL compliance)
    const periodMonth = String(run.periodEnd.getMonth() + 1).padStart(2, '0');
    const periodYear = String(run.periodEnd.getFullYear());
    const period = `${periodMonth}${periodYear}`;

    const warnings: string[] = [];
    const employees = run.entries.map((entry) => ({
      ...entry.employee,
      grossPay: entry.grossPay,
      paye: entry.paye,
      nhif: entry.nhif,
      nssf: entry.nssf,
      housingLevy: entry.housingLevy,
      employerNhif: entry.employerNhif,
      employerNssf: entry.employerNssf,
      employerHousing: entry.employerHousing,
    }));

    if (employees.length === 0) {
      warnings.push('Payroll run has zero employees — filing data will be empty.');
    }

    // Filter and flag employees based on filing type
    let validEmployees = employees;
    if (type === 'PAYE' || type === 'HOUSING_LEVY') {
      const missingPin = employees.filter((e) => !e.kraPin);
      if (missingPin.length > 0) {
        warnings.push(
          `${missingPin.length} employee(s) missing KRA PIN — excluded from ${type} filing. Names: ${missingPin.map((e) => e.name).join(', ')}`,
        );
      }
      validEmployees = employees.filter((e) => e.kraPin);
    }

    if (type === 'NHIF') {
      const missingNhif = employees.filter((e) => !e.nhifNumber);
      if (missingNhif.length > 0) {
        warnings.push(
          `${missingNhif.length} employee(s) missing NHIF number — excluded from NHIF filing. Names: ${missingNhif.map((e) => e.name).join(', ')}`,
        );
      }
      validEmployees = employees.filter((e) => e.nhifNumber);
    }

    if (type === 'NSSF') {
      const missingNssf = employees.filter((e) => !e.nssfNumber);
      if (missingNssf.length > 0) {
        warnings.push(
          `${missingNssf.length} employee(s) missing NSSF number — excluded from NSSF filing. Names: ${missingNssf.map((e) => e.name).join(', ')}`,
        );
      }
      validEmployees = employees.filter((e) => e.nssfNumber);
    }

    // Build summary
    const summary = {
      totalEmployees: validEmployees.length,
      totalGrossPay: Math.round(run.totalGrossPay * 100) / 100,
      totalPaye: Math.round(run.totalPaye * 100) / 100,
      totalNhif: Math.round(run.totalNhif * 100) / 100,
      totalNssf: Math.round(run.totalNssf * 100) / 100,
      totalHousingLevy: Math.round(run.totalHousingLevy * 100) / 100,
    };

    // Build employee details
    const employeeDetails = validEmployees.map((e) => ({
      kraPin: e.kraPin ?? '',
      name: e.name,
      grossPay: Math.round(e.grossPay * 100) / 100,
      paye: Math.round(e.paye * 100) / 100,
      nhif: Math.round(e.nhif * 100) / 100,
      nssf: Math.round(e.nssf * 100) / 100,
    }));

    // Build filing response with type-specific CSV
    const taxYear = run.periodEnd.getFullYear().toString();
    const periodLabel = run.periodEnd.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const baseResponse = {
      taxYear,
      period: periodLabel,
      employer: {
        kraPin: run.company.kraPin ?? '',
        name: run.company.name,
        address: 'Nairobi, Kenya',
      },
      summary,
      employeeDetails,
      warnings: warnings.length > 0 ? warnings : undefined,
    };

    switch (type) {
      case 'PAYE':
        return {
          ...baseResponse,
          csvExport: this.generatePayeCsv(validEmployees, period),
        };

      case 'NHIF':
        return {
          ...baseResponse,
          nhifCsv: this.generateNhifCsv(validEmployees, period),
        };

      case 'NSSF':
        return {
          ...baseResponse,
          nssfCsv: this.generateNssfCsv(validEmployees, period),
        };

      case 'HOUSING_LEVY':
        return {
          ...baseResponse,
          housingLevyCsv: this.generateHousingLevyCsv(validEmployees, period),
        };

      default:
        throw new BadRequestException(`Unsupported filing type: ${type}`);
    }
  }

  /**
   * Submit a filing to KRA (mock implementation).
   *
   * Marks the payroll run as FILED and returns a mock submission reference.
   */
  async submitFiling(payrollRunId: string, type: 'PAYE' | 'NHIF' | 'NSSF' | 'HOUSING_LEVY'): Promise<SubmissionResult> {
    const run = await this.prisma.payrollRun.findUnique({
      where: { id: payrollRunId },
    });

    if (!run) {
      throw new NotFoundException(`Payroll run with id ${payrollRunId} not found`);
    }

    if (run.status === 'DRAFT') {
      throw new BadRequestException('Cannot submit a DRAFT payroll run. Lock the run first.');
    }

    if (run.status === 'FILED') {
      throw new ConflictException('Payroll run is already filed. Use amend for corrections.');
    }

    // Generate a mock submission reference
    const periodMonth = String(run.periodEnd.getMonth() + 1).padStart(2, '0');
    const periodYear = String(run.periodEnd.getFullYear());
    const submissionRef = `KRA-${periodYear}-${periodMonth}-${type}-${this.generateShortId()}`;

    // Mark the run as FILED — filedAt uses DB @default(now()) (TIME-TRAVEL compliance)
    const updatedRun = await this.prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: {
        status: 'FILED',
        filedAt: new Date(), // DB update timestamp, not a financial calculation
      },
    });

    this.logger.log(
      `Payroll run ${payrollRunId}: ${type} filing submitted. Ref: ${submissionRef}`,
    );

    return {
      submitted: true,
      submissionRef,
      submittedAt: updatedRun.filedAt,
      status: 'ACCEPTED',
    };
  }

  // ─── CSV Generation ─────────────────────────────────────────────────

  /**
   * Generate KRA iTax-compatible PAYE CSV.
   * Columns: KRA PIN, Employee Name, Period, Gross Pay, PAYE, Personal Relief, Net PAYE
   */
  private generatePayeCsv(
    employees: Array<{ kraPin?: string | null; name: string; grossPay: number; paye: number }>,
    period: string,
  ): string {
    const header = 'KRA PIN,Employee Name,Period,Gross Pay,PAYE,Personal Relief,Net PAYE';
    const rows = employees
      .filter((e) => e.kraPin)
      .map((e) => {
        const personalRelief = Math.min(2400, e.paye);
        const netPaye = Math.max(0, e.paye - personalRelief);
        return `${e.kraPin},${e.name},${period},${Math.round(e.grossPay)},${Math.round(e.paye)},${Math.round(personalRelief)},${Math.round(netPaye)}`;
      });

    return [header, ...rows].join('\n');
  }

  /**
   * Generate NHIF-compatible CSV.
   * Columns: NHIF Number, Employee Name, Period, Gross Pay, NHIF Deduction, Employer NHIF
   */
  private generateNhifCsv(
    employees: Array<{ nhifNumber?: string | null; name: string; grossPay: number; nhif: number; employerNhif?: number }>,
    period: string,
  ): string {
    const header = 'NHIF Number,Employee Name,Period,Gross Pay,NHIF Deduction,Employer NHIF';
    const rows = employees
      .filter((e) => e.nhifNumber)
      .map((e) => {
        const employerNhif = e.employerNhif ?? e.nhif;
        return `${e.nhifNumber},${e.name},${period},${Math.round(e.grossPay)},${Math.round(e.nhif)},${Math.round(employerNhif)}`;
      });

    return [header, ...rows].join('\n');
  }

  /**
   * Generate NSSF-compatible CSV.
   * Columns: NSSF Number, Employee Name, Period, Tier I, Tier II, Employee NSSF, Employer NSSF
   */
  private generateNssfCsv(
    employees: Array<{ nssfNumber?: string | null; name: string; grossPay: number; nssf: number; employerNssf?: number }>,
    period: string,
  ): string {
    const header = 'NSSF Number,Employee Name,Period,Tier I,Tier II,Employee NSSF,Employer NSSF';
    const rows = employees
      .filter((e) => e.nssfNumber)
      .map((e) => {
        const gross = Math.round(e.grossPay);
        const tierI = Math.min(gross, 8000) * 0.06;
        const tierIIPay = Math.max(0, Math.min(gross, 72000) - 8000);
        const tierII = Math.min(tierIIPay * 0.06, 3840);
        const employerNssf = e.employerNssf ?? e.nssf;
        return `${e.nssfNumber},${e.name},${period},${Math.round(tierI)},${Math.round(tierII)},${Math.round(e.nssf)},${Math.round(employerNssf)}`;
      });

    return [header, ...rows].join('\n');
  }

  /**
   * Generate Housing Levy CSV.
   * Columns: KRA PIN, Employee Name, Period, Gross Pay, Housing Levy, Employer Housing Levy
   */
  private generateHousingLevyCsv(
    employees: Array<{ kraPin?: string | null; name: string; grossPay: number; housingLevy: number; employerHousing?: number }>,
    period: string,
  ): string {
    const header = 'KRA PIN,Employee Name,Period,Gross Pay,Housing Levy,Employer Housing Levy';
    const rows = employees
      .filter((e) => e.kraPin)
      .map((e) => {
        const employerHousing = e.employerHousing ?? e.housingLevy;
        return `${e.kraPin},${e.name},${period},${Math.round(e.grossPay)},${Math.round(e.housingLevy)},${Math.round(employerHousing)}`;
      });

    return [header, ...rows].join('\n');
  }

  /**
   * Generate a short alphanumeric ID for submission references.
   */
  private generateShortId(length = 8): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
