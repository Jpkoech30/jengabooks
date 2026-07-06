import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// Level thresholds (matching shared enums)
const LEVEL_THRESHOLDS = [
  { level: 1, minXp: 0, title: 'Apprentice' },
  { level: 2, minXp: 100, title: 'Apprentice' },
  { level: 3, minXp: 300, title: 'Apprentice' },
  { level: 4, minXp: 600, title: 'Apprentice' },
  { level: 5, minXp: 1000, title: 'Apprentice' },
  { level: 6, minXp: 1500, title: 'Bookkeeper' },
  { level: 7, minXp: 2100, title: 'Bookkeeper' },
  { level: 8, minXp: 2800, title: 'Bookkeeper' },
  { level: 9, minXp: 3600, title: 'Bookkeeper' },
  { level: 10, minXp: 4500, title: 'Bookkeeper' },
  { level: 11, minXp: 5500, title: 'Accountant' },
  { level: 12, minXp: 6600, title: 'Accountant' },
  { level: 13, minXp: 7800, title: 'Accountant' },
  { level: 14, minXp: 9100, title: 'Accountant' },
  { level: 15, minXp: 10500, title: 'Accountant' },
  { level: 16, minXp: 12000, title: 'Accountant' },
  { level: 17, minXp: 13600, title: 'Accountant' },
  { level: 18, minXp: 15300, title: 'Accountant' },
  { level: 19, minXp: 17100, title: 'Accountant' },
  { level: 20, minXp: 19000, title: 'Accountant' },
  { level: 21, minXp: 21000, title: 'Finance Pro' },
  { level: 22, minXp: 23100, title: 'Finance Pro' },
  { level: 23, minXp: 25300, title: 'Finance Pro' },
  { level: 24, minXp: 27600, title: 'Finance Pro' },
  { level: 25, minXp: 30000, title: 'Finance Pro' },
  { level: 26, minXp: 32500, title: 'Finance Pro' },
  { level: 27, minXp: 35100, title: 'Finance Pro' },
  { level: 28, minXp: 37800, title: 'Finance Pro' },
  { level: 29, minXp: 40600, title: 'Finance Pro' },
  { level: 30, minXp: 43500, title: 'Finance Pro' },
  { level: 31, minXp: 46500, title: 'Business Master' },
  { level: 32, minXp: 49600, title: 'Business Master' },
  { level: 33, minXp: 52800, title: 'Business Master' },
  { level: 34, minXp: 56100, title: 'Business Master' },
  { level: 35, minXp: 59500, title: 'Business Master' },
  { level: 36, minXp: 63000, title: 'Business Master' },
  { level: 37, minXp: 66600, title: 'Business Master' },
  { level: 38, minXp: 70300, title: 'Business Master' },
  { level: 39, minXp: 74100, title: 'Business Master' },
  { level: 40, minXp: 78000, title: 'Business Master' },
  { level: 41, minXp: 82000, title: 'Business Master' },
  { level: 42, minXp: 86100, title: 'Business Master' },
  { level: 43, minXp: 90300, title: 'Business Master' },
  { level: 44, minXp: 94600, title: 'Business Master' },
  { level: 45, minXp: 99000, title: 'Business Master' },
  { level: 46, minXp: 103500, title: 'Business Master' },
  { level: 47, minXp: 108100, title: 'Business Master' },
  { level: 48, minXp: 112800, title: 'Business Master' },
  { level: 49, minXp: 117600, title: 'Business Master' },
  { level: 50, minXp: 122500, title: 'Business Master' },
];

// Badge definitions
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

  constructor(private readonly prisma: PrismaService) {}

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
    await this.prisma.xPRecord.create({
      data: {
        userId,
        companyId,
        points,
        reason,
        badge: badge || null,
      },
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
