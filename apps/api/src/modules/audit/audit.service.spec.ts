import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';

describe('AuditService', () => {
  let service: AuditService;
  let prisma: any;

  const mockPrisma = {
    $queryRaw: jest.fn().mockResolvedValue([{ now: new Date('2026-07-08T12:00:00Z') }]),
    auditLock: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    externalAccess: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    externalAccessLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── Lock-Down Periods ──────────────────────────────────────────────────

  describe('createLock', () => {
    const dto = {
      companyId: 'comp_123',
      fiscalYear: 2026,
      periodStart: '2026-01-01',
      periodEnd: '2026-03-31',
      lockType: 'FULL' as const,
      modules: ['LEDGER', 'MPESA', 'ETIMS', 'PAYROLL'],
    };

    it('should create a lock when no overlapping LOCKED period exists', async () => {
      mockPrisma.auditLock.findFirst.mockResolvedValue(null);
      mockPrisma.auditLock.create.mockResolvedValue({
        id: 'lock_1',
        ...dto,
        status: 'LOCKED',
        lockedById: 'user_1',
        lockedAt: new Date(),
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        modules: dto.modules,
        lockedBy: { id: 'user_1', name: 'Test User', email: 'test@test.com' },
      });

      const result = await service.createLock('user_1', dto);

      expect(result.status).toBe('LOCKED');
      expect(mockPrisma.auditLock.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'comp_123',
            fiscalYear: 2026,
            status: 'LOCKED',
          }),
        }),
      );
      expect(mockPrisma.auditLock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 'comp_123',
            fiscalYear: 2026,
            lockedById: 'user_1',
          }),
        }),
      );
    });

    it('should reject periodStart >= periodEnd', async () => {
      await expect(
        service.createLock('user_1', {
          ...dto,
          periodStart: '2026-03-31',
          periodEnd: '2026-01-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject overlapping LOCKED periods', async () => {
      mockPrisma.auditLock.findFirst.mockResolvedValue({
        id: 'existing_lock',
        companyId: 'comp_123',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-03-31'),
        status: 'LOCKED',
      });

      await expect(service.createLock('user_1', dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findLocks', () => {
    it('should return all locks for a company', async () => {
      const locks = [
        { id: 'lock_1', fiscalYear: 2026, status: 'LOCKED' },
        { id: 'lock_2', fiscalYear: 2025, status: 'OPEN' },
      ];
      mockPrisma.auditLock.findMany.mockResolvedValue(locks);

      const result = await service.findLocks('comp_123');

      expect(result).toHaveLength(2);
      expect(mockPrisma.auditLock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'comp_123' },
        }),
      );
    });

    it('should filter by status when provided', async () => {
      mockPrisma.auditLock.findMany.mockResolvedValue([]);

      await service.findLocks('comp_123', 'LOCKED');

      expect(mockPrisma.auditLock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'comp_123', status: 'LOCKED' },
        }),
      );
    });
  });

  describe('findLock', () => {
    it('should return a lock by id', async () => {
      const lock = { id: 'lock_1', status: 'LOCKED' };
      mockPrisma.auditLock.findUnique.mockResolvedValue(lock);

      const result = await service.findLock('lock_1');

      expect(result.id).toBe('lock_1');
    });

    it('should throw NotFoundException when lock not found', async () => {
      mockPrisma.auditLock.findUnique.mockResolvedValue(null);

      await expect(service.findLock('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('amendLock', () => {
    const existingLock = {
      id: 'lock_1',
      companyId: 'comp_123',
      fiscalYear: 2026,
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-03-31'),
      lockType: 'FULL',
      status: 'LOCKED',
      lockedById: 'user_1',
      lockedAt: new Date(),
      modules: ['LEDGER', 'MPESA', 'ETIMS', 'PAYROLL'],
    };

    const amendDto = {
      reason: 'Late invoice #1042 needs to be recorded in Q1 2026',
      amendments: [{ module: 'LEDGER' as const, action: 'unlock' as const }],
    };

    it('should amend a locked period and create replacement', async () => {
      mockPrisma.auditLock.findUnique.mockResolvedValue(existingLock);
      mockPrisma.auditLock.update.mockResolvedValue({ ...existingLock, status: 'AMENDED' });
      mockPrisma.auditLock.create.mockResolvedValue({
        ...existingLock,
        id: 'lock_2',
        modules: ['MPESA', 'ETIMS', 'PAYROLL'],
      });

      const result = await service.amendLock('lock_1', 'user_2', amendDto);

      expect(mockPrisma.auditLock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lock_1' },
          data: expect.objectContaining({
            status: 'AMENDED',
            unlockReason: amendDto.reason,
            unlockRequestedById: 'user_2',
          }),
        }),
      );
      // Should create new lock with remaining modules (LEDGER removed)
      expect(mockPrisma.auditLock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            modules: expect.not.arrayContaining(['LEDGER']),
          }),
        }),
      );
      // Verify LEDGER was removed
      const createCall = mockPrisma.auditLock.create.mock.calls[0][0];
      expect(createCall.data.modules).toEqual(['MPESA', 'ETIMS', 'PAYROLL']);
    });

    it('should return message when all modules are unlocked', async () => {
      mockPrisma.auditLock.findUnique.mockResolvedValue(existingLock);
      mockPrisma.auditLock.update.mockResolvedValue({ ...existingLock, status: 'AMENDED' });

      const result = await service.amendLock('lock_1', 'user_2', {
        reason: 'All clear',
        amendments: [
          { module: 'LEDGER', action: 'unlock' },
          { module: 'MPESA', action: 'unlock' },
          { module: 'ETIMS', action: 'unlock' },
          { module: 'PAYROLL', action: 'unlock' },
        ],
      });

      expect((result as any).message).toContain('All modules have been unlocked');
      expect(mockPrisma.auditLock.create).not.toHaveBeenCalled();
    });

    it('should reject lock not in LOCKED status', async () => {
      mockPrisma.auditLock.findUnique.mockResolvedValue({
        ...existingLock,
        status: 'OPEN',
      });

      await expect(service.amendLock('lock_1', 'user_2', amendDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject amendment without a reason', async () => {
      mockPrisma.auditLock.findUnique.mockResolvedValue(existingLock);

      await expect(
        service.amendLock('lock_1', 'user_2', { reason: '', amendments: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when lock does not exist', async () => {
      mockPrisma.auditLock.findUnique.mockResolvedValue(null);

      await expect(service.amendLock('nonexistent', 'user_2', amendDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('checkLock', () => {
    it('should return locked=true when date falls in a LOCKED period', async () => {
      mockPrisma.auditLock.findMany.mockResolvedValue([
        {
          id: 'lock_1',
          periodStart: new Date('2026-01-01'),
          periodEnd: new Date('2026-03-31'),
          status: 'LOCKED',
        },
      ]);

      const result = await service.checkLock('comp_123', '2026-02-15');

      expect(result.locked).toBe(true);
      expect(result.locks).toHaveLength(1);
    });

    it('should return locked=false when date is not in any LOCKED period', async () => {
      mockPrisma.auditLock.findMany.mockResolvedValue([]);

      const result = await service.checkLock('comp_123', '2026-05-15');

      expect(result.locked).toBe(false);
      expect(result.locks).toHaveLength(0);
    });
  });

  // ─── External Access ────────────────────────────────────────────────────

  describe('grantExternalAccess', () => {
    const dto = {
      companyId: 'comp_123',
      recipientName: 'KRA Auditor - John Kamau',
      recipientEmail: 'jkamau@kra.go.ke',
      accessLevel: 'READ_ONLY' as const,
      expiresInDays: 30,
      purpose: 'KRA_AUDIT' as const,
    };

    it('should create an external access grant with a generated token', async () => {
      const expiresAt = new Date();
      mockPrisma.externalAccess.create.mockResolvedValue({
        id: 'ext_123',
        companyId: 'comp_123',
        grantorId: 'user_1',
        recipientName: dto.recipientName,
        recipientEmail: dto.recipientEmail,
        accessLevel: dto.accessLevel,
        accessToken: expect.any(String),
        expiresAt,
        purpose: dto.purpose,
      });

      const result = await service.grantExternalAccess('user_1', dto);

      expect(result.id).toBe('ext_123');
      expect(result.token).toBeDefined();
      expect(result.accessUrl).toContain('token=');
      expect(result.token.length).toBe(64); // 32 bytes = 64 hex chars
      expect(mockPrisma.externalAccess.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 'comp_123',
            grantorId: 'user_1',
            recipientName: dto.recipientName,
          }),
        }),
      );
    });
  });

  describe('findExternalAccessGrants', () => {
    it('should return all grants for a company', async () => {
      mockPrisma.externalAccess.findMany.mockResolvedValue([
        { id: 'ext_1', recipientName: 'KRA Auditor' },
      ]);

      const result = await service.findExternalAccessGrants('comp_123');

      expect(result).toHaveLength(1);
      expect(mockPrisma.externalAccess.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'comp_123' },
        }),
      );
    });
  });

  describe('revokeExternalAccess', () => {
    it('should revoke an active grant', async () => {
      mockPrisma.externalAccess.findUnique.mockResolvedValue({
        id: 'ext_1',
        isRevoked: false,
      });
      mockPrisma.externalAccess.update.mockResolvedValue({
        id: 'ext_1',
        isRevoked: true,
      });

      const result = await service.revokeExternalAccess('ext_1');

      expect(result.isRevoked).toBe(true);
      expect(mockPrisma.externalAccess.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ext_1' },
          data: { isRevoked: true },
        }),
      );
    });

    it('should throw NotFoundException for non-existent grant', async () => {
      mockPrisma.externalAccess.findUnique.mockResolvedValue(null);

      await expect(service.revokeExternalAccess('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if already revoked', async () => {
      mockPrisma.externalAccess.findUnique.mockResolvedValue({
        id: 'ext_1',
        isRevoked: true,
      });

      await expect(service.revokeExternalAccess('ext_1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAccessLogs', () => {
    it('should return logs for an access grant', async () => {
      mockPrisma.externalAccess.findUnique.mockResolvedValue({ id: 'ext_1' });
      mockPrisma.externalAccessLog.findMany.mockResolvedValue([
        { id: 'log_1', action: 'AUTHENTICATE' },
      ]);

      const result = await service.findAccessLogs('ext_1');

      expect(result).toHaveLength(1);
    });

    it('should throw NotFoundException if access grant does not exist', async () => {
      mockPrisma.externalAccess.findUnique.mockResolvedValue(null);

      await expect(service.findAccessLogs('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('authenticateExternalToken', () => {
    it('should authenticate a valid, non-revoked, non-expired token', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      mockPrisma.externalAccess.findUnique.mockResolvedValue({
        id: 'ext_1',
        companyId: 'comp_123',
        accessLevel: 'READ_ONLY',
        recipientName: 'KRA Auditor',
        purpose: 'KRA_AUDIT',
        accessToken: 'valid_token',
        isRevoked: false,
        expiresAt: futureDate,
      });
      mockPrisma.externalAccess.update.mockResolvedValue({});
      mockPrisma.externalAccessLog.create.mockResolvedValue({});

      const result = await service.authenticateExternalToken('valid_token');

      expect(result.companyId).toBe('comp_123');
      expect(result.accessLevel).toBe('READ_ONLY');
      expect(result.expiresIn).toBe(3600);
    });

    it('should throw NotFoundException for invalid token', async () => {
      mockPrisma.externalAccess.findUnique.mockResolvedValue(null);

      await expect(
        service.authenticateExternalToken('invalid_token'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for revoked token', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      mockPrisma.externalAccess.findUnique.mockResolvedValue({
        id: 'ext_1',
        isRevoked: true,
        expiresAt: futureDate,
      });

      await expect(
        service.authenticateExternalToken('revoked_token'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for expired token', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      mockPrisma.externalAccess.findUnique.mockResolvedValue({
        id: 'ext_1',
        isRevoked: false,
        expiresAt: pastDate,
      });

      await expect(
        service.authenticateExternalToken('expired_token'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
