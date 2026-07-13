import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from '../base.repository';

@Injectable()
export class CollaborationRepository extends BaseRepository<any> {
    constructor(prisma: PrismaService) {
        super(prisma);
    }
    protected get model() { return this.prisma.comment; }

    async findByEntity(entityType: string, entityId: string) {
        return this.prisma.comment.findMany({
            where: { entityType, entityId, parentId: null },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findNotifications(userId: string, companyId: string) {
        return this.prisma.notification.findMany({
            where: { userId, companyId, status: 'UNREAD' },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findClientTasks(companyId: string) {
        return this.prisma.clientTask.findMany({
            where: { companyId },
            orderBy: { createdAt: 'desc' },
        });
    }
}
