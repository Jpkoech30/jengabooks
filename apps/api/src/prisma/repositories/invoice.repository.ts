import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from '../base.repository';

@Injectable()
export class InvoiceRepository extends BaseRepository<any> {
    constructor(prisma: PrismaService) {
        super(prisma);
    }
    protected get model() { return this.prisma.invoice; }

    async findByInvoiceNumber(invoiceNumber: string) {
        return this.prisma.invoice.findUnique({ where: { invoiceNumber } });
    }

    async findEtimsSubmission(invoiceId: string) {
        return this.prisma.eTIMSSubmission.findUnique({ where: { invoiceId } });
    }

    async createEtimsSubmission(data: any) {
        return this.prisma.eTIMSSubmission.create({ data });
    }
}
