import { Test, TestingModule } from '@nestjs/testing';
import { SandboxService } from './sandbox.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('SandboxService', () => {
  let service: SandboxService;
  let prisma: any;

  const mockDbNow = new Date('2026-07-08T23:00:00Z');

  const createMockPrisma = () => ({
    $queryRaw: jest.fn().mockResolvedValue([{ now: mockDbNow }]),
    $executeRaw: jest.fn().mockResolvedValue(undefined),
    $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
    companyMember: {
      findFirst: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'cm_1' }),
      count: jest.fn().mockResolvedValue(0),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: 'user_1' }),
    },
    mpesaTransaction: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SandboxService,
        { provide: PrismaService, useValue: createMockPrisma() },
      ],
    }).compile();

    service = module.get<SandboxService>(SandboxService);
    prisma = module.get(PrismaService);
  });

  // ─── Status ───────────────────────────────────────────────────────────────

  describe('status', () => {
    it('should return isSandbox=true when company has sandbox record', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { sampleSize: 'MEDIUM', createdAt: mockDbNow, resetCount: 2 },
      ]);

      const result = await service.status('comp_123');

      expect(result).toEqual({
        isSandbox: true,
        sampleSize: 'MEDIUM',
        createdAt: mockDbNow.toISOString(),
        resetCount: 2,
      });
    });

    it('should return isSandbox=false when no sandbox record exists', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const result = await service.status('comp_live_123');

      expect(result).toEqual({
        isSandbox: false,
        sampleSize: null,
        createdAt: null,
        resetCount: null,
      });
    });
  });

  // ─── Init ─────────────────────────────────────────────────────────────────

  describe('init', () => {
    it('should create a new sandbox when user has no existing sandbox', async () => {
      prisma.companyMember.findFirst.mockResolvedValue(null);

      const result = await service.init(
        { companyName: 'Acme Traders Ltd (Sandbox)', sampleSize: 'MEDIUM' },
        'user_1',
      );

      expect(result.sandboxId).toContain('sandbox_');
      expect(result.companyId).toContain('comp_sandbox_');
      expect(result.resetToken).toContain('reset_');
      expect(result.accountsCreated).toBe(47);
      expect(result.invoicesCreated).toBe(10);
      expect(result.employeesCreated).toBe(5);
    });

    it('should return existing sandbox if user already has one', async () => {
      prisma.companyMember.findFirst.mockResolvedValue({
        id: 'cm_1',
        company: { id: 'existing_comp', name: 'Existing Co' },
      });

      // Override the default mock to handle the sequence
      prisma.$queryRaw
        .mockResolvedValueOnce([{ now: mockDbNow }]) // getDbNow
        .mockResolvedValueOnce([{ id: 'sandbox_existing', resetToken: 'reset_existing' }]); // existing sandbox

      const result = await service.init(
        { companyName: 'Acme Traders Ltd (Sandbox)', sampleSize: 'MEDIUM' },
        'user_1',
      );

      expect(result.sandboxId).toBe('sandbox_existing');
      expect(result.companyId).toBe('existing_comp');
      expect(result.resetToken).toBe('reset_existing');
    });
  });

  // ─── Reset ─────────────────────────────────────────────────────────────────

  describe('reset', () => {
    it('should reset sandbox with valid token', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([
          {
            id: 'sandbox_1',
            companyId: 'comp_1',
            sampleSize: 'MEDIUM',
            resetCount: 1,
            resetToken: 'reset_valid',
          },
        ])
        .mockResolvedValueOnce([{ now: mockDbNow }]);

      prisma.companyMember.findFirst.mockResolvedValue({
        userId: 'user_1',
      });

      const result = await service.reset({
        sandboxId: 'sandbox_1',
        resetToken: 'reset_valid',
      });

      expect(result.sandboxId).toBe('sandbox_1');
      expect(result.companyId).toBe('comp_1');
      expect(result.resetToken).toBe('reset_valid');
    });

    it('should throw NotFoundException for non-existent sandbox', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await expect(
        service.reset({ sandboxId: 'sandbox_nonexist', resetToken: 'reset_xxx' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid reset token', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 'sandbox_1',
          companyId: 'comp_1',
          sampleSize: 'MEDIUM',
          resetCount: 0,
          resetToken: 'reset_correct',
        },
      ]);

      await expect(
        service.reset({ sandboxId: 'sandbox_1', resetToken: 'reset_wrong' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  describe('cleanupOldSandboxes', () => {
    it('should clean up sandboxes older than 7 days', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ now: mockDbNow }])
        .mockResolvedValueOnce([
          { id: 'sandbox_old_1', companyId: 'comp_old_1' },
          { id: 'sandbox_old_2', companyId: 'comp_old_2' },
        ]);

      const result = await service.cleanupOldSandboxes();

      expect(result).toBe(2);
      expect(prisma.$executeRaw).toHaveBeenCalled();
    });

    it('should return 0 when no old sandboxes exist', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ now: mockDbNow }])
        .mockResolvedValueOnce([]);

      const result = await service.cleanupOldSandboxes();

      expect(result).toBe(0);
    });
  });

  // ─── Sample Size ──────────────────────────────────────────────────────────

  describe('sample size', () => {
    it('should map SMALL to 50 transactions', () => {
      expect(service['getTxCount']('SMALL')).toBe(50);
    });

    it('should map MEDIUM to 200 transactions', () => {
      expect(service['getTxCount']('MEDIUM')).toBe(200);
    });

    it('should map LARGE to 500 transactions', () => {
      expect(service['getTxCount']('LARGE')).toBe(500);
    });
  });
});
