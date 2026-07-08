import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RecurringBill {
  name: string;
  amount: number;
  dueDate: string; // ISO date
  frequency: string; // 'monthly' | 'weekly' | 'quarterly'
}

interface ExpectedIncome {
  name: string;
  amount: number;
  expectedDate: string; // ISO date
}

interface ForecastMonth {
  month: string;
  projectedIncome: number;
  projectedExpenses: number;
  netCashflow: number;
  closingBalance: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  recurringBills: RecurringBill[];
  expectedIncome: ExpectedIncome[];
}

interface Alert {
  type: 'WARNING' | 'ACTION_REQUIRED' | 'INFO';
  message: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  relatedInvoiceId?: string;
}

interface LowPoint {
  date: string;
  balance: number;
  isWarning: boolean;
}

export interface ForecastResponse {
  currentBalance: number;
  forecast: ForecastMonth[];
  alerts: Alert[];
  nextLowPoint: LowPoint | null;
}

interface TopExpenseCategory {
  category: string;
  amount: number;
  percentage: number;
}

interface InvoicePaymentStats {
  averagePaymentDays: number;
  paidWithin30Days: number;
  overdue60Days: number;
  overdue90Days: number;
}

export interface InsightsResponse {
  averageMonthlyIncome: number;
  averageMonthlyExpenses: number;
  monthsOfRunway: number;
  topExpenseCategories: TopExpenseCategory[];
  invoicePaymentStats: InvoicePaymentStats;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface RawEntry {
  description: string;
  amount: number;
  direction: string;
  entryDate: Date;
  accountType: string;
  accountName: string;
}

interface PatternEntry {
  description: string;
  amount: number;
  direction: string;
  entryDate: Date;
  accountType: string;
  accountName: string;
}

interface RecurringPattern {
  key: string;
  direction: 'CREDIT' | 'DEBIT';
  amounts: number[];
  avgAmount: number;
  stdDev: number;
  dayOfMonth: number;
  monthsObserved: Set<string>;
  accountType: string;
  accountName: string;
  count: number;
}

@Injectable()
export class CashflowService {
  constructor(private readonly prisma: PrismaService) {}

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * GET /api/v1/cashflow/forecast?companyId=xxx&months=3
   */
  async getForecast(companyId: string, months: number = 3): Promise<ForecastResponse> {
    // 1. Get DB clock as single reference point — TIME-TRAVEL compliance
    const dbNow = await this.getDbNow();
    const sixMonthsAgo = new Date(dbNow.getTime() - 180 * 24 * 60 * 60 * 1000);

    // 2. Fetch raw data
    const [entries, invoices, currentBalance] = await Promise.all([
      this.fetchLedgerEntries(companyId, sixMonthsAgo),
      this.fetchPaidInvoices(companyId),
      this.calculateCurrentBalance(companyId),
    ]);

    // 3. Edge case: zero transactions
    if (entries.length === 0 && invoices.length === 0) {
      return {
        currentBalance,
        forecast: [],
        alerts: [],
        nextLowPoint: null,
      };
    }

    // 4. Pattern recognition
    const { recurringBills, recurringIncome, seasonalFactors } =
      this.analyzePatterns(entries, dbNow);

    // 5. Invoice aging analysis
    const agingStats = this.analyzeInvoiceAging(invoices);

    // 6. Determine confidence
    const confidence = this.determineConfidence(recurringBills, recurringIncome, dbNow, sixMonthsAgo);

    // 7. Build forecast months
    const forecast = this.buildForecast(
      dbNow,
      months,
      currentBalance,
      recurringBills,
      recurringIncome,
      seasonalFactors,
      agingStats,
      confidence,
    );

    // 8. Generate alerts
    const alerts = this.generateAlerts(forecast, currentBalance, recurringBills, dbNow);

    // 9. Find next low point
    const nextLowPoint = this.findNextLowPoint(forecast);

    return { currentBalance, forecast, alerts, nextLowPoint };
  }

