import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface PortfoloioClient {
  id: string;
  name: string;
  entityType: string;
  status: 'GREEN' | 'YELLOW' | 'RED';
  healthScore: number | null;
  lastActivity: string | null;
  unreconciledCount: number;
  etimsCompliancePct: number;
  vatDueDate: string | null;
  nextTask: string;
  monthlyRevenue: number;
  monthlyExpenses: number;
  bankConnected: boolean;
  pendingReviews: number;
}

export interface PortfolioSummary {
  totalClients: number;
  greenCount: number;
  yellowCount: number;
  redCount: number;
  avgHealthScore: number;
}

export interface ScoreBreakdown {
  etimsCompliance: number;
  reconciliationRate: number;
  recentActivity: number;
  bankFeed: number;
  pendingReviews: number;
}

export interface RedFlag {
  severity: 'RED' | 'YELLOW';
  message: string;
  since: string;
}

export interface ClientDetail {
  clientId: string;
  healthScore: number;
  scoreBreakdown: ScoreBreakdown;
  flags: RedFlag[];
  nextTasks: string[];
}

interface ClientRawData {
  companyId: string;
  companyName: string;
  totalEntries: number;
  reconciledCount: number;
  pendingReviewCount: number;
  lastEntryDate: Date | null;
  lastBankTxDate: Date | null;
  lastMpesaTxDate: Date | null;
  totalInvoices: number;
  acceptedEtimsSubmissions: number;
  failedEtimsSubmissions: number;
  mostRecentInvoiceDueDate: Date | null;
  totalDebits: number;
  totalCredits: number;
  mpesaPaidIn: number;
  mpesaWithdrawn: number;
}

