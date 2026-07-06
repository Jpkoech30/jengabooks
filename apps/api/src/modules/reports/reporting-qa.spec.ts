/**
 * Reporting & QA Tests — Phase E
 *
 * Edge cases:
 * - Period-over-period comparison (current vs prior month)
 * - Variance calculations (absolute and percentage)
 * - Duplicate payment detection (same amount + same payee within 90 days)
 * - Shareable token generation with expiry
 * - Bank-grade report formatting
 */

interface PeriodData {
  period: string;
  revenue: number;
  expenses: number;
  netIncome: number;
}

interface Variance {
  absolute: number;
  percentage: number;
  direction: 'up' | 'down' | 'flat';
}

function calculateVariance(current: number, prior: number): Variance {
  const absolute = current - prior;
  const percentage = prior !== 0 ? Math.round((absolute / prior) * 100) : 0;
  return {
    absolute,
    percentage,
    direction: absolute > 0 ? 'up' : absolute < 0 ? 'down' : 'flat',
  };
}

function comparePeriods(current: PeriodData, prior: PeriodData) {
  return {
    revenue: calculateVariance(current.revenue, prior.revenue),
    expenses: calculateVariance(current.expenses, prior.expenses),
    netIncome: calculateVariance(current.netIncome, prior.netIncome),
  };
}

function detectDuplicate(
  amount: number,
  description: string,
  recentTransactions: Array<{ id?: string; amount: number; description: string; date: Date }>,
  daysThreshold: number = 90,
): { isDuplicate: boolean; matchId?: string; matchDate?: Date } {
  const now = new Date();
  const threshold = daysThreshold * 24 * 60 * 60 * 1000;

  for (const tx of recentTransactions) {
    const timeDiff = now.getTime() - new Date(tx.date).getTime();
    if (timeDiff > threshold) continue;

    if (tx.amount === amount && tx.description.toLowerCase() === description.toLowerCase()) {
      return { isDuplicate: true, matchId: tx.id, matchDate: tx.date };
    }
  }

  return { isDuplicate: false };
}

function generateShareToken(reportId: string): { token: string; expiresAt: Date } {
  const token = `shr_${reportId.substring(0, 8)}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  return { token, expiresAt };
}

function formatBankGrade(report: { name: string; items: Array<{ label: string; amount: number }>; total: number }) {
  return {
    title: report.name,
    headers: ['#', 'Description', 'Amount (KES)'],
    rows: report.items.map((item, i) => [
      String(i + 1),
      item.label,
      item.amount.toLocaleString('en-KE', { minimumFractionDigits: 2 }),
    ]),
    footer: [`${report.items.length + 1}`, 'TOTAL', report.total.toLocaleString('en-KE', { minimumFractionDigits: 2 })],
    generatedAt: new Date().toISOString(),
    disclaimer: 'This is a computer-generated document. For financial decisions, consult a professional accountant.',
  };
}

describe('Reporting & QA — Phase E', () => {
  const currentMonth: PeriodData = { period: '2026-07', revenue: 500000, expenses: 350000, netIncome: 150000 };
  const priorMonth: PeriodData = { period: '2026-06', revenue: 450000, expenses: 320000, netIncome: 130000 };

  describe('Period Comparison', () => {
    it('should calculate revenue increase', () => {
      const result = comparePeriods(currentMonth, priorMonth);
      expect(result.revenue.absolute).toBe(50000);
      expect(result.revenue.percentage).toBe(11);
      expect(result.revenue.direction).toBe('up');
    });

    it('should calculate expense increase', () => {
      const result = comparePeriods(currentMonth, priorMonth);
      expect(result.expenses.absolute).toBe(30000);
      expect(result.expenses.percentage).toBe(9);
    });

    it('should calculate net income growth', () => {
      const result = comparePeriods(currentMonth, priorMonth);
      expect(result.netIncome.absolute).toBe(20000);
      expect(result.netIncome.percentage).toBe(15);
    });

    it('should return flat when no change', () => {
      const same: PeriodData = { period: '2026-07', revenue: 100, expenses: 50, netIncome: 50 };
      const result = comparePeriods(same, same);
      expect(result.revenue.direction).toBe('flat');
      expect(result.revenue.percentage).toBe(0);
    });

    it('should handle zero prior period', () => {
      const zeroPrior: PeriodData = { period: '2026-05', revenue: 0, expenses: 0, netIncome: 0 };
      const result = comparePeriods(currentMonth, zeroPrior);
      expect(result.revenue.percentage).toBe(0); // Can't divide by zero
    });
  });

  describe('Duplicate Payment Detection', () => {
    const recentTxns = [
      { id: 'tx1', amount: 50000, description: 'Office rent', date: new Date('2026-06-01') },
      { id: 'tx2', amount: 50000, description: 'Office rent', date: new Date('2026-07-01') },
      { id: 'tx3', amount: 2500, description: 'Internet bill', date: new Date('2026-06-15') },
    ];

    it('should detect duplicate within threshold', () => {
      const result = detectDuplicate(2500, 'Internet bill', recentTxns as any);
      expect(result.isDuplicate).toBe(true);
    });

    it('should not flag different amounts', () => {
      const result = detectDuplicate(3000, 'Internet bill', recentTxns as any);
      expect(result.isDuplicate).toBe(false);
    });

    it('should not flag different descriptions', () => {
      const result = detectDuplicate(2500, 'Phone bill', recentTxns as any);
      expect(result.isDuplicate).toBe(false);
    });

    it('should be case-insensitive on description match', () => {
      const result = detectDuplicate(50000, 'OFFICE RENT', recentTxns as any);
      expect(result.isDuplicate).toBe(true);
    });

    it('should return no duplicate for empty history', () => {
      const result = detectDuplicate(1000, 'Test', []);
      expect(result.isDuplicate).toBe(false);
    });
  });

  describe('Shareable Token', () => {
    it('should generate token with shr_ prefix', () => {
      const result = generateShareToken('report-12345');
      expect(result.token).toMatch(/^shr_/);
    });

    it('should set expiry to 24 hours from now', () => {
      const result = generateShareToken('report-1');
      const diffMs = result.expiresAt.getTime() - Date.now();
      const diffHours = Math.round(diffMs / (1000 * 60 * 60));
      expect(diffHours).toBe(24);
    });

    it('should generate unique tokens', () => {
      const t1 = generateShareToken('report-1');
      const t2 = generateShareToken('report-1');
      expect(t1.token).not.toBe(t2.token);
    });
  });

  describe('Bank-Grade Formatting', () => {
    const report = {
      name: 'Profit & Loss Statement',
      items: [
        { label: 'Revenue', amount: 500000 },
        { label: 'Cost of Goods Sold', amount: 200000 },
        { label: 'Operating Expenses', amount: 150000 },
      ],
      total: 150000,
    };

    it('should include title and headers', () => {
      const result = formatBankGrade(report);
      expect(result.title).toBe('Profit & Loss Statement');
      expect(result.headers).toContain('Amount (KES)');
    });

    it('should number rows sequentially', () => {
      const result = formatBankGrade(report);
      expect(result.rows[0][0]).toBe('1');
      expect(result.rows[1][0]).toBe('2');
    });

    it('should format amounts with KES locale', () => {
      const result = formatBankGrade(report);
      expect(result.rows[0][2]).toContain(',');
    });

    it('should include total in footer', () => {
      const result = formatBankGrade(report);
      expect(result.footer[1]).toBe('TOTAL');
    });

    it('should include disclaimer', () => {
      const result = formatBankGrade(report);
      expect(result.disclaimer).toContain('professional accountant');
    });
  });
});
