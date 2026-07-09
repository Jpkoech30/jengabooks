import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SampleSize = 'SMALL' | 'MEDIUM' | 'LARGE';

export interface InitSandboxDto {
  companyName: string;
  sampleSize?: SampleSize;
}

export interface InitSandboxResponse {
  sandboxId: string;
  companyId: string;
  entriesCreated: number;
  accountsCreated: number;
  invoicesCreated: number;
  employeesCreated: number;
  resetToken: string;
}

export interface ResetSandboxDto {
  sandboxId: string;
  resetToken: string;
}

export interface SandboxStatus {
  isSandbox: boolean;
  sampleSize: SampleSize | null;
  createdAt: string | null;
  resetCount: number | null;
}

// ─── Chart of Accounts ────────────────────────────────────────────────────────

interface AccountDef {
  code: string;
  name: string;
  type: string;
  taxRate?: number | null;
}

const KENYAN_SME_CHART: AccountDef[] = [
  // Assets (1xxx)
  { code: '1000', name: 'Cash at Bank', type: 'ASSET' },
  { code: '1010', name: 'Cash in Hand', type: 'ASSET' },
  { code: '1100', name: 'Accounts Receivable', type: 'ASSET' },
  { code: '1200', name: 'Inventory', type: 'ASSET' },
  { code: '1201', name: 'Raw Materials', type: 'ASSET' },
  { code: '1202', name: 'Finished Goods', type: 'ASSET' },
  { code: '1300', name: 'Prepaid Expenses', type: 'ASSET' },
  { code: '1400', name: 'Office Equipment', type: 'ASSET' },
  { code: '1401', name: 'Accum. Deprec. — Office Equipment', type: 'ASSET' },
  { code: '1410', name: 'Motor Vehicles', type: 'ASSET' },
  { code: '1411', name: 'Accum. Deprec. — Motor Vehicles', type: 'ASSET' },
  { code: '1420', name: 'Computer Equipment', type: 'ASSET' },
  { code: '1421', name: 'Accum. Deprec. — Computer Equipment', type: 'ASSET' },
  { code: '1500', name: 'Other Current Assets', type: 'ASSET' },
  // Liabilities (2xxx)
  { code: '2000', name: 'Accounts Payable', type: 'LIABILITY' },
  { code: '2010', name: 'Accrued Expenses', type: 'LIABILITY' },
  { code: '2020', name: 'VAT Payable', type: 'LIABILITY' },
  { code: '2021', name: 'PAYE Payable', type: 'LIABILITY' },
  { code: '2022', name: 'NHIF Payable', type: 'LIABILITY' },
  { code: '2023', name: 'NSSF Payable', type: 'LIABILITY' },
  { code: '2024', name: 'Housing Levy Payable', type: 'LIABILITY' },
  { code: '2100', name: 'Short-term Loans', type: 'LIABILITY' },
  { code: '2200', name: 'Long-term Loans', type: 'LIABILITY' },
  // Equity (3xxx)
  { code: '3000', name: 'Share Capital', type: 'EQUITY' },
  { code: '3010', name: 'Retained Earnings', type: 'EQUITY' },
  { code: '3020', name: 'Drawings', type: 'EQUITY' },
  // Income (4xxx)
  { code: '4000', name: 'Sales Revenue', type: 'INCOME' },
  { code: '4010', name: 'Service Revenue', type: 'INCOME' },
  { code: '4020', name: 'Interest Income', type: 'INCOME' },
  { code: '4030', name: 'Other Income', type: 'INCOME' },
  // Expenses (5xxx)
  { code: '5000', name: 'Cost of Goods Sold', type: 'EXPENSE' },
  { code: '5010', name: 'Salaries & Wages', type: 'EXPENSE' },
  { code: '5020', name: 'Rent Expense', type: 'EXPENSE' },
  { code: '5030', name: 'Electricity Expense', type: 'EXPENSE' },
  { code: '5040', name: 'Water Expense', type: 'EXPENSE' },
  { code: '5050', name: 'Internet & Telephone', type: 'EXPENSE' },
  { code: '5060', name: 'M-Pesa Charges', type: 'EXPENSE' },
  { code: '5070', name: 'Bank Charges', type: 'EXPENSE' },
  { code: '5080', name: 'Advertising & Marketing', type: 'EXPENSE' },
  { code: '5090', name: 'Transport & Travel', type: 'EXPENSE' },
  { code: '5100', name: 'Office Supplies', type: 'EXPENSE' },
  { code: '5110', name: 'Insurance Expense', type: 'EXPENSE' },
  { code: '5120', name: 'Depreciation Expense', type: 'EXPENSE' },
  { code: '5130', name: 'Professional Fees', type: 'EXPENSE' },
  { code: '5140', name: 'Repairs & Maintenance', type: 'EXPENSE' },
  { code: '5150', name: 'License & Permits', type: 'EXPENSE' },
  { code: '5200', name: 'Miscellaneous Expenses', type: 'EXPENSE' },
];

