import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from '../base.repository';

@Injectable()
export class AuthRepository extends BaseRepository<any> {
    constructor(prisma: PrismaService) {
        super(prisma);
    }
    protected get model() { return this.prisma.user; }

    async findByEmail(email: string) {
        return this.prisma.user.findUnique({ where: { email } });
    }

    async findMemberships(userId: string) {
        return this.prisma.companyMember.findMany({
            where: { userId, isActive: true },
            include: { company: true },
        });
    }

    async createRefreshToken(data: any) {
        return this.prisma.refreshToken.create({ data });
    }

    async findRefreshToken(tokenHash: string) {
        return this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    }
}