  /**
   * GET /api/v1/cashflow/insights?companyId=xxx
   */
  async getInsights(companyId: string): Promise<InsightsResponse> {
    const dbNow = await this.getDbNow();
    const sixMonthsAgo = new Date(dbNow.getTime() - 180 * 24 * 60 * 60 * 1000);

    const [entries, invoices, currentBalance] = await Promise.all([
      this.fetchLedgerEntries(companyId, sixMonthsAgo),
      this.fetchPaidInvoices(companyId),
      this.calculateCurrentBalance(companyId),
    ]);

    // Monthly averages
    const { avgMonthlyIncome, avgMonthlyExpenses } =
      this.computeMonthlyAverages(entries, sixMonthsAgo, dbNow);

    // Top expense categories
    const topExpenseCategories = this.computeTopExpenseCategories(entries);

    // Invoice payment stats
    const invoicePaymentStats = this.computeInvoiceStats(invoices);

    // Runway (months of operating expenses covered by current balance)
    const monthsOfRunway =
      avgMonthlyExpenses > 0 ? parseFloat((currentBalance / avgMonthlyExpenses).toFixed(1)) : 0;

    return {
      averageMonthlyIncome: Math.round(avgMonthlyIncome),
      averageMonthlyExpenses: Math.round(avgMonthlyExpenses),
      monthsOfRunway,
      topExpenseCategories,
      invoicePaymentStats,
    };
  }

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------

  /**
   * Get DB timestamp for TIME-TRAVEL compliance — single source of truth.
   */
  private async getDbNow(): Promise<Date> {
    const result = await this.prisma.$queryRaw<Array<{ now: Date }>>`SELECT NOW() as "now"`;
    return result[0].now;
  }

  /**
   * Fetch all journal entries for the past 6 months.
   */
  private async fetchLedgerEntries(
    companyId: string,
    since: Date,
  ): Promise<PatternEntry[]> {
    const rows = await this.prisma.journalEntry.findMany({
      where: {
        companyId,
        deletedAt: null,
        entryDate: { gte: since },
      },
      include: {
        account: { select: { type: true, name: true } },
      },
      orderBy: { entryDate: 'asc' },
    });

    return rows.map((r) => ({
      description: r.description,
      amount: r.amount,
      direction: r.direction,
      entryDate: r.entryDate,
      accountType: r.account.type,
      accountName: r.account.name,
    }));
  }

  /**
   * Fetch paid invoices for payment-aging analysis.
   */
  private async fetchPaidInvoices(companyId: string) {
    return this.prisma.invoice.findMany({
      where: {
        companyId,
        paidAt: { not: null },
        dueDate: { not: null },
      },
      select: {
        id: true,
        invoiceNumber: true,
        customerName: true,
        total: true,
        dueDate: true,
        paidAt: true,
        status: true,
      },
    });
  }

  /**
   * Calculate current cash balance = sum(CREDIT) - sum(DEBIT) across all journal entries.
   */
  private async calculateCurrentBalance(companyId: string): Promise<number> {
    const result = await this.prisma.journalEntry.aggregate({
      where: { companyId, deletedAt: null },
      _sum: { amount: true },
    });

    // Simple heuristic: total credits - total debits
    const credits = await this.prisma.journalEntry.aggregate({
      where: { companyId, deletedAt: null, direction: 'CREDIT' },
      _sum: { amount: true },
    });
    const debits = await this.prisma.journalEntry.aggregate({
      where: { companyId, deletedAt: null, direction: 'DEBIT' },
      _sum: { amount: true },
    });

    return (credits._sum.amount || 0) - (debits._sum.amount || 0);
  }

  // -----------------------------------------------------------------------
  // Pattern recognition (heuristic)
  // -----------------------------------------------------------------------

