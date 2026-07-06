import { Test, TestingModule } from '@nestjs/testing';
import { WizardService } from './wizard.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('WizardService', () => {
  let service: WizardService;
  let prisma: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WizardService,
        {
          provide: PrismaService,
          useValue: {
            wizardProgress: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
            xPRecord: { create: jest.fn(), aggregate: jest.fn() },
            userLevel: { upsert: jest.fn() },
            company: { findUnique: jest.fn() },
            chartOfAccount: { count: jest.fn() },
            mpesaTransaction: { count: jest.fn() },
            journalEntry: { count: jest.fn() },
            invoice: { count: jest.fn() },
            eTIMSSubmission: { count: jest.fn() },
            companyMember: { count: jest.fn() },
          },
        },
      ],
    }).compile();

    service = module.get<WizardService>(WizardService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  describe('getProgress', () => {
    it('should return 0% for no completed steps', async () => {
      prisma.wizardProgress.findMany.mockResolvedValue([]);
      const result = await service.getProgress('u1', 'c1');
      expect(result.percentage).toBe(0);
      expect(result.completedSteps).toBe(0);
      expect(result.isComplete).toBe(false);
      expect(result.nextStep).toBeDefined();
    });

    it('should return 100% for all steps completed', async () => {
      const allSteps = [
        'COMPANY_PROFILE', 'CHART_OF_ACCOUNTS', 'CONNECT_MPESA', 'IMPORT_MPESA',
        'FIRST_INCOME', 'FIRST_EXPENSE', 'FIRST_INVOICE', 'FIRST_ETIMS',
        'INVITE_TEAM', 'FIRST_REPORT',
      ].map(step => ({ step, completedAt: new Date(), xpAwarded: 100, badgeAwarded: null }));
      prisma.wizardProgress.findMany.mockResolvedValue(allSteps);
      const result = await service.getProgress('u1', 'c1');
      expect(result.percentage).toBe(100);
      expect(result.isComplete).toBe(true);
      expect(result.nextStep).toBeNull();
    });
  });

  describe('completeStep', () => {
    it('should mark a step as complete and award XP', async () => {
      prisma.wizardProgress.findUnique.mockResolvedValue(null);
      prisma.wizardProgress.create.mockResolvedValue({ step: 'COMPANY_PROFILE' });
      prisma.xPRecord.create.mockResolvedValue({});
      prisma.xPRecord.aggregate.mockResolvedValue({ _sum: { points: 50 } });
      prisma.userLevel.upsert.mockResolvedValue({ level: 1 });

      const { GamificationService } = await import('../gamification/gamification.service');
      jest.spyOn(GamificationService, 'calculateLevel').mockReturnValue({ level: 1, title: 'Apprentice', xpToNextLevel: 50 });

      const result = await service.completeStep('u1', 'c1', 'COMPANY_PROFILE');
      expect(result.alreadyCompleted).toBe(false);
      expect(result.xpAwarded).toBe(50);
    });

    it('should skip already completed steps', async () => {
      prisma.wizardProgress.findUnique.mockResolvedValue({ step: 'COMPANY_PROFILE', completedAt: new Date() });
      const result = await service.completeStep('u1', 'c1', 'COMPANY_PROFILE');
      expect(result.alreadyCompleted).toBe(true);
    });

    it('should return error for invalid step', async () => {
      const result = await service.completeStep('u1', 'c1', 'INVALID_STEP');
      expect(result.error).toBeDefined();
    });
  });

  describe('autoDetectProgress', () => {
    it('should detect steps from actual data', async () => {
      prisma.wizardProgress.findMany.mockResolvedValue([]);
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' }); // COMPANY_PROFILE
      prisma.chartOfAccount.count.mockResolvedValue(5); // CHART_OF_ACCOUNTS
      prisma.mpesaTransaction.count.mockResolvedValue(3); // IMPORT_MPESA
      prisma.journalEntry.count.mockResolvedValue(1); // FIRST_REPORT
      prisma.invoice.count.mockResolvedValue(0);
      prisma.eTIMSSubmission.count.mockResolvedValue(0);
      prisma.companyMember.count.mockResolvedValue(1);
      prisma.wizardProgress.create.mockResolvedValue({});
      // xPRecord.aggregate must return proper shape for completeStep
      prisma.xPRecord.aggregate.mockResolvedValue({ _sum: { points: 100 } });

      const result = await service.autoDetectProgress('u1', 'c1');
      expect(result.autoCompleted).toBeGreaterThan(0);
    });
  });
});
