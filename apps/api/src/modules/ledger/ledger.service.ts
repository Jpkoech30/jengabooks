import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { LedgerRepository } from '../../prisma/repositories/ledger.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';

@Injectable()
export class LedgerService {
  constructor(
    private readonly ledgerRepo: LedgerRepository,
    private readonly prisma: PrismaService,
    private readonly gamificationService: GamificationService,
  ) { }

  // ─── Chart of Accounts ─────────────────────────────────────────────────

  async findAccounts(companyId: string) {
    return this.ledgerRepo.findMany({ companyId } as any);
  }

  async findAccount(id: string) {
    const account = await this.ledgerRepo.findById(id);
    if (!account) {
      throw new NotFoundException(`Account with id ${id} not found`);
    }
    return account;
  }

  async createAccount(companyId: string, data: {
    code: string;
    name: string;
    type: string;
    parentId?: string;
  }) {
    // Validate parent if provided
    if (data.parentId) {
      const parent = await this.ledgerRepo.findById(data.parentId);
      if (!parent) {
        throw new NotFoundException(`Parent account ${data.parentId} not found`);
      }
    }

    // Check unique code within company
    const existing = await this.prisma.chartOfAccount.findUnique({
      where: { companyId_code: { companyId, code: data.code } },
    });
    if (existing) {
      throw new BadRequestException(`Account code ${data.code} already exists for this company`);
    }

    return this.ledgerRepo.create({
      companyId,
      code: data.code,
      name: data.name,
      type: data.type,
      parentId: data.parentId,
    });
  }

  async updateAccount(id: string, data: { name?: string; isActive?: boolean; parentId?: string }) {
    return this.ledgerRepo.update(id, data);
  }

  async deleteAccount(id: string) {
    const account = await this.ledgerRepo.findById(id);
    if (!account) {
      throw new NotFoundException(`Account with id ${id} not found`);
    }
    if (account.children && account.children.length > 0) {
      throw new BadRequestException('Cannot delete account with active child accounts');
    }
    return this.ledgerRepo.delete(id);
  }

  // ─── Journal Entries (Double-Entry) ────────────────────────────────────

