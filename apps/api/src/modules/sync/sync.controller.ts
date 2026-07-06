import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { SyncService } from './sync.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get('status/:companyId/:deviceId')
  getStatus(
    @Param('companyId') companyId: string,
    @Param('deviceId') deviceId: string,
  ) {
    return this.syncService.getStatus(companyId, deviceId);
  }

  @Get('changes/:companyId/:deviceId')
  getChanges(
    @Param('companyId') companyId: string,
    @Param('deviceId') deviceId: string,
    @Param('lastSync') lastSync?: string,
  ) {
    return this.syncService.getChanges(companyId, deviceId, lastSync);
  }

  @Post('push/:companyId/:deviceId')
  pushChanges(
    @Param('companyId') companyId: string,
    @Param('deviceId') deviceId: string,
    @Body() body: { changes: Array<{ entityType: string; entityId: string; data: string; deviceVersion: number }> },
  ) {
    return this.syncService.pushChanges(companyId, deviceId, body.changes);
  }

  @Post('resolve/:conflictId')
  resolveConflict(
    @Param('conflictId') conflictId: string,
    @Body() body: { resolution: 'USE_SERVER' | 'USE_DEVICE' },
  ) {
    return this.syncService.resolveConflict(conflictId, body.resolution);
  }

  @Get('logs/:companyId/:deviceId')
  getSyncLogs(
    @Param('companyId') companyId: string,
    @Param('deviceId') deviceId: string,
  ) {
    return this.syncService.getSyncLogs(companyId, deviceId);
  }
}
