import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from '../base.repository';

@Injectable()
export class StatementRepository extends BaseRepository<any> {
    constructor(prisma: PrismaService) {
        super(prisma);
    }
    protected get model() { return this.prisma.statementUpload; }

    async findByCompany(companyId: string) {
        return this.prisma.statementUpload.findMany({
            where: { tenantId: companyId },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findTemplates(companyId: string) {
        return this.prisma.parsingTemplate.findMany({
            where: { tenantId: companyId, isActive: true },
        });
    }
}
