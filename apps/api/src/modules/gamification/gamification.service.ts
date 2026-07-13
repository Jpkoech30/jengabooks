import { Injectable, Logger } from '@nestjs/common';
import { GamificationRepository } from '../../prisma/repositories/gamification.repository';
import { PrismaService } from '../../prisma/prisma.service';
// Import shared constants to ensure consistency across the codebase
import { LEVEL_THRESHOLDS } from '@jengabooks/shared';

// Badge definitions (defined here — shared package doesn't export this format yet)
const BADGE_DEFINITIONS = [
  { id: 'ACCOUNTANT', name: 'Accountant', description: 'Set up your Chart of Accounts', icon: '📚' },
  { id: 'MPESA_CONNECTED', name: 'M-Pesa Connected', description: 'Connect M-Pesa business number', icon: '📱' },
  { id: 'DATA_DRIVEN', name: 'Data Driven', description: 'Import first M-Pesa CSV', icon: '📊' },
  { id: 'FIRST_INCOME', name: 'First Income', description: 'Record your first income', icon: '💰' },
  { id: 'FIRST_EXPENSE', name: 'First Expense', description: 'Record your first expense', icon: '💳' },
  { id: 'INVOICER', name: 'Invoicer', description: 'Create your first invoice', icon: '📄' },
  { id: 'TAX_COMPLIANT', name: 'Tax Compliant', description: 'Submit first eTIMS invoice', icon: '🛡️' },
  { id: 'TEAM_PLAYER', name: 'Team Player', description: 'Invite a team member', icon: '👥' },
  { id: 'ANALYST', name: 'Analyst', description: 'Generate your first report', icon: '📈' },
];

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  constructor(
    private readonly gamificationRepo: GamificationRepository,
    private readonly prisma: PrismaService,
  ) { }

  /**
   * Calculate level and title from total XP using the predefined thresholds
   */
  static calculateLevel(totalXp: number): { level: number; title: string; xpToNextLevel: number } {
    let currentLevel = LEVEL_THRESHOLDS[0];
    let nextThreshold = LEVEL_THRESHOLDS[1];

    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (totalXp >= LEVEL_THRESHOLDS[i].minXp) {
        currentLevel = LEVEL_THRESHOLDS[i];
        nextThreshold = LEVEL_THRESHOLDS[i + 1] || LEVEL_THRESHOLDS[i];
        break;
      }
    }

    const xpToNextLevel = nextThreshold.minXp - totalXp;
    return {
      level: currentLevel.level,
      title: currentLevel.title,
      xpToNextLevel: Math.max(0, xpToNextLevel),
    };
  }

  /**
   * Award XP to a user, update their level, and return the result
   */
  async awardXp(
    userId: string,
    companyId: string,
    points: number,
    reason: string,
    badge?: string,
  ) {
    // Create XP record
    await this.gamificationRepo.create({
      userId,
      companyId,
      points,
      reason,
      badge: badge || null,
    });

    // Calculate new total
    const totalXp = await this.prisma.xPRecord.aggregate({
      where: { userId, companyId },
      _sum: { points: true },
    });

    const newTotal = totalXp._sum.points || 0;
    const levelInfo = GamificationService.calculateLevel(newTotal);

    // Upsert user level
    const userLevel = await this.prisma.userLevel.upsert({
      where: { userId_companyId: { userId, companyId } },
      update: { totalXp: newTotal, level: levelInfo.level },
      create: {
        userId,
        companyId,
        totalXp: newTotal,
        level: levelInfo.level,
      },
    });

    this.logger.log(`Awarded ${points} XP to user ${userId} for ${reason}. New total: ${newTotal}, Level: ${levelInfo.level}`);

    return {
      userId,
      companyId,
      pointsAwarded: points,
      newScore: newTotal,
      newLevel: userLevel.level,
      levelTitle: levelInfo.title,
      xpToNextLevel: levelInfo.xpToNextLevel,
      badge: badge || null,
      reason,
    };
  }

  /**
   * Get gamification profile for a user within a company
   */
  async getProfile(userId: string, companyId: string) {
    // Check and auto-award any new badges based on activity
    await this.checkAndAwardBadges(userId, companyId);

    const userLevel = await this.prisma.userLevel.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });

    const totalXp = userLevel?.totalXp || 0;
    const levelInfo = GamificationService.calculateLevel(totalXp);

    const recentXp = await this.prisma.xPRecord.findMany({
      where: { userId, companyId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Get earned badges (badges with non-null badge field in XPRecord)
    const earnedBadgeRecords = await this.prisma.xPRecord.findMany({
      where: { userId, companyId, badge: { not: null } },
      distinct: ['badge'],
      select: { badge: true, createdAt: true },
    });

    const earnedBadges = earnedBadgeRecords
      .filter((r) => r.badge)
      .map((r) => {
        const def = BADGE_DEFINITIONS.find((b) => b.name === r.badge);
        return {
          id: def?.id || r.badge,
          name: r.badge,
          description: def?.description || '',
          icon: def?.icon || '🏅',
          earnedAt: r.createdAt,
        };
      });

    // Build available badges (all minus earned)
    const earnedNames = new Set(earnedBadges.map((b) => b.name));
    const availableBadges = BADGE_DEFINITIONS.filter((b) => !earnedNames.has(b.name)).map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      icon: b.icon,
      earned: false,
    }));

    return {
      userId,
      companyId,
      score: totalXp,
      level: levelInfo.level,
      levelTitle: levelInfo.title,
      xpToNextLevel: levelInfo.xpToNextLevel,
      badges: {
        earned: earnedBadges,
        available: availableBadges,
      },
      recentActivity: recentXp.map((xp) => ({
        points: xp.points,
        reason: xp.reason,
        badge: xp.badge,
        date: xp.createdAt,
      })),
    };
  }

  /**
   * Get badges (earned + available) for a user within a company
   */
  async getBadges(userId: string, companyId: string) {
    // Check and auto-award any new badges based on activity
    await this.checkAndAwardBadges(userId, companyId);

    // Get earned badges (badges with non-null badge field in XPRecord)
    const earnedBadgeRecords = await this.prisma.xPRecord.findMany({
      where: { userId, companyId, badge: { not: null } },
      distinct: ['badge'],
      select: { badge: true, createdAt: true },
    });

    const earnedBadges = earnedBadgeRecords
      .filter((r) => r.badge)
      .map((r) => {
        const def = BADGE_DEFINITIONS.find((b) => b.name === r.badge);
        return {
          id: def?.id || r.badge,
          name: r.badge,
          description: def?.description || '',
          icon: def?.icon || '🏅',
          earnedAt: r.createdAt,
        };
      });

    // Build available badges (all minus earned)
    const earnedNames = new Set(earnedBadges.map((b) => b.name));
    const availableBadges = BADGE_DEFINITIONS.filter((b) => !earnedNames.has(b.name)).map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      icon: b.icon,
      earned: false,
    }));

    return {
      earned: earnedBadges,
      available: availableBadges,
    };
  }

  /**
   * Auto-detect and award badges by checking actual user activity
   * This is called when checking the user's gamification profile
   */
  async checkAndAwardBadges(userId: string, companyId: string): Promise<string[]> {
    const newlyAwarded: string[] = [];

    // Get already earned badges
    const earnedRecords = await this.prisma.xPRecord.findMany({
      where: { userId, companyId, badge: { not: null } },
      distinct: ['badge'],
      select: { badge: true },
    });
    const earnedBadgeNames = new Set(earnedRecords.map((r) => r.badge).filter(Boolean));

    // Check each badge condition
    // 📚 Accountant — Set up Chart of Accounts
    if (!earnedBadgeNames.has('Accountant')) {
      const accountCount = await this.prisma.chartOfAccount.count({
        where: { companyId },
      });
      if (accountCount >= 5) {
        await this.awardXp(userId, companyId, 25, 'Earned badge: Accountant', 'Accountant');
        newlyAwarded.push('Accountant');
      }
    }

    // 📱 M-Pesa Connected — Has M-Pesa transactions
    if (!earnedBadgeNames.has('M-Pesa Connected')) {
      const mpesaCount = await this.prisma.mpesaTransaction.count({
        where: { companyId },
      });
      if (mpesaCount > 0) {
        await this.awardXp(userId, companyId, 25, 'Earned badge: M-Pesa Connected', 'M-Pesa Connected');
        newlyAwarded.push('M-Pesa Connected');
      }
    }

    // 📊 Data Driven — Imported first CSV
    if (!earnedBadgeNames.has('Data Driven')) {
      const mpesaCount = await this.prisma.mpesaTransaction.count({
        where: { companyId },
      });
      if (mpesaCount > 0) {
        await this.awardXp(userId, companyId, 25, 'Earned badge: Data Driven', 'Data Driven');
        newlyAwarded.push('Data Driven');
      }
    }

    // 💰 First Income — Recorded first income entry
    if (!earnedBadgeNames.has('First Income')) {
      const incomeCount = await this.prisma.journalEntry.count({
        where: { companyId, account: { type: 'INCOME' } },
      });
      if (incomeCount > 0) {
        await this.awardXp(userId, companyId, 25, 'Earned badge: First Income', 'First Income');
        newlyAwarded.push('First Income');
      }
    }

    // 💳 First Expense — Recorded first expense entry
    if (!earnedBadgeNames.has('First Expense')) {
      const expenseCount = await this.prisma.journalEntry.count({
        where: { companyId, account: { type: 'EXPENSE' } },
      });
      if (expenseCount > 0) {
        await this.awardXp(userId, companyId, 25, 'Earned badge: First Expense', 'First Expense');
        newlyAwarded.push('First Expense');
      }
    }

    // 🛡️ Tax Compliant — Submitted first eTIMS invoice
    if (!earnedBadgeNames.has('Tax Compliant')) {
      const submissionCount = await this.prisma.eTIMSSubmission.count({
        where: { invoice: { companyId }, status: 'ACCEPTED' },
      });
      if (submissionCount > 0) {
        await this.awardXp(userId, companyId, 50, 'Earned badge: Tax Compliant', 'Tax Compliant');
        newlyAwarded.push('Tax Compliant');
      }
    }

    // 📈 Analyst — Generated first report
    if (!earnedBadgeNames.has('Analyst')) {
      // Reports are generated via the reports service — we check if they have enough data
      const entryCount = await this.prisma.journalEntry.count({
        where: { companyId },
      });
      if (entryCount >= 5) {
        await this.awardXp(userId, companyId, 25, 'Earned badge: Analyst', 'Analyst');
        newlyAwarded.push('Analyst');
      }
    }

    if (newlyAwarded.length > 0) {
      this.logger.log(`Badges auto-awarded for user ${userId}: ${newlyAwarded.join(', ')}`);
    }

    return newlyAwarded;
  }

  /**
   * Get leaderboard for a company
   */
  async getLeaderboard(companyId: string, limit: number = 10) {
    const levels = await this.prisma.userLevel.findMany({
      where: { companyId },
      orderBy: { totalXp: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return levels.map((entry, index) => {
      const levelInfo = GamificationService.calculateLevel(entry.totalXp);
      return {
        rank: index + 1,
        userId: entry.userId,
        name: entry.user.name,
        email: entry.user.email,
        level: entry.level,
        levelTitle: levelInfo.title,
        totalXp: entry.totalXp,
      };
    });
  }
}
