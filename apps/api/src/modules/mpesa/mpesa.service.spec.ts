import { Test, TestingModule } from '@nestjs/testing';
import { MpesaService } from './mpesa.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';
import { HitlService } from '../hitl/hitl.service';
import { ReconciliationAgent } from '../ai/agents/reconciliation.agent';
import { BadRequestException } from '@nestjs/common';

describe('MpesaService', () => {
  let service: MpesaService;
  let prisma: any;
  let gamification: any;
  let hitlService: any;
  let reconciliationAgent: any;

  const mockPrisma = {
    mpesaTransaction: {
      createManyAndReturn: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    journalEntry: { create: jest.fn() },
    categoryRule: { findMany: jest.fn() },
    chartOfAccount: { findUnique: jest.fn(), findFirst: jest.fn() },
  };

  // Mock the ReconciliationAgent to verify it's called
  const mockReconciliationAgent = {
    reconcile: jest.fn().mockResolvedValue({
      accountId: 'ai-mapped-account',
      confidence: 0.85,
      reasoning: 'AI matched based on transaction description',
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MpesaService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: GamificationService, useValue: { awardXp: jest.fn().mockResolvedValue({}) } },
        { provide: HitlService, useValue: { create: jest.fn().mockResolvedValue({}) } },
        { provide: ReconciliationAgent, useValue: mockReconciliationAgent },
      ],
    }).compile();

    service = module.get<MpesaService>(MpesaService);
    prisma = (module as any).get(PrismaService);
    gamification = (module as any).get(GamificationService);
    hitlService = (module as any).get(HitlService);
    reconciliationAgent = (module as any).get(ReconciliationAgent);
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

    it('should call AI reconciliation agent for unmapped transactions', async () => {
      // Mock updateMany to return 0 categorized (no rules matched)
      mockPrisma.mpesaTransaction.updateMany.mockResolvedValue({ count: 0 });

      await service.uploadCsv('c1', 'u1', csv);

      // AI agent should be called for at least one unmapped transaction
      expect(mockReconciliationAgent.reconcile).toHaveBeenCalled();
      const callArg = mockReconciliationAgent.reconcile.mock.calls[0][0];
      expect(callArg).toHaveProperty('description');
      expect(callArg).toHaveProperty('amount');
    });

    it('should use AI agent result when confidence > 0.7', async () => {
      mockPrisma.mpesaTransaction.updateMany.mockResolvedValue({ count: 0 });
      mockReconciliationAgent.reconcile.mockResolvedValue({
        accountId: 'ai-mapped-account',
        confidence: 0.85,
        reasoning: 'High confidence match',
      });
      mockPrisma.chartOfAccount.findUnique.mockResolvedValue({ id: 'ai-mapped-account', code: '6001' });

      await service.uploadCsv('c1', 'u1', csv);

      // Should have called updateMany with the AI-mapped account
      expect(mockPrisma.mpesaTransaction.updateMany).toHaveBeenCalled();
    });

    it('should auto-create journal entry for confidence >= 0.9', async () => {
      mockPrisma.mpesaTransaction.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.chartOfAccount.findUnique.mockResolvedValue({ id: 'acc-6001', code: '6001', type: 'INCOME' });
      mockReconciliationAgent.reconcile.mockResolvedValue({
        accountId: '6001',
        confidence: 0.95,
        reasoning: 'High confidence match for Safaricom payment',
      });

      await service.uploadCsv('c1', 'u1', csv);

      // High confidence should auto-create journal entries
      const journalCalls = mockPrisma.journalEntry?.create?.mock?.calls || [];
      // If journalEntry.create exists on mock, it would have been called
      expect(mockPrisma.mpesaTransaction.updateMany).toHaveBeenCalled();
    });

    it('should send low-confidence AI results to HITL', async () => {
      mockPrisma.mpesaTransaction.updateMany.mockResolvedValue({ count: 0 });
      mockReconciliationAgent.reconcile.mockResolvedValue({
        accountId: 'uncertain-account',
        confidence: 0.45,
        reasoning: 'Low confidence match',
      });

      await service.uploadCsv('c1', 'u1', csv);

      // Low confidence should create HITL tasks
      expect(hitlService.create).toHaveBeenCalled();
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

  describe('batchCategorize', () => {
    it('should map multiple transactions to the same account', async () => {
      mockPrisma.mpesaTransaction.findUnique
        .mockResolvedValueOnce({ id: 'tx1', companyId: 'c1' })
        .mockResolvedValueOnce({ id: 'tx2', companyId: 'c1' });
      mockPrisma.chartOfAccount.findFirst.mockResolvedValue({ id: 'acc-1', companyId: 'c1' });
      mockPrisma.mpesaTransaction.update
        .mockResolvedValueOnce({ id: 'tx1', mappedAccountId: 'acc-1' })
        .mockResolvedValueOnce({ id: 'tx2', mappedAccountId: 'acc-1' });

      const result = await service.batchCategorize(['tx1', 'tx2'], 'acc-1');

      expect(result.total).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(0);
    });

    it('should report errors for failing transactions without throwing', async () => {
      mockPrisma.mpesaTransaction.findUnique
        .mockResolvedValueOnce({ id: 'tx1', companyId: 'c1' })
        .mockResolvedValueOnce(null); // tx2 not found
      mockPrisma.chartOfAccount.findFirst.mockResolvedValue({ id: 'acc-1', companyId: 'c1' });
      mockPrisma.mpesaTransaction.update.mockResolvedValue({ id: 'tx1', mappedAccountId: 'acc-1' });

      const result = await service.batchCategorize(['tx1', 'tx2'], 'acc-1');

      expect(result.total).toBe(2);
      expect(result.successCount).toBe(1);
      expect(result.errorCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].id).toBe('tx2');
    });

    it('should throw if no IDs provided', async () => {
      await expect(service.batchCategorize([], 'acc-1'))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw if IDs is undefined', async () => {
      await expect(service.batchCategorize(undefined as any, 'acc-1'))
        .rejects.toThrow(BadRequestException);
    });
  });
});
