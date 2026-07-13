import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from '../base.repository';

@Injectable()
export class PendingReviewRepository extends BaseRepository<any> {
    constructor(prisma: PrismaService) {
        super(prisma);
    }
    protected get model() { return this.prisma.pendingReview; }

    async findByCompany(companyId: string, status?: string) {
        const where: any = { companyId };
        if (status) where.status = status;
        return this.prisma.pendingReview.findMany({ where, orderBy: { createdAt: 'desc' } });
    }

    async resolve(id: string, resolution: string, resolvedBy: string) {
        return this.prisma.pendingReview.update({
            where: { id },
            data: { status: 'RESOLVED', resolution, resolvedBy, resolvedAt: new Date() },
        });
    }
}
