import { Test, TestingModule } from '@nestjs/testing';
import { EtimsService } from './etims.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { GamificationService } from '../gamification/gamification.service';
import { EtimsRetryWorker } from '../../queues/etims.queue';

describe('EtimsService', () => {
  let service: EtimsService;
  let prisma: any;
  let retryWorker: any;

  const mockPrisma = {
    invoice: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), count: jest.fn() },
    eTIMSSubmission: { findMany: jest.fn(), findUnique: jest.fn(), upsert: jest.fn(), count: jest.fn(), update: jest.fn() },
    xPRecord: { create: jest.fn() },
  };

  const mockCircuitBreaker = {
    call: jest.fn((fn) => fn()),
  };

  const mockRetryWorker = {
    scheduleRetry: jest.fn().mockResolvedValue(undefined),
    schedulePoll: jest.fn().mockResolvedValue(undefined),
    clearPendingJobs: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EtimsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CircuitBreakerService, useValue: mockCircuitBreaker },
        { provide: GamificationService, useValue: { awardXp: jest.fn().mockResolvedValue({}) } },
        { provide: EtimsRetryWorker, useValue: mockRetryWorker },
      ],
    }).compile();

    service = module.get<EtimsService>(EtimsService);
    prisma = module.get(PrismaService);
    retryWorker = module.get(EtimsRetryWorker);
    jest.clearAllMocks();
  });

  // ─── Invoice Creation ──────────────────────────────────────────────

  describe('createInvoice', () => {
    it('should create invoice with sequential number', async () => {
      mockPrisma.invoice.count.mockResolvedValue(0);
      mockPrisma.invoice.create.mockImplementation(({ data }: any) => Promise.resolve(data));

      const result = await service.createInvoice('company-1', {
        customerName: 'John Kamau',
        lineItems: [{ description: 'Consulting', quantity: 1, unitPrice: 100000 }],
      });

      expect(result.invoiceNumber).toMatch(/^INV-/);
      expect(result.subtotal).toBe(100000);
      expect(result.vat).toBe(16000); // 16%
      expect(result.total).toBe(116000);
    });

    it('should apply 0% VAT for exempt tax code', async () => {
      mockPrisma.invoice.count.mockResolvedValue(0);
      mockPrisma.invoice.create.mockImplementation(({ data }: any) => Promise.resolve(data));

      const result = await service.createInvoice('company-1', {
        customerName: 'Test',
        lineItems: [{ description: 'Item', quantity: 1, unitPrice: 1000 }],
        taxCode: 'E',
      });

      expect(result.vat).toBe(0);
      expect(result.total).toBe(1000);
    });
  });

  // ─── eTIMS Submission ──────────────────────────────────────────────

  describe('submitToKra', () => {
    const baseInvoice = {
      id: 'inv-1', invoiceNumber: 'INV-0001', companyId: 'company-1',
      customerName: 'Test', lineItems: '[]',
      subtotal: 1000, vat: 160, total: 1160, taxCode: 'S',
    };

    beforeEach(() => {
      mockPrisma.invoice.findUnique.mockResolvedValue(baseInvoice);
    });

    it('should award XP on ACCEPTED submission', async () => {
      const gamification = { awardXp: jest.fn().mockResolvedValue({}) };
      const module = await Test.createTestingModule({
        providers: [
          EtimsService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: CircuitBreakerService, useValue: mockCircuitBreaker },
          { provide: GamificationService, useValue: gamification },
          { provide: EtimsRetryWorker, useValue: mockRetryWorker },
        ],
      }).compile();
      const svc = module.get<EtimsService>(EtimsService);

      mockPrisma.eTIMSSubmission.findUnique.mockResolvedValue(null);
      mockCircuitBreaker.call.mockImplementation(async (fn: any) => {
        const submissionFn = async () => {
          const mockResponse = { status: 'ACCEPTED', serialNumber: 'KRA-12345' };
          return mockPrisma.eTIMSSubmission.upsert({
            where: { invoiceId: 'inv-1' },
            update: {},
            create: { invoiceId: 'inv-1', serialNumber: 'KRA-12345', xmlPayload: '', kraResponse: '{}', status: 'ACCEPTED' },
          });
        };
        return submissionFn();
      });
      mockPrisma.eTIMSSubmission.upsert.mockResolvedValue({ id: 'sub-1', status: 'ACCEPTED' });

      await svc.submitToKra('inv-1', 'user-1', 'company-1');
      expect(gamification.awardXp).toHaveBeenCalledWith(
        'user-1', 'company-1', 30, 'Submitted an eTIMS invoice',
      );
    });

    it('should clear pending jobs when ACCEPTED', async () => {
      mockPrisma.eTIMSSubmission.findUnique.mockResolvedValue(null);
      mockCircuitBreaker.call.mockImplementation(async (fn: any) => {
        const mockResponse = { status: 'ACCEPTED', serialNumber: 'KRA-12345' };
        return mockPrisma.eTIMSSubmission.upsert({
          where: { invoiceId: 'inv-1' },
          update: {},
          create: { invoiceId: 'inv-1', serialNumber: 'KRA-12345', xmlPayload: '', kraResponse: '{}', status: 'ACCEPTED' },
        });
      });
      mockPrisma.eTIMSSubmission.upsert.mockResolvedValue({ id: 'sub-1', status: 'ACCEPTED' });

      await service.submitToKra('inv-1', 'user-1', 'company-1');

      expect(retryWorker.clearPendingJobs).toHaveBeenCalledWith('inv-1');
      expect(retryWorker.scheduleRetry).not.toHaveBeenCalled();
    });

    it('should schedule retry when submission FAILED', async () => {
      mockPrisma.eTIMSSubmission.findUnique.mockResolvedValue(null);
      mockCircuitBreaker.call.mockImplementation(async (fn: any) => {
        const mockResponse = { status: 'FAILED', error: 'KRA timeout', serialNumber: 'FAILED-inv-1' };
        return mockPrisma.eTIMSSubmission.upsert({
          where: { invoiceId: 'inv-1' },
          update: {},
          create: { invoiceId: 'inv-1', serialNumber: 'FAILED-inv-1', xmlPayload: '', kraResponse: JSON.stringify(mockResponse), status: 'FAILED' },
        });
      });
      mockPrisma.eTIMSSubmission.upsert.mockResolvedValue({ id: 'sub-1', status: 'FAILED' });

      await service.submitToKra('inv-1');

      expect(retryWorker.scheduleRetry).toHaveBeenCalledWith('inv-1', undefined, undefined, 0);
      expect(retryWorker.schedulePoll).not.toHaveBeenCalled();
    });

    it('should schedule poll when KRA returns PENDING', async () => {
      mockPrisma.eTIMSSubmission.findUnique.mockResolvedValue(null);
      mockPrisma.eTIMSSubmission.count.mockResolvedValue(0);
      mockCircuitBreaker.call.mockImplementation(async (fn: any) => {
        const mockResponse = { status: 'PENDING', serialNumber: 'ETIMS-INV-0001-00001' };
        return mockPrisma.eTIMSSubmission.upsert({
          where: { invoiceId: 'inv-1' },
          update: {},
          create: { invoiceId: 'inv-1', serialNumber: mockResponse.serialNumber, xmlPayload: '', kraResponse: JSON.stringify(mockResponse), status: 'PENDING' },
        });
      });
      mockPrisma.eTIMSSubmission.upsert.mockResolvedValue({ id: 'sub-1', status: 'PENDING' });

      const result = await service.submitToKra('inv-1');
      expect(result).toBeDefined();
      expect(retryWorker.schedulePoll).toHaveBeenCalledWith('inv-1', undefined, undefined, 0);
      expect(retryWorker.scheduleRetry).not.toHaveBeenCalled();
    });

    it('should throw when submission is ACCEPTED already', async () => {
      mockPrisma.eTIMSSubmission.findUnique.mockResolvedValue({
        id: 'sub-1', invoiceId: 'inv-1', status: 'ACCEPTED',
      });

      await expect(service.submitToKra('inv-1'))
        .rejects.toThrow('Invoice already submitted and accepted by KRA');
    });

    it('should throw when submission is FAILED_PERMANENT', async () => {
      mockPrisma.eTIMSSubmission.findUnique.mockResolvedValue({
        id: 'sub-1', invoiceId: 'inv-1', status: 'FAILED_PERMANENT',
      });

      await expect(service.submitToKra('inv-1'))
        .rejects.toThrow('Invoice submission permanently failed');
    });

    it('should create submission with PENDING status in dev mock mode', async () => {
      mockPrisma.eTIMSSubmission.findUnique.mockResolvedValue(null);
      mockPrisma.eTIMSSubmission.count.mockResolvedValue(0);
      mockCircuitBreaker.call.mockImplementation(async (fn: any) => {
        const submissionFn = async () => {
          const serialCount = 0;
          const mockResponse = { status: 'PENDING', serialNumber: `ETIMS-INV-0001-00001` };
          return mockPrisma.eTIMSSubmission.upsert({
            where: { invoiceId: 'inv-1' },
            update: {},
            create: { invoiceId: 'inv-1', serialNumber: mockResponse.serialNumber, xmlPayload: '', kraResponse: JSON.stringify(mockResponse), status: 'PENDING' },
          });
        };
        return submissionFn();
      });
      mockPrisma.eTIMSSubmission.upsert.mockResolvedValue({ id: 'sub-1', status: 'PENDING' });

      const result = await service.submitToKra('inv-1');
      expect(result).toBeDefined();
    });
  });

  // ─── Manual Retry ──────────────────────────────────────────────────

  describe('retrySubmission', () => {
    it('should allow retry for FAILED submission', async () => {
      mockPrisma.eTIMSSubmission.findUnique.mockResolvedValue({
        id: 'sub-1', invoiceId: 'inv-1', status: 'FAILED', retryCount: 1,
        invoice: { id: 'inv-1' },
      });
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1', invoiceNumber: 'INV-0001', companyId: 'company-1',
        customerName: 'Test', lineItems: '[]',
        subtotal: 1000, vat: 160, total: 1160, taxCode: 'S',
      });
      mockPrisma.eTIMSSubmission.findUnique
        .mockResolvedValueOnce({ id: 'sub-1', invoiceId: 'inv-1', status: 'FAILED', retryCount: 1, invoice: { id: 'inv-1' } })
        .mockResolvedValueOnce({ id: 'sub-1', invoiceId: 'inv-1', status: 'FAILED', retryCount: 1 });
      mockCircuitBreaker.call.mockImplementation(async (fn: any) => fn());
      mockPrisma.eTIMSSubmission.upsert.mockResolvedValue({ id: 'sub-1', status: 'PENDING' });

      const result = await service.retrySubmission('sub-1');
      expect(result).toBeDefined();
    });

    it('should throw when retrying ACCEPTED submission', async () => {
      mockPrisma.eTIMSSubmission.findUnique.mockResolvedValue({
        id: 'sub-1', invoiceId: 'inv-1', status: 'ACCEPTED',
        invoice: { id: 'inv-1' },
      });

      await expect(service.retrySubmission('sub-1'))
        .rejects.toThrow('Submission already accepted');
    });

    it('should throw when retrying FAILED_PERMANENT submission', async () => {
      mockPrisma.eTIMSSubmission.findUnique.mockResolvedValue({
        id: 'sub-1', invoiceId: 'inv-1', status: 'FAILED_PERMANENT',
        invoice: { id: 'inv-1' },
      });

      await expect(service.retrySubmission('sub-1'))
        .rejects.toThrow('Submission permanently failed');
    });
  });

  // ─── Retry Worker Unit Tests ───────────────────────────────────────

  describe('EtimsRetryWorker helpers', () => {
    it('should return correct delays for each attempt', async () => {
      const { getRetryDelay, RETRY_DELAYS } = await import('../../queues/etims.queue');
      expect(getRetryDelay(0)).toBe(RETRY_DELAYS[0]);  // 30s
      expect(getRetryDelay(1)).toBe(RETRY_DELAYS[1]);  // 2min
      expect(getRetryDelay(2)).toBe(RETRY_DELAYS[2]);  // 10min
      expect(getRetryDelay(3)).toBe(RETRY_DELAYS[3]);  // 1hr
      expect(getRetryDelay(4)).toBe(RETRY_DELAYS[4]);  // 6hr
    });

    it('should cap delay at max for attempts beyond schedule', async () => {
      const { getRetryDelay, RETRY_DELAYS } = await import('../../queues/etims.queue');
      expect(getRetryDelay(5)).toBe(RETRY_DELAYS[4]); // capped at 6hr
      expect(getRetryDelay(99)).toBe(RETRY_DELAYS[4]); // capped at 6hr
    });

    it('should use first delay for negative attempts', async () => {
      const { getRetryDelay, RETRY_DELAYS } = await import('../../queues/etims.queue');
      expect(getRetryDelay(-1)).toBe(RETRY_DELAYS[0]); // 30s
    });

    it('should generate consistent job IDs', async () => {
      const { retryJobId, pollJobId } = await import('../../queues/etims.queue');
      expect(retryJobId('inv-1')).toBe('retry:inv-1');
      expect(pollJobId('inv-1')).toBe('poll:inv-1');
    });
  });
});
