import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateLockDto } from './dto/create-lock.dto';
import { AmendLockDto } from './dto/amend-lock.dto';
import { GrantExternalAccessDto } from './dto/grant-external-access.dto';

@Controller('audit')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  // ─── Lock-Down Periods ──────────────────────────────────────────────────

  /**
   * POST /api/v1/audit/locks — Lock a fiscal period
   */
  @Post('locks')
  createLock(@Req() req: any, @Body() dto: CreateLockDto) {
    return this.auditService.createLock(req.user.userId, dto);
  }

  /**
   * GET /api/v1/audit/locks?companyId=comp_123&status=LOCKED — List lock periods
   */
  @Get('locks')
  findLocks(
    @Req() req: any,
    @Query('companyId') companyId?: string,
    @Query('status') status?: string,
  ) {
    const cid = companyId || req.user.companyId;
    return this.auditService.findLocks(cid, status);
  }

  /**
   * GET /api/v1/audit/locks/:id — Get lock details
   */
  @Get('locks/:id')
  findLock(@Param('id') id: string) {
    return this.auditService.findLock(id);
  }

  /**
   * POST /api/v1/audit/locks/:id/amend — Amend a locked period (requires reason)
   */
  @Post('locks/:id/amend')
  amendLock(@Req() req: any, @Param('id') id: string, @Body() dto: AmendLockDto) {
    return this.auditService.amendLock(id, req.user.userId, dto);
  }

  /**
   * GET /api/v1/audit/locks/check?companyId=comp_123&date=2026-02-15
   * Check if a date falls in a locked period
   */
  @Get('locks/check')
  checkLock(
    @Query('companyId') companyId: string,
    @Query('date') date: string,
  ) {
    return this.auditService.checkLock(companyId, date);
  }

  // ─── External Access ────────────────────────────────────────────────────

  /**
   * POST /api/v1/audit/external-access — Grant temporary access
   */
  @Post('external-access')
  grantExternalAccess(@Req() req: any, @Body() dto: GrantExternalAccessDto) {
    return this.auditService.grantExternalAccess(req.user.userId, dto);
  }

  /**
   * GET /api/v1/audit/external-access?companyId=comp_123 — List grants
   */
  @Get('external-access')
  findExternalAccess(
    @Req() req: any,
    @Query('companyId') companyId?: string,
  ) {
    const cid = companyId || req.user.companyId;
    return this.auditService.findExternalAccessGrants(cid);
  }

  /**
   * POST /api/v1/audit/external-access/:id/revoke — Revoke access immediately
   */
  @Post('external-access/:id/revoke')
  revokeExternalAccess(@Param('id') id: string) {
    return this.auditService.revokeExternalAccess(id);
  }

  /**
   * GET /api/v1/audit/external-access/:id/logs — View access logs
   */
  @Get('external-access/:id/logs')
  findAccessLogs(@Param('id') id: string) {
    return this.auditService.findAccessLogs(id);
  }
}
