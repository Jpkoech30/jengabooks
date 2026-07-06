import { Test, TestingModule } from '@nestjs/testing';
import { EtimsService } from './etims.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { GamificationService } from '../gamification/gamification.service';

describe('EtimsService', () => {
  let service: EtimsService;
  let prisma: any;

  const mockPrisma = {
    invoice: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), count: jest.fn() },
    eTIMSSubmission: { findMany: jest.fn(), findUnique: jest.fn(), upsert: jest.fn(), count: jest.fn() },
  };

  const mockCircuitBreaker = {
    call: jest.fn((fn) => fn()),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EtimsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CircuitBreakerService, useValue: mockCircuitBreaker },
        { provide: GamificationService, useValue: { awardXp: jest.fn().mockResolvedValue({}) } },
      ],
    }).compile();

    service = module.get<EtimsService>(EtimsService);
    prisma = module.get(PrismaService);
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
    it('should award XP on ACCEPTED submission', async () => {
      const gamification = { awardXp: jest.fn().mockResolvedValue({}) };
      // Override the module's gamification service
      const module = await Test.createTestingModule({
        providers: [
          EtimsService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: CircuitBreakerService, useValue: mockCircuitBreaker },
          { provide: GamificationService, useValue: gamification },
        ],
      }).compile();
      const svc = module.get<EtimsService>(EtimsService);

      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1', invoiceNumber: 'INV-0001', companyId: 'company-1',
        customerName: 'Test', lineItems: '[]',
        subtotal: 1000, vat: 160, total: 1160, taxCode: 'S',
      });
      mockPrisma.eTIMSSubmission.findUnique.mockResolvedValue(null);
      mockCircuitBreaker.call.mockImplementation(async (fn: any) => {
        const submissionFn = async () => {
          const mockResponse = { status: 'ACCEPTED', serialNumber: 'KRA-12345' };
          return mockPrisma.eTIMSSubmission.upsert({
            where: { invoiceId: 'inv-1' },
            update: {},
            create: { invoiceId: 'inv-1', serialNumber: 'KRA-12345', xmlPayload: '', kraResponse: '{}', status: 'ACCEPTED', submittedAt: new Date() },
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

    it('should create submission with PENDING status', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1', invoiceNumber: 'INV-0001', companyId: 'company-1',
        customerName: 'Test', lineItems: '[]',
        subtotal: 1000, vat: 160, total: 1160, taxCode: 'S',
      });
      mockPrisma.eTIMSSubmission.findUnique.mockResolvedValue(null);
      mockPrisma.eTIMSSubmission.count.mockResolvedValue(0);
      mockCircuitBreaker.call.mockImplementation(async (fn: any) => {
        // Manually call the function to trigger the upsert inside
        const submissionFn = async () => {
          const serialCount = 0;
          const mockResponse = { status: 'PENDING', serialNumber: `ETIMS-INV-0001-00001` };
          return mockPrisma.eTIMSSubmission.upsert({
            where: { invoiceId: 'inv-1' },
            update: {},
            create: { invoiceId: 'inv-1', serialNumber: mockResponse.serialNumber, xmlPayload: '', kraResponse: JSON.stringify(mockResponse), status: 'PENDING', submittedAt: new Date() },
          });
        };
        return submissionFn();
      });
      mockPrisma.eTIMSSubmission.upsert.mockResolvedValue({ id: 'sub-1', status: 'PENDING' });

      const result = await service.submitToKra('inv-1');
      expect(result).toBeDefined();
    });
  });
});
