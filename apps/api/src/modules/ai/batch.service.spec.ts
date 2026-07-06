/**
 * Nightly Fraud Detection Batch — Tests
 *
 * Edge cases considered:
 * - No recent transactions → skip
 * - Normal transactions → no flags
 * - Suspicious transactions (large amounts, round numbers, duplicates) → flagged
 * - Error from AI agent → logged, not fatal
 * - Multiple companies processed independently
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BatchService } from './batch.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FraudDetectionAgent } from './agents/fraud-detection.agent';
import { HitlService } from '../hitl/hitl.service';

describe('BatchService — Nightly Fraud Detection', () => {
  let service: BatchService;
  let prisma: any;
  let fraudAgent: any;
  let hitlService: any;

  const mockPrisma = {
    company: { findMany: jest.fn() },
    journalEntry: { findMany: jest.fn(), count: jest.fn() },
    mpesaTransaction: { findMany: jest.fn() },
  };

  const mockFraudAgent = {
    analyze: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BatchService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FraudDetectionAgent, useValue: mockFraudAgent },
        { provide: HitlService, useValue: { create: jest.fn().mockResolvedValue({}) } },
      ],
    }).compile();

    service = module.get<BatchService>(BatchService);
    prisma = module.get(PrismaService);
    fraudAgent = module.get(FraudDetectionAgent);
    hitlService = module.get(HitlService);
    jest.clearAllMocks();
  });

  describe('runNightlyFraudDetection', () => {
    it('should skip when no active companies exist', async () => {
      mockPrisma.company.findMany.mockResolvedValue([]);
      const result = await service.runNightlyFraudDetection();
      expect(result.processed).toBe(0);
      expect(fraudAgent.analyze).not.toHaveBeenCalled();
    });

    it('should analyze recent transactions for each company', async () => {
      mockPrisma.company.findMany.mockResolvedValue([{ id: 'c1' }]);
      mockPrisma.journalEntry.findMany.mockResolvedValue([
        { id: 'e1', amount: 1000000, description: 'Large payment', accountId: 'a1', companyId: 'c1' },
        { id: 'e2', amount: 500, description: 'Normal expense', accountId: 'a2', companyId: 'c1' },
      ]);
      mockFraudAgent.analyze.mockResolvedValue({
        fraudScore: 0.1,
        flags: [],
        recommendedAction: 'APPROVE',
      });

      const result = await service.runNightlyFraudDetection();
      expect(result.processed).toBe(1);
      expect(fraudAgent.analyze).toHaveBeenCalled();
    });

    it('should flag suspicious transactions to HITL', async () => {
      mockPrisma.company.findMany.mockResolvedValue([{ id: 'c1' }]);
      mockPrisma.journalEntry.findMany.mockResolvedValue([
        { id: 'e1', amount: 5000000, description: 'Round 5M transfer', accountId: 'a1', companyId: 'c1' },
      ]);
      mockFraudAgent.analyze.mockResolvedValue({
        fraudScore: 0.85,
        flags: ['Large round amount', 'Unusual pattern'],
        recommendedAction: 'FLAG',
        reasoning: 'Amount 5,000,000 is unusually large for this account',
      });

      await service.runNightlyFraudDetection();
      expect(hitlService.create).toHaveBeenCalled();
      const hitlCall = hitlService.create.mock.calls[0];
      expect(hitlCall[1].category).toBe('RECONCILIATION_CONFLICT');
    });

    it('should handle AI agent errors gracefully', async () => {
      mockPrisma.company.findMany.mockResolvedValue([{ id: 'c1' }]);
      mockPrisma.journalEntry.findMany.mockResolvedValue([
        { id: 'e1', amount: 1000, description: 'Test', accountId: 'a1', companyId: 'c1' },
      ]);
      mockFraudAgent.analyze.mockRejectedValue(new Error('API timeout'));

      // Should not throw — errors should be caught per transaction
      const result = await service.runNightlyFraudDetection();
      expect(result.errors).toBe(1);
    });

    it('should return summary with processed count and flags', async () => {
      mockPrisma.company.findMany.mockResolvedValue([{ id: 'c1' }]);
      mockPrisma.journalEntry.findMany.mockResolvedValue([]);
      const result = await service.runNightlyFraudDetection();
      expect(result).toHaveProperty('processed');
      expect(result).toHaveProperty('flagged');
      expect(result).toHaveProperty('errors');
    });
  });
});