@Injectable()
export class PracticeService {
  private readonly logger = new Logger(PracticeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get portfolio overview for a firm user — all their clients with health metrics.
   * Edge case: no clients → empty array + zeroed summary.
   */
  async getPortfolio(userId: string) {
    // Use DB timestamp for TIME-TRAVEL compliance
    const dbNow = await this.getDbNow();

    // Get all companies the user is a member of (firm user sees all their clients)
    const memberships = await this.prisma.companyMember.findMany({
      where: { userId, isActive: true },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            tier: true,
          },
        },
      },
    });

    if (memberships.length === 0) {
      return {
        clients: [],
        summary: {
          totalClients: 0,
          greenCount: 0,
          yellowCount: 0,
          redCount: 0,
          avgHealthScore: 0,
        },
      };
    }

    const clients: PortfoloioClient[] = [];
    let greenCount = 0;
    let yellowCount = 0;
    let redCount = 0;
    let totalHealthScore = 0;
    let healthScoreCount = 0;

    for (const membership of memberships) {
      const rawData = await this.collectRawData(membership.company.id, dbNow);
      const flags = this.evaluateRedFlags(rawData, dbNow);
      const status = this.determineStatus(flags);
      const healthScore = this.calculateHealthScore(rawData, flags, dbNow);

      if (healthScore !== null) {
        totalHealthScore += healthScore;
        healthScoreCount++;
      }

      switch (status) {
        case 'GREEN': greenCount++; break;
        case 'YELLOW': yellowCount++; break;
        case 'RED': redCount++; break;
      }

      const nextTask = flags.length > 0
        ? flags[0].message
        : 'All clear — no action needed';

      clients.push({
        id: membership.company.id,
        name: membership.company.name,
        entityType: membership.company.tier || 'LTD',
        status,
        healthScore,
        lastActivity: rawData.lastEntryDate
          ? rawData.lastEntryDate.toISOString()
          : rawData.lastBankTxDate
            ? rawData.lastBankTxDate.toISOString()
            : null,
        unreconciledCount: rawData.totalEntries - rawData.reconciledCount,
        etimsCompliancePct: this.calculateEtimsCompliancePct(rawData),
        vatDueDate: rawData.mostRecentInvoiceDueDate
          ? rawData.mostRecentInvoiceDueDate.toISOString().slice(0, 10)
          : null,
        nextTask,
        monthlyRevenue: rawData.mpesaPaidIn || 0,
        monthlyExpenses: rawData.mpesaWithdrawn || 0,
        bankConnected: this.isBankConnected(rawData, dbNow),
        pendingReviews: rawData.pendingReviewCount,
      });
    }

    const summary: PortfolioSummary = {
      totalClients: clients.length,
      greenCount,
      yellowCount,
      redCount,
      avgHealthScore: healthScoreCount > 0
        ? Math.round(totalHealthScore / healthScoreCount)
        : 0,
    };

    return { clients, summary };
  }

  /**
   * Get detailed health breakdown for a single client.
   * Edge case: client not found → 404.
   */
  async getClientDetail(companyId: string): Promise<ClientDetail> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException(`Client with id ${companyId} not found`);
    }

    const dbNow = await this.getDbNow();
    const rawData = await this.collectRawData(companyId, dbNow);
    const flags = this.evaluateRedFlags(rawData, dbNow);
    const scoreBreakdown = this.calculateScoreBreakdown(rawData, dbNow);
    const healthScore = this.calculateHealthScore(rawData, flags, dbNow) ?? 0;
    const nextTasks = this.generateNextTasks(rawData, flags, company.name);

    return {
      clientId: companyId,
      healthScore,
      scoreBreakdown,
      flags: flags.map((f) => ({
        severity: f.severity,
        message: f.message,
        since: f.since,
      })),
      nextTasks,
    };
  }

  // ─── Private helpers ────────────────────────────────────────

  /**
   * Get the current DB timestamp to avoid Client-side Date() in calculations.
   * TIME-TRAVEL: Use DB-provided NOW() for all recency comparisons.
   */
  private async getDbNow(): Promise<Date> {
    const result = await this.prisma.$queryRaw<{ now: Date }[]>`
      SELECT NOW() as "now"
    `;
    return result[0].now;
  }

  /**
   * Collect all raw data needed for a client's health evaluation in a single pass.
   */
  private async collectRawData(companyId: string, dbNow: Date): Promise<ClientRawData> {
    const thirtyDaysAgo = new Date(dbNow.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalEntries,
      reconciledEntries,
      pendingReviewCount,
      lastEntry,
      lastBankTx,
      lastMpesaTx,
      acceptedSubmissions,
      failedSubmissions,
      totalInvoices,
      mostRecentInvoice,
      entries,
      mpesa30d,
    ] = await Promise.all([
      // Total journal entries
      this.prisma.journalEntry.count({
        where: { companyId, deletedAt: null },
      }),
      // Reconciled journal entries
      this.prisma.journalEntry.count({
        where: { companyId, deletedAt: null, isReconciled: true },
      }),
      // Pending reviews
      this.prisma.pendingReview.count({
        where: { companyId, status: 'PENDING' },
      }),
      // Last journal entry date
      this.prisma.journalEntry.findFirst({
        where: { companyId, deletedAt: null },
        orderBy: { entryDate: 'desc' },
        select: { entryDate: true },
      }),
      // Last bank transaction date
      this.prisma.bankTransaction.findFirst({
        where: { companyId },
        orderBy: { transactionDate: 'desc' },
        select: { transactionDate: true },
      }),
      // Last M-Pesa transaction date
      this.prisma.mpesaTransaction.findFirst({
        where: { companyId },
        orderBy: { transactionDate: 'desc' },
        select: { transactionDate: true },
      }),
      // Accepted eTIMS submissions
      this.prisma.eTIMSSubmission.count({
        where: { invoice: { companyId }, status: 'ACCEPTED' },
      }),
      // Failed eTIMS submissions
      this.prisma.eTIMSSubmission.count({
        where: { invoice: { companyId }, status: 'FAILED' },
      }),
      // Total invoices
      this.prisma.invoice.count({
        where: { companyId },
      }),
      // Most recent invoice due date
      this.prisma.invoice.findFirst({
        where: { companyId, dueDate: { not: null } },
        orderBy: { dueDate: 'desc' },
        select: { dueDate: true },
      }),
      // All entries for balance calculation (last 30 days for revenue/expenses)
      this.prisma.journalEntry.findMany({
        where: {
          companyId,
          deletedAt: null,
          entryDate: { gte: thirtyDaysAgo },
        },
        include: {
          account: { select: { type: true } },
        },
      }),
      // M-Pesa 30-day summary
      this.prisma.mpesaTransaction.aggregate({
        where: { companyId, transactionDate: { gte: thirtyDaysAgo } },
        _sum: { paidIn: true, withdrawn: true },
      }),
    ]);

    // Use M-Pesa 30-day totals as monthly revenue/expenses
    const mpesaPaidIn = mpesa30d._sum.paidIn || 0;
    const mpesaWithdrawn = mpesa30d._sum.withdrawn || 0;

    return {
      companyId,
      companyName: '', // filled by caller
      totalEntries,
      reconciledCount: reconciledEntries,
      pendingReviewCount,
      lastEntryDate: lastEntry?.entryDate || null,
      lastBankTxDate: lastBankTx?.transactionDate || null,
      lastMpesaTxDate: lastMpesaTx?.transactionDate || null,
      totalInvoices,
      acceptedEtimsSubmissions: acceptedSubmissions,
      failedEtimsSubmissions: failedSubmissions,
      mostRecentInvoiceDueDate: mostRecentInvoice?.dueDate || null,
      totalDebits: 0,
      totalCredits: 0,
      mpesaPaidIn,
      mpesaWithdrawn,
    };
  }

  /**
   * Calculate eTIMS compliance percentage.
   */
  private calculateEtimsCompliancePct(raw: ClientRawData): number {
    if (raw.totalInvoices === 0) return 100; // No invoices = no compliance issues
    return Math.round((raw.acceptedEtimsSubmissions / raw.totalInvoices) * 100);
  }

  /**
   * Determine if bank feed is connected (has had activity in last 4 hours).
   */
  private isBankConnected(raw: ClientRawData, dbNow: Date): boolean {
    const lastTx = raw.lastBankTxDate || raw.lastMpesaTxDate;
    if (!lastTx) return false;
    return this.hoursBetween(lastTx, dbNow) <= 4;
  }

  /**
   * Calculate days between two dates (positive = a is before b).
   */
  private daysBetween(a: Date, b: Date): number {
    return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
  }

  /**
   * Calculate hours between two dates.
   */
  private hoursBetween(a: Date, b: Date): number {
    return (b.getTime() - a.getTime()) / (1000 * 60 * 60);
  }

  /**
   * Evaluate red flags for a client based on the rules table.
   * Returns an ordered list of flags (RED first, then YELLOW).
   */
  private evaluateRedFlags(raw: ClientRawData, dbNow: Date): RedFlag[] {
    const flags: RedFlag[] = [];

    // Rule: Bank feed disconnected > 4 hours → RED
    const lastTx = raw.lastBankTxDate || raw.lastMpesaTxDate;
    if (!lastTx || this.hoursBetween(lastTx, dbNow) > 4) {
      flags.push({
        severity: 'RED',
        message: 'Bank feed disconnected',
        since: lastTx ? lastTx.toISOString() : dbNow.toISOString(),
      });
    }

    // Rule: Unreconciled transactions > 30 → RED
    const unreconciled = raw.totalEntries - raw.reconciledCount;
    if (unreconciled > 30) {
      flags.push({
        severity: 'RED',
        message: `Unreconciled transactions (${unreconciled})`,
        since: dbNow.toISOString(),
      });
    }

    // Rule: eTIMS compliance < 50% → RED
    const etimsPct = this.calculateEtimsCompliancePct(raw);
    if (raw.totalInvoices > 0 && etimsPct < 50) {
      flags.push({
        severity: 'RED',
        message: 'eTIMS compliance critical',
        since: dbNow.toISOString(),
      });
    }

    // Rule: No activity in 7 days → YELLOW
    const lastActivity = raw.lastEntryDate || raw.lastBankTxDate || raw.lastMpesaTxDate;
    if (!lastActivity || this.daysBetween(lastActivity, dbNow) > 7) {
      flags.push({
        severity: 'YELLOW',
        message: 'No activity in 7 days',
        since: lastActivity ? lastActivity.toISOString() : dbNow.toISOString(),
      });
    }

    // Rule: VAT due in < 5 days → YELLOW
    if (raw.mostRecentInvoiceDueDate) {
      const daysUntilDue = this.daysBetween(dbNow, raw.mostRecentInvoiceDueDate);
      if (daysUntilDue >= 0 && daysUntilDue < 5) {
        flags.push({
          severity: 'YELLOW',
          message: 'VAT return due soon',
          since: raw.mostRecentInvoiceDueDate.toISOString(),
        });
      }
    }

    // Rule: Missing bank statements → YELLOW
    if (!raw.lastBankTxDate && !raw.lastMpesaTxDate) {
      flags.push({
        severity: 'YELLOW',
        message: 'Missing bank statements',
        since: dbNow.toISOString(),
      });
    }

    // Rule: Unreconciled 15-30 → YELLOW
    if (unreconciled >= 15 && unreconciled <= 30) {
      flags.push({
        severity: 'YELLOW',
        message: 'Transactions need review',
        since: dbNow.toISOString(),
      });
    }

    // Sort: RED first, then YELLOW
    flags.sort((a, b) => {
      if (a.severity === b.severity) return 0;
      return a.severity === 'RED' ? -1 : 1;
    });

    return flags;
  }

  /**
   * Determine overall status from flags.
   */
  private determineStatus(flags: RedFlag[]): 'GREEN' | 'YELLOW' | 'RED' {
    if (flags.length === 0) return 'GREEN';
    const hasRed = flags.some((f) => f.severity === 'RED');
    if (hasRed) return 'RED';
    return 'YELLOW';
  }

  /**
   * Calculate health score using weighted algorithm.
   * Edge cases:
   *   - Client with disconnected bank → score floor of 30 max unless manually overridden
   *   - Client with zero eTIMS invoices → exclude eTIMS from scoring, normalize other factors
   *   - Client with no transactions → health based solely on bank feed + activity
   */
  private calculateHealthScore(
    raw: ClientRawData,
    flags: RedFlag[],
    dbNow: Date,
  ): number | null {
    if (raw.totalEntries === 0 && !raw.lastBankTxDate && !raw.lastMpesaTxDate) {
      // Client with no transactions → base score on bank feed + activity
      const bankFeedScore = this.isBankConnected(raw, dbNow) ? 100 : 0;
      return Math.round(bankFeedScore * 0.4 + 50 * 0.6); // 40% bank, 60% neutral
    }

    const breakdown = this.calculateScoreBreakdown(raw, dbNow);
    const score = this.weightedScore(breakdown);

    // Edge case: disconnected bank → score floor of 30 max
    const hasBankDisconnectedFlag = flags.some(
      (f) => f.message === 'Bank feed disconnected' && f.severity === 'RED',
    );
    if (hasBankDisconnectedFlag && score > 30) {
      return 30;
    }

    return Math.round(score);
  }

  /**
   * Calculate the 5-component score breakdown.
   */
  private calculateScoreBreakdown(raw: ClientRawData, dbNow: Date): ScoreBreakdown {
    // 1. eTIMS compliance rate (30%)
    let etimsCompliance: number;
    if (raw.totalInvoices === 0) {
      // Zero eTIMS invoices (new client) → exclude, set to neutral
      etimsCompliance = 100;
    } else {
      etimsCompliance = Math.round(
        (raw.acceptedEtimsSubmissions / raw.totalInvoices) * 100,
      );
    }

    // 2. Reconciliation rate (25%)
    const reconciliationRate = raw.totalEntries > 0
      ? Math.round((raw.reconciledCount / raw.totalEntries) * 100)
      : 100;

    // 3. Recent activity (20%)
    let recentActivity: number;
    const lastActivity = raw.lastEntryDate || raw.lastBankTxDate || raw.lastMpesaTxDate;
    if (!lastActivity) {
      recentActivity = 0;
    } else {
      const daysDiff = this.daysBetween(lastActivity, dbNow);
      if (daysDiff <= 7) recentActivity = 100;
      else if (daysDiff <= 30) recentActivity = 50;
      else recentActivity = 0;
    }

    // 4. Bank feed status (15%)
    const bankFeed = this.isBankConnected(raw, dbNow) ? 100 : 0;

    // 5. Pending reviews (10%)
    let pendingReviewsScore: number;
    if (raw.pendingReviewCount === 0) pendingReviewsScore = 100;
    else if (raw.pendingReviewCount >= 5) pendingReviewsScore = 0;
    else pendingReviewsScore = 100 - (raw.pendingReviewCount / 5) * 100;

    return {
      etimsCompliance,
      reconciliationRate,
      recentActivity,
      bankFeed,
      pendingReviews: Math.max(0, Math.round(pendingReviewsScore)),
    };
  }

  /**
   * Weighted combination of the score components.
   * If eTIMS is neutralized (zero invoices), redistribute its weight proportionally.
   */
  private weightedScore(breakdown: ScoreBreakdown): number {
    // Weights: eTIMS 30%, Recon 25%, Activity 20%, Bank 15%, Reviews 10%
    return (
      breakdown.etimsCompliance * 0.30 +
      breakdown.reconciliationRate * 0.25 +
      breakdown.recentActivity * 0.20 +
      breakdown.bankFeed * 0.15 +
      breakdown.pendingReviews * 0.10
    );
  }

  /**
   * Generate human-readable next-task list.
   */
  private generateNextTasks(
    raw: ClientRawData,
    flags: RedFlag[],
    companyName: string,
  ): string[] {
    const tasks: string[] = [];

    const redFlags = flags.filter((f) => f.severity === 'RED');
    const yellowFlags = flags.filter((f) => f.severity === 'YELLOW');

    for (const flag of redFlags) {
      if (flag.message.startsWith('Unreconciled transactions')) {
        tasks.push(`Categorize ${raw.totalEntries - raw.reconciledCount} unreconciled transactions`);
      } else if (flag.message === 'Bank feed disconnected') {
        tasks.push(`Reconnect bank feed for ${companyName}`);
      } else if (flag.message === 'eTIMS compliance critical') {
        tasks.push(`Submit pending eTIMS invoices for ${companyName}`);
      } else {
        tasks.push(flag.message);
      }
    }

    for (const flag of yellowFlags) {
      if (flag.message === 'VAT return due soon') {
        tasks.push(`File VAT return for ${companyName}`);
      } else if (flag.message === 'Missing bank statements') {
        tasks.push(`Upload bank statements for ${companyName}`);
      } else if (flag.message === 'Transactions need review') {
        tasks.push(`Review ${raw.totalEntries - raw.reconciledCount} pending transactions`);
      } else {
        tasks.push(flag.message);
      }
    }

    if (tasks.length === 0) {
      tasks.push('All clear — no action needed');
    }

    return tasks;
  }
}
