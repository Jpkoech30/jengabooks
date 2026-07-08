import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TaxService } from './tax.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('TaxService', () => {
  let service: TaxService;
  let prisma: any;

  const mockPrisma = {
    journalEntry: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TaxService>(TaxService);
    prisma = module.get(PrismaService);
  });

  // ─── Validation ────────────────────────────────────────────────────

  describe('calculateVat validation', () => {
    it('should throw BadRequestException when from is missing', async () => {
      await expect(service.calculateVat('company-1', undefined, '2026-01-31'))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when to is missing', async () => {
      await expect(service.calculateVat('company-1', '2026-01-01', undefined))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when from > to', async () => {
      await expect(service.calculateVat('company-1', '2026-02-01', '2026-01-01'))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid date format', async () => {
      await expect(service.calculateVat('company-1', 'not-a-date', '2026-01-31'))
        .rejects.toThrow(BadRequestException);
    });
  });

  // ─── VAT Calculation ───────────────────────────────────────────────

  describe('calculateVat', () => {
    it('should return zero amounts when no entries exist', async () => {
      mockPrisma.journalEntry.findMany.mockResolvedValue([]);

      const result = await service.calculateVat('company-1', '2026-01-01', '2026-01-31');

      expect(result.period).toEqual({ from: '2026-01-01', to: '2026-01-31' });
      expect(result.outputVat.standard16).toBe(0);
      expect(result.outputVat.total).toBe(0);
      expect(result.inputVat.standard16).toBe(0);
      expect(result.inputVat.total).toBe(0);
      expect(result.netVatPayable).toBe(0);
      expect(result.entriesCount.total).toBe(0);
      expect(result.entriesCount.vatRated).toBe(0);
      expect(result.entriesCount.exempt).toBe(0);
    });

    it('should calculate 16% output VAT on INCOME CREDIT entries with default rate', async () => {
      mockPrisma.journalEntry.findMany.mockResolvedValue([
        {
          id: 'entry-1',
          companyId: 'company-1',
          accountId: 'acct-1',
          amount: 116000, // 100,000 + 16,000 VAT
          direction: 'CREDIT',
          entryDate: new Date('2026-01-15'),
          account: {
            id: 'acct-1',
            code: '4001',
            name: 'Consulting Revenue',
            type: 'INCOME',
            taxRate: null, // null = use default (16%)
          },
        },
      ]);

      const result = await service.calculateVat('company-1', '2026-01-01', '2026-01-31');

      // VAT = 116000 * 16 / 116 = 16000
      expect(result.outputVat.standard16).toBeCloseTo(16000, 2);
      expect(result.outputVat.total).toBeCloseTo(16000, 2);
      expect(result.inputVat.total).toBe(0);
      expect(result.netVatPayable).toBeCloseTo(16000, 2);
      expect(result.entriesCount.total).toBe(1);
      expect(result.entriesCount.vatRated).toBe(1);
      expect(result.entriesCount.exempt).toBe(0);
    });

    it('should calculate 16% input VAT on EXPENSE DEBIT entries', async () => {
      mockPrisma.journalEntry.findMany.mockResolvedValue([
        {
          id: 'entry-1',
          companyId: 'company-1',
          accountId: 'acct-1',
          amount: 116000,
          direction: 'DEBIT',
          entryDate: new Date('2026-01-15'),
          account: {
            id: 'acct-1',
            code: '5001',
            name: 'Office Supplies',
            type: 'EXPENSE',
            taxRate: null, // null = use default (16%)
          },
        },
      ]);

      const result = await service.calculateVat('company-1', '2026-01-01', '2026-01-31');

      expect(result.outputVat.total).toBe(0);
      expect(result.inputVat.standard16).toBeCloseTo(16000, 2);
      expect(result.inputVat.total).toBeCloseTo(16000, 2);
      expect(result.netVatPayable).toBeCloseTo(-16000, 2); // refundable
    });

    it('should respect account-level taxRate override (8% reduced)', async () => {
      mockPrisma.journalEntry.findMany.mockResolvedValue([
        {
          id: 'entry-1',
          companyId: 'company-1',
          accountId: 'acct-1',
          amount: 108000,
          direction: 'CREDIT',
          entryDate: new Date('2026-01-15'),
          account: {
            id: 'acct-1',
            code: '4002',
            name: 'Reduced Rate Sales',
            type: 'INCOME',
            taxRate: 8, // reduced rate override
          },
        },
      ]);

      const result = await service.calculateVat('company-1', '2026-01-01', '2026-01-31');

      // VAT = 108000 * 8 / 108 = 8000
      expect(result.outputVat.reduced8).toBeCloseTo(8000, 2);
      expect(result.outputVat.standard16).toBe(0);
      expect(result.outputVat.total).toBeCloseTo(8000, 2);
    });

    it('should treat accounts with taxRate=0 as zero-rated', async () => {
      mockPrisma.journalEntry.findMany.mockResolvedValue([
        {
          id: 'entry-1',
          companyId: 'company-1',
          accountId: 'acct-1',
          amount: 100000,
          direction: 'CREDIT',
          entryDate: new Date('2026-01-15'),
          account: {
            id: 'acct-1',
            code: '4003',
            name: 'Export Sales',
            type: 'INCOME',
            taxRate: 0, // zero-rated
          },
        },
      ]);

      const result = await service.calculateVat('company-1', '2026-01-01', '2026-01-31');

      expect(result.outputVat.standard16).toBe(0);
      expect(result.outputVat.reduced8).toBe(0);
      expect(result.outputVat.zeroRated).toBe(0);
      expect(result.entriesCount.vatRated).toBe(1);
    });

    it('should treat accounts with explicit taxRate=null as exempt (non-P&L) and non-P&L accounts as exempt', async () => {
      // ASSET accounts with no taxRate override are exempt
      mockPrisma.journalEntry.findMany.mockResolvedValue([
        {
          id: 'entry-1',
          companyId: 'company-1',
          accountId: 'acct-1',
          amount: 50000,
          direction: 'DEBIT',
          entryDate: new Date('2026-01-15'),
          account: {
            id: 'acct-1',
            code: '1001',
            name: 'Cash at Bank',
            type: 'ASSET',
            taxRate: null, // non-P&L accounts are exempt by default
          },
        },
      ]);

      const result = await service.calculateVat('company-1', '2026-01-01', '2026-01-31');

      expect(result.entriesCount.total).toBe(1);
      expect(result.entriesCount.vatRated).toBe(0);
      expect(result.entriesCount.exempt).toBe(1);
      // Non-P&L entries are not included in input VAT
      expect(result.inputVat.standard16).toBe(0);
      expect(result.inputVat.total).toBe(0);
    });

    it('should handle mixed INCOME and EXPENSE entries', async () => {
      mockPrisma.journalEntry.findMany.mockResolvedValue([
        {
          id: 'entry-1',
          companyId: 'company-1',
          accountId: 'acct-income',
          amount: 116000,
          direction: 'CREDIT',
          entryDate: new Date('2026-01-15'),
          account: { id: 'acct-income', code: '4001', name: 'Sales', type: 'INCOME', taxRate: null },
        },
        {
          id: 'entry-2',
          companyId: 'company-1',
          accountId: 'acct-expense',
          amount: 58000,
          direction: 'DEBIT',
          entryDate: new Date('2026-01-16'),
          account: { id: 'acct-expense', code: '5001', name: 'Supplies', type: 'EXPENSE', taxRate: null },
        },
      ]);

      const result = await service.calculateVat('company-1', '2026-01-01', '2026-01-31');

      expect(result.outputVat.standard16).toBeCloseTo(16000, 2); // 116000 * 16/116
      expect(result.inputVat.standard16).toBeCloseTo(8000, 2); // 58000 * 16/116
      expect(result.netVatPayable).toBeCloseTo(8000, 2); // 16000 - 8000
      expect(result.entriesCount.total).toBe(2);
    });

    it('should handle partial month periods', async () => {
      mockPrisma.journalEntry.findMany.mockResolvedValue([
        {
          id: 'entry-1',
          companyId: 'company-1',
          accountId: 'acct-1',
          amount: 116000,
          direction: 'CREDIT',
          entryDate: new Date('2026-01-15'),
          account: { id: 'acct-1', code: '4001', name: 'Sales', type: 'INCOME', taxRate: null },
        },
      ]);

      const result = await service.calculateVat('company-1', '2026-01-10', '2026-01-20');

      expect(result.period).toEqual({ from: '2026-01-10', to: '2026-01-20' });
      expect(result.entriesCount.total).toBe(1);
      expect(result.outputVat.standard16).toBeCloseTo(16000, 2);
    });

    it('should exclude ASSET/LIABILITY/EQUITY entries from VAT calculation', async () => {
      mockPrisma.journalEntry.findMany.mockResolvedValue([
        {
          id: 'entry-1',
          companyId: 'company-1',
          accountId: 'acct-asset',
          amount: 1000000,
          direction: 'DEBIT',
          entryDate: new Date('2026-01-15'),
          account: { id: 'acct-asset', code: '1001', name: 'Cash', type: 'ASSET', taxRate: null },
        },
        {
          id: 'entry-2',
          companyId: 'company-1',
          accountId: 'acct-income',
          amount: 116000,
          direction: 'CREDIT',
          entryDate: new Date('2026-01-15'),
          account: { id: 'acct-income', code: '4001', name: 'Sales', type: 'INCOME', taxRate: null },
        },
      ]);

      const result = await service.calculateVat('company-1', '2026-01-01', '2026-01-31');

      // Only the INCOME entry should contribute to VAT
      expect(result.entriesCount.total).toBe(2);
      expect(result.entriesCount.vatRated).toBe(1); // Income entry
      expect(result.entriesCount.exempt).toBe(1); // Asset entry (non-P&L)
      expect(result.outputVat.standard16).toBeCloseTo(16000, 2);
    });
  });
});