// ─── Sample data templates ────────────────────────────────────────────────────

interface MpesaTxTemplate {
  description: string;
  paybill?: string;
  amountMin: number;
  amountMax: number;
  direction: 'paidIn' | 'withdrawn';
  weight: number;
}

interface InvoiceTemplate {
  customerName: string;
  customerPin: string;
  taxCode: string;
  lineItemDesc: string;
  unitPrice: number;
  quantity: number;
}

interface EmployeeTemplate {
  name: string;
  email: string;
  phone: string;
  kraPin: string;
  nationalId: string;
  nhifNumber: string;
  nssfNumber: string;
  employeeType: string;
  taxTreatment: string;
  basicPay: number;
}

const MPESA_TX_TEMPLATES: MpesaTxTemplate[] = [
  { description: 'KPLC Prepaid Token', paybill: '888880', amountMin: 500, amountMax: 5000, direction: 'withdrawn', weight: 20 },
  { description: 'Safaricom Airtime & Data', paybill: '333333', amountMin: 1000, amountMax: 3000, direction: 'withdrawn', weight: 15 },
  { description: 'Zuku Internet Payment', paybill: '444444', amountMin: 2000, amountMax: 3000, direction: 'withdrawn', weight: 10 },
  { description: 'Safaricom Postpay Bill', paybill: '888888', amountMin: 1500, amountMax: 5000, direction: 'withdrawn', weight: 8 },
  { description: 'DStv Payment', paybill: '555555', amountMin: 1500, amountMax: 6000, direction: 'withdrawn', weight: 5 },
  { description: 'Water Co. Bill Payment', paybill: '777777', amountMin: 300, amountMax: 2000, direction: 'withdrawn', weight: 8 },
  { description: 'Rent Payment', paybill: '111111', amountMin: 30000, amountMax: 80000, direction: 'withdrawn', weight: 3 },
  { description: 'Office Supplies Payment', paybill: '222222', amountMin: 1000, amountMax: 15000, direction: 'withdrawn', weight: 6 },
  { description: 'Payment for Invoice INV-001', amountMin: 5000, amountMax: 500000, direction: 'paidIn', weight: 12 },
  { description: 'Payment for Invoice INV-002', amountMin: 10000, amountMax: 300000, direction: 'paidIn', weight: 10 },
  { description: 'Customer Payment — Goods', amountMin: 2000, amountMax: 250000, direction: 'paidIn', weight: 15 },
  { description: 'Customer Payment — Services', amountMin: 5000, amountMax: 150000, direction: 'paidIn', weight: 12 },
  { description: 'M-Pesa Withdrawal ATM', amountMin: 500, amountMax: 10000, direction: 'withdrawn', weight: 5 },
  { description: 'Fuel Purchase', amountMin: 2000, amountMax: 8000, direction: 'withdrawn', weight: 7 },
  { description: 'Staff Airtime Reimbursement', amountMin: 500, amountMax: 2000, direction: 'withdrawn', weight: 4 },
];

const PHONE_NUMBERS = [
  '254712345678', '254723456789', '254734567890', '254745678901',
  '254756789012', '254767890123', '254778901234', '254789012345',
  '254790123456', '254701234567', '254702345678', '254703456789',
  '254714567890', '254725678901', '254736789012', '254747890123',
];

const INVOICE_TEMPLATES: InvoiceTemplate[] = [
  { customerName: 'TechBiz Kenya Ltd', customerPin: 'P051234567Z', taxCode: 'S', lineItemDesc: 'IT Support Services — Monthly Retainer', unitPrice: 120000, quantity: 1 },
  { customerName: 'TechBiz Kenya Ltd', customerPin: 'P051234567Z', taxCode: 'S', lineItemDesc: 'Software License Renewal', unitPrice: 45000, quantity: 2 },
  { customerName: 'Nairobi Retailers', customerPin: 'P059876543Z', taxCode: 'S', lineItemDesc: 'Wholesale Goods — Assorted', unitPrice: 85000, quantity: 1 },
  { customerName: 'Nairobi Retailers', customerPin: 'P059876543Z', taxCode: 'Z', lineItemDesc: 'Zero-Rated Supplies', unitPrice: 32000, quantity: 1 },
  { customerName: 'Mombasa Traders', customerPin: 'P055555555Z', taxCode: 'S', lineItemDesc: 'Imported Electronics — Consignment', unitPrice: 250000, quantity: 1 },
  { customerName: 'Mombasa Traders', customerPin: 'P055555555Z', taxCode: 'E', lineItemDesc: 'Exempt Medical Supplies', unitPrice: 75000, quantity: 1 },
  { customerName: 'Karen Coffee House', customerPin: 'P056666666Z', taxCode: 'S', lineItemDesc: 'Coffee Beans Supply — Monthly', unitPrice: 18000, quantity: 3 },
  { customerName: 'Karen Coffee House', customerPin: 'P056666666Z', taxCode: 'Z', lineItemDesc: 'Export Grade Coffee — Zero Rated', unitPrice: 95000, quantity: 1 },
  { customerName: 'Eldoret Logistics Ltd', customerPin: 'P057777777Z', taxCode: 'S', lineItemDesc: 'Freight & Haulage Services — Q1', unitPrice: 180000, quantity: 1 },
  { customerName: 'Eldoret Logistics Ltd', customerPin: 'P057777777Z', taxCode: 'S', lineItemDesc: 'Warehousing Storage Fee', unitPrice: 40000, quantity: 3 },
];

