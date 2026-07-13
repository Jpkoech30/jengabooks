import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from '../base.repository';

@Injectable()
export class SyncRepository extends BaseRepository<any> {
    constructor(prisma: PrismaService) {
        super(prisma);
    }
    protected get model() { return this.prisma.syncLog; }

    async findByEntity(entityType: string, entityId: string) {
        return this.prisma.syncLog.findMany({
            where: { entityType, entityId },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findConflicts(companyId: string) {
        return this.prisma.syncLog.findMany({
            where: { companyId, status: 'CONFLICT' },
            orderBy: { createdAt: 'desc' },
        });
    }
}
