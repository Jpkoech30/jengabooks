import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FiscalPeriodsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.fiscalPeriod.findMany({
      where: { companyId },
      orderBy: { startDate: 'desc' },
    });
  }

  async findOne(id: string) {
    const period = await this.prisma.fiscalPeriod.findUnique({ where: { id } });
    if (!period) {
      throw new NotFoundException(`Fiscal period with id ${id} not found`);
    }
    return period;
  }

  async create(companyId: string, data: {
    name: string;
    startDate: string;
    endDate: string;
    status?: string;
  }) {
    // Validate no overlapping periods
    const overlapping = await this.prisma.fiscalPeriod.findFirst({
      where: {
        companyId,
        OR: [
          {
            startDate: { lte: new Date(data.endDate) },
            endDate: { gte: new Date(data.startDate) },
          },
        ],
      },
    });

    if (overlapping) {
      throw new BadRequestException(
        `Period overlaps with existing period "${overlapping.name}"`,
      );
    }

    return this.prisma.fiscalPeriod.create({
      data: {
        companyId,
        name: data.name,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        status: data.status || 'OPEN',
      },
    });
  }

  async closePeriod(id: string, closedBy: string) {
    const period = await this.prisma.fiscalPeriod.findUnique({ where: { id } });
    if (!period) {
      throw new NotFoundException(`Fiscal period with id ${id} not found`);
    }
    if (period.status !== 'OPEN') {
      throw new BadRequestException(`Period is already ${period.status}`);
    }

    return this.prisma.fiscalPeriod.update({
      where: { id },
      data: {
        status: 'CLOSED',
        closedBy,
        closedAt: new Date(),
      },
    });
  }

  async reopenPeriod(id: string) {
    const period = await this.prisma.fiscalPeriod.findUnique({ where: { id } });
    if (!period) {
      throw new NotFoundException(`Fiscal period with id ${id} not found`);
    }
    if (period.status !== 'CLOSED') {
      throw new BadRequestException(`Can only reopen CLOSED periods, current: ${period.status}`);
    }

    return this.prisma.fiscalPeriod.update({
      where: { id },
      data: { status: 'OPEN', closedBy: null, closedAt: null },
    });
  }
}
