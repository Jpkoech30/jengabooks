import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface PillarScore {
  name: string;
  weight: number;
  score: number;
  maxScore: number;
  details: string;
}

@Injectable()
export class HealthScoreService {
  private readonly logger = new Logger(HealthScoreService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getHealthScore(companyId: string) {
    // Check for a recent cached score (within last hour)
    const recent = await this.prisma.businessHealthScore.findFirst({
      where: { companyId },
      orderBy: { calculatedAt: 'desc' },
    });

    if (recent) {
      const elapsed = Date.now() - new Date(recent.calculatedAt).getTime();
      if (elapsed < 3600000) {
        // Cache is less than 1 hour old
        // Parse pillarScores which may be stored as JSON string or JSON object
        let pillars: PillarScore[];
        try {
          const raw = recent.pillarScores;
          pillars = typeof raw === 'string' ? JSON.parse(raw) : raw as unknown as PillarScore[];
        } catch {
          // Corrupted cache data — fall through to recalculate
          pillars = await this.calculatePillars(companyId);
          const overallScore = this.calculateOverall(pillars);
          return { overallScore, pillars, calculatedAt: new Date().toISOString(), cached: false };
        }
        return {
          overallScore: recent.overallScore,
          pillars,
          calculatedAt: recent.calculatedAt,
          cached: true,
        };
      }
    }

    // Calculate fresh score
    const pillars = await this.calculatePillars(companyId);
    const overallScore = this.calculateOverall(pillars);

    // Cache the result
    await this.prisma.businessHealthScore.create({
      data: {
        companyId,
        overallScore,
        pillarScores: JSON.stringify(pillars),
      },
    });

    return {
      overallScore,
      pillars,
      calculatedAt: new Date().toISOString(),
      cached: false,
    };
  }

  private async calculatePillars(companyId: string): Promise<PillarScore[]> {
    // 1. Accounting Health (25%) — up-to-date transactions, reconciled accounts, balanced books
    const accountHealth = await this.calculateAccountingHealth(companyId);

    // 2. Compliance Health (25%) — eTIMS submissions up to date, no failed submissions
    const complianceHealth = await this.calculateComplianceHealth(companyId);

    // 3. Banking Health (15%) — M-Pesa connected, transactions imported recently
    const bankingHealth = await this.calculateBankingHealth(companyId);

    // 4. Review Health (15%) — HITL queue empty, no overdue reviews
    const reviewHealth = await this.calculateReviewHealth(companyId);

    // 5. Reporting Health (10%) — Reports run recently, data completeness
    const reportingHealth = await this.calculateReportingHealth(companyId);

    // 6. Engagement Health (10%) — Active usage, team collaboration
    const engagementHealth = await this.calculateEngagementHealth(companyId);

    return [
      accountHealth,
      complianceHealth,
      bankingHealth,
      reviewHealth,
      reportingHealth,
      engagementHealth,
    ];
  }

  private async calculateAccountingHealth(companyId: string): Promise<PillarScore> {
    const totalEntries = await this.prisma.journalEntry.count({
      where: { companyId, deletedAt: null },
    });

    // Check if trial balance is balanced
    const entries = await this.prisma.journalEntry.findMany({
      where: { companyId, deletedAt: null },
    });
    let totalDebits = 0;
    let totalCredits = 0;
    for (const entry of entries) {
      if (entry.direction === 'DEBIT') totalDebits += entry.amount;
      else totalCredits += entry.amount;
    }
    const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

    // Score: entries exist (40%), balanced (30%), recent activity (30%)
    let score = 0;
    if (totalEntries > 0) score += 40;
    if (totalEntries > 50) score += 10;
    if (isBalanced) score += 30;

    // Recent activity (entries in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentEntries = await this.prisma.journalEntry.count({
      where: { companyId, entryDate: { gte: thirtyDaysAgo }, deletedAt: null },
    });
    if (recentEntries > 0) score += 20;
    else if (totalEntries > 0) score += 10;

