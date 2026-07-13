import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from '../base.repository';

@Injectable()
export class AuditRepository extends BaseRepository<any> {
    constructor(prisma: PrismaService) {
        super(prisma);
    }
    protected get model() { return this.prisma.auditLog; }

    async findByEntity(entityType: string, entityId: string) {
        return this.prisma.auditLog.findMany({
            where: { entityType, entityId },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findLocks(companyId: string) {
        return this.prisma.auditLock.findMany({ where: { companyId }, orderBy: { fiscalYear: 'desc' } });
    }

    async findExternalAccess(companyId: string) {
        return this.prisma.externalAccess.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
    }
}
