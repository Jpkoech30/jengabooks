import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: any;

  const mockEntries = [
    { accountId: '1', amount: 10000, direction: 'CREDIT', deletedAt: null, entryDate: new Date('2026-06-01'), account: { code: '4000', name: 'Revenue', type: 'INCOME' } },
    { accountId: '2', amount: 5000, direction: 'DEBIT', deletedAt: null, entryDate: new Date('2026-06-15'), account: { code: '5000', name: 'Salaries', type: 'EXPENSE' } },
    { accountId: '3', amount: 2000, direction: 'DEBIT', deletedAt: null, entryDate: new Date('2026-06-20'), account: { code: '1000', name: 'Cash', type: 'ASSET' } },
    { accountId: '4', amount: 2000, direction: 'CREDIT', deletedAt: null, entryDate: new Date('2026-06-20'), account: { code: '3000', name: 'Equity', type: 'EQUITY' } },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: { journalEntry: { findMany: jest.fn() } } },
        { provide: GamificationService, useValue: { awardXp: jest.fn().mockResolvedValue({}) } },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  describe('getProfitLoss', () => {
    it('should calculate net income from income and expense entries', async () => {
      prisma.journalEntry.findMany.mockResolvedValue(mockEntries);
      const result = await service.getProfitLoss('c1', 'u1');
      expect(result.totalIncome).toBe(10000);
      expect(result.totalExpenses).toBe(5000);
      expect(result.netIncome).toBe(5000);
    });

    it('should return zero values for empty data', async () => {
      prisma.journalEntry.findMany.mockResolvedValue([]);
      const result = await service.getProfitLoss('c1', 'u1');
      expect(result.totalIncome).toBe(0);
      expect(result.totalExpenses).toBe(0);
      expect(result.netIncome).toBe(0);
    });
  });

  describe('getBalanceSheet', () => {
    it('should calculate assets, liabilities, equity', async () => {
      prisma.journalEntry.findMany.mockResolvedValue(mockEntries);
      const result = await service.getBalanceSheet('c1');
      expect(result.totalAssets).toBe(2000);
      expect(result.totalEquity).toBe(2000);
      expect(result.balanced).toBe(true);
    });
  });

  describe('getTrialBalance', () => {
    it('should calculate debit and credit totals', async () => {
      prisma.journalEntry.findMany.mockResolvedValue(mockEntries);
      const result = await service.getTrialBalance('c1');
      expect(result.totalDebits).toBe(7000); // 5000 + 2000
      expect(result.totalCredits).toBe(12000); // 10000 + 2000
    });
  });

  describe('getCashFlow', () => {
    it('should calculate operating cash flow', async () => {
      prisma.journalEntry.findMany.mockResolvedValue(mockEntries);
      const result = await service.getCashFlow('c1');
      expect(result.operating.inflows).toBeGreaterThan(0);
      expect(result.netCashChange).toBeDefined();
    });
  });
});