const EMPLOYEE_TEMPLATES: EmployeeTemplate[] = [
  { name: 'John Kamau', email: 'john.kamau@acmetraders.co.ke', phone: '254712345001', kraPin: 'A001234567K', nationalId: '12345678', nhifNumber: 'NHIF-001234', nssfNumber: 'NSSF-001234', employeeType: 'PERMANENT', taxTreatment: 'STANDARD', basicPay: 150000 },
  { name: 'Mary Wanjiku', email: 'mary.wanjiku@acmetraders.co.ke', phone: '254723456002', kraPin: 'A002345678L', nationalId: '23456789', nhifNumber: 'NHIF-002345', nssfNumber: 'NSSF-002345', employeeType: 'PERMANENT', taxTreatment: 'STANDARD', basicPay: 85000 },
  { name: 'Peter Ochieng', email: 'peter.ochieng@acmetraders.co.ke', phone: '254734567003', kraPin: 'A003456789M', nationalId: '34567890', nhifNumber: 'NHIF-003456', nssfNumber: 'NSSF-003456', employeeType: 'PERMANENT', taxTreatment: 'STANDARD', basicPay: 250000 },
  { name: 'Grace Akinyi', email: 'grace.akinyi@acmetraders.co.ke', phone: '254745678004', kraPin: 'A004567890N', nationalId: '45678901', nhifNumber: 'NHIF-004567', nssfNumber: 'NSSF-004567', employeeType: 'CONTRACT', taxTreatment: 'STANDARD', basicPay: 45000 },
  { name: 'David Mwangi', email: 'david.mwangi@acmetraders.co.ke', phone: '254756789005', kraPin: 'A005678901P', nationalId: '56789012', nhifNumber: 'NHIF-005678', nssfNumber: 'NSSF-005678', employeeType: 'CONTRACT', taxTreatment: 'STANDARD', basicPay: 65000 },
];

