import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(companyId: string, deviceId: string) {
    const lastSync = await this.prisma.syncLog.findFirst({
      where: { companyId, deviceId, status: 'SYNCED' },
      orderBy: { createdAt: 'desc' },
    });

    const pendingCount = await this.prisma.syncLog.count({
      where: { companyId, deviceId, status: 'PENDING' },
    });

    return {
      status: pendingCount > 0 ? 'PENDING_CHANGES' : 'SYNCED',
      lastSync: lastSync?.createdAt || null,
      pendingChanges: pendingCount,
      deviceId,
    };
  }

  async getChanges(companyId: string, deviceId: string, lastSyncTimestamp?: string) {
    const where: any = { companyId };

    if (lastSyncTimestamp) {
      where.updatedAt = { gte: new Date(lastSyncTimestamp) };
    }

    // Get journal entries created/updated since last sync
    const entries = await this.prisma.journalEntry.findMany({
      where: { ...where, deletedAt: null },
      take: 100,
      orderBy: { updatedAt: 'desc' },
    });

    // Get mpesa transactions
    const mpesaTxns = await this.prisma.mpesaTransaction.findMany({
      where,
      take: 100,
      orderBy: { createdAt: 'desc' },
    });

    return {
      deviceId,
      timestamp: new Date().toISOString(),
      changes: {
        journalEntries: entries,
        mpesaTransactions: mpesaTxns,
      },
      changeCount: entries.length + mpesaTxns.length,
    };
  }

  async pushChanges(companyId: string, deviceId: string, changes: {
    entityType: string;
    entityId: string;
    data: string;
    deviceVersion: number;
  }[]) {
    const results = [];

    for (const change of changes) {
      // Check for conflicts
      const existing = await this.prisma.syncLog.findFirst({
        where: {
          companyId,
          entityType: change.entityType,
          entityId: change.entityId,
          status: 'SYNCED',
        },
        orderBy: { createdAt: 'desc' },
      });

      if (existing && existing.serverVersion && existing.serverVersion > change.deviceVersion) {
        // Conflict detected
        const conflict = await this.prisma.syncLog.create({
          data: {
            companyId,
            deviceId,
            entityType: change.entityType,
            entityId: change.entityId,
            status: 'CONFLICT',
            serverVersion: existing.serverVersion,
            deviceVersion: change.deviceVersion,
            conflictData: JSON.stringify({
              server: existing.id,
              device: change.data,
            }),
          },
        });
        results.push({ status: 'CONFLICT', id: conflict.id, entityId: change.entityId });
      } else {
        // No conflict — record sync
        const synced = await this.prisma.syncLog.create({
          data: {
            companyId,
            deviceId,
            entityType: change.entityType,
            entityId: change.entityId,
            status: 'SYNCED',
            serverVersion: change.deviceVersion,
            deviceVersion: change.deviceVersion,
            resolvedAt: new Date(),
          },
        });
        results.push({ status: 'SYNCED', id: synced.id, entityId: change.entityId });
      }
    }

    return {
      deviceId,
      results,
      synced: results.filter((r) => r.status === 'SYNCED').length,
      conflicts: results.filter((r) => r.status === 'CONFLICT').length,
    };
  }

  async resolveConflict(conflictId: string, resolution: 'USE_SERVER' | 'USE_DEVICE') {
    const conflict = await this.prisma.syncLog.findUnique({ where: { id: conflictId } });
    if (!conflict || conflict.status !== 'CONFLICT') {
      throw new Error(`Conflict ${conflictId} not found or already resolved`);
    }

    return this.prisma.syncLog.update({
      where: { id: conflictId },
      data: {
        status: 'SYNCED',
        resolvedAt: new Date(),
        conflictData: JSON.stringify({
          ...JSON.parse(conflict.conflictData || '{}'),
          resolution,
          resolvedAt: new Date().toISOString(),
        }),
      },
    });
  }

  async getSyncLogs(companyId: string, deviceId: string) {
    return this.prisma.syncLog.findMany({
      where: { companyId, deviceId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
