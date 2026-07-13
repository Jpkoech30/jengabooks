import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from '../base.repository';

@Injectable()
export class SandboxRepository extends BaseRepository<any> {
    constructor(prisma: PrismaService) {
        super(prisma);
    }
    protected get model() { return this.prisma.sandbox; }

    async findByCompany(companyId: string) {
        return this.prisma.sandbox.findUnique({ where: { companyId } });
    }
}
