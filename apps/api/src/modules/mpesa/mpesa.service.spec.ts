import { Test, TestingModule } from '@nestjs/testing';
import { MpesaService } from './mpesa.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';
import { HitlService } from '../hitl/hitl.service';
import { BadRequestException } from '@nestjs/common';

describe('MpesaService', () => {
  let service: MpesaService;
  let prisma: any;
  let gamification: any;

  const mockPrisma = {
    mpesaTransaction: {
      createManyAndReturn: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    categoryRule: { findMany: jest.fn() },
    chartOfAccount: { findUnique: jest.fn(), findFirst: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MpesaService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: GamificationService, useValue: { awardXp: jest.fn().mockResolvedValue({}) } },
        { provide: HitlService, useValue: { create: jest.fn().mockResolvedValue({}) } },
      ],
    }).compile();

    service = module.get<MpesaService>(MpesaService);
    prisma = (module as any).get(PrismaService);
    gamification = (module as any).get(GamificationService);
    jest.clearAllMocks();
  });

  describe('CSV parsing', () => {
    beforeEach(() => {
      // No category rules defined for basic CSV tests
      mockPrisma.categoryRule.findMany.mockResolvedValue([]);
    });

    it('should map receipt header to receiptNo', async () => {
      const csv = 'receipt,date,amount\nRCP001,2026-01-01,500';
      mockPrisma.mpesaTransaction.createManyAndReturn.mockResolvedValue([{ id: '1', receiptNo: 'RCP001' }]);
      const r = await service.uploadCsv('c1', 'u1', csv);
      expect(r.imported).toBe(1);
    });

    it('should map phone header to phoneNumber', async () => {
      const csv = 'phone,date,amount\n0712345678,2026-01-01,500';
      mockPrisma.mpesaTransaction.createManyAndReturn.mockResolvedValue([{ id: '1', phoneNumber: '0712345678' }]);
      const r = await service.uploadCsv('c1', 'u1', csv);
      expect(r.imported).toBe(1);
    });

    it('should skip malformed rows', async () => {
      const csv = 'receipt,date,amount\nRCP001,2026-01-01\nRCP002,2026-01-01,1000';
      mockPrisma.mpesaTransaction.createManyAndReturn.mockResolvedValue([{ id: '1' }]);
      const r = await service.uploadCsv('c1', 'u1', csv);
      expect(r.imported).toBe(1);
    });

    it('should throw for CSV with only header', async () => {
      await expect(service.uploadCsv('c1', 'u1', 'receipt,date,amount'))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw for empty CSV', async () => {
      await expect(service.uploadCsv('c1', 'u1', '')).rejects.toThrow(BadRequestException);
    });
  });

  describe('auto-categorization', () => {
    const csv = 'description,amount\nSafaricom,1000\nrent,20000';
    const createdTxns = [
      { id: 'tx1', description: 'Safaricom', amount: 1000 },
      { id: 'tx2', description: 'rent', amount: 20000 },
    ];

    beforeEach(() => {
      mockPrisma.mpesaTransaction.createManyAndReturn.mockResolvedValue(createdTxns);
      mockPrisma.categoryRule.findMany.mockResolvedValue([
        { keyword: 'Safaricom', accountCode: '6001', priority: 10 },
      ]);
      mockPrisma.chartOfAccount.findUnique.mockResolvedValue({ id: 'acc-6001', code: '6001' });
    });

    it('should categorize matching transactions', async () => {
      await service.uploadCsv('c1', 'u1', csv);
      expect(mockPrisma.mpesaTransaction.updateMany).toHaveBeenCalled();
    });

    it('should award XP for imported transactions', async () => {
      await service.uploadCsv('c1', 'u1', csv);
      expect(gamification.awardXp).toHaveBeenCalled();
    });
  });

  describe('findTransactions', () => {
    it('should return paginated results', async () => {
      mockPrisma.mpesaTransaction.findMany.mockResolvedValue([{ id: '1', amount: 500 }]);
      mockPrisma.mpesaTransaction.count.mockResolvedValue(1);
      const result = await service.findTransactions('c1');
      expect(result.items).toHaveLength(1);
    });
  });

  describe('mapToAccount', () => {
    it('should map transaction to account', async () => {
      mockPrisma.mpesaTransaction.findUnique.mockResolvedValue({ id: 'tx1', companyId: 'c1' });
      mockPrisma.chartOfAccount.findFirst.mockResolvedValue({ id: 'acc-1', companyId: 'c1' });
      mockPrisma.mpesaTransaction.update.mockResolvedValue({ id: 'tx1', mappedAccountId: 'acc-1' });
      const result = await service.mapToAccount('tx1', 'acc-1');
      expect(result.mappedAccountId).toBe('acc-1');
    });

    it('should throw for wrong company account', async () => {
      mockPrisma.mpesaTransaction.findUnique.mockResolvedValue({ id: 'tx1', companyId: 'c1' });
      mockPrisma.chartOfAccount.findFirst.mockResolvedValue(null);
      await expect(service.mapToAccount('tx1', 'wrong-acc')).rejects.toThrow(BadRequestException);
    });
  });
});