function generateReceiptNo(index: number): string {
  const alpha = String.fromCharCode(65 + (index % 26));
  const num = String(100000 + index).slice(1);
  return `${alpha}${num}${String(index).padStart(4, '0')}`;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class SandboxService {
  private readonly logger = new Logger(SandboxService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── TIME-TRAVEL: DB timestamp ──────────────────────────────────────────────

  private async getDbNow(): Promise<Date> {
    const result = await this.prisma.$queryRaw<{ now: Date }[]>`
      SELECT NOW() as "now"
    `;
    return result[0].now;
  }

  private escapeSql(val: string): string {
    return val.replace(/'/g, "''");
  }

  // ─── Init ───────────────────────────────────────────────────────────────────

  async init(dto: InitSandboxDto, userId: string): Promise<InitSandboxResponse> {
    const sampleSize: SampleSize = dto.sampleSize || 'MEDIUM';
    const txCount = this.getTxCount(sampleSize);

    const dbNow = await this.getDbNow();

    // Edge case: User already has a sandbox → return existing, don't duplicate
    const existingMembership = await this.prisma.companyMember.findFirst({
      where: { userId, isActive: true },
      include: { company: true },
    });

    if (existingMembership) {
      const existingSandbox = await this.prisma.$queryRaw<
        Array<{ id: string; resetToken: string }>
      >`
        SELECT id, "resetToken" FROM sandboxes
        WHERE "companyId" = ${existingMembership.company.id}
        LIMIT 1
      `;
      if (existingSandbox.length > 0) {
        this.logger.log(`User ${userId} already has sandbox ${existingSandbox[0].id} — returning existing`);
        const counts = await this.getCounts(existingMembership.company.id);
        return {
          sandboxId: existingSandbox[0].id,
          companyId: existingMembership.company.id,
          entriesCreated: counts.entriesCreated,
          accountsCreated: counts.accountsCreated,
          invoicesCreated: counts.invoicesCreated,
          employeesCreated: counts.employeesCreated,
          resetToken: existingSandbox[0].resetToken,
        };
      }
    }

    const companyId = `comp_sandbox_${crypto.randomBytes(8).toString('hex')}`;
    const sandboxId = `sandbox_${crypto.randomBytes(8).toString('hex')}`;
    const resetToken = `reset_${crypto.randomBytes(16).toString('hex').slice(0, 12)}`;

    // Create the sandbox company
    await this.prisma.$executeRaw`
      INSERT INTO companies (id, name, tier, "isActive", "createdAt", "updatedAt")
      VALUES (${companyId}, ${dto.companyName}, 'SANDBOX', true, ${dbNow}, ${dbNow})
    `;

    // Create membership for the user
    await this.prisma.companyMember.create({
      data: {
        userId,
        companyId,
        role: 'SME_OWNER',
        isActive: true,
      },
    });

    // Create sandbox record
    await this.prisma.$executeRaw`
      INSERT INTO sandboxes (id, "companyId", "sampleSize", "resetCount", "resetToken", "createdAt", "updatedAt")
      VALUES (${sandboxId}, ${companyId}, ${sampleSize}, 0, ${resetToken}, ${dbNow}, ${dbNow})
    `;

    // Generate all sample data
    const accountIds = await this.generateChartOfAccounts(companyId, dbNow);
    const entriesCreated = await this.generateMpesaTransactions(
      companyId, accountIds, txCount, dbNow,
    );
    const invoicesCreated = await this.generateInvoices(companyId, accountIds, dbNow);
    const employeesCreated = await this.generateEmployees(companyId, userId, dbNow);
    await this.generateOpeningBalances(companyId, accountIds, userId, dbNow);
    await this.generateBankStatements(companyId, accountIds, dbNow);

    this.logger.log(
      `Sandbox ${sandboxId} initialized: ${entriesCreated} tx, ${accountIds.size} accounts, ${invoicesCreated} invoices, ${employeesCreated} employees`,
    );

    return {
      sandboxId,
      companyId,
      entriesCreated,
      accountsCreated: accountIds.size,
      invoicesCreated,
      employeesCreated,
      resetToken,
    };
  }

  // ─── Reset ──────────────────────────────────────────────────────────────────

  async reset(dto: ResetSandboxDto): Promise<InitSandboxResponse> {
    const sandboxRows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        companyId: string;
        sampleSize: string;
        resetCount: number;
        resetToken: string;
      }>
    >`
      SELECT id, "companyId", "sampleSize", "resetCount", "resetToken"
      FROM sandboxes WHERE id = ${dto.sandboxId} LIMIT 1
    `;

    if (sandboxRows.length === 0) {
      throw new NotFoundException(`Sandbox ${dto.sandboxId} not found`);
    }

    const sandbox = sandboxRows[0];

    if (sandbox.resetToken !== dto.resetToken) {
      throw new BadRequestException('Invalid reset token');
    }

    const dbNow = await this.getDbNow();
    const companyId = sandbox.companyId;
    const sampleSize = sandbox.sampleSize as SampleSize;
    const txCount = this.getTxCount(sampleSize);

    // Delete all existing data in this sandbox
    await this.deleteSandboxData(companyId);

    // Get the user who owns this sandbox
    const member = await this.prisma.companyMember.findFirst({
      where: { companyId, isActive: true },
    });
    const userId = member?.userId || 'system';

    // Regenerate data
    const accountIds = await this.generateChartOfAccounts(companyId, dbNow);
    const entriesCreated = await this.generateMpesaTransactions(companyId, accountIds, txCount, dbNow);
    const invoicesCreated = await this.generateInvoices(companyId, accountIds, dbNow);
    const employeesCreated = await this.generateEmployees(companyId, userId, dbNow);
    await this.generateOpeningBalances(companyId, accountIds, userId, dbNow);
    await this.generateBankStatements(companyId, accountIds, dbNow);

    const newResetCount = sandbox.resetCount + 1;
    await this.prisma.$executeRaw`
      UPDATE sandboxes SET "resetCount" = ${newResetCount}, "updatedAt" = ${dbNow}
      WHERE id = ${dto.sandboxId}
    `;

    this.logger.log(`Sandbox ${dto.sandboxId} reset (count: ${newResetCount})`);

    return {
      sandboxId: sandbox.id,
      companyId,
      entriesCreated,
      accountsCreated: accountIds.size,
      invoicesCreated,
      employeesCreated,
      resetToken: sandbox.resetToken,
    };
  }

  // ─── Status ─────────────────────────────────────────────────────────────────

  async status(companyId: string): Promise<SandboxStatus> {
    const sandbox = await this.prisma.$queryRaw<
      Array<{ sampleSize: string; createdAt: Date; resetCount: number }>
    >`
      SELECT "sampleSize", "createdAt", "resetCount"
      FROM sandboxes WHERE "companyId" = ${companyId} LIMIT 1
    `;

    if (sandbox.length === 0) {
      return { isSandbox: false, sampleSize: null, createdAt: null, resetCount: null };
    }

    return {
      isSandbox: true,
      sampleSize: sandbox[0].sampleSize as SampleSize,
      createdAt: sandbox[0].createdAt.toISOString(),
      resetCount: sandbox[0].resetCount,
    };
  }

  // ─── Cleanup old sandboxes (7-day TTL) ────────────────────────────────────────

  async cleanupOldSandboxes(): Promise<number> {
    const dbNow = await this.getDbNow();

    const oldSandboxes = await this.prisma.$queryRaw<
      Array<{ id: string; companyId: string }>
    >`
      SELECT id, "companyId"
      FROM sandboxes
      WHERE "createdAt" < ${new Date(dbNow.getTime() - 7 * 24 * 60 * 60 * 1000)}
    `;

    for (const sb of oldSandboxes) {
      await this.deleteSandboxData(sb.companyId);
      await this.prisma.$executeRaw`DELETE FROM sandboxes WHERE id = ${sb.id}`;
      await this.prisma.$executeRaw`DELETE FROM companies WHERE id = ${sb.companyId}`;
    }

    if (oldSandboxes.length > 0) {
      this.logger.log(`Cleaned up ${oldSandboxes.length} expired sandboxes`);
    }

    return oldSandboxes.length;
  }

  // ─── Data generation helpers ────────────────────────────────────────────────

  private getTxCount(size: SampleSize): number {
    switch (size) {
      case 'SMALL': return 50;
      case 'LARGE': return 500;
      default: return 200;
    }
  }

  private async getCounts(companyId: string) {
    const [entriesResult, accountsResult, invoicesResult, employeesResult] = await Promise.all([
      this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::int as count FROM mpesa_transactions WHERE "companyId" = ${companyId}
      `,
      this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::int as count FROM chart_of_accounts WHERE "companyId" = ${companyId}
      `,
      this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::int as count FROM invoices WHERE "companyId" = ${companyId}
      `,
      this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::int as count FROM employees WHERE "companyId" = ${companyId}
      `,
    ]);

    return {
      entriesCreated: Number(entriesResult[0]?.count || 0),
      accountsCreated: Number(accountsResult[0]?.count || 0),
      invoicesCreated: Number(invoicesResult[0]?.count || 0),
      employeesCreated: Number(employeesResult[0]?.count || 0),
    };
  }

  private async generateChartOfAccounts(
    companyId: string,
    dbNow: Date,
  ): Promise<Map<string, string>> {
    const accountIds = new Map<string, string>();

    for (const def of KENYAN_SME_CHART) {
      const id = crypto.randomUUID();
      await this.prisma.$executeRaw`
        INSERT INTO chart_of_accounts (id, "companyId", code, name, type, "taxRate", "isActive", "createdAt", "updatedAt")
        VALUES (${id}, ${companyId}, ${def.code}, ${def.name}, ${def.type}, ${def.taxRate ?? null}, true, ${dbNow}, ${dbNow})
      `;
      accountIds.set(def.code, id);
    }

    return accountIds;
  }

  private async generateMpesaTransactions(
    companyId: string,
    accountIds: Map<string, string>,
    count: number,
    dbNow: Date,
  ): Promise<number> {
    let created = 0;
    const BATCH_SIZE = 50;

    // Build weighted template pool
    const weightedPool: Array<{ template: MpesaTxTemplate; index: number }> = [];
    for (let i = 0; i < MPESA_TX_TEMPLATES.length; i++) {
      for (let w = 0; w < MPESA_TX_TEMPLATES[i].weight; w++) {
        weightedPool.push({ template: MPESA_TX_TEMPLATES[i], index: i });
      }
    }

    const customerNames = [
      'John Kamau', 'Mary Wanjiku', 'Peter Ochieng', 'Grace Akinyi',
      'David Mwangi', 'Jane Muthoni', 'Kevin Maina', 'Sarah Nyambura',
      'Daniel Kiprop', 'Esther Wambui',
    ];

    const valueRows: string[] = [];

    for (let i = 0; i < count; i++) {
      const pick = weightedPool[Math.floor(Math.random() * weightedPool.length)];
      const template = pick.template;
      const amount = template.amountMin + Math.random() * (template.amountMax - template.amountMin);
      const roundedAmount = Math.round(amount * 100) / 100;

      // Transaction date: random within last 90 days, business hours
      const daysAgo = Math.floor(Math.random() * 90);
      const txDate = new Date(dbNow.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      txDate.setHours(Math.floor(Math.random() * 12) + 8);
      txDate.setMinutes(Math.floor(Math.random() * 60));
      txDate.setSeconds(0);

      const phoneNumber = PHONE_NUMBERS[Math.floor(Math.random() * PHONE_NUMBERS.length)];
      const receiptNo = generateReceiptNo(created);
      const paidIn = template.direction === 'paidIn' ? roundedAmount : null;
      const withdrawn = template.direction === 'withdrawn' ? roundedAmount : null;
      const customerName = template.direction === 'paidIn'
        ? customerNames[Math.floor(Math.random() * customerNames.length)]
        : null;

      // Map paybill transactions to appropriate expense account
      let mappedAccountId: string | null = null;
      if (template.paybill === '888880') mappedAccountId = accountIds.get('5030') || null; // Electricity
      else if (template.paybill === '888888') mappedAccountId = accountIds.get('5050') || null; // Telephone
      else if (template.paybill === '333333') mappedAccountId = accountIds.get('5050') || null; // Telephone
      else if (template.paybill === '444444') mappedAccountId = accountIds.get('5050') || null; // Internet
      else if (template.paybill === '555555') mappedAccountId = accountIds.get('5200') || null; // Misc
      else if (template.paybill === '777777') mappedAccountId = accountIds.get('5040') || null; // Water
      else if (template.paybill === '111111') mappedAccountId = accountIds.get('5020') || null; // Rent
      else if (template.paybill === '222222') mappedAccountId = accountIds.get('5100') || null; // Office Supplies
      else if (template.direction === 'paidIn') mappedAccountId = accountIds.get('4000') || null; // Sales

      const id = crypto.randomUUID();
      const paidInStr = paidIn !== null ? paidIn.toString() : 'NULL';
      const withdrawnStr = withdrawn !== null ? withdrawn.toString() : 'NULL';
      const customerStr = customerName ? `'${this.escapeSql(customerName)}'` : 'NULL';
      const mappedStr = mappedAccountId ? `'${mappedAccountId}'` : 'NULL';

      valueRows.push(
        `('${id}','${companyId}','${receiptNo}','${txDate.toISOString()}','${this.escapeSql(template.description)}',${roundedAmount},${paidInStr},${withdrawnStr},'${phoneNumber}','${template.paybill || ''}',${customerStr},'${template.paybill ? 'PAYBILL' : 'CUSTOMER'}',${mappedStr},0.95,false,'${dbNow.toISOString()}')`,
      );
      created++;

      if (valueRows.length >= BATCH_SIZE || i === count - 1) {
        await this.prisma.$executeRawUnsafe(`
          INSERT INTO mpesa_transactions
            (id, "companyId", "receiptNo", "transactionDate", description, amount,
             "paidIn", withdrawn, "phoneNumber", paybill, "customerName",
             "transactionType", "mappedAccountId", confidence, "isReconciled", "createdAt")
          VALUES ${valueRows.join(',\n')}
        `);
        valueRows.length = 0;
      }
    }

    return created;
  }

  private async generateInvoices(
    companyId: string,
    accountIds: Map<string, string>,
    dbNow: Date,
  ): Promise<number> {
    const statuses = ['VALIDATED', 'VALIDATED', 'VALIDATED', 'PENDING', 'PENDING', 'FAILED', 'FAILED', 'VALIDATED', 'VALIDATED', 'PENDING'];
    let created = 0;

    for (let i = 0; i < INVOICE_TEMPLATES.length; i++) {
      const template = INVOICE_TEMPLATES[i];
      const status = statuses[i % statuses.length];
      const invoiceId = crypto.randomUUID();
      const invoiceNumber = `INV-SB-${String(i + 1).padStart(3, '0')}`;
      const subtotal = template.unitPrice * template.quantity;

      let vat = 0;
      if (template.taxCode === 'S') {
        vat = Math.round(subtotal * 0.16 * 100) / 100;
      }

      const total = subtotal + vat;
      const daysAgo = Math.floor(Math.random() * 60) + 1;
      const invoiceDate = new Date(dbNow.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      const dueDate = new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000);

      const lineItems = JSON.stringify([
        {
          description: template.lineItemDesc,
          quantity: template.quantity,
          unitPrice: template.unitPrice,
          subtotal,
          taxCode: template.taxCode,
          vatRate: template.taxCode === 'S' ? 16 : template.taxCode === 'Z' ? 0 : null,
          vat,
        },
      ]);

      const isPaid = status === 'VALIDATED' && i < 4;
      const paidAt = isPaid
        ? new Date(invoiceDate.getTime() + (Math.floor(Math.random() * 14) + 1) * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const email = `info@${template.customerName.toLowerCase().replace(/\s+/g, '')}.co.ke`;
      const notes = `Sandbox invoice for ${template.customerName}`;

      if (paidAt) {
        await this.prisma.$executeRaw`
          INSERT INTO invoices
            (id, "companyId", "invoiceNumber", "customerName", "customerPin",
             "customerEmail", "lineItems", subtotal, vat, total, "taxCode",
             status, "dueDate", "paidAt", notes, "createdAt", "updatedAt")
          VALUES
            (${invoiceId}, ${companyId}, ${invoiceNumber}, ${template.customerName},
             ${template.customerPin}, ${email}, ${lineItems}::json, ${subtotal},
             ${vat}, ${total}, ${template.taxCode}, ${status}, ${dueDate},
             ${paidAt}, ${notes}, ${invoiceDate}, ${invoiceDate})
        `;
      } else {
        await this.prisma.$executeRaw`
          INSERT INTO invoices
            (id, "companyId", "invoiceNumber", "customerName", "customerPin",
             "customerEmail", "lineItems", subtotal, vat, total, "taxCode",
             status, "dueDate", notes, "createdAt", "updatedAt")
          VALUES
            (${invoiceId}, ${companyId}, ${invoiceNumber}, ${template.customerName},
             ${template.customerPin}, ${email}, ${lineItems}::json, ${subtotal},
             ${vat}, ${total}, ${template.taxCode}, ${status}, ${dueDate},
             ${notes}, ${invoiceDate}, ${invoiceDate})
        `;
      }

      // Create eTIMS submission for non-failed invoices
      if (status !== 'FAILED') {
        const submissionId = crypto.randomUUID();
        const serialNumber = `ETIMS-SB-${String(i + 1).padStart(6, '0')}`;
        const xmlPayload = `<Invoice><invoiceNo>${invoiceNumber}</invoiceNo><total>${total}</total></Invoice>`;
        const kraResponse = status === 'VALIDATED'
          ? JSON.stringify({ resultCode: '0', resultDesc: 'Success', serialNumber })
          : null;
        const submittedAt = status === 'VALIDATED' ? invoiceDate.toISOString() : null;
        const retryCount = status === 'PENDING' ? 1 : 0;

        await this.prisma.$executeRaw`
          INSERT INTO etims_submissions
            (id, "invoiceId", "serialNumber", "xmlPayload", "kraResponse",
             status, "submittedAt", "retryCount", "createdAt", "updatedAt")
          VALUES
            (${submissionId}, ${invoiceId}, ${serialNumber}, ${xmlPayload},
             ${kraResponse}, ${status}, ${submittedAt}, ${retryCount},
             ${invoiceDate}, ${invoiceDate})
        `;
      }

      created++;
    }

    return created;
  }

  private async generateEmployees(
    companyId: string,
    userId: string,
    dbNow: Date,
  ): Promise<number> {
    let created = 0;

    for (const template of EMPLOYEE_TEMPLATES) {
      const employeeId = crypto.randomUUID();
      const yearsAgo = Math.floor(Math.random() * 3) + 1;
      const hireDate = new Date(dbNow.getTime() - yearsAgo * 365 * 24 * 60 * 60 * 1000);

      await this.prisma.$executeRaw`
        INSERT INTO employees
          (id, "companyId", name, email, phone, "kraPin", "nationalId",
           "nhifNumber", "nssfNumber", "employeeType", "taxTreatment",
           status, "hireDate", "createdAt", "updatedAt")
        VALUES
          (${employeeId}, ${companyId}, ${template.name}, ${template.email},
           ${template.phone}, ${template.kraPin}, ${template.nationalId},
           ${template.nhifNumber}, ${template.nssfNumber}, ${template.employeeType},
           ${template.taxTreatment}, 'ACTIVE', ${hireDate}, ${dbNow}, ${dbNow})
      `;

      // Create salary structure
      const salaryId = crypto.randomUUID();
      const housingAllowance = Math.round(template.basicPay * 0.15);
      const transportAllowance = Math.round(template.basicPay * 0.08);
      const benefits = JSON.stringify({ housingAllowance, transportAllowance });
      const deductions = JSON.stringify({ salaryAdvance: 0, garnisheeOrder: 0 });
      const housingLevy = Math.round(template.basicPay * 0.015 * 100) / 100;

      await this.prisma.$executeRaw`
        INSERT INTO salary_structures
          (id, "employeeId", "effectiveFrom", "basicPay", "housingLevy",
           benefits, deductions, "createdAt", "updatedAt")
        VALUES
          (${salaryId}, ${employeeId}, ${hireDate}, ${template.basicPay},
           ${housingLevy}, ${benefits}::json, ${deductions}::json,
           ${dbNow}, ${dbNow})
      `;

      created++;
    }

    return created;
  }

  private async generateOpeningBalances(
    companyId: string,
    accountIds: Map<string, string>,
    userId: string,
    dbNow: Date,
  ): Promise<void> {
    const openingBalances: Array<{ code: string; amount: number; direction: string }> = [
      { code: '1000', amount: 2500000, direction: 'DEBIT' },
      { code: '1010', amount: 150000, direction: 'DEBIT' },
      { code: '1100', amount: 850000, direction: 'DEBIT' },
      { code: '1200', amount: 1200000, direction: 'DEBIT' },
      { code: '1300', amount: 75000, direction: 'DEBIT' },
      { code: '1400', amount: 450000, direction: 'DEBIT' },
      { code: '1410', amount: 2800000, direction: 'DEBIT' },
      { code: '1420', amount: 650000, direction: 'DEBIT' },
      { code: '2000', amount: 320000, direction: 'CREDIT' },
      { code: '2010', amount: 125000, direction: 'CREDIT' },
      { code: '2020', amount: 185000, direction: 'CREDIT' },
      { code: '2100', amount: 500000, direction: 'CREDIT' },
      { code: '2200', amount: 1500000, direction: 'CREDIT' },
      { code: '3000', amount: 1000000, direction: 'CREDIT' },
      { code: '3010', amount: 4800000, direction: 'CREDIT' },
    ];

    const periodStart = new Date(dbNow.getTime() - 90 * 24 * 60 * 60 * 1000);

    for (const bal of openingBalances) {
      const accountId = accountIds.get(bal.code);
      if (!accountId) continue;

      await this.prisma.$executeRaw`
        INSERT INTO journal_entries
          (id, "companyId", "accountId", description, amount, direction,
           reference, "entryDate", "postedById", "isReconciled", "createdAt", "updatedAt")
        VALUES
          (${crypto.randomUUID()}, ${companyId}, ${accountId},
           ${`Opening balance — ${bal.code}`}, ${bal.amount},
           ${bal.direction}, 'OPENING', ${periodStart}, ${userId},
           true, ${dbNow}, ${dbNow})
      `;
    }
  }

  private async generateBankStatements(
    companyId: string,
    accountIds: Map<string, string>,
    dbNow: Date,
  ): Promise<void> {
    const banks = [
      { name: 'Equity Bank — KES Current Account', prefix: 'EQ' },
      { name: 'KCB — Business Account', prefix: 'KCB' },
    ];

    for (const bank of banks) {
      for (let i = 0; i < 30; i++) {
        const daysAgo = Math.floor(Math.random() * 90);
        const txDate = new Date(dbNow.getTime() - daysAgo * 24 * 60 * 60 * 1000);
        txDate.setHours(9 + Math.floor(Math.random() * 8));
        txDate.setMinutes(Math.floor(Math.random() * 60));

        const isCredit = Math.random() > 0.4;
        const amount = Math.round((1000 + Math.random() * 200000) * 100) / 100;
        const reference = `${bank.prefix}-${String(i + 1).padStart(4, '0')}`;

        const descriptions = [
          'EFTS Transfer — Customer Payment',
          'Cheque Deposit — Customer',
          'Bank Charges — Monthly Ledger Fee',
          'Interest Earned — Savings',
          'EFT Transfer — Supplier Payment',
          'ATM Withdrawal — Business',
          'Standing Order — Loan Repayment',
          'POS Settlement — Daily Sales',
          'RTGS Transfer — Inward Payment',
          'Foreign Remittance — USD-KES Conversion',
        ];
        const description = descriptions[Math.floor(Math.random() * descriptions.length)];
        const mappedAccountId = isCredit
          ? (accountIds.get('4000') || null)
          : (accountIds.get('5070') || null);

        await this.prisma.$executeRaw`
          INSERT INTO bank_transactions
            (id, "companyId", "transactionDate", description, amount,
             reference, "mappedAccountId", "isReconciled", "createdAt")
          VALUES
            (${crypto.randomUUID()}, ${companyId}, ${txDate}, ${description},
             ${amount}, ${reference}, ${mappedAccountId}, false, ${dbNow})
        `;
      }
    }
  }

  private async deleteSandboxData(companyId: string): Promise<void> {
    await this.prisma.$executeRaw`
      DELETE FROM etims_submissions
      WHERE "invoiceId" IN (SELECT id FROM invoices WHERE "companyId" = ${companyId})
    `;
    await this.prisma.$executeRaw`DELETE FROM invoices WHERE "companyId" = ${companyId}`;
    await this.prisma.$executeRaw`
      DELETE FROM salary_structures
      WHERE "employeeId" IN (SELECT id FROM employees WHERE "companyId" = ${companyId})
    `;
    await this.prisma.$executeRaw`DELETE FROM employees WHERE "companyId" = ${companyId}`;
    await this.prisma.$executeRaw`DELETE FROM journal_entries WHERE "companyId" = ${companyId}`;
    await this.prisma.$executeRaw`DELETE FROM bank_transactions WHERE "companyId" = ${companyId}`;
    await this.prisma.$executeRaw`DELETE FROM mpesa_transactions WHERE "companyId" = ${companyId}`;
    await this.prisma.$executeRaw`DELETE FROM chart_of_accounts WHERE "companyId" = ${companyId}`;
    await this.prisma.$executeRaw`DELETE FROM company_members WHERE "companyId" = ${companyId}`;
    await this.prisma.$executeRaw`DELETE FROM wizard_progress WHERE "companyId" = ${companyId}`;
    await this.prisma.$executeRaw`DELETE FROM xp_records WHERE "companyId" = ${companyId}`;
  }
}
