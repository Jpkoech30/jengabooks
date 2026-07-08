import { Test, TestingModule } from '@nestjs/testing';
import { PracticeService } from '../practice.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('PracticeService', () => {
  let service: PracticeService;
  let prisma: jest.Mocked<PrismaService>;

  const mockPrisma = {
    $queryRaw: jest.fn(),
    company: {
      findUnique: jest.fn(),
    },
    companyMember: {
      findMany: jest.fn(),
    },
    journalEntry: {
      count: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    bankTransaction: {
      findFirst: jest.fn(),
    },
    mpesaTransaction: {
      findFirst: jest.fn(),
      aggregate: jest.fn(),
    },
    pendingReview: {
      count: jest.fn(),
    },
    eTIMSSubmission: {
      count: jest.fn(),
    },
    invoice: {
      count: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PracticeService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PracticeService>(PracticeService);
    prisma = module.get(PrismaService);

    // Reset all mocks
    jest.clearAllMocks();

    // Default DB timestamp
    mockPrisma.$queryRaw.mockResolvedValue([{ now: new Date('2026-07-08T12:00:00Z') }]);
  });

  describe('getPortfolio', () => {
    it('should return empty clients and zeroed summary when user has no memberships', async () => {
      mockPrisma.companyMember.findMany.mockResolvedValue([]);

      const result = await service.getPortfolio('user_1');

      expect(result).toEqual({
        clients: [],
        summary: {
          totalClients: 0,
          greenCount: 0,
          yellowCount: 0,
          redCount: 0,
          avgHealthScore: 0,
        },
      });
    });

    it('should return a GREEN client with high health score when all metrics are good', async () => {
      const now = new Date('2026-07-08T12:00:00Z');
      mockPrisma.$queryRaw.mockResolvedValue([{ now }]);

      mockPrisma.companyMember.findMany.mockResolvedValue([
        {
          userId: 'user_1',
          companyId: 'comp_001',
          role: 'ACCOUNTANT',
          isActive: true,
          company: { id: 'comp_001', name: 'Acme Ltd', tier: 'LTD' },
        },
      ]);

      // High activity: recent entry (within 7 days), good reconciliation
      mockPrisma.journalEntry.count
        .mockResolvedValueOnce(100)  // total entries
        .mockResolvedValueOnce(95);  // reconciled entries
      mockPrisma.pendingReview.count.mockResolvedValue(0);
      mockPrisma.journalEntry.findFirst.mockResolvedValue({
        entryDate: new Date('2026-07-07T12:00:00Z'), // 1 day ago
      });
      mockPrisma.bankTransaction.findFirst.mockResolvedValue({
        transactionDate: new Date('2026-07-08T10:00:00Z'), // 2 hours ago
      });
      mockPrisma.mpesaTransaction.findFirst.mockResolvedValue({
        transactionDate: new Date('2026-07-08T11:00:00Z'),
      });
      mockPrisma.eTIMSSubmission.count
        .mockResolvedValueOnce(45)  // accepted
        .mockResolvedValueOnce(0);  // failed
      mockPrisma.invoice.count.mockResolvedValue(50);
      mockPrisma.invoice.findFirst.mockResolvedValue({
        dueDate: new Date('2026-08-20T00:00:00Z'), // far in future
      });

      // Entries for monthly calc
      mockPrisma.journalEntry.findMany.mockResolvedValue([
        { amount: 1000, direction: 'CREDIT', account: { type: 'INCOME' } },
        { amount: 500, direction: 'DEBIT', account: { type: 'EXPENSE' } },
      ]);

      mockPrisma.mpesaTransaction.aggregate.mockResolvedValue({
        _sum: { paidIn: 1500000, withdrawn: 950000 },
      });

      const result = await service.getPortfolio('user_1');

      expect(result.clients).toHaveLength(1);
      expect(result.clients[0].name).toBe('Acme Ltd');
      expect(result.clients[0].status).toBe('GREEN');
      expect(result.clients[0].bankConnected).toBe(true);
      expect(result.summary.greenCount).toBe(1);
      expect(result.summary.totalClients).toBe(1);
    });

    it('should return RED status for client with disconnected bank feed', async () => {
      const now = new Date('2026-07-08T12:00:00Z');
      mockPrisma.$queryRaw.mockResolvedValue([{ now }]);

      mockPrisma.companyMember.findMany.mockResolvedValue([
        {
          userId: 'user_1',
          companyId: 'comp_002',
          role: 'ACCOUNTANT',
          isActive: true,
          company: { id: 'comp_002', name: 'Disconnected Ltd', tier: 'LTD' },
        },
      ]);

      // Total entries, reconciled (none = all unreconciled)
      mockPrisma.journalEntry.count
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(5); // only 5 reconciled → 45 unreconciled (> 30 → RED)
      mockPrisma.pendingReview.count.mockResolvedValue(0);

      // Last activity was 5 days ago
      mockPrisma.journalEntry.findFirst.mockResolvedValue({
        entryDate: new Date('2026-07-03T12:00:00Z'),
      });
      // No bank transaction in 10 hours (disconnected)
      mockPrisma.bankTransaction.findFirst.mockResolvedValue({
        transactionDate: new Date('2026-07-08T00:00:00Z'), // 12 hours ago
      });
      mockPrisma.mpesaTransaction.findFirst.mockResolvedValue(null);

      mockPrisma.eTIMSSubmission.count
        .mockResolvedValueOnce(5)   // accepted
        .mockResolvedValueOnce(10); // failed
      mockPrisma.invoice.count.mockResolvedValue(30);
      mockPrisma.invoice.findFirst.mockResolvedValue(null);

      mockPrisma.journalEntry.findMany.mockResolvedValue([]);
      mockPrisma.mpesaTransaction.aggregate.mockResolvedValue({
        _sum: { paidIn: 0, withdrawn: 0 },
      });

      const result = await service.getPortfolio('user_1');

      expect(result.clients).toHaveLength(1);
      expect(result.clients[0].status).toBe('RED');
      expect(result.clients[0].bankConnected).toBe(false);
      expect(result.clients[0].unreconciledCount).toBe(45);
      expect(result.summary.redCount).toBe(1);
    });
  });

  describe('getClientDetail', () => {
    it('should throw NotFoundException for unknown client', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(null);

      await expect(service.getClientDetail('nonexistent')).rejects.toThrow(
        'Client with id nonexistent not found',
      );
    });

    it('should return detailed health breakdown for a known client', async () => {
      const now = new Date('2026-07-08T12:00:00Z');
      mockPrisma.$queryRaw.mockResolvedValue([{ now }]);

      mockPrisma.company.findUnique.mockResolvedValue({
        id: 'comp_001',
        name: 'Acme Ltd',
        tier: 'LTD',
      } as any);

      // Recent activity, good reconciliation
      mockPrisma.journalEntry.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(80);
      mockPrisma.pendingReview.count.mockResolvedValue(3);
      mockPrisma.journalEntry.findFirst.mockResolvedValue({
        entryDate: new Date('2026-07-07T12:00:00Z'),
      });
      mockPrisma.bankTransaction.findFirst.mockResolvedValue({
        transactionDate: new Date('2026-07-08T10:00:00Z'),
      });
      mockPrisma.mpesaTransaction.findFirst.mockResolvedValue({
        transactionDate: new Date('2026-07-08T11:00:00Z'),
      });
      mockPrisma.eTIMSSubmission.count
        .mockResolvedValueOnce(40)
        .mockResolvedValueOnce(2);
      mockPrisma.invoice.count.mockResolvedValue(50);
      mockPrisma.invoice.findFirst.mockResolvedValue({
        dueDate: new Date('2026-07-10T00:00:00Z'), // 2 days away → YELLOW flag
      });

      mockPrisma.journalEntry.findMany.mockResolvedValue([
        { amount: 2000, direction: 'CREDIT', account: { type: 'INCOME' } },
        { amount: 800, direction: 'DEBIT', account: { type: 'EXPENSE' } },
      ]);
      mockPrisma.mpesaTransaction.aggregate.mockResolvedValue({
        _sum: { paidIn: 1000000, withdrawn: 500000 },
      });

      const result = await service.getClientDetail('comp_001');

      expect(result.clientId).toBe('comp_001');
      expect(result.healthScore).toBeGreaterThan(0);
      expect(result.scoreBreakdown).toBeDefined();
      expect(result.scoreBreakdown.etimsCompliance).toBe(80); // 40/50 * 100
      expect(result.scoreBreakdown.reconciliationRate).toBe(80); // 80/100 * 100
      expect(result.flags).toBeDefined();
      expect(result.nextTasks).toContain('File VAT return for Acme Ltd');
    });
  });

  describe('edge cases', () => {
    it('should handle client with no transactions — score based on bank feed + activity', async () => {
      const now = new Date('2026-07-08T12:00:00Z');
      mockPrisma.$queryRaw.mockResolvedValue([{ now }]);

      mockPrisma.company.findUnique.mockResolvedValue({
        id: 'comp_new',
        name: 'NewCo Ltd',
        tier: 'LTD',
      } as any);

      // No journal entries
      mockPrisma.journalEntry.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      mockPrisma.pendingReview.count.mockResolvedValue(0);
      mockPrisma.journalEntry.findFirst.mockResolvedValue(null);
      mockPrisma.bankTransaction.findFirst.mockResolvedValue(null);
      mockPrisma.mpesaTransaction.findFirst.mockResolvedValue(null);
      mockPrisma.eTIMSSubmission.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      mockPrisma.invoice.count.mockResolvedValue(0);
      mockPrisma.invoice.findFirst.mockResolvedValue(null);
      mockPrisma.journalEntry.findMany.mockResolvedValue([]);
      mockPrisma.mpesaTransaction.aggregate.mockResolvedValue({
        _sum: { paidIn: 0, withdrawn: 0 },
      });

      const result = await service.getClientDetail('comp_new');

      // No flags, should have "No activity" + "Missing bank statements"
      expect(result.flags.length).toBeGreaterThan(0);
    });

    it('should handle client with zero eTIMS invoices — exclude eTIMS from scoring', async () => {
      const now = new Date('2026-07-08T12:00:00Z');
      mockPrisma.$queryRaw.mockResolvedValue([{ now }]);

      mockPrisma.company.findUnique.mockResolvedValue({
        id: 'comp_no_etims',
        name: 'NoETims Ltd',
        tier: 'LTD',
      } as any);

      // Have journal entries but no invoices
      mockPrisma.journalEntry.count
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(18);
      mockPrisma.pendingReview.count.mockResolvedValue(0);
      mockPrisma.journalEntry.findFirst.mockResolvedValue({
        entryDate: new Date('2026-07-07T12:00:00Z'),
      });
      mockPrisma.bankTransaction.findFirst.mockResolvedValue({
        transactionDate: new Date('2026-07-08T10:00:00Z'),
      });
      mockPrisma.mpesaTransaction.findFirst.mockResolvedValue({
        transactionDate: new Date('2026-07-08T11:00:00Z'),
      });
      mockPrisma.eTIMSSubmission.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      mockPrisma.invoice.count.mockResolvedValue(0); // zero invoices
      mockPrisma.invoice.findFirst.mockResolvedValue(null);
      mockPrisma.journalEntry.findMany.mockResolvedValue([]);
      mockPrisma.mpesaTransaction.aggregate.mockResolvedValue({
        _sum: { paidIn: 500000, withdrawn: 200000 },
      });

      const result = await service.getClientDetail('comp_no_etims');

      expect(result.scoreBreakdown.etimsCompliance).toBe(100); // neutralized
      expect(result.healthScore).toBeGreaterThan(0);
    });

    it('should enforce score floor of 30 for disconnected bank', async () => {
      const now = new Date('2026-07-08T12:00:00Z');
      mockPrisma.$queryRaw.mockResolvedValue([{ now }]);

      mockPrisma.company.findUnique.mockResolvedValue({
        id: 'comp_disc',
        name: 'Disc Ltd',
        tier: 'LTD',
      } as any);

      // Perfect everything except disconnected bank
      mockPrisma.journalEntry.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(95);
      mockPrisma.pendingReview.count.mockResolvedValue(0);
      mockPrisma.journalEntry.findFirst.mockResolvedValue({
        entryDate: new Date('2026-07-07T12:00:00Z'),
      });
      // Last bank transaction > 4 hours ago → disconnected
      mockPrisma.bankTransaction.findFirst.mockResolvedValue({
        transactionDate: new Date('2026-07-07T20:00:00Z'), // 16 hours ago
      });
      mockPrisma.mpesaTransaction.findFirst.mockResolvedValue({
        transactionDate: new Date('2026-07-08T11:00:00Z'),
      });
      mockPrisma.eTIMSSubmission.count.mockResolvedValueOnce(50).mockResolvedValueOnce(0);
      mockPrisma.invoice.count.mockResolvedValue(50);
      mockPrisma.invoice.findFirst.mockResolvedValue(null);
      mockPrisma.journalEntry.findMany.mockResolvedValue([]);
      mockPrisma.mpesaTransaction.aggregate.mockResolvedValue({
        _sum: { paidIn: 0, withdrawn: 0 },
      });

      const result = await service.getClientDetail('comp_disc');

      // Health score should be capped at 30 due to disconnected bank
      expect(result.healthScore).toBeLessThanOrEqual(30);
    });
  });

  describe('red flag engine', () => {
    it('should detect no-activity-in-7-days flag', async () => {
      const now = new Date('2026-07-08T12:00:00Z');
      mockPrisma.$queryRaw.mockResolvedValue([{ now }]);

      mockPrisma.company.findUnique.mockResolvedValue({
        id: 'comp_inactive',
        name: 'Inactive Ltd',
        tier: 'LTD',
      } as any);

      // Last activity was 10 days ago
      mockPrisma.journalEntry.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(8);
      mockPrisma.pendingReview.count.mockResolvedValue(0);
      mockPrisma.journalEntry.findFirst.mockResolvedValue({
        entryDate: new Date('2026-06-28T12:00:00Z'), // 10 days ago
      });
      mockPrisma.bankTransaction.findFirst.mockResolvedValue({
        transactionDate: new Date('2026-06-28T10:00:00Z'),
      });
      mockPrisma.mpesaTransaction.findFirst.mockResolvedValue(null);
      mockPrisma.eTIMSSubmission.count.mockResolvedValueOnce(5).mockResolvedValueOnce(0);
      mockPrisma.invoice.count.mockResolvedValue(10);
      mockPrisma.invoice.findFirst.mockResolvedValue(null);
      mockPrisma.journalEntry.findMany.mockResolvedValue([]);
      mockPrisma.mpesaTransaction.aggregate.mockResolvedValue({
        _sum: { paidIn: 0, withdrawn: 0 },
      });

      const result = await service.getClientDetail('comp_inactive');

      expect(result.flags.some((f) => f.message === 'No activity in 7 days')).toBe(true);
      expect(result.flags.some((f) => f.message === 'Bank feed disconnected')).toBe(true);
    });
  });
});