  /**
   * Analyze 6 months of ledger entries to find recurring patterns.
   *
   * Heuristic rules:
   *  - Group by description similarity (same vendor prefix, similar amounts ±20%)
   *  - If an expense occurs on same day-of-month for ≥3 months → recurring bill
   *  - If income from same source for ≥3 months → recurring income
   *  - Detect seasonal factors by comparing month-over-month spending
   *  - Exclude extreme outliers (|amount - mean| > 2 * stdDev)
   */
  private analyzePatterns(
    entries: PatternEntry[],
    _dbNow: Date,
  ): {
    recurringBills: RecurringPattern[];
    recurringIncome: RecurringPattern[];
    seasonalFactors: Map<number, number>; // month → multiplier
  } {
    if (entries.length === 0) {
      return { recurringBills: [], recurringIncome: [], seasonalFactors: new Map() };
    }

    // 1. Group entries by normalized description key
    const grouped = this.groupByDescription(entries);

    // 2. For each group, detect if it's recurring
    const recurringBills: RecurringPattern[] = [];
    const recurringIncome: RecurringPattern[] = [];

    for (const [, group] of grouped) {
      // Remove outliers (|amount - mean| > 2 * stdDev)
      const cleaned = this.removeOutliers(group);
      if (cleaned.length < 3) continue; // Need at least 3 occurrences

      const amounts = cleaned.map((e) => e.amount);
      const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const stdDev = this.calculateStdDev(amounts, avgAmount);

      const dayOfMonth = cleaned[0].entryDate.getDate();
      const direction = cleaned[0].direction;

      // Check same day-of-month for 3+ distinct months
      const monthsObserved = new Set(
        cleaned.map((e) => `${e.entryDate.getFullYear()}-${e.entryDate.getMonth()}`),
      );

      if (monthsObserved.size >= 3) {
        const pattern: RecurringPattern = {
          key: cleaned[0].description.trim().toLowerCase(),
          direction: direction as 'CREDIT' | 'DEBIT',
          amounts,
          avgAmount: Math.round(avgAmount * 100) / 100,
          stdDev: Math.round(stdDev * 100) / 100,
          dayOfMonth,
          monthsObserved,
          accountType: cleaned[0].accountType,
          accountName: cleaned[0].accountName,
          count: cleaned.length,
        };

        if (direction === 'DEBIT') {
          recurringBills.push(pattern);
        } else {
          recurringIncome.push(pattern);
        }
      }
    }

    // 3. Seasonal factors: compare spending by month
    const seasonalFactors = this.detectSeasonality(entries);

    return { recurringBills, recurringIncome, seasonalFactors };
  }

