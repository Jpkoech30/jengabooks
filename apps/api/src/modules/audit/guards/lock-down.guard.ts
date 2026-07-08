import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { AuditService } from '../audit.service';
import { CompanyRole } from '@jengabooks/shared';

/**
 * Lock-Down Enforcement Guard
 * 
 * Checks if a transaction date falls in a locked period before any POST/PUT/PATCH/DELETE
 * on financial modules (ledger, mpesa, etims, payroll).
 * 
 * - If locked and user is not ACCOUNTANT partner → reject with 423 Locked
 * - If locked and user is ACCOUNTANT partner → require `unlockReason` in request body
 */
@Injectable()
export class LockDownGuard implements CanActivate {
  private readonly logger = new Logger(LockDownGuard.name);

  constructor(private readonly auditService: AuditService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Only enforce on write operations
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return true;
    }

    const user = request.user;
    if (!user || !user.companyId) {
      return true; // Let auth guard handle missing user
    }

    // Extract the transaction date from the request body
    const entryDate = request.body?.entryDate || request.body?.transactionDate || request.body?.date;
    if (!entryDate) {
      return true; // No financial date to check
    }

    const date = new Date(entryDate);

    // Find active locks for this company covering the given date
    const activeLocks = await this.auditService.findActiveLocksForDate(user.companyId, date);

    if (activeLocks.length === 0) {
      return true; // No lock covers this date
    }

    // Determine user's role
    const userRole: string = user.role || '';

    // ACCOUNTANT partners can override with mandatory unlock reason
    if (userRole === CompanyRole.ACCOUNTANT) {
      const unlockReason = request.body?.unlockReason;
      if (!unlockReason || unlockReason.trim().length === 0) {
        throw new BadRequestException(
          'This date falls within a locked fiscal period. As an accountant, you must provide an "unlockReason" in the request body to proceed.',
        );
      }

      this.logger.warn(
        `[LOCK_OVERRIDE] Accountant ${user.userId} overriding lock for company ${user.companyId} on date ${entryDate}. Reason: ${unlockReason}`,
      );

      // Attach lock override info to request for audit logging
      request.lockOverride = {
        overrideReason: unlockReason,
        lockIds: activeLocks.map((l: any) => l.id),
        overriddenAt: new Date(),
      };

      return true;
    }

    // Non-accountant users are blocked
    const lockDescriptions = activeLocks
      .map((l: any) => `Fiscal Year ${l.fiscalYear}: ${l.periodStart.toISOString()} - ${l.periodEnd.toISOString()}`)
      .join('; ');

    throw new ForbiddenException({
      statusCode: 423,
      error: 'Locked',
      message: `Cannot modify records for date ${entryDate}. This date falls within a locked fiscal period: ${lockDescriptions}. Contact your accounting partner to unlock.`,
    });
  }
}