  async findJournalEntries(companyId: string, filters?: {
    accountId?: string;
    fromDate?: string;
    toDate?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = { companyId, deletedAt: null };

    if (filters?.accountId) {
      where.accountId = filters.accountId;
    }
    if (filters?.fromDate || filters?.toDate) {
      where.entryDate = {};
      if (filters.fromDate) where.entryDate.gte = new Date(filters.fromDate);
      if (filters.toDate) where.entryDate.lte = new Date(filters.toDate);
    }
    if (filters?.search) {
      where.OR = [
        { description: { contains: filters.search, mode: 'insensitive' } },
        { reference: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        include: {
          account: { select: { id: true, code: true, name: true, type: true } },
          postedBy: { select: { id: true, name: true } },
        },
        orderBy: { entryDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.journalEntry.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findJournalEntry(id: string) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id, deletedAt: null },
      include: {
        account: true,
        postedBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!entry) {
      throw new NotFoundException(`Journal entry with id ${id} not found`);
    }

    return entry;
  }

  async createJournalEntry(companyId: string, data: {
    accountId: string;
    description: string;
    amount: number;
    direction: string;
    reference?: string;
    serialNumber?: string;
    entryDate: string;
    postedById: string;
    aiConfidence?: number;
    aiReasoning?: string;
  }) {
    // Validate account
    const account = await this.prisma.chartOfAccount.findFirst({
      where: { id: data.accountId, companyId, deletedAt: null, isActive: true },
    });
    if (!account) {
      throw new NotFoundException(`Active account with id ${data.accountId} not found`);
    }

    // Validate fiscal period is open
    const entryDate = new Date(data.entryDate);
    const period = await this.prisma.fiscalPeriod.findFirst({
      where: {
        companyId,
        startDate: { lte: entryDate },
        endDate: { gte: entryDate },
      },
    });

    if (period && period.status !== 'OPEN') {
      throw new BadRequestException(
        `Cannot post to period "${period.name}" — status is ${period.status}`,
      );
    }

    // Generate sequential serial number for audit trail
    const serialNumber = data.serialNumber || await this.generateSerialNumber(companyId, 'JE');

    const entry = await this.prisma.journalEntry.create({
      data: {
        companyId,
        accountId: data.accountId,
        description: data.description,
        amount: data.amount,
        direction: data.direction,
        reference: data.reference,
        serialNumber,
        entryDate,
        postedById: data.postedById,
        aiConfidence: data.aiConfidence,
        aiReasoning: data.aiReasoning,
      },
      include: {
        account: { select: { id: true, code: true, name: true, type: true } },
      },
    });

    // Award XP for recording a transaction
    await this.gamificationService.awardXp(
      data.postedById,
      companyId,
      10,
      'Recorded a journal entry',
    ).catch(() => { });

    return entry;
  }

  async deleteJournalEntry(id: string) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id, deletedAt: null },
    });
    if (!entry) {
      throw new NotFoundException(`Journal entry with id ${id} not found`);
    }

    return this.prisma.journalEntry.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ─── Trial Balance ─────────────────────────────────────────────────────

  async getTrialBalance(companyId: string, asOf?: string) {
    const where: any = {
      companyId,
      deletedAt: null,
    };

    if (asOf) {
      where.entryDate = { lte: new Date(asOf) };
    }

    const entries = await this.prisma.journalEntry.findMany({
      where,
      include: {
        account: { select: { id: true, code: true, name: true, type: true } },
      },
    });

    // Aggregate by account
    const balanceMap = new Map<string, { code: string; name: string; type: string; debit: number; credit: number }>();

    for (const entry of entries) {
      const key = entry.accountId;
      const current = balanceMap.get(key) || {
        code: entry.account.code,
        name: entry.account.name,
        type: entry.account.type,
        debit: 0,
        credit: 0,
      };

      if (entry.direction === 'DEBIT') {
        current.debit += entry.amount;
      } else {
        current.credit += entry.amount;
      }

      balanceMap.set(key, current);
    }

    const accounts = Array.from(balanceMap.values());
    const totalDebits = accounts.reduce((sum, a) => sum + a.debit, 0);
    const totalCredits = accounts.reduce((sum, a) => sum + a.credit, 0);

    return {
      accounts,
      totalDebits,
      totalCredits,
      balanced: Math.abs(totalDebits - totalCredits) < 0.01,
      asOf: asOf || new Date().toISOString(),
    };
  }

  // ─── Income (Quick Entry) ──────────────────────────────────────────────

  async createIncome(companyId: string, data: {
    accountId: string;
    description: string;
    amount: number;
    reference?: string;
    entryDate: string;
    postedById: string;
  }) {
    // For income: debit the cash/bank account (default to first asset account),
    // credit the income account
    // In a quick entry, we credit the selected income account
    // and debit a default cash account

    // Find a default cash/bank account — match by name or code patterns first
    let cashAccount = await this.prisma.chartOfAccount.findFirst({
      where: {
        companyId,
        type: 'ASSET',
        isActive: true,
        deletedAt: null,
        OR: [
          { name: { contains: 'Cash', mode: 'insensitive' } },
          { name: { contains: 'Bank', mode: 'insensitive' } },
          { name: { contains: 'M-Pesa', mode: 'insensitive' } },
          { name: { contains: 'Petty', mode: 'insensitive' } },
          { code: { startsWith: '100' } }, // Standard cash account codes
          { code: { startsWith: '110' } }, // Standard bank account codes
        ],
      },
      orderBy: [{ code: 'asc' }],
    });

    if (!cashAccount) {
      // Fallback to any asset account
      const fallbackAccount = await this.prisma.chartOfAccount.findFirst({
        where: { companyId, type: 'ASSET', isActive: true, deletedAt: null },
        orderBy: { code: 'asc' },
      });
      if (!fallbackAccount) {
        throw new BadRequestException('No asset account found. Please create a cash/bank account first.');
      }
      // Assign the fallback as the cash account
      // Both branches guarantee cashAccount is non-null at this point
      cashAccount = fallbackAccount!;
    }

    // Validate income account exists and is INCOME type
    const incomeAccount = await this.prisma.chartOfAccount.findFirst({
      where: { id: data.accountId, companyId, type: 'INCOME', isActive: true, deletedAt: null },
    });
    if (!incomeAccount) {
      throw new BadRequestException('Income account not found or is not an INCOME type account');
    }

    // Create two journal entries (double-entry)
    const entryDate = new Date(data.entryDate);
    const serialNumber = await this.generateSerialNumber(companyId, 'INC');

    // Debit cash account
    await this.prisma.journalEntry.create({
      data: {
        companyId,
        accountId: cashAccount!.id,
        description: data.description,
        amount: data.amount,
        direction: 'DEBIT',
        reference: data.reference,
        serialNumber,
        entryDate,
        postedById: data.postedById,
      },
    });

    // Credit income account
    const entry = await this.prisma.journalEntry.create({
      data: {
        companyId,
        accountId: incomeAccount.id,
        description: data.description,
        amount: data.amount,
        direction: 'CREDIT',
        reference: data.reference,
        serialNumber,
        entryDate,
        postedById: data.postedById,
      },
      include: {
        account: { select: { id: true, code: true, name: true, type: true } },
      },
    });

    // Award XP for recording income
    await this.gamificationService.awardXp(
      data.postedById,
      companyId,
      10,
      'Recorded income',
    ).catch(() => { });

    return entry;
  }

  // ─── Expense (Quick Entry) ─────────────────────────────────────────────

  async createExpense(companyId: string, data: {
    accountId: string;
    description: string;
    amount: number;
    reference?: string;
    entryDate: string;
    postedById: string;
  }) {
    // For expense: debit the expense account, credit the cash/bank account
    // Find a default cash/bank account — match by name or code patterns first
    let cashAccount = await this.prisma.chartOfAccount.findFirst({
      where: {
        companyId,
        type: 'ASSET',
        isActive: true,
        deletedAt: null,
        OR: [
          { name: { contains: 'Cash', mode: 'insensitive' } },
          { name: { contains: 'Bank', mode: 'insensitive' } },
          { name: { contains: 'M-Pesa', mode: 'insensitive' } },
          { name: { contains: 'Petty', mode: 'insensitive' } },
          { code: { startsWith: '100' } },
          { code: { startsWith: '110' } },
        ],
      },
      orderBy: [{ code: 'asc' }],
    });

    if (!cashAccount) {
      // Fallback to any asset account
      const fallbackAccount = await this.prisma.chartOfAccount.findFirst({
        where: { companyId, type: 'ASSET', isActive: true, deletedAt: null },
        orderBy: { code: 'asc' },
      });
      if (!fallbackAccount) {
        throw new BadRequestException('No asset account found. Please create a cash/bank account first.');
      }
      cashAccount = fallbackAccount;
    }

    const expenseAccount = await this.prisma.chartOfAccount.findFirst({
      where: { id: data.accountId, companyId, type: 'EXPENSE', isActive: true, deletedAt: null },
    });
    if (!expenseAccount) {
      throw new BadRequestException('Expense account not found or is not an EXPENSE type account');
    }

    const entryDate = new Date(data.entryDate);
    const serialNumber = await this.generateSerialNumber(companyId, 'EXP');

    // Debit expense account
    await this.prisma.journalEntry.create({
      data: {
        companyId,
        accountId: expenseAccount.id,
        description: data.description,
        amount: data.amount,
        direction: 'DEBIT',
        reference: data.reference,
        serialNumber,
        entryDate,
        postedById: data.postedById,
      },
    });

    // Credit cash account
    const entry = await this.prisma.journalEntry.create({
      data: {
        companyId,
        accountId: cashAccount!.id,
        description: data.description,
        amount: data.amount,
        direction: 'CREDIT',
        reference: data.reference,
        serialNumber,
        entryDate,
        postedById: data.postedById,
      },
      include: {
        account: { select: { id: true, code: true, name: true, type: true } },
      },
    });

    // Award XP for recording an expense
    await this.gamificationService.awardXp(
      data.postedById,
      companyId,
      10,
      'Recorded an expense',
    ).catch(() => { });

    return entry;
  }

  /**
   * Generate a sequential serial number per company for audit trail compliance.
   * Format: {PREFIX}-{YYYYMMDD}-{SEQUENTIAL_5_DIGITS}
   * Example: JE-20260706-00001, INC-20260706-00042
   * @param now - Optional timestamp override for TIME-TRAVEL compliance (defaults to new Date())
   */
  private async generateSerialNumber(companyId: string, prefix: string, now?: Date): Promise<string> {
    const today = now || new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    // Count existing entries with today's prefix to get the sequence number
    const count = await this.prisma.journalEntry.count({
      where: {
        companyId,
        serialNumber: {
          startsWith: `${prefix}-${dateStr}`,
        },
      },
    });

    return `${prefix}-${dateStr}-${String(count + 1).padStart(5, '0')}`;
  }
}
