import { Test, TestingModule } from '@nestjs/testing';
import { LedgerService } from './ledger.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('LedgerService', () => {
  let service: LedgerService;
  let prisma: any;

  const mockPrisma = {
    chartOfAccount: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    journalEntry: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    fiscalPeriod: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: GamificationService,
          useValue: {
            awardXp: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile();

    service = module.get<LedgerService>(LedgerService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  // ─── Chart of Accounts ─────────────────────────────────────────────

  describe('findAccounts', () => {
    it('should return accounts sorted by code', async () => {
      const accounts = [
        { id: '1', code: '1000', name: 'Cash', type: 'ASSET', children: [] },
        { id: '2', code: '2000', name: 'Revenue', type: 'INCOME', children: [] },
      ];
      mockPrisma.chartOfAccount.findMany.mockResolvedValue(accounts);

      const result = await service.findAccounts('company-1');
      expect(result).toEqual(accounts);
    });
  });

  describe('createAccount', () => {
    it('should create an account successfully', async () => {
      const newAccount = { id: '1', code: '1000', name: 'Cash', type: 'ASSET' };
      mockPrisma.chartOfAccount.findFirst.mockResolvedValue(null); // no parent check needed
      mockPrisma.chartOfAccount.findUnique.mockResolvedValue(null); // no duplicate
      mockPrisma.chartOfAccount.create.mockResolvedValue(newAccount);

      const result = await service.createAccount('company-1', {
        code: '1000', name: 'Cash', type: 'ASSET',
      });
      expect(result.code).toBe('1000');
      expect(result.name).toBe('Cash');
    });

    it('should throw on duplicate account code', async () => {
      mockPrisma.chartOfAccount.findFirst.mockResolvedValue(null);
      mockPrisma.chartOfAccount.findUnique.mockResolvedValue({ id: 'existing', code: '1000' });

      await expect(service.createAccount('company-1', {
        code: '1000', name: 'Cash', type: 'ASSET',
      })).rejects.toThrow(BadRequestException);
    });

    it('should throw when parent account not found', async () => {
      mockPrisma.chartOfAccount.findFirst.mockResolvedValue(null); // parent not found

      await expect(service.createAccount('company-1', {
        code: '1000', name: 'Cash', type: 'ASSET', parentId: 'nonexistent',
      })).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteAccount', () => {
    it('should soft-delete an account', async () => {
      mockPrisma.chartOfAccount.findFirst.mockResolvedValue({
        id: '1', children: [],
      });

      await service.deleteAccount('1');
      expect(mockPrisma.chartOfAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '1' },
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
    });

    it('should throw when account has children', async () => {
      mockPrisma.chartOfAccount.findFirst.mockResolvedValue({
        id: '1', children: [{ id: '2' }],
      });

      await expect(service.deleteAccount('1')).rejects.toThrow(BadRequestException);
    });
  });

  // ─── Journal Entries ───────────────────────────────────────────────

  describe('createJournalEntry', () => {
    it('should create entry with serial number', async () => {
      mockPrisma.chartOfAccount.findFirst.mockResolvedValue({ id: 'acc-1', isActive: true });
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValue({ status: 'OPEN' });
      mockPrisma.journalEntry.count.mockResolvedValue(0);
      mockPrisma.journalEntry.create.mockResolvedValue({
        id: 'entry-1', serialNumber: 'JE-20260706-00001',
      });

      const result = await service.createJournalEntry('company-1', {
        accountId: 'acc-1',
        description: 'Test entry',
        amount: 1000,
        direction: 'DEBIT',
        entryDate: new Date().toISOString(),
        postedById: 'user-1',
      });

      expect(result).toBeDefined();
      expect(mockPrisma.journalEntry.create).toHaveBeenCalled();
    });

    it('should throw for closed fiscal period', async () => {
      mockPrisma.chartOfAccount.findFirst.mockResolvedValue({ id: 'acc-1', isActive: true });
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValue({ status: 'CLOSED', name: 'FY2025' });

      await expect(service.createJournalEntry('company-1', {
        accountId: 'acc-1',
        description: 'Test',
        amount: 100,
        direction: 'DEBIT',
        entryDate: new Date().toISOString(),
        postedById: 'user-1',
      })).rejects.toThrow(BadRequestException);
    });
  });

  // ─── Trial Balance ─────────────────────────────────────────────────

  describe('getTrialBalance', () => {
    it('should return balanced trial balance', async () => {
      mockPrisma.journalEntry.findMany.mockResolvedValue([
        { accountId: '1', amount: 500, direction: 'DEBIT', account: { code: '1000', name: 'Cash', type: 'ASSET' } },
        { accountId: '2', amount: 500, direction: 'CREDIT', account: { code: '4000', name: 'Revenue', type: 'INCOME' } },
      ]);

      const result = await service.getTrialBalance('company-1');
      expect(result.balanced).toBe(true);
      expect(result.totalDebits).toBe(500);
      expect(result.totalCredits).toBe(500);
    });

    it('should detect unbalanced trial balance', async () => {
      mockPrisma.journalEntry.findMany.mockResolvedValue([
        { accountId: '1', amount: 500, direction: 'DEBIT', account: { code: '1000', name: 'Cash', type: 'ASSET' } },
        { accountId: '2', amount: 300, direction: 'CREDIT', account: { code: '4000', name: 'Revenue', type: 'INCOME' } },
      ]);

      const result = await service.getTrialBalance('company-1');
      expect(result.balanced).toBe(false);
    });
  });

  // ─── Serial Number Generation ──────────────────────────────────────

  describe('generateSerialNumber', () => {
    it('should generate sequential journal entry serials', async () => {
      mockPrisma.journalEntry.count.mockResolvedValue(0);
      // Access private method via prototype
      const result = await (service as any).generateSerialNumber('company-1', 'JE');
      expect(result).toMatch(/^JE-\d{8}-00001$/);
    });

    it('should increment serial counter', async () => {
      mockPrisma.journalEntry.count.mockResolvedValue(42);
      const result = await (service as any).generateSerialNumber('company-1', 'INC');
      expect(result).toMatch(/^INC-\d{8}-00043$/);
    });
  });

  // ─── Income / Expense Quick Entries ────────────────────────────────

  describe('createIncome', () => {
    it('should prefer named cash accounts', async () => {
      // First query (named cash) returns a result
      mockPrisma.chartOfAccount.findFirst
        .mockResolvedValueOnce({ id: 'cash-1', name: 'Main Cash Account', code: '1001' }) // named cash
        .mockResolvedValueOnce({ id: 'income-1', type: 'INCOME' }); // income account
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValue({ status: 'OPEN' });
      mockPrisma.journalEntry.count.mockResolvedValue(0);
      mockPrisma.journalEntry.create.mockResolvedValue({ id: 'entry-1' });

      const result = await service.createIncome('company-1', {
        accountId: 'income-1',
        description: 'Consulting fee',
        amount: 50000,
        entryDate: new Date().toISOString(),
        postedById: 'user-1',
      });

      expect(result).toBeDefined();
      // Should use the named cash account
      expect(mockPrisma.journalEntry.create).toHaveBeenCalledTimes(2);
    });

    it('should fallback to first asset account when no named cash', async () => {
      // First query (named cash) returns null, fallback returns an account
      mockPrisma.chartOfAccount.findFirst
        .mockResolvedValueOnce(null) // no named cash
        .mockResolvedValueOnce({ id: 'asset-1', name: 'Equipment', code: '1500' }) // fallback asset
        .mockResolvedValueOnce({ id: 'income-1', type: 'INCOME' }); // income account
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValue({ status: 'OPEN' });
      mockPrisma.journalEntry.count.mockResolvedValue(0);
      mockPrisma.journalEntry.create.mockResolvedValue({ id: 'entry-1' });

      const result = await service.createIncome('company-1', {
        accountId: 'income-1',
        description: 'Consulting fee',
        amount: 50000,
        entryDate: new Date().toISOString(),
        postedById: 'user-1',
      });

      expect(result).toBeDefined();
    });

    it('should throw when no asset account exists', async () => {
      mockPrisma.chartOfAccount.findFirst
        .mockResolvedValueOnce(null) // no named cash
        .mockResolvedValueOnce(null); // no fallback asset

      await expect(service.createIncome('company-1', {
        accountId: 'income-1',
        description: 'Test',
        amount: 100,
        entryDate: new Date().toISOString(),
        postedById: 'user-1',
      })).rejects.toThrow(BadRequestException);
    });
  });

  describe('createExpense', () => {
    it('should create double-entry expense', async () => {
      mockPrisma.chartOfAccount.findFirst
        .mockResolvedValueOnce({ id: 'cash-1', name: 'Bank Account', code: '1101' }) // named cash
        .mockResolvedValueOnce({ id: 'expense-1', type: 'EXPENSE' }); // expense account
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValue({ status: 'OPEN' });
      mockPrisma.journalEntry.count.mockResolvedValue(0);
      mockPrisma.journalEntry.create.mockResolvedValue({ id: 'entry-1' });

      const result = await service.createExpense('company-1', {
        accountId: 'expense-1',
        description: 'Office supplies',
        amount: 5000,
        entryDate: new Date().toISOString(),
        postedById: 'user-1',
      });

      expect(result).toBeDefined();
      expect(mockPrisma.journalEntry.create).toHaveBeenCalledTimes(2);
    });
  });
});
