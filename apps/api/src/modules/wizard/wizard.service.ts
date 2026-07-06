import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// Wizard step definitions (matching shared enums)
const WIZARD_STEPS = [
  { step: 'COMPANY_PROFILE', label: 'Create Company Profile', xpReward: 50, badgeAward: null },
  { step: 'CHART_OF_ACCOUNTS', label: 'Set up Chart of Accounts', xpReward: 50, badgeAward: 'Accountant' },
  { step: 'CONNECT_MPESA', label: 'Connect M-Pesa', xpReward: 100, badgeAward: 'M-Pesa Connected' },
  { step: 'IMPORT_MPESA', label: 'Import First M-Pesa CSV', xpReward: 100, badgeAward: 'Data Driven' },
  { step: 'FIRST_INCOME', label: 'Record First Income', xpReward: 100, badgeAward: 'First Income' },
  { step: 'FIRST_EXPENSE', label: 'Record First Expense', xpReward: 100, badgeAward: 'First Expense' },
  { step: 'FIRST_INVOICE', label: 'Create First Invoice', xpReward: 150, badgeAward: 'Invoicer' },
  { step: 'FIRST_ETIMS', label: 'Submit First eTIMS Invoice', xpReward: 200, badgeAward: 'Tax Compliant' },
  { step: 'INVITE_TEAM', label: 'Invite a Team Member', xpReward: 50, badgeAward: 'Team Player' },
  { step: 'FIRST_REPORT', label: 'Generate First Report', xpReward: 100, badgeAward: 'Analyst' },
];

