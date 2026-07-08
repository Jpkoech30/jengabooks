import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(companyId: string, userId: string) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

    // 1. Recent entries + total count
    const [totalEntries, recentEntries] = await Promise.all([
      this.prisma.journalEntry.count({ where: { companyId, deletedAt: null } }),
      this.prisma.journalEntry.findMany({
        where: { companyId, deletedAt: null },
        orderBy: { entryDate: 'desc' },
        take: 5,
        include: {
          account: { select: { code: true, name: true } },
          postedBy: { select: { name: true } },
        },
      }),
    ]);

    // 2. Business health score (using findFirst since companyId is not unique)
    const healthScore = await this.prisma.businessHealthScore.findFirst({
      where: { companyId },
      orderBy: { calculatedAt: 'desc' },
    });

    // 3. Wizard progress
    const wizardSteps = await this.prisma.wizardProgress.findMany({
      where: { userId, companyId },
      orderBy: { completedAt: 'desc' },
    });
    const wizard = {
      completedSteps: wizardSteps.length,
      totalSteps: 5,
      percentage: Math.round((wizardSteps.length / 5) * 100),
      isComplete: wizardSteps.length >= 5,
      nextStep: null as { label: string } | null,
      steps: wizardSteps.map((s: { step: string; completedAt: Date; xpAwarded: number; badgeAwarded: string | null }) => ({
        step: s.step,
        completed: true,
        completedAt: s.completedAt,
        xpAwarded: s.xpAwarded,
        badgeAwarded: s.badgeAwarded,
      })),
    };

    // 4. Gamification
    const userLevel = await this.prisma.userLevel.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });

    const recentXp = await this.prisma.xPRecord.findMany({
      where: { userId, companyId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const gamification = userLevel
      ? {
          score: userLevel.totalXp,
          level: userLevel.level,
          xpToNextLevel: this.getXpForNextLevel(userLevel.level),
          levelTitle: `Level ${userLevel.level}`,
          recentActivity: recentXp.map((r: { points: number; reason: string; badge: string | null; createdAt: Date }) => ({
            points: r.points,
            reason: r.reason,
            badge: r.badge,
            date: r.createdAt,
          })),
        }
      : null;

    // 5. Monthly analytics
    const monthlyEntries = await this.prisma.journalEntry.findMany({
      where: { companyId, entryDate: { gte: sixMonthsAgo }, deletedAt: null },
      include: { account: { select: { type: true } } },
    });

    const monthlyMap = new Map<string, { income: number; expense: number }>();
    for (const entry of monthlyEntries) {
      const monthKey = entry.entryDate.toISOString().slice(0, 7);
      const current = monthlyMap.get(monthKey) || { income: 0, expense: 0 };
      if (entry.account.type === 'INCOME') {
        current.income += entry.direction === 'CREDIT' ? entry.amount : -entry.amount;
      } else if (entry.account.type === 'EXPENSE') {
        current.expense += entry.direction === 'DEBIT' ? entry.amount : -entry.amount;
      }
      monthlyMap.set(monthKey, current);
    }

    // 6. Top 5 expenses
    const expenseEntries = await this.prisma.journalEntry.groupBy({
      by: ['accountId'],
      where: { companyId, account: { type: 'EXPENSE' }, deletedAt: null },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 5,
    });

    const topExpenses = await Promise.all(
      expenseEntries.map(async (e: { accountId: string; _sum: { amount: number | null } }) => {
        const acct = await this.prisma.chartOfAccount.findUnique({ where: { id: e.accountId } });
        return { code: acct?.code, name: acct?.name, total: e._sum.amount || 0 };
      }),
    );

    // 7. M-Pesa 30-day summary
    const mpesaSummary = await this.prisma.mpesaTransaction.aggregate({
      where: { companyId, transactionDate: { gte: thirtyDaysAgo } },
      _sum: { paidIn: true, withdrawn: true },
    });

    return {
      entries: {
        total: totalEntries,
        recent: recentEntries.map((e: { id: string; description: string; amount: number; direction: string; entryDate: Date; account: { code: string; name: string }; aiConfidence: number | null; postedBy: { name: string } | null }) => ({
          id: e.id,
          description: e.description,
          amount: e.amount,
          direction: e.direction,
          entryDate: e.entryDate,
          account: e.account,
          aiConfidence: e.aiConfidence,
          postedBy: e.postedBy,
        })),
      },
      healthScore: healthScore
        ? {
            overallScore: healthScore.overallScore,
            pillars: healthScore.pillarScores as any,
            calculatedAt: healthScore.calculatedAt,
          }
        : null,
      wizard,
      gamification,
      analytics: {
        monthly: Array.from(monthlyMap.entries()).map(([month, data]) => ({ month, ...data })),
        topExpenses,
        mpesaSummary: {
          paidIn30d: mpesaSummary._sum.paidIn || 0,
          withdrawn30d: mpesaSummary._sum.withdrawn || 0,
        },
      },
    };
  }

  private getXpForNextLevel(currentLevel: number): number {
    return currentLevel * 500;
  }
}
