import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from '../base.repository';

@Injectable()
export class DocumentRepository extends BaseRepository<any> {
    constructor(prisma: PrismaService) {
        super(prisma);
    }
    protected get model() { return this.prisma.document; }

    async findByCompany(companyId: string, category?: string) {
        const where: any = { companyId, isDeleted: false };
        if (category) where.category = category;
        return this.prisma.document.findMany({ where, orderBy: { createdAt: 'desc' } });
    }

    async findVersions(documentId: string) {
        return this.prisma.documentVersion.findMany({
            where: { documentId },
            orderBy: { version: 'desc' },
        });
    }
}