@Injectable()
export class WizardService {
  private readonly logger = new Logger(WizardService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get wizard progress for a user within a company
   */
  async getProgress(userId: string, companyId: string) {
    const completedSteps = await this.prisma.wizardProgress.findMany({
      where: { userId, companyId },
      select: { step: true, completedAt: true, xpAwarded: true, badgeAwarded: true },
    });

    const completedSet = new Set(completedSteps.map((s) => s.step));
    let totalXpEarned = 0;
    const badgesEarned: string[] = [];

    const steps = WIZARD_STEPS.map((def) => {
      const completed = completedSteps.find((s) => s.step === def.step);
      if (completed) {
        totalXpEarned += completed.xpAwarded;
        if (completed.badgeAwarded) badgesEarned.push(completed.badgeAwarded);
      }
      return {
        step: def.step,
        label: def.label,
        xpReward: def.xpReward,
        badgeAward: def.badgeAward,
        completed: !!completed,
        completedAt: completed?.completedAt || null,
      };
    });

    const completedCount = completedSteps.length;
    const totalSteps = WIZARD_STEPS.length;
    const percentage = Math.round((completedCount / totalSteps) * 100);

    // Determine next suggested step
    const nextStep = steps.find((s) => !s.completed);

    return {
      steps,
      totalSteps,
      completedSteps: completedCount,
      percentage,
      totalXpEarned,
      badgesEarned,
      nextStep: nextStep
        ? { step: nextStep.step, label: nextStep.label, xpReward: nextStep.xpReward }
        : null,
      isComplete: completedCount === totalSteps,
    };
  }

  /**
   * Auto-detect which steps are complete based on actual user data
   */
  async autoDetectProgress(userId: string, companyId: string) {
    const completedSteps = await this.prisma.wizardProgress.findMany({
      where: { userId, companyId },
      select: { step: true },
    });
    const completedSet = new Set(completedSteps.map((s) => s.step));
    const newlyCompleted: string[] = [];

    // Check each step by looking at actual data
    const checks: Array<{ step: string; check: () => Promise<boolean> }> = [
      {
        step: 'COMPANY_PROFILE',
        check: async () => {
          const company = await this.prisma.company.findUnique({ where: { id: companyId } });
          return !!company;
        },
      },
      {
        step: 'CHART_OF_ACCOUNTS',
        check: async () => {
          const count = await this.prisma.chartOfAccount.count({ where: { companyId } });
          return count > 0;
        },
      },
      {
        step: 'CONNECT_MPESA',
        check: async () => {
          const company = await this.prisma.company.findUnique({ where: { id: companyId } });
          return !!company?.kraPin; // Proxy: company has some configuration
        },
      },
      {
        step: 'IMPORT_MPESA',
        check: async () => {
          const count = await this.prisma.mpesaTransaction.count({ where: { companyId } });
          return count > 0;
        },
      },
      {
        step: 'FIRST_INCOME',
        check: async () => {
          const count = await this.prisma.journalEntry.count({
            where: { companyId, account: { type: 'INCOME' } },
          });
          return count > 0;
        },
      },
      {
        step: 'FIRST_EXPENSE',
        check: async () => {
          const count = await this.prisma.journalEntry.count({
            where: { companyId, account: { type: 'EXPENSE' } },
          });
          return count > 0;
        },
      },
      {
        step: 'FIRST_INVOICE',
        check: async () => {
          const count = await this.prisma.invoice.count({ where: { companyId } });
          return count > 0;
        },
      },
      {
        step: 'FIRST_ETIMS',
        check: async () => {
          const count = await this.prisma.eTIMSSubmission.count({
            where: { invoice: { companyId } },
          });
          return count > 0;
        },
      },
      {
        step: 'INVITE_TEAM',
        check: async () => {
          const count = await this.prisma.companyMember.count({
            where: { companyId, isActive: true },
          });
          return count > 1; // More than just the owner
        },
      },
      {
        step: 'FIRST_REPORT',
        check: async () => {
          // Proxy: if they have enough data for a report
          const count = await this.prisma.journalEntry.count({
            where: { companyId },
          });
          return count > 0;
        },
      },
    ];

    for (const { step, check } of checks) {
      if (completedSet.has(step)) continue;
      const isComplete = await check();
      if (isComplete) {
        await this.completeStep(userId, companyId, step);
        newlyCompleted.push(step);
      }
    }

    return { autoCompleted: newlyCompleted.length, steps: newlyCompleted };
  }

  /**
   * Mark a wizard step as complete and award XP
   */
  async completeStep(userId: string, companyId: string, step: string) {
    const def = WIZARD_STEPS.find((s) => s.step === step);
    if (!def) {
      return { error: `Unknown wizard step: ${step}` };
    }

    // Check if already completed
    const existing = await this.prisma.wizardProgress.findUnique({
      where: { userId_companyId_step: { userId, companyId, step } },
    });
    if (existing) {
      return {
        step,
        alreadyCompleted: true,
        xpAwarded: 0,
        badgeAwarded: null,
      };
    }

    // Create progress record
    await this.prisma.wizardProgress.create({
      data: {
        userId,
        companyId,
        step,
        xpAwarded: def.xpReward,
        badgeAwarded: def.badgeAward,
      },
    });

    // Award XP via XPRecord
    await this.prisma.xPRecord.create({
      data: {
        userId,
        companyId,
        points: def.xpReward,
        reason: `Wizard step: ${def.label}`,
        badge: def.badgeAward,
      },
    });

    // Update user level using canonical calculation from GamificationService
    const totalXp = await this.prisma.xPRecord.aggregate({
      where: { userId, companyId },
      _sum: { points: true },
    });
    const newTotal = totalXp._sum.points || 0;
    const { GamificationService } = await import('../gamification/gamification.service');
    const levelInfo = GamificationService.calculateLevel(newTotal);

    await this.prisma.userLevel.upsert({
      where: { userId_companyId: { userId, companyId } },
      update: { totalXp: newTotal, level: levelInfo.level },
      create: { userId, companyId, totalXp: newTotal, level: levelInfo.level },
    });

    this.logger.log(`Wizard step "${step}" completed for user ${userId}. Awarded ${def.xpReward} XP`);

    return {
      step,
      label: def.label,
      alreadyCompleted: false,
      xpAwarded: def.xpReward,
      badgeAwarded: def.badgeAward,
      newTotalXp: newTotal,
      newLevel: levelInfo.level,
    };
  }
}
