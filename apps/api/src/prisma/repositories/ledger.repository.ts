import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from '../base.repository';

@Injectable()
export class LedgerRepository extends BaseRepository<any> {
    constructor(prisma: PrismaService) {
        super(prisma);
    }
    protected get model() { return this.prisma.chartOfAccount; }

    async findJournalEntries(companyId: string, accountId?: string) {
        const where: any = { companyId, deletedAt: null };
        if (accountId) where.accountId = accountId;
        return this.prisma.journalEntry.findMany({ where, orderBy: { entryDate: 'desc' } });
    }

    async createJournalEntry(data: any) {
        return this.prisma.journalEntry.create({ data });
    }

    async findFiscalPeriods(companyId: string) {
        return this.prisma.fiscalPeriod.findMany({ where: { companyId }, orderBy: { startDate: 'desc' } });
    }

    async createFiscalPeriod(data: any) {
        return this.prisma.fiscalPeriod.create({ data });
    }
}