    return {
      name: 'Accounting Health',
      weight: 25,
      score: Math.min(100, score),
      maxScore: 100,
      details: `${totalEntries} total entries, ${isBalanced ? 'balanced' : 'unbalanced'} books`,
    };
  }

  private async calculateComplianceHealth(companyId: string): Promise<PillarScore> {
    const totalInvoices = await this.prisma.invoice.count({ where: { companyId } });
    const acceptedSubmissions = await this.prisma.eTIMSSubmission.count({
      where: { invoice: { companyId }, status: 'ACCEPTED' },
    });
    const failedSubmissions = await this.prisma.eTIMSSubmission.count({
      where: { invoice: { companyId }, status: 'FAILED' },
    });

    let score = 0;
    if (totalInvoices > 0) score += 30;
    if (acceptedSubmissions > 0) score += 40;
    const submissionRate = totalInvoices > 0 ? (acceptedSubmissions / totalInvoices) * 30 : 0;
    score += submissionRate;
    if (failedSubmissions > 0) score = Math.max(0, score - 20 * failedSubmissions);

    return {
      name: 'Compliance Health',
      weight: 25,
      score: Math.min(100, Math.round(score)),
      maxScore: 100,
      details: `${acceptedSubmissions}/${totalInvoices} invoices synced to KRA`,
    };
  }

  private async calculateBankingHealth(companyId: string): Promise<PillarScore> {
    const totalMpesa = await this.prisma.mpesaTransaction.count({ where: { companyId } });
    const reconciled = await this.prisma.mpesaTransaction.count({
      where: { companyId, isReconciled: true },
    });

    // Check for recent imports (last 60 days)
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const recentImports = await this.prisma.mpesaTransaction.count({
      where: { companyId, transactionDate: { gte: sixtyDaysAgo } },
    });

    let score = 0;
    if (totalMpesa > 0) score += 30;
    if (recentImports > 0) score += 30;
    const reconciliationRate = totalMpesa > 0 ? (reconciled / totalMpesa) * 40 : 0;
    score += reconciliationRate;

    return {
      name: 'Banking Health',
      weight: 15,
      score: Math.min(100, Math.round(score)),
      maxScore: 100,
      details: `${totalMpesa} M-Pesa transactions, ${reconciled} reconciled`,
    };
  }

  private async calculateReviewHealth(companyId: string): Promise<PillarScore> {
    const pendingReviews = await this.prisma.pendingReview.count({
      where: { companyId, status: 'PENDING' },
    });
    const inProgressReviews = await this.prisma.pendingReview.count({
      where: { companyId, status: 'IN_PROGRESS' },
    });
    const resolvedReviews = await this.prisma.pendingReview.count({
      where: { companyId, status: 'RESOLVED' },
    });

    let score = 100;
    if (pendingReviews > 0) score -= 15 * pendingReviews;
    if (inProgressReviews > 0) score -= 5 * inProgressReviews;
    if (resolvedReviews > 0) score = Math.min(score + 10, 100);

    return {
      name: 'Review Health',
      weight: 15,
      score: Math.max(0, score),
      maxScore: 100,
      details: `${pendingReviews} pending, ${inProgressReviews} in progress, ${resolvedReviews} resolved`,
    };
  }

  private async calculateReportingHealth(companyId: string): Promise<PillarScore> {
    const totalEntries = await this.prisma.journalEntry.count({
      where: { companyId, deletedAt: null },
    });

    let score = 0;
    if (totalEntries > 0) score += 50;
    if (totalEntries > 20) score += 25;
    if (totalEntries > 100) score += 25;

    return {
      name: 'Reporting Health',
      weight: 10,
      score: Math.min(100, score),
      maxScore: 100,
      details: `${totalEntries} total entries available for reporting`,
    };
  }

  private async calculateEngagementHealth(companyId: string): Promise<PillarScore> {
    const memberCount = await this.prisma.companyMember.count({
      where: { companyId, isActive: true },
    });
    const totalXp = await this.prisma.xPRecord.aggregate({
      where: { companyId },
      _sum: { points: true },
    });

    let score = 30; // Base score
    if (memberCount > 1) score += 30; // Team collaboration
    if ((totalXp._sum.points || 0) > 100) score += 20;
    if ((totalXp._sum.points || 0) > 1000) score += 20;

    return {
      name: 'Engagement Health',
      weight: 10,
      score: Math.min(100, score),
      maxScore: 100,
      details: `${memberCount} team members, ${totalXp._sum.points || 0} total XP earned`,
    };
  }

  private calculateOverall(pillars: PillarScore[]): number {
    const totalWeight = pillars.reduce((sum, p) => sum + p.weight, 0);
    const weightedScore = pillars.reduce((sum, p) => sum + (p.score * p.weight) / 100, 0);
    return Math.round((weightedScore / totalWeight) * 100);
  }
}
