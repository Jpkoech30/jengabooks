import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from '../base.repository';

@Injectable()
export class TenantRepository extends BaseRepository<any> {
    constructor(prisma: PrismaService) {
        super(prisma);
    }
    protected get model() { return this.prisma.company; }

    async findSubscription(companyId: string) {
        return this.prisma.subscription.findUnique({ where: { companyId } });
    }

    async upsertSubscription(companyId: string, data: any) {
        return this.prisma.subscription.upsert({
            where: { companyId },
            create: { companyId, ...data },
            update: data,
        });
    }
}