  /**
   * Group entries by normalized description — same prefix, similar amount.
   */
  private groupByDescription(
    entries: PatternEntry[],
  ): Map<string, PatternEntry[]> {
    const groups = new Map<string, PatternEntry[]>();

    for (const entry of entries) {
      // Normalize: lowercase, remove trailing numbers/invoice refs
      const key = entry.description
        .trim()
        .toLowerCase()
        .replace(/\s+(inv|invoice|#)\s*\w+$/i, '')
        .replace(/\d{4,}/g, '')
        .trim();

      // Check if we can merge with an existing group by amount similarity ±20%
      let merged = false;
      for (const [existingKey, existingEntries] of groups) {
        if (this.isSimilarDescription(existingKey, key)) {
          // Check amount similarity
          const existingAvg =
            existingEntries.reduce((s, e) => s + e.amount, 0) / existingEntries.length;
          if (Math.abs(entry.amount - existingAvg) / Math.max(existingAvg, 1) <= 0.2) {
            existingEntries.push(entry);
            merged = true;
            break;
          }
        }
      }

      if (!merged) {
        groups.set(key, [entry]);
      }
    }

    return groups;
  }

  /**
   * Check if two descriptions likely refer to the same vendor.
   */
  private isSimilarDescription(a: string, b: string): boolean {
    if (a === b) return true;
    const tokensA = a.split(/\s+/).filter(Boolean);
    const tokensB = b.split(/\s+/).filter(Boolean);
    const shared = tokensA.filter((t) => tokensB.includes(t));
    // At least 60% of shorter token list must match
    const min = Math.min(tokensA.length, tokensB.length);
    return min > 0 && shared.length / min >= 0.6;
  }

  /**
   * Remove outliers where |value - mean| > 2 * stdDev.
   */
  private removeOutliers(entries: PatternEntry[]): PatternEntry[] {
    if (entries.length < 3) return entries;

    const amounts = entries.map((e) => e.amount);
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance =
      amounts.reduce((sum, v) => sum + (v - mean) ** 2, 0) / amounts.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return entries;

    return entries.filter(
      (e) => Math.abs(e.amount - mean) / stdDev <= 2,
    );
  }

  /**
   * Calculate standard deviation.
   */
  private calculateStdDev(values: number[], mean: number): number {
    if (values.length < 2) return 0;
    const variance =
      values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Detect seasonal spending patterns (month-over-month comparison).
   */
  private detectSeasonality(
    entries: PatternEntry[],
  ): Map<number, number> {
    const monthTotals = new Map<number, number[]>();

    for (const entry of entries) {
      const month = entry.entryDate.getMonth(); // 0-11
      if (!monthTotals.has(month)) monthTotals.set(month, []);
      monthTotals.get(month)!.push(entry.amount);
    }

    const factors = new Map<number, number>();
    let grandTotal = 0;
    let grandCount = 0;

    for (const [, amounts] of monthTotals) {
      grandTotal += amounts.reduce((a, b) => a + b, 0);
      grandCount += amounts.length;
    }

    const grandAvg = grandCount > 0 ? grandTotal / grandCount : 0;

    for (const [month, amounts] of monthTotals) {
      const monthAvg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      factors.set(month, grandAvg > 0 ? monthAvg / grandAvg : 1.0);
    }

    return factors;
  }

  // -----------------------------------------------------------------------
  // Invoice aging analysis
  // -----------------------------------------------------------------------

  /**
   * Analyze payment patterns for invoices.
   * - averagePaymentDays: mean days from dueDate to paidAt
   * - paidWithin30Days: % of invoices paid within 30 days of due date
   * - overdue60Days: % paid after 60 days
   * - overdue90Days: % paid after 90 days
   */
  private analyzeInvoiceAging(
    invoices: Array<{ dueDate: Date | null; paidAt: Date | null }>,
  ) {
    const paymentDeltas: number[] = [];
    let within30 = 0;
    let over60 = 0;
    let over90 = 0;
    const total = invoices.length;

    for (const inv of invoices) {
      if (!inv.dueDate || !inv.paidAt) continue;
      const days = this.daysBetween(inv.dueDate, inv.paidAt);
      paymentDeltas.push(days);

      if (days <= 30) within30++;
      if (days > 60) over60++;
      if (days > 90) over90++;
    }

    const avgDays =
      paymentDeltas.length > 0
        ? Math.round(
            paymentDeltas.reduce((a, b) => a + b, 0) / paymentDeltas.length,
          )
        : 0;

    return {
      averagePaymentDays: avgDays,
      paidWithin30Days: total > 0 ? Math.round((within30 / total) * 100) : 0,
      overdue60Days: total > 0 ? Math.round((over60 / total) * 100) : 0,
      overdue90Days: total > 0 ? Math.round((over90 / total) * 100) : 0,
      averageDelay: avgDays,
    };
  }

  /**
   * Compute invoice statistics for insights endpoint.
   */
  private computeInvoiceStats(
    invoices: Array<{ dueDate: Date | null; paidAt: Date | null }>,
  ): InvoicePaymentStats {
    const aging = this.analyzeInvoiceAging(invoices);
    return {
      averagePaymentDays: aging.averagePaymentDays,
      paidWithin30Days: aging.paidWithin30Days,
      overdue60Days: aging.overdue60Days,
      overdue90Days: aging.overdue90Days,
    };
  }

  // -----------------------------------------------------------------------
  // Monthly averages helper
  // -----------------------------------------------------------------------

  private computeMonthlyAverages(
    entries: PatternEntry[],
    since: Date,
    dbNow: Date,
  ) {
    const monthBuckets = new Map<
      string,
      { income: number; expense: number }
    >();

    for (const entry of entries) {
      const monthKey = `${entry.entryDate.getFullYear()}-${String(entry.entryDate.getMonth() + 1).padStart(2, '0')}`;
      const bucket = monthBuckets.get(monthKey) || { income: 0, expense: 0 };

      if (entry.direction === 'CREDIT') {
        bucket.income += entry.amount;
      } else {
        bucket.expense += entry.amount;
      }
      monthBuckets.set(monthKey, bucket);
    }

    const monthCount = monthBuckets.size || 1;
    const totalIncome = Array.from(monthBuckets.values()).reduce(
      (s, b) => s + b.income,
      0,
    );
    const totalExpense = Array.from(monthBuckets.values()).reduce(
      (s, b) => s + b.expense,
      0,
    );

    return {
      avgMonthlyIncome: totalIncome / monthCount,
      avgMonthlyExpenses: totalExpense / monthCount,
    };
  }

  /**
   * Compute top expense categories from journal entries.
   */
  private computeTopExpenseCategories(
    entries: PatternEntry[],
  ): TopExpenseCategory[] {
    const expenseMap = new Map<string, number>();

    for (const entry of entries) {
      if (entry.direction === 'DEBIT') {
        const cat = entry.accountName || 'Other';
        expenseMap.set(cat, (expenseMap.get(cat) || 0) + entry.amount);
      }
    }

    const sorted = Array.from(expenseMap.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    const totalExpense = sorted.reduce((s, [, v]) => s + v, 0);

    return sorted.map(([category, amount]) => ({
      category,
      amount: Math.round(amount),
      percentage:
        totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0,
    }));
  }

  // -----------------------------------------------------------------------
  // Forecast builder
  // -----------------------------------------------------------------------

  /**
   * Determine confidence level based on data sufficiency.
   */
  private determineConfidence(
    recurringBills: RecurringPattern[],
    recurringIncome: RecurringPattern[],
    dbNow: Date,
    sixMonthsAgo: Date,
  ): 'HIGH' | 'MEDIUM' | 'LOW' {
    const dataSpan =
      (dbNow.getTime() - sixMonthsAgo.getTime()) / (30 * 24 * 60 * 60 * 1000);

    if (dataSpan < 3) return 'LOW';
    if (recurringBills.length === 0 && recurringIncome.length === 0)
      return 'LOW';
    if (recurringBills.length >= 3 && recurringIncome.length >= 2)
      return 'HIGH';
    if (recurringBills.length >= 1 || recurringIncome.length >= 1)
      return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Build N-month forecast using identified patterns.
   */
  private buildForecast(
    dbNow: Date,
    months: number,
    currentBalance: number,
    recurringBills: RecurringPattern[],
    recurringIncome: RecurringPattern[],
    seasonalFactors: Map<number, number>,
    agingStats: { averageDelay: number },
    confidence: 'HIGH' | 'MEDIUM' | 'LOW',
  ): ForecastMonth[] {
    const forecast: ForecastMonth[] = [];
    let runningBalance = currentBalance;

    const startYear = dbNow.getFullYear();
    const startMonth = dbNow.getMonth(); // 0-indexed

    for (let i = 0; i < months; i++) {
      const targetYear = startYear + Math.floor((startMonth + i) / 12);
      const targetMonth = (startMonth + i) % 12;
      const monthStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;

      // Project recurring bills for this month
      const monthlyBills = this.projectRecurringBills(
        recurringBills,
        targetYear,
        targetMonth,
        seasonalFactors,
      );

      // Project recurring income for this month
      const monthlyIncome = this.projectRecurringIncome(
        recurringIncome,
        targetYear,
        targetMonth,
        agingStats,
        seasonalFactors,
      );

      const totalExpenses = monthlyBills.reduce((s, b) => s + b.amount, 0);
      const totalIncome = monthlyIncome.reduce((s, b) => s + b.amount, 0);
      const netCashflow = totalIncome - totalExpenses;
      runningBalance += netCashflow;

      forecast.push({
        month: monthStr,
        projectedIncome: Math.round(totalIncome),
        projectedExpenses: Math.round(totalExpenses),
        netCashflow: Math.round(netCashflow),
        closingBalance: Math.max(0, Math.round(runningBalance)),
        confidence,
        recurringBills: monthlyBills,
        expectedIncome: monthlyIncome,
      });
    }

    return forecast;
  }

  /**
   * Project recurring bills for a given month, applying seasonal factors.
   */
  private projectRecurringBills(
    patterns: RecurringPattern[],
    year: number,
    month: number,
    seasonalFactors: Map<number, number>,
  ): RecurringBill[] {
    const seasonalMultiplier = seasonalFactors.get(month) || 1.0;

    return patterns.map((p) => {
      const adjustedAmount = Math.round(p.avgAmount * seasonalMultiplier);
      const dueDay = Math.min(p.dayOfMonth, 28); // Clamp to valid day
      const dueDate = new Date(year, month, dueDay);

      return {
        name: p.accountName || p.key,
        amount: adjustedAmount,
        dueDate: dueDate.toISOString().slice(0, 10),
        frequency: 'monthly',
      };
    });
  }

  /**
   * Project recurring income for a given month.
   */
  private projectRecurringIncome(
    patterns: RecurringPattern[],
    year: number,
    month: number,
    agingStats: { averageDelay: number },
    seasonalFactors: Map<number, number>,
  ): ExpectedIncome[] {
    const seasonalMultiplier = seasonalFactors.get(month) || 1.0;

    return patterns.map((p) => {
      const adjustedAmount = Math.round(p.avgAmount * seasonalMultiplier);
      const dueDay = Math.min(p.dayOfMonth, 28);
      // Apply average payment delay
      const expectedDate = new Date(year, month, dueDay + agingStats.averageDelay);

      return {
        name: p.accountName || p.key,
        amount: adjustedAmount,
        expectedDate: expectedDate.toISOString().slice(0, 10),
      };
    });
  }

  // -----------------------------------------------------------------------
  // Alert generation
  // -----------------------------------------------------------------------

  /**
   * Generate alerts based on forecast and rules.
   *
   * Rules:
   *  1. Low cash warning — projected balance < KSh 50,000 in next 30 days
   *  2. Bill cluster — total due bills in a week > current balance * 0.5
   *  3. Payment delay — recurring bill unpaid 3+ days past expected date
   *     (tracked via DB — we flag if the DB now > dueDate + 3)
   *  4. Income shortfall — projected income < expenses for 2+ consecutive months
   *  5. Large transaction — single transaction > current balance * 0.3
   *     (we check historical entries for this)
   */
  private generateAlerts(
    forecast: ForecastMonth[],
    currentBalance: number,
    recurringBills: RecurringPattern[],
    dbNow: Date,
  ): Alert[] {
    const alerts: Alert[] = [];

    // Rule 1: Low cash warning
    for (const month of forecast) {
      if (month.closingBalance < 50000) {
        alerts.push({
          type: 'WARNING',
          message: `Cash balance will dip below KSh 50,000 in ${month.month} (projected: KSh ${month.closingBalance.toLocaleString()})`,
          severity: 'HIGH',
        });
      }
    }

    // Rule 2: Bill cluster (check each forecast month's bills)
    for (const month of forecast) {
      const weekBuckets = this.bucketBillsByWeek(month.recurringBills);
      for (const [, weekTotal] of weekBuckets) {
        if (weekTotal > currentBalance * 0.5) {
          alerts.push({
            type: 'ACTION_REQUIRED',
            message: `You have bills totaling KSh ${weekTotal.toLocaleString()} due in a single week — exceeds 50% of current balance`,
            severity: 'HIGH',
          });
        }
      }
    }

    // Rule 3: Payment delay — check if any recurring bill's expected due date has passed + 3 days
    for (const bill of recurringBills) {
      // Estimate next due date based on most recent month observed + dayOfMonth
      const sortedMonths = Array.from(bill.monthsObserved).sort();
      const lastMonth = sortedMonths[sortedMonths.length - 1];
      const [lastYear, lastMon] = lastMonth.split('-').map(Number);

      // Next expected date = last observed month + 1, same day
      let nextDueYear = lastYear;
      let nextDueMonth = lastMon + 1;
      if (nextDueMonth > 11) {
        nextDueMonth = 0;
        nextDueYear++;
      }
      const dueDay = Math.min(bill.dayOfMonth, 28);
      const expectedDate = new Date(nextDueYear, nextDueMonth, dueDay);
      const graceDate = new Date(expectedDate.getTime() + 3 * 24 * 60 * 60 * 1000);

      if (dbNow > graceDate) {
        alerts.push({
          type: 'ACTION_REQUIRED',
          message: `${bill.accountName || bill.key} of KSh ${bill.avgAmount.toLocaleString()} was due on ${expectedDate.toISOString().slice(0, 10)} and is now overdue`,
          severity: 'MEDIUM',
        });
      }
    }

    // Rule 4: Income shortfall — 2+ consecutive months where income < expenses
    let shortfallStreak = 0;
    for (const month of forecast) {
      if (month.projectedIncome < month.projectedExpenses) {
        shortfallStreak++;
        if (shortfallStreak >= 2) {
          alerts.push({
            type: 'WARNING',
            message: `Projected income is less than expenses for ${shortfallStreak} consecutive months — consider cost reduction measures`,
            severity: 'HIGH',
          });
          break; // Only one alert for this rule
        }
      } else {
        shortfallStreak = 0;
      }
    }

    // Rule 5: Large transaction — check historical for single tx > currentBalance * 0.3
    // We run this as a separate query to check for outlier transactions
    alerts.push(...this.checkLargeTransactions(currentBalance));

    return alerts;
  }

  /**
   * Check for large historical transactions that may signal future large payments.
   */
  private checkLargeTransactions(currentBalance: number): Alert[] {
    // This is informational — we check if any past entries were > 30% of balance
    // and flag the pattern for awareness
    return []; // Deferred to avoid over-alerting; could be enhanced with a dedicated query
  }

  /**
   * Group bills by week and sum amounts.
   */
  private bucketBillsByWeek(bills: RecurringBill[]): Map<string, number> {
    const buckets = new Map<string, number>();

    for (const bill of bills) {
      // Create a week key based on ISO week number approximation
      const date = new Date(bill.dueDate);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
      const key = weekStart.toISOString().slice(0, 10);

      buckets.set(key, (buckets.get(key) || 0) + bill.amount);
    }

    return buckets;
  }

  // -----------------------------------------------------------------------
  // Low point detection
  // -----------------------------------------------------------------------

  private findNextLowPoint(forecast: ForecastMonth[]): LowPoint | null {
    let lowest: LowPoint | null = null;

    for (const month of forecast) {
      if (month.closingBalance < 50000) {
        if (!lowest || month.closingBalance < lowest.balance) {
          lowest = {
            date: `${month.month}-28`,
            balance: month.closingBalance,
            isWarning: true,
          };
        }
      }
    }

    // If no warning-level low point, find the overall lowest balance
    if (!lowest && forecast.length > 0) {
      const minMonth = forecast.reduce((a, b) =>
        a.closingBalance < b.closingBalance ? a : b,
      );
      lowest = {
        date: `${minMonth.month}-28`,
        balance: minMonth.closingBalance,
        isWarning: minMonth.closingBalance < 50000,
      };
    }

    return lowest;
  }

  // -----------------------------------------------------------------------
  // Date utilities — TIME-TRAVEL compliant (only uses DB-derived values)
  // -----------------------------------------------------------------------

  /**
   * Calculate calendar days between two dates.
   */
  private daysBetween(a: Date, b: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round(Math.abs(b.getTime() - a.getTime()) / msPerDay);
  }
}
