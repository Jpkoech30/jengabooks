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

  const mockAuditLogs = [
    { id: '1', companyId: 'c1', userId: 'u1', user: { id: 'u1', name: 'Admin', email: 'admin@test.com' }, action: 'LOGIN', entityType: 'USER', entityId: 'u1', createdAt: new Date('2026-07-01') },
    { id: '2', companyId: 'c1', userId: 'u1', user: { id: 'u1', name: 'Admin', email: 'admin@test.com' }, action: 'CREATE_ENTRY', entityType: 'JOURNAL_ENTRY', entityId: 'je-1', createdAt: new Date('2026-07-02') },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: PrismaService,
          useValue: {
            journalEntry: { findMany: jest.fn() },
            auditLog: {
              findMany: jest.fn(),
              count: jest.fn(),
            },
          },
        },
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

  describe('getAuditTrail', () => {
    it('should return paginated audit logs', async () => {
      prisma.auditLog.findMany.mockResolvedValue(mockAuditLogs);
      prisma.auditLog.count.mockResolvedValue(2);
      const result = await service.getAuditTrail('c1');
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.items[0].action).toBe('LOGIN');
    });

    it('should filter by entityType', async () => {
      prisma.auditLog.findMany.mockResolvedValue([mockAuditLogs[1]]);
      prisma.auditLog.count.mockResolvedValue(1);
      const result = await service.getAuditTrail('c1', { entityType: 'JOURNAL_ENTRY' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].entityType).toBe('JOURNAL_ENTRY');
      // Verify the where clause included entityType
      const findManyCall = prisma.auditLog.findMany.mock.calls[0][0];
      expect(findManyCall.where.entityType).toBe('JOURNAL_ENTRY');
    });

    it('should return empty array for no logs', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);
      const result = await service.getAuditTrail('c1');
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should respect limit and offset', async () => {
      prisma.auditLog.findMany.mockResolvedValue([mockAuditLogs[0]]);
      prisma.auditLog.count.mockResolvedValue(2);
      const result = await service.getAuditTrail('c1', { limit: 1, offset: 1 });
      expect(result.limit).toBe(1);
      expect(result.offset).toBe(1);
      const findManyCall = prisma.auditLog.findMany.mock.calls[0][0];
      expect(findManyCall.take).toBe(1);
      expect(findManyCall.skip).toBe(1);
    });
  });
});
