import { PrismaService } from './prisma.service';

export interface PaginationParams {
    page?: number;
    limit?: number;
    cursor?: string;
    orderBy?: { field: string; direction: 'asc' | 'desc' };
}

export interface PaginatedResult<T> {
    items: T[];
    total: number;
    page: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
}

export abstract class BaseRepository<T, F = Record<string, any>> {
    constructor(protected readonly prisma: PrismaService) { }

    protected abstract get model(): any;

    async findById(id: string): Promise<T | null> {
        return this.model.findFirst({
            where: { id, deletedAt: null },
        });
    }

    async findMany(filter?: F): Promise<T[]> {
        return this.model.findMany({
            where: { ...(filter || ({} as F)), deletedAt: null },
        });
    }

    async create(data: any): Promise<T> {
        return this.model.create({ data });
    }

    async update(id: string, data: any): Promise<T> {
        const existing = await this.findById(id);
        if (!existing) {
            const { NotFoundException } = require('@nestjs/common');
            throw new NotFoundException(`Record with id ${id} not found`);
        }
        return this.model.update({ where: { id }, data });
    }

    async delete(id: string): Promise<T> {
        const existing = await this.findById(id);
        if (!existing) {
            const { NotFoundException } = require('@nestjs/common');
            throw new NotFoundException(`Record with id ${id} not found`);
        }
        return this.model.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
    }

    async findManyPaginated(params: PaginationParams & { filter?: F }): Promise<PaginatedResult<T>> {
        const page = params.page || 1;
        const limit = Math.min(params.limit || 20, 100);
        const skip = (page - 1) * limit;
        const where = { ...(params.filter || ({} as F)), deletedAt: null };

        const [items, total] = await Promise.all([
            this.model.findMany({ where, skip, take: limit, orderBy: params.orderBy }),
            this.model.count({ where }),
        ]);

        return {
            items,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            hasNext: page * limit < total,
            hasPrevious: page > 1,
        };
    }

    async withTransaction<R>(fn: (tx: any) => Promise<R>): Promise<R> {
        return this.prisma.$transaction(fn);
    }

    async restore(id: string): Promise<T> {
        return this.model.update({
            where: { id },
            data: { deletedAt: null },
        });
    }

    async findDeleted(filter?: F): Promise<T[]> {
        return this.model.findMany({
            where: { ...(filter || ({} as F)), deletedAt: { not: null } },
        });
    }
}
