import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('BillingService', () => {
  let service: BillingService;
  let prisma: any;

  const mockPrisma = {
    subscription: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  // Helper to create a mock subscription shape
  const mockSubscription = (overrides: Partial<Record<string, any>> = {}) => ({
    id: 'sub-1',
    companyId: 'comp-1',
    tier: 'STARTER',
    status: 'TRIAL',
    trialEndsAt: new Date('2026-07-22T00:00:00.000Z'), // 14 days from mock now
    currentPeriodStart: new Date('2026-07-08T00:00:00.000Z'),
    currentPeriodEnd: new Date('2026-08-07T00:00:00.000Z'),
    cancelledAt: null,
    createdAt: new Date('2026-07-08T00:00:00.000Z'),
    updatedAt: new Date('2026-07-08T00:00:00.000Z'),
    ...overrides,
  });

  const mockDbNow = new Date('2026-07-08T00:00:00.000Z');

  beforeEach(async () => {
    jest.clearAllMocks();

    // Default: $queryRaw returns DB now
    mockPrisma.$queryRaw.mockResolvedValue([{ now: mockDbNow }]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
    prisma = module.get(PrismaService);
  });

  // ─── getPlans ────────────────────────────────────────────────────────

  describe('getPlans()', () => {
    it('should return all 4 pricing tiers', () => {
      const plans = service.getPlans();

      expect(plans).toHaveProperty('STARTER');
      expect(plans).toHaveProperty('PRO');
      expect(plans).toHaveProperty('ENTERPRISE');
      expect(plans).toHaveProperty('ACCOUNTANT_PRACTICE');
      expect(Object.keys(plans)).toHaveLength(4);
    });

    it('should include features and pricing for each tier', () => {
      const plans = service.getPlans();

      expect(plans.STARTER.price).toBe(2500);
      expect(plans.STARTER.features).toContain('Basic bookkeeping');
      expect(plans.PRO.price).toBe(5000);
      expect(plans.PRO.features).toContain('M-Pesa integration');
      expect(plans.ENTERPRISE.price).toBe(12000);
      expect(plans.ACCOUNTANT_PRACTICE.price).toBe(15000);
    });
  });

  // ─── getSubscription ─────────────────────────────────────────────────

  describe('getSubscription()', () => {
    it('should auto-create TRIAL subscription if none exists', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      mockPrisma.subscription.create.mockResolvedValue(mockSubscription());

      const result = await service.getSubscription('comp-1');

      expect(mockPrisma.subscription.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 'comp-1',
            tier: 'STARTER',
            status: 'TRIAL',
          }),
        }),
      );
      expect(result.companyId).toBe('comp-1');
      expect(result.status).toBe('TRIAL');
    });

    it('should return existing ACTIVE subscription with features resolved', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(
        mockSubscription({ tier: 'PRO', status: 'ACTIVE' }),
      );

      const result = await service.getSubscription('comp-1');

      expect(result.tier).toBe('PRO');
      expect(result.status).toBe('ACTIVE');
      expect(result.features).toContain('M-Pesa integration');
      expect(result.features).toContain('Payroll');
      expect(result.price).toBe(5000);
    });

    it('should return EXPIRED status if trial has ended', async () => {
      const expiredTrial = mockSubscription({
        status: 'TRIAL',
        trialEndsAt: new Date('2026-07-01T00:00:00.000Z'), // Past date
      });
      mockPrisma.subscription.findUnique.mockResolvedValue(expiredTrial);
      mockPrisma.subscription.update.mockResolvedValue({
        ...expiredTrial,
        status: 'EXPIRED',
      });

      const result = await service.getSubscription('comp-1');

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-1' },
          data: { status: 'EXPIRED' },
        }),
      );
      expect(result.status).toBe('EXPIRED');
    });

    it('should resolve features for ENTERPRISE tier', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(
        mockSubscription({ tier: 'ENTERPRISE', status: 'ACTIVE' }),
      );

      const result = await service.getSubscription('comp-1');

      expect(result.features).toContain('Multi-entity');
      expect(result.features).toContain('Advanced reporting');
      expect(result.price).toBe(12000);
    });
  });

  // ─── createSubscription ──────────────────────────────────────────────

  describe('createSubscription()', () => {
    it('should create a new ACTIVE subscription', async () => {
      // createSubscription calls upsert, then getSubscription internally
      // getSubscription calls findUnique — must return the ACTIVE subscription
      mockPrisma.subscription.findUnique.mockResolvedValue(
        mockSubscription({ tier: 'PRO', status: 'ACTIVE', trialEndsAt: null }),
      );
      mockPrisma.subscription.upsert.mockResolvedValue(
        mockSubscription({ tier: 'PRO', status: 'ACTIVE' }),
      );

      const result = await service.createSubscription('comp-1', 'PRO');

      expect(mockPrisma.subscription.upsert).toHaveBeenCalled();
      expect(result.status).toBe('ACTIVE');
      expect(result.tier).toBe('PRO');
      expect(result.trialEndsAt).toBeNull();
    });

    it('should update existing subscription if company already has one', async () => {
      // After upsert, getSubscription internally calls findUnique
      mockPrisma.subscription.findUnique.mockResolvedValue(
        mockSubscription({ tier: 'ENTERPRISE', status: 'ACTIVE', trialEndsAt: null }),
      );
      mockPrisma.subscription.upsert.mockResolvedValue(
        mockSubscription({ tier: 'ENTERPRISE', status: 'ACTIVE' }),
      );

      const result = await service.createSubscription('comp-1', 'ENTERPRISE');

      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'comp-1' },
          update: expect.objectContaining({ tier: 'ENTERPRISE', status: 'ACTIVE' }),
          create: expect.objectContaining({ tier: 'ENTERPRISE', status: 'ACTIVE' }),
        }),
      );
      expect(result.tier).toBe('ENTERPRISE');
    });

    it('should throw BadRequestException for invalid tier', async () => {
      await expect(
        service.createSubscription('comp-1', 'INVALID_TIER'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── changeTier ──────────────────────────────────────────────────────

  describe('changeTier()', () => {
    it('should update tier successfully', async () => {
      // changeTier calls findUnique (existing check), then update, then getSubscription
      // getSubscription calls findUnique again — return PRO on second call
      mockPrisma.subscription.findUnique
        .mockResolvedValueOnce(mockSubscription({ tier: 'STARTER', status: 'ACTIVE' })) // for changeTier's existing check
        .mockResolvedValueOnce(mockSubscription({ tier: 'PRO', status: 'ACTIVE' })); // for getSubscription's findUnique
      mockPrisma.subscription.update.mockResolvedValue(
        mockSubscription({ tier: 'PRO', status: 'ACTIVE' }),
      );

      const result = await service.changeTier('comp-1', 'PRO');

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'comp-1' },
          data: { tier: 'PRO' },
        }),
      );
      expect(result.tier).toBe('PRO');
    });

    it('should throw NotFoundException if no subscription exists', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      await expect(
        service.changeTier('comp-1', 'PRO'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid tier', async () => {
      await expect(
        service.changeTier('comp-1', 'NONEXISTENT'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── cancelSubscription ──────────────────────────────────────────────

  describe('cancelSubscription()', () => {
    it('should set status to CANCELLED', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(
        mockSubscription({ tier: 'PRO', status: 'ACTIVE' }),
      );
      mockPrisma.subscription.update.mockResolvedValue(
        mockSubscription({ tier: 'PRO', status: 'CANCELLED', cancelledAt: new Date() }),
      );

      const result = await service.cancelSubscription('comp-1');

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'comp-1' },
          data: expect.objectContaining({
            status: 'CANCELLED',
            cancelledAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should throw NotFoundException if no subscription exists', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      await expect(
        service.cancelSubscription('comp-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getFeatureCheck ─────────────────────────────────────────────────

  describe('getFeatureCheck()', () => {
    it('should return false for Starter plan not including M-Pesa integration', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(
        mockSubscription({ tier: 'STARTER', status: 'ACTIVE' }),
      );

      const result = await service.getFeatureCheck('comp-1', 'M-Pesa integration');

      expect(result).toBe(false);
    });

    it('should return true for PRO plan including M-Pesa integration', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(
        mockSubscription({ tier: 'PRO', status: 'ACTIVE' }),
      );

      const result = await service.getFeatureCheck('comp-1', 'M-Pesa integration');

      expect(result).toBe(true);
    });

    it('should return false for PRO plan not including Multi-entity', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(
        mockSubscription({ tier: 'PRO', status: 'ACTIVE' }),
      );

      const result = await service.getFeatureCheck('comp-1', 'Multi-entity');

      expect(result).toBe(false);
    });

    it('should return true for ENTERPRISE plan including Multi-entity', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(
        mockSubscription({ tier: 'ENTERPRISE', status: 'ACTIVE' }),
      );

      const result = await service.getFeatureCheck('comp-1', 'Multi-entity');

      expect(result).toBe(true);
    });

    it('should auto-create TRIAL subscription if none exists before checking', async () => {
      mockPrisma.subscription.findUnique
        .mockResolvedValueOnce(null) // First call: no subscription
        .mockResolvedValueOnce(mockSubscription()); // After auto-creation
      mockPrisma.subscription.create.mockResolvedValue(mockSubscription());

      const result = await service.getFeatureCheck('comp-1', 'eTIMS compliance');

      expect(mockPrisma.subscription.create).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });
});
