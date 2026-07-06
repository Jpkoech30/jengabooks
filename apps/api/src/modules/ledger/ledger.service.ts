import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';

@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamificationService: GamificationService,
  ) {}

  // ─── Chart of Accounts ─────────────────────────────────────────────────

  async findAccounts(companyId: string) {
    return this.prisma.chartOfAccount.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { code: 'asc' },
      include: {
        children: { where: { deletedAt: null } },
      },
    });
  }

  async findAccount(id: string) {
    const account = await this.prisma.chartOfAccount.findFirst({
      where: { id, deletedAt: null },
      include: {
        parent: true,
        children: { where: { deletedAt: null } },
      },
    });

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
      const parent = await this.prisma.chartOfAccount.findFirst({
        where: { id: data.parentId, companyId, deletedAt: null },
      });
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

    return this.prisma.chartOfAccount.create({
      data: {
        companyId,
        code: data.code,
        name: data.name,
        type: data.type,
        parentId: data.parentId,
      },
    });
  }

  async updateAccount(id: string, data: { name?: string; isActive?: boolean; parentId?: string }) {
    const account = await this.prisma.chartOfAccount.findFirst({
      where: { id, deletedAt: null },
    });
    if (!account) {
      throw new NotFoundException(`Account with id ${id} not found`);
    }

    return this.prisma.chartOfAccount.update({
      where: { id },
      data,
    });
  }

  async deleteAccount(id: string) {
    const account = await this.prisma.chartOfAccount.findFirst({
      where: { id, deletedAt: null },
      include: { children: { where: { deletedAt: null } } },
    });
    if (!account) {
      throw new NotFoundException(`Account with id ${id} not found`);
    }
    if (account.children.length > 0) {
      throw new BadRequestException('Cannot delete account with active child accounts');
    }

    return this.prisma.chartOfAccount.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
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

    // Generate serial number if not provided
    const serialNumber = data.serialNumber || `JE-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

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
    ).catch(() => {});

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

    // Find a default cash account (first asset account)
    const cashAccount = await this.prisma.chartOfAccount.findFirst({
      where: { companyId, type: 'ASSET', isActive: true, deletedAt: null },
      orderBy: { code: 'asc' },
    });

    if (!cashAccount) {
      throw new BadRequestException('No asset account found. Please create a cash/bank account first.');
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
    const serialNumber = `INC-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Debit cash account
    await this.prisma.journalEntry.create({
      data: {
        companyId,
        accountId: cashAccount.id,
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
    ).catch(() => {});

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
    const cashAccount = await this.prisma.chartOfAccount.findFirst({
      where: { companyId, type: 'ASSET', isActive: true, deletedAt: null },
      orderBy: { code: 'asc' },
    });

    if (!cashAccount) {
      throw new BadRequestException('No asset account found. Please create a cash/bank account first.');
    }

    const expenseAccount = await this.prisma.chartOfAccount.findFirst({
      where: { id: data.accountId, companyId, type: 'EXPENSE', isActive: true, deletedAt: null },
    });
    if (!expenseAccount) {
      throw new BadRequestException('Expense account not found or is not an EXPENSE type account');
    }

    const entryDate = new Date(data.entryDate);
    const serialNumber = `EXP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

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
        accountId: cashAccount.id,
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
    ).catch(() => {});

    return entry;
  }
}
