import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';
import { CreateLockDto } from './dto/create-lock.dto';
import { AmendLockDto } from './dto/amend-lock.dto';
import { GrantExternalAccessDto } from './dto/grant-external-access.dto';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Lock-Down Periods ──────────────────────────────────────────────────

  /**
   * Create a new lock-down period with overlap detection.
   * Prevents creating a LOCKED status period that overlaps an existing LOCKED period.
   */
  async createLock(lockedById: string, dto: CreateLockDto) {
    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);

    if (periodStart >= periodEnd) {
      throw new BadRequestException('periodStart must be before periodEnd');
    }

    // Check for overlapping LOCKED periods (same company, same fiscal year)
    const overlapping = await this.prisma.auditLock.findFirst({
      where: {
        companyId: dto.companyId,
        fiscalYear: dto.fiscalYear,
        status: 'LOCKED',
        periodStart: { lt: periodEnd },
        periodEnd: { gt: periodStart },
      },
    });

    if (overlapping) {
      throw new ConflictException(
        `Lock period overlaps with existing LOCKED period: ${overlapping.periodStart.toISOString()} - ${overlapping.periodEnd.toISOString()}`,
      );
    }

    const dbNow = await this.getDbNow();
    return this.prisma.auditLock.create({
      data: {
        companyId: dto.companyId,
        fiscalYear: dto.fiscalYear,
        periodStart,
        periodEnd,
        lockType: dto.lockType,
        status: 'LOCKED',
        lockedById,
        lockedAt: dbNow, // DB timestamp for audit trail
        modules: dto.modules ?? [],
      },
      include: {
        lockedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  /**
   * List lock-down periods for a company with optional status filter.
   */
  async findLocks(companyId: string, status?: string) {
    const where: any = { companyId };
    if (status) {
      where.status = status;
    }

    return this.prisma.auditLock.findMany({
      where,
      orderBy: [{ fiscalYear: 'desc' }, { periodStart: 'desc' }],
      include: {
        lockedBy: { select: { id: true, name: true, email: true } },
        unlockRequestedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  /**
   * Get a single lock-down period by ID.
   */
  async findLock(id: string) {
    const lock = await this.prisma.auditLock.findUnique({
      where: { id },
      include: {
        lockedBy: { select: { id: true, name: true, email: true } },
        unlockRequestedBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!lock) {
      throw new NotFoundException(`Lock with id ${id} not found`);
    }

    return lock;
  }

  /**
   * Amend a locked period. Requires a reason and preserves amendment history.
   * The status transitions: LOCKED → AMENDED (new record is created).
   */
  async amendLock(id: string, requestedById: string, dto: AmendLockDto) {
    const lock = await this.prisma.auditLock.findUnique({ where: { id } });
    if (!lock) {
      throw new NotFoundException(`Lock with id ${id} not found`);
    }
    if (lock.status !== 'LOCKED') {
      throw new BadRequestException(`Cannot amend lock with status ${lock.status}`);
    }
    if (!dto.reason || dto.reason.trim().length === 0) {
      throw new BadRequestException('A reason is required to amend a locked period');
    }

    // Mark existing lock as AMENDED with audit trail
    await this.prisma.auditLock.update({
      where: { id },
      data: {
        status: 'AMENDED',
        unlockReason: dto.reason,
        unlockRequestedById: requestedById,
      },
    });

    // Compute new modules array based on amendments
    const currentModules: string[] = (lock.modules as string[]) ?? [];
    for (const amend of dto.amendments) {
      if (amend.action === 'unlock') {
        const idx = currentModules.indexOf(amend.module);
        if (idx !== -1) currentModules.splice(idx, 1);
      } else if (amend.action === 'lock') {
        if (!currentModules.includes(amend.module)) {
          currentModules.push(amend.module);
        }
      }
    }

    // If all modules are unlocked, don't create a replacement; return the amended one
    if (currentModules.length === 0) {
      return {
        ...lock,
        status: 'AMENDED',
        unlockReason: dto.reason,
        modules: [],
        message: 'All modules have been unlocked. No active lock remains.',
      };
    }

    // Create replacement lock record with remaining modules (preserving dates)
    return this.prisma.auditLock.create({
      data: {
        companyId: lock.companyId,
        fiscalYear: lock.fiscalYear,
        periodStart: lock.periodStart,
        periodEnd: lock.periodEnd,
        lockType: lock.lockType,
        status: 'LOCKED',
        lockedById: lock.lockedById,
        lockedAt: lock.lockedAt,
        modules: currentModules,
      },
      include: {
        lockedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  /**
   * Check if a specific date falls within any LOCKED period for the company.
   */
  async checkLock(companyId: string, date: string) {
    const checkDate = new Date(date);

    const activeLocks = await this.prisma.auditLock.findMany({
      where: {
        companyId,
        status: 'LOCKED',
        periodStart: { lte: checkDate },
        periodEnd: { gte: checkDate },
      },
      include: {
        lockedBy: { select: { id: true, name: true, email: true } },
      },
    });

    return {
      locked: activeLocks.length > 0,
      date: checkDate.toISOString(),
      locks: activeLocks,
    };
  }

  /**
   * Find any active locks that cover the given date for a company.
   * Used by the LockDownGuard to enforce lock-down rules.
   */
  async findActiveLocksForDate(companyId: string, date: Date): Promise<any[]> {
    return this.prisma.auditLock.findMany({
      where: {
        companyId,
        status: 'LOCKED',
        periodStart: { lte: date },
        periodEnd: { gte: date },
      },
    });
  }

  // ─── External Access ────────────────────────────────────────────────────

  /**
   * Grant temporary external access to an auditor/bank/KRA.
   * Generates a unique access token and returns it (shown only once).
   */
  async grantExternalAccess(grantorId: string, dto: GrantExternalAccessDto) {
    const accessToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + dto.expiresInDays);

    const grant = await this.prisma.externalAccess.create({
      data: {
        companyId: dto.companyId,
        grantorId,
        recipientName: dto.recipientName,
        recipientEmail: dto.recipientEmail,
        accessLevel: dto.accessLevel,
        accessToken,
        expiresAt,
        purpose: dto.purpose,
      },
    });

    // Return the token (only shown once at creation)
    return {
      id: grant.id,
      accessUrl: `https://app.jengabooks.com/external-access?token=${accessToken}`,
      token: accessToken,
      expiresAt: grant.expiresAt.toISOString(),
      recipientName: grant.recipientName,
      accessLevel: grant.accessLevel,
      purpose: grant.purpose,
    };
  }

  /**
   * List external access grants for a company.
   */
  async findExternalAccessGrants(companyId: string) {
    return this.prisma.externalAccess.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      include: {
        grantor: { select: { id: true, name: true, email: true } },
      },
    });
  }

  /**
   * Revoke an external access grant immediately.
   */
  async revokeExternalAccess(id: string) {
    const grant = await this.prisma.externalAccess.findUnique({ where: { id } });
    if (!grant) {
      throw new NotFoundException(`External access grant with id ${id} not found`);
    }
    if (grant.isRevoked) {
      throw new BadRequestException('Access grant is already revoked');
    }

    return this.prisma.externalAccess.update({
      where: { id },
      data: { isRevoked: true },
    });
  }

  /**
   * View access logs for an external access grant.
   */
  async findAccessLogs(accessId: string) {
    const grant = await this.prisma.externalAccess.findUnique({ where: { id: accessId } });
    if (!grant) {
      throw new NotFoundException(`External access grant with id ${accessId} not found`);
    }

    return this.prisma.externalAccessLog.findMany({
      where: { accessId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Log an access action performed by an external user.
   */
  async logExternalAccess(
    accessId: string,
    action: string,
    resourceType: string,
    resourceId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.prisma.externalAccessLog.create({
      data: {
        accessId,
        action,
        resourceType,
        resourceId,
        ipAddress,
        userAgent,
      },
    });
  }

  /**
   * Authenticate an external access token.
   * Returns a short-lived access payload or throws descriptive error.
   */
  async authenticateExternalToken(token: string) {
    const grant = await this.prisma.externalAccess.findUnique({
      where: { accessToken: token },
    });

    if (!grant) {
      throw new NotFoundException('Invalid access token');
    }

    if (grant.isRevoked) {
      throw new ForbiddenException('Access has been revoked. Contact the company administrator.');
    }

    if (grant.expiresAt < (await this.getDbNow())) {
      throw new ForbiddenException(
        `Access token expired on ${grant.expiresAt.toISOString()}. Request a new access grant.`,
      );
    }

    const dbNow = await this.getDbNow();
    // Update last accessed timestamp
    await this.prisma.externalAccess.update({
      where: { id: grant.id },
      data: { lastAccessedAt: dbNow },
    });

    // Log the authentication event
    await this.logExternalAccess(grant.id, 'AUTHENTICATE', 'SESSION', grant.id);

    return {
      sub: grant.id,
      companyId: grant.companyId,
      accessLevel: grant.accessLevel,
      recipientName: grant.recipientName,
      purpose: grant.purpose,
      // Short-lived JWT: 1 hour for external users
      expiresIn: 3600,
    };
  }

  // ─── Internal Helpers ─────────────────────────────────────────────────

  /**
   * Gets the current database timestamp for TIME-TRAVEL compliant operations.
   * All audit timestamps derive from this single DB-source of truth.
   */
  async getDbNow(): Promise<Date> {
    const result = await this.prisma.$queryRaw<Array<{ now: Date }>>`SELECT NOW() as now`;
    return result[0].now;
  }
}
