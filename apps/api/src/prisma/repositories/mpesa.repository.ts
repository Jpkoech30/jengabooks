import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from '../base.repository';

@Injectable()
export class MpesaRepository extends BaseRepository<any> {
    constructor(prisma: PrismaService) {
        super(prisma);
    }
    protected get model() { return this.prisma.mpesaTransaction; }

    async findUnmapped(companyId: string) {
        return this.prisma.mpesaTransaction.findMany({
            where: { companyId, mappedAccountId: null, deletedAt: null },
            orderBy: { transactionDate: 'desc' },
        });
    }

    async findBankTransactions(companyId: string) {
        return this.prisma.bankTransaction.findMany({
            where: { companyId },
            orderBy: { transactionDate: 'desc' },
        });
    }

    async findCategoryRules(companyId: string) {
        return this.prisma.categoryRule.findMany({
            where: { companyId, isActive: true },
            orderBy: { priority: 'asc' },
        });
    }
}
