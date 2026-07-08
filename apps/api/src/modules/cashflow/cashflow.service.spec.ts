import { Test, TestingModule } from '@nestjs/testing';
import { CashflowService } from './cashflow.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('CashflowService', () => {
  let service: CashflowService;
  let prisma: any;

  const mockPrisma = {
    $queryRaw: jest.fn(),
    journalEntry: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
    invoice: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CashflowService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CashflowService>(CashflowService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();

    // Default: DB now returns a fixed timestamp
    mockPrisma.$queryRaw.mockResolvedValue([{ now: new Date('2026-07-08T12:00:00Z') }]);
  });

  // -----------------------------------------------------------------------
  // getForecast
  // -----------------------------------------------------------------------

  describe('getForecast', () => {
    it('should return empty forecast for company with zero transactions', async () => {
      mockPrisma.journalEntry.findMany.mockResolvedValue([]);
      mockPrisma.invoice.findMany.mockResolvedValue([]);
      mockPrisma.journalEntry.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 0 } })
        .mockResolvedValueOnce({ _sum: { amount: 0 } })
        .mockResolvedValueOnce({ _sum: { amount: 0 } });

      const result = await service.getForecast('comp_empty');

      expect(result.currentBalance).toBe(0);
      expect(result.forecast).toHaveLength(0);
      expect(result.alerts).toHaveLength(0);
      expect(result.nextLowPoint).toBeNull();
    });

    it('should return LOW confidence for company with less than 3 months data', async () => {
      // Mock: only 2 months data
      const twoMonthsAgo = new Date('2026-05-01');
      const entries = [
        {
          description: 'Rent payment',
          amount: 100000,
          direction: 'DEBIT',
          entryDate: twoMonthsAgo,
          account: { type: 'EXPENSE', name: 'Rent' },
        },
        {
          description: 'Rent payment',
          amount: 100000,
          direction: 'DEBIT',
          entryDate: new Date('2026-06-01'),
          account: { type: 'EXPENSE', name: 'Rent' },
        },
        {
          description: 'Client payment',
          amount: 200000,
          direction: 'CREDIT',
          entryDate: twoMonthsAgo,
          account: { type: 'INCOME', name: 'Services' },
        },
        {
          description: 'Client payment',
          amount: 200000,
          direction: 'CREDIT',
          entryDate: new Date('2026-06-01'),
          account: { type: 'INCOME', name: 'Services' },
        },
      ];

      mockPrisma.journalEntry.findMany.mockResolvedValue(entries);
      mockPrisma.invoice.findMany.mockResolvedValue([]);
      // Current balance: credits - debits
      mockPrisma.journalEntry.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 0 } }) // total unused
        .mockResolvedValueOnce({ _sum: { amount: 400000 } }) // credits
        .mockResolvedValueOnce({ _sum: { amount: 200000 } }); // debits

      const result = await service.getForecast('comp_new', 3);

      // Confidence should be LOW because only 2 months of data (< 3)
      for (const month of result.forecast) {
        expect(month.confidence).toBe('LOW');
      }
      // Balance = 400k - 200k = 200k
      expect(result.currentBalance).toBe(200000);
    });

    it('should detect recurring bills from 3+ months of same-day entries', async () => {
      // Rent on the 1st of each month for 6 months
      const entries = [];
      for (let m = 1; m <= 6; m++) {
        entries.push({
          description: 'Rent - Westlands Office',
          amount: 120000,
          direction: 'DEBIT',
          entryDate: new Date(2026, m, 1),
          account: { type: 'EXPENSE', name: 'Rent' },
        });
        // Income on the 5th
        entries.push({
          description: 'Acme Enterprises retainer',
          amount: 150000,
          direction: 'CREDIT',
          entryDate: new Date(2026, m, 5),
          account: { type: 'INCOME', name: 'Consulting' },
        });
      }

      mockPrisma.journalEntry.findMany.mockResolvedValue(entries);
      mockPrisma.invoice.findMany.mockResolvedValue([]);
      mockPrisma.journalEntry.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 0 } })
        .mockResolvedValueOnce({ _sum: { amount: 900000 } }) // 6 * 150k
        .mockResolvedValueOnce({ _sum: { amount: 720000 } }); // 6 * 120k

      const result = await service.getForecast('comp_recurring', 3);

      expect(result.currentBalance).toBe(180000);
      expect(result.forecast.length).toBeGreaterThan(0);

      // Each forecast month should have recurring bills and expected income
      for (const month of result.forecast) {
        expect(month.recurringBills.length).toBeGreaterThanOrEqual(1);
        expect(month.expectedIncome.length).toBeGreaterThanOrEqual(1);
        // 2 unique patterns → MEDIUM (need ≥3 bill patterns for HIGH)
        expect(month.confidence).toBe('MEDIUM');
      }
    });

    it('should generate LOW-cash WARNING alert when balance dips below 50,000', async () => {
      // Large recurring expense, small income — simulate cash crunch
      const entries: any[] = [];
      for (let m = 1; m <= 4; m++) {
        entries.push({
          description: 'Supplier payment',
          amount: 500000,
          direction: 'DEBIT',
          entryDate: new Date(2026, m, 15),
          account: { type: 'EXPENSE', name: 'Cost of Goods' },
        });
        entries.push({
          description: 'Sales income',
          amount: 200000,
          direction: 'CREDIT',
          entryDate: new Date(2026, m, 20),
          account: { type: 'INCOME', name: 'Sales' },
        });
      }

      mockPrisma.journalEntry.findMany.mockResolvedValue(entries);
      mockPrisma.invoice.findMany.mockResolvedValue([]);
      // Starting balance: 400k credit - 0 debit (only entries the expenses reduce it)
      mockPrisma.journalEntry.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 0 } })
        .mockResolvedValueOnce({ _sum: { amount: 800000 } }) // credits
        .mockResolvedValueOnce({ _sum: { amount: 2000000 } }); // debits

      const result = await service.getForecast('comp_crunch', 3);

      // Should have LOW-cash warnings
      const lowCashAlerts = result.alerts.filter(
        (a) => a.type === 'WARNING' && a.message.includes('below KSh 50,000'),
      );
      expect(lowCashAlerts.length).toBeGreaterThanOrEqual(1);

      // Next low point should be a warning
      if (result.nextLowPoint) {
        expect(result.nextLowPoint.isWarning).toBe(true);
      }
    });

    it('should generate income-shortfall alert for 2+ consecutive months', async () => {
      // Expenses consistently higher than income
      const entries: any[] = [];
      for (let m = 1; m <= 4; m++) {
        entries.push({
          description: 'Rent',
          amount: 200000,
          direction: 'DEBIT',
          entryDate: new Date(2026, m, 1),
          account: { type: 'EXPENSE', name: 'Rent' },
        });
        entries.push({
          description: 'Consulting fee',
          amount: 100000,
          direction: 'CREDIT',
          entryDate: new Date(2026, m, 5),
          account: { type: 'INCOME', name: 'Consulting' },
        });
      }

      mockPrisma.journalEntry.findMany.mockResolvedValue(entries);
      mockPrisma.invoice.findMany.mockResolvedValue([]);
      mockPrisma.journalEntry.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 0 } })
        .mockResolvedValueOnce({ _sum: { amount: 400000 } })
        .mockResolvedValueOnce({ _sum: { amount: 800000 } });

      const result = await service.getForecast('comp_shortfall', 3);

      const shortfallAlerts = result.alerts.filter(
        (a) => a.type === 'WARNING' && a.message.includes('income is less than expenses'),
      );
      expect(shortfallAlerts.length).toBeGreaterThanOrEqual(1);
    });
  });

  // -----------------------------------------------------------------------
  // getInsights
  // -----------------------------------------------------------------------

  describe('getInsights', () => {
    it('should return empty stats for company with no data', async () => {
      mockPrisma.journalEntry.findMany.mockResolvedValue([]);
      mockPrisma.invoice.findMany.mockResolvedValue([]);
      mockPrisma.journalEntry.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 0 } })
        .mockResolvedValueOnce({ _sum: { amount: 0 } })
        .mockResolvedValueOnce({ _sum: { amount: 0 } });

      const result = await service.getInsights('comp_empty');

      expect(result.averageMonthlyIncome).toBe(0);
      expect(result.averageMonthlyExpenses).toBe(0);
      expect(result.monthsOfRunway).toBe(0);
      expect(result.topExpenseCategories).toHaveLength(0);
    });

    it('should compute correct averages from ledger data', async () => {
      const entries = [];
      for (let m = 1; m <= 3; m++) {
        entries.push({
          description: 'Income',
          amount: 300000,
          direction: 'CREDIT',
          entryDate: new Date(2026, m, 15),
          account: { type: 'INCOME', name: 'Sales' },
        });
        entries.push({
          description: 'Expense',
          amount: 100000,
          direction: 'DEBIT',
          entryDate: new Date(2026, m, 20),
          account: { type: 'EXPENSE', name: 'Rent' },
        });
      }

      mockPrisma.journalEntry.findMany.mockResolvedValue(entries);
      mockPrisma.invoice.findMany.mockResolvedValue([]);
      mockPrisma.journalEntry.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 0 } })
        .mockResolvedValueOnce({ _sum: { amount: 900000 } })
        .mockResolvedValueOnce({ _sum: { amount: 300000 } });

      const result = await service.getInsights('comp_stats');

      // 3 months: 300k income each month, 100k expense each month
      expect(result.averageMonthlyIncome).toBe(300000);
      expect(result.averageMonthlyExpenses).toBe(100000);
      // Runway: 600k / 100k = 6 months
      expect(result.monthsOfRunway).toBe(6);
      // Top expense categories
      expect(result.topExpenseCategories.length).toBeGreaterThanOrEqual(1);
      expect(result.topExpenseCategories[0].category).toBe('Rent');
    });

    it('should compute invoice payment stats', async () => {
      const invoices = [
        {
          id: 'inv_1',
          invoiceNumber: 'INV-001',
          customerName: 'Client A',
          total: 50000,
          dueDate: new Date('2026-01-01'),
          paidAt: new Date('2026-01-15'),
          status: 'PAID',
        },
        {
          id: 'inv_2',
          invoiceNumber: 'INV-002',
          customerName: 'Client B',
          total: 75000,
          dueDate: new Date('2026-02-01'),
          paidAt: new Date('2026-02-10'),
          status: 'PAID',
        },
        {
          id: 'inv_3',
          invoiceNumber: 'INV-003',
          customerName: 'Client C',
          total: 100000,
          dueDate: new Date('2026-03-01'),
          paidAt: new Date('2026-04-15'), // 45 days overdue
          status: 'PAID',
        },
      ];

      mockPrisma.journalEntry.findMany.mockResolvedValue([
        {
          description: 'Income',
          amount: 100000,
          direction: 'CREDIT',
          entryDate: new Date('2026-01-15'),
          account: { type: 'INCOME', name: 'Sales' },
        },
      ]);
      mockPrisma.invoice.findMany.mockResolvedValue(invoices);
      mockPrisma.journalEntry.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 0 } })
        .mockResolvedValueOnce({ _sum: { amount: 100000 } })
        .mockResolvedValueOnce({ _sum: { amount: 0 } });

      const result = await service.getInsights('comp_invoices');

      // avg delay: (14 + 9 + 45) / 3 = ~22.7 => rounded to 23
      expect(result.invoicePaymentStats.averagePaymentDays).toBeGreaterThan(0);
      expect(result.invoicePaymentStats.paidWithin30Days).toBeGreaterThanOrEqual(66); // 2/3 = 67%
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('should handle extreme outliers by excluding them from recurring patterns', async () => {
      // 5 months of small rent + 1 month of huge "rent" (outlier)
      const entries: any[] = [];
      for (let m = 1; m <= 5; m++) {
        entries.push({
          description: 'Rent payment',
          amount: m === 4 ? 1200000 : 120000, // month 4 is 10x outlier
          direction: 'DEBIT',
          entryDate: new Date(2026, m, 1),
          account: { type: 'EXPENSE', name: 'Rent' },
        });
      }

      mockPrisma.journalEntry.findMany.mockResolvedValue(entries);
      mockPrisma.invoice.findMany.mockResolvedValue([]);
      mockPrisma.journalEntry.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 0 } })
        .mockResolvedValueOnce({ _sum: { amount: 0 } })
        .mockResolvedValueOnce({ _sum: { amount: 1680000 } });

      const result = await service.getForecast('comp_outliers', 3);

      // Should still produce a forecast (even if low confidence)
      expect(result.forecast.length).toBeGreaterThan(0);
      // The outlier should not distort the average too much
      // After outlier removal, avg amount should be ~120000
      const firstMonth = result.forecast[0];
      if (firstMonth.recurringBills.length > 0) {
        expect(firstMonth.recurringBills[0].amount).toBeLessThan(200000);
      }
    });

    it('should detect no recurring patterns and return basic average forecast', async () => {
      // Random one-off entries, no pattern
      const entries = [
        {
          description: 'One-time purchase',
          amount: 50000,
          direction: 'DEBIT',
          entryDate: new Date('2026-01-15'),
          account: { type: 'EXPENSE', name: 'Supplies' },
        },
        {
          description: 'One-time sale',
          amount: 100000,
          direction: 'CREDIT',
          entryDate: new Date('2026-03-20'),
          account: { type: 'INCOME', name: 'Sales' },
        },
      ];

      mockPrisma.journalEntry.findMany.mockResolvedValue(entries);
      mockPrisma.invoice.findMany.mockResolvedValue([]);
      mockPrisma.journalEntry.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 0 } })
        .mockResolvedValueOnce({ _sum: { amount: 100000 } })
        .mockResolvedValueOnce({ _sum: { amount: 50000 } });

      const result = await service.getForecast('comp_random', 3);

      // Should return basic forecast with LOW confidence
      expect(result.forecast.length).toBeGreaterThan(0);
      for (const month of result.forecast) {
        expect(month.confidence).toBe('LOW');
        // No recurring patterns
        expect(month.recurringBills).toHaveLength(0);
        expect(month.expectedIncome).toHaveLength(0);
      }
    });
  });

  // -----------------------------------------------------------------------
  // TIME-TRAVEL compliance verification
  // -----------------------------------------------------------------------

  describe('TIME-TRAVEL compliance', () => {
    it('should query DB NOW() instead of using new Date()', async () => {
      mockPrisma.journalEntry.findMany.mockResolvedValue([]);
      mockPrisma.invoice.findMany.mockResolvedValue([]);
      mockPrisma.journalEntry.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 0 } })
        .mockResolvedValueOnce({ _sum: { amount: 0 } })
        .mockResolvedValueOnce({ _sum: { amount: 0 } });

      await service.getForecast('comp_tt', 3);

      // Should have called $queryRaw with SELECT NOW()
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      const callArg = mockPrisma.$queryRaw.mock.calls[0][0];
      expect(callArg.text?.toLowerCase?.() ?? String(callArg).toLowerCase()).toMatch(/now\(\)/);
    });
  });
});
