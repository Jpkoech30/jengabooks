import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [companies, total] = await Promise.all([
      this.prisma.company.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          tier: true,
          isActive: true,
          createdAt: true,
          _count: {
            select: {
              members: true,
              chartOfAccounts: true,
              journalEntries: true,
            },
          },
        },
      }),
      this.prisma.company.count(),
    ]);

    return {
      items: companies,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        members: {
          where: { isActive: true },
          include: { user: { select: { id: true, email: true, name: true } } },
        },
        _count: {
          select: {
            chartOfAccounts: true,
            journalEntries: true,
            mpesaTransactions: true,
          },
        },
      },
    });

    if (!company) {
      throw new NotFoundException(`Company with id ${id} not found`);
    }

    return company;
  }

  async create(data: { name: string; tier?: string; kraPin?: string; parentCompanyId?: string }) {
    return this.prisma.company.create({
      data: {
        name: data.name,
        tier: data.tier || 'BRONZE',
        kraPin: data.kraPin,
        parentCompanyId: data.parentCompanyId,
      },
    });
  }

  async update(id: string, data: { name?: string; kraPin?: string; tier?: string; isActive?: boolean }) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) {
      throw new NotFoundException(`Company with id ${id} not found`);
    }

    return this.prisma.company.update({
      where: { id },
      data,
    });
  }

  async getMembers(companyId: string) {
    return this.prisma.companyMember.findMany({
      where: { companyId, isActive: true },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
      orderBy: { id: 'asc' },
    });
  }

  async addMember(companyId: string, data: { userId: string; role: string }) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundException(`Company with id ${companyId} not found`);
    }

    const user = await this.prisma.user.findUnique({ where: { id: data.userId } });
    if (!user) {
      throw new NotFoundException(`User with id ${data.userId} not found`);
    }

    const existing = await this.prisma.companyMember.findUnique({
      where: { userId_companyId: { userId: data.userId, companyId } },
    });

    if (existing) {
      if (existing.isActive) {
        throw new ConflictException('User is already a member of this company');
      }
      // Reactivate
      return this.prisma.companyMember.update({
        where: { id: existing.id },
        data: { isActive: true, role: data.role },
        include: { user: { select: { id: true, email: true, name: true } } },
      });
    }

    return this.prisma.companyMember.create({
      data: {
        userId: data.userId,
        companyId,
        role: data.role,
      },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
  }

  async updateMemberRole(companyId: string, userId: string, role: string) {
    const membership = await this.prisma.companyMember.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    return this.prisma.companyMember.update({
      where: { id: membership.id },
      data: { role },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
  }

  async removeMember(companyId: string, userId: string) {
    const membership = await this.prisma.companyMember.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    return this.prisma.companyMember.update({
      where: { id: membership.id },
      data: { isActive: false },
    });
  }

  async inviteByEmail(companyId: string, data: { email: string; role: string; name?: string }) {
    // Find existing user by email or create a placeholder
    let user = await this.prisma.user.findUnique({ where: { email: data.email } });

    if (!user) {
      // Create a minimal user (they'll set password on first login)
      const tempPassword = Math.random().toString(36).substring(2, 15);
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      user = await this.prisma.user.create({
        data: {
          email: data.email,
          password: hashedPassword,
          name: data.name || data.email.split('@')[0],
        },
      });
    }

    return this.addMember(companyId, { userId: user.id, role: data.role });
  }
}
