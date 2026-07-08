import { Test, TestingModule } from '@nestjs/testing';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

describe('AuditController', () => {
  let controller: AuditController;
  let service: any;

  const mockAuditService = {
    createLock: jest.fn(),
    findLocks: jest.fn(),
    findLock: jest.fn(),
    amendLock: jest.fn(),
    checkLock: jest.fn(),
    grantExternalAccess: jest.fn(),
    findExternalAccessGrants: jest.fn(),
    revokeExternalAccess: jest.fn(),
    findAccessLogs: jest.fn(),
  };

  const mockRequest = () => ({
    user: { userId: 'user_1', companyId: 'comp_123', role: 'TENANT_ADMIN' },
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    controller = module.get<AuditController>(AuditController);
    service = module.get(AuditService);
    jest.clearAllMocks();
  });

  // ─── Lock-Down Periods ──────────────────────────────────────────────────

  describe('POST /audit/locks', () => {
    it('should create a lock', async () => {
      const dto = {
        companyId: 'comp_123',
        fiscalYear: 2026,
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31',
        lockType: 'FULL',
        modules: ['LEDGER'],
      };
      mockAuditService.createLock.mockResolvedValue({ id: 'lock_1', ...dto });

      const result = await controller.createLock(mockRequest(), dto as any);

      expect(result.id).toBe('lock_1');
      expect(mockAuditService.createLock).toHaveBeenCalledWith('user_1', dto);
    });
  });

  describe('GET /audit/locks', () => {
    it('should list locks with companyId from query', async () => {
      mockAuditService.findLocks.mockResolvedValue([]);

      await controller.findLocks(mockRequest(), 'comp_123', 'LOCKED');

      expect(mockAuditService.findLocks).toHaveBeenCalledWith('comp_123', 'LOCKED');
    });

    it('should use companyId from JWT when query param is absent', async () => {
      mockAuditService.findLocks.mockResolvedValue([]);

      await controller.findLocks(mockRequest(), undefined, undefined);

      expect(mockAuditService.findLocks).toHaveBeenCalledWith('comp_123', undefined);
    });
  });

  describe('GET /audit/locks/:id', () => {
    it('should return a lock by id', async () => {
      mockAuditService.findLock.mockResolvedValue({ id: 'lock_1' });

      const result = await controller.findLock('lock_1');

      expect(result.id).toBe('lock_1');
      expect(mockAuditService.findLock).toHaveBeenCalledWith('lock_1');
    });
  });

  describe('POST /audit/locks/:id/amend', () => {
    it('should amend a lock', async () => {
      const dto = {
        reason: 'Late invoice',
        amendments: [{ module: 'LEDGER', action: 'unlock' }],
      };
      mockAuditService.amendLock.mockResolvedValue({ id: 'lock_1', status: 'AMENDED' });

      const result = await controller.amendLock(mockRequest(), 'lock_1', dto as any);

      expect(result.status).toBe('AMENDED');
      expect(mockAuditService.amendLock).toHaveBeenCalledWith('lock_1', 'user_1', dto);
    });
  });

  describe('GET /audit/locks/check', () => {
    it('should check if a date is locked', async () => {
      mockAuditService.checkLock.mockResolvedValue({ locked: true, locks: [] });

      const result = await controller.checkLock('comp_123', '2026-02-15');

      expect(result.locked).toBe(true);
      expect(mockAuditService.checkLock).toHaveBeenCalledWith('comp_123', '2026-02-15');
    });
  });

  // ─── External Access ────────────────────────────────────────────────────

  describe('POST /audit/external-access', () => {
    it('should grant external access', async () => {
      const dto = {
        companyId: 'comp_123',
        recipientName: 'KRA Auditor',
        recipientEmail: 'auditor@kra.go.ke',
        accessLevel: 'READ_ONLY',
        expiresInDays: 30,
        purpose: 'KRA_AUDIT',
      };
      mockAuditService.grantExternalAccess.mockResolvedValue({
        id: 'ext_1',
        accessUrl: 'https://app.jengabooks.com/external-access?token=abc',
        token: 'abc',
      });

      const result = await controller.grantExternalAccess(mockRequest(), dto as any);

      expect(result.token).toBe('abc');
      expect(mockAuditService.grantExternalAccess).toHaveBeenCalledWith('user_1', dto);
    });
  });

  describe('GET /audit/external-access', () => {
    it('should list grants', async () => {
      mockAuditService.findExternalAccessGrants.mockResolvedValue([]);

      await controller.findExternalAccess(mockRequest(), 'comp_123');

      expect(mockAuditService.findExternalAccessGrants).toHaveBeenCalledWith('comp_123');
    });
  });

  describe('POST /audit/external-access/:id/revoke', () => {
    it('should revoke a grant', async () => {
      mockAuditService.revokeExternalAccess.mockResolvedValue({ id: 'ext_1', isRevoked: true });

      const result = await controller.revokeExternalAccess('ext_1');

      expect(result.isRevoked).toBe(true);
      expect(mockAuditService.revokeExternalAccess).toHaveBeenCalledWith('ext_1');
    });
  });

  describe('GET /audit/external-access/:id/logs', () => {
    it('should return access logs', async () => {
      mockAuditService.findAccessLogs.mockResolvedValue([{ id: 'log_1' }]);

      const result = await controller.findAccessLogs('ext_1');

      expect(result).toHaveLength(1);
      expect(mockAuditService.findAccessLogs).toHaveBeenCalledWith('ext_1');
    });
  });
});
