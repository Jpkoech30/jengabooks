import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from '../base.repository';

@Injectable()
export class PayrollRepository extends BaseRepository<any> {
    constructor(prisma: PrismaService) {
        super(prisma);
    }
    protected get model() { return this.prisma.employee; }

    async findEmployees(companyId: string) {
        return this.prisma.employee.findMany({ where: { companyId }, orderBy: { name: 'asc' } });
    }

    async findPayrollRuns(companyId: string) {
        return this.prisma.payrollRun.findMany({ where: { companyId }, orderBy: { periodStart: 'desc' } });
    }

    async findPayrollEntries(payrollRunId: string) {
        return this.prisma.payrollEntry.findMany({
            where: { payrollRunId },
            include: { employee: true },
        });
    }

    async createPayrollRun(data: any) {
        return this.prisma.payrollRun.create({ data });
    }
}
