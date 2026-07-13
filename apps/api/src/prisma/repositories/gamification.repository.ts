import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from '../base.repository';

@Injectable()
export class GamificationRepository extends BaseRepository<any> {
    constructor(prisma: PrismaService) {
        super(prisma);
    }
    protected get model() { return this.prisma.xPRecord; }

    async getUserLevel(userId: string, companyId: string) {
        return this.prisma.userLevel.findUnique({
            where: { userId_companyId: { userId, companyId } },
        });
    }

    async upsertUserLevel(userId: string, companyId: string, data: any) {
        return this.prisma.userLevel.upsert({
            where: { userId_companyId: { userId, companyId } },
            create: { userId, companyId, ...data },
            update: data,
        });
    }

    async getHealthScore(companyId: string) {
        return this.prisma.businessHealthScore.findFirst({
            where: { companyId },
            orderBy: { calculatedAt: 'desc' },
        });
    }

    async findWizardProgress(userId: string, companyId: string) {
        return this.prisma.wizardProgress.findMany({
            where: { userId, companyId },
            orderBy: { completedAt: 'asc' },
        });
    }
}
