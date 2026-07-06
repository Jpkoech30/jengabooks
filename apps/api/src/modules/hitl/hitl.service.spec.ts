import { Test, TestingModule } from '@nestjs/testing';
import { HitlService } from './hitl.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('HitlService', () => {
  let service: HitlService;
  let prisma: any;

  const mockPrisma = {
    pendingReview: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    mpesaTransaction: { update: jest.fn() },
    journalEntry: { create: jest.fn() },
    eTIMSSubmission: { updateMany: jest.fn() },
    xPRecord: { create: jest.fn(), aggregate: jest.fn() },
    userLevel: { upsert: jest.fn() },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HitlService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<HitlService>(HitlService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a pending review', async () => {
      const review = { id: 'review-1', category: 'UNMAPPED_DATA', status: 'PENDING' };
      mockPrisma.pendingReview.create.mockResolvedValue(review);

      const result = await service.create('company-1', {
        category: 'UNMAPPED_DATA',
        description: 'Unmapped transaction',
      });

      expect(result.status).toBe('PENDING');
      expect(mockPrisma.pendingReview.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ companyId: 'company-1' }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated reviews', async () => {
      mockPrisma.pendingReview.findMany.mockResolvedValue([{ id: '1', status: 'PENDING' }]);
      mockPrisma.pendingReview.count.mockResolvedValue(1);

      const result = await service.findAll('company-1');
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('assign', () => {
    it('should assign pending review to a user', async () => {
      mockPrisma.pendingReview.findUnique.mockResolvedValue({ id: '1', status: 'PENDING' });
      mockPrisma.pendingReview.update.mockResolvedValue({ id: '1', status: 'IN_PROGRESS', assignedTo: 'user-1' });

      const result = await service.assign('1', 'user-1');
      expect(result.status).toBe('IN_PROGRESS');
      expect(result.assignedTo).toBe('user-1');
    });

    it('should throw for non-pending review', async () => {
      mockPrisma.pendingReview.findUnique.mockResolvedValue({ id: '1', status: 'RESOLVED' });

      await expect(service.assign('1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw for non-existent review', async () => {
      mockPrisma.pendingReview.findUnique.mockResolvedValue(null);

      await expect(service.assign('nonexistent', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('resolve', () => {
    it('should resolve with APPROVE action', async () => {
      const review = {
        id: '1', companyId: 'company-1', status: 'IN_PROGRESS',
        category: 'UNMAPPED_DATA', linkedEntityId: null,
      };
      mockPrisma.pendingReview.findUnique.mockResolvedValue(review);
      mockPrisma.$transaction.mockImplementation(async (cb: Function) => {
        const tx = {
          pendingReview: {
            update: jest.fn().mockResolvedValue({ id: '1', status: 'RESOLVED', xpAwarded: 50 }),
          },
          xPRecord: { create: jest.fn() },
          userLevel: { upsert: jest.fn() },
        };
        // Mock aggregate for XP
        (tx as any).xPRecord.aggregate = jest.fn().mockResolvedValue({ _sum: { points: 500 } });
        return cb(tx);
      });

      const result = await service.resolve('1', 'user-1', 'Approved after review', 'APPROVE');
      expect(result).toBeDefined();
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should throw for already resolved review', async () => {
      mockPrisma.pendingReview.findUnique.mockResolvedValue({ id: '1', status: 'RESOLVED' });

      await expect(service.resolve('1', 'user-1', 'test', 'APPROVE'))
        .rejects.toThrow(BadRequestException);
    });
  });
});
