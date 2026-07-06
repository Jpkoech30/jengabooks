import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class HitlService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string, filters?: {
    status?: string;
    category?: string;
    assignedTo?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = { companyId };
    if (filters?.status) where.status = filters.status;
    if (filters?.category) where.category = filters.category;
    if (filters?.assignedTo) where.assignedTo = filters.assignedTo;

    const [items, total] = await Promise.all([
      this.prisma.pendingReview.findMany({
        where,
        include: {
          assignedUser: { select: { id: true, name: true, email: true } },
          resolvedUser: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.pendingReview.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const review = await this.prisma.pendingReview.findUnique({
      where: { id },
      include: {
        assignedUser: { select: { id: true, name: true, email: true } },
        resolvedUser: { select: { id: true, name: true, email: true } },
        company: { select: { id: true, name: true } },
      },
    });

    if (!review) {
      throw new NotFoundException(`Review with id ${id} not found`);
    }
    return review;
  }

  async create(companyId: string, data: {
    category: string;
    description: string;
    rawData?: string;
    conflictData?: string;
    linkedEntityId?: string;
    linkedEntityType?: string;
    confidence?: number;
  }) {
    return this.prisma.pendingReview.create({
      data: {
        companyId,
        category: data.category,
        description: data.description,
        rawData: data.rawData,
        conflictData: data.conflictData,
        linkedEntityId: data.linkedEntityId,
        linkedEntityType: data.linkedEntityType,
        confidence: data.confidence,
      },
    });
  }

  async assign(id: string, userId: string) {
    const review = await this.prisma.pendingReview.findUnique({ where: { id } });
    if (!review) {
      throw new NotFoundException(`Review with id ${id} not found`);
    }
    if (review.status !== 'PENDING') {
      throw new BadRequestException(`Cannot assign review in status ${review.status}`);
    }

    return this.prisma.pendingReview.update({
      where: { id },
      data: {
        assignedTo: userId,
        status: 'IN_PROGRESS',
      },
      include: {
        assignedUser: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async resolve(
    id: string,
    userId: string,
    resolution: string,
    action: 'APPROVE' | 'REJECT' | 'EDIT',
    correctedData?: string,
    xpAwarded?: number,
  ) {
    const review = await this.prisma.pendingReview.findUnique({ where: { id } });
    if (!review) {
      throw new NotFoundException(`Review with id ${id} not found`);
    }
    if (review.status === 'RESOLVED') {
      throw new BadRequestException('Review is already resolved');
    }

    const xp = xpAwarded || 50;

    // Apply the resolution action to the linked entity
    const linkedReview = review as any;
    if (action !== 'REJECT' && linkedReview.linkedEntityId && linkedReview.linkedEntityType) {
      await this.applyResolution(linkedReview, action, correctedData);
    }

    // Resolve review and award XP in a transaction
    return this.prisma.$transaction(async (tx) => {
      const resolved = await tx.pendingReview.update({
        where: { id },
        data: {
          status: 'RESOLVED',
          resolvedBy: userId,
          resolvedAt: new Date(),
          resolution,
          resolutionAction: action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : 'EDITED',
          xpAwarded: xp,
        },
      });

      // Award XP record
      await tx.xPRecord.create({
        data: {
          userId,
          companyId: review.companyId,
          points: xp,
          reason: `Resolved HITL case: ${review.category} (${action})`,
        },
      });

      // Update or create user level using canonical calculation from GamificationService
      const totalXp = await tx.xPRecord.aggregate({
        where: { userId, companyId: review.companyId },
        _sum: { points: true },
      });

      const totalXpValue = totalXp._sum.points || 0;
      const { GamificationService } = await import('../gamification/gamification.service');
      const levelInfo = GamificationService.calculateLevel(totalXpValue);

      await tx.userLevel.upsert({
        where: { userId_companyId: { userId, companyId: review.companyId } },
        update: { totalXp: totalXpValue, level: levelInfo.level },
        create: {
          userId,
          companyId: review.companyId,
          level: levelInfo.level,
          totalXp: totalXpValue,
        },
      });

      return resolved;
    });
  }

  private async applyResolution(
    review: any,
    action: string,
    correctedData?: string,
  ) {
    const { linkedEntityId, linkedEntityType } = review;

    switch (linkedEntityType) {
      case 'MPESA_TX': {
        // Approve or Edit: map the M-Pesa transaction to the suggested/corrected account
        if (action === 'APPROVE') {
          // Auto-approve uses whatever was in the suggestion
          // For manual mapping, correctedData would contain accountId
          if (correctedData) {
            const { accountId } = JSON.parse(correctedData);
            await this.prisma.mpesaTransaction.update({
              where: { id: linkedEntityId },
              data: { mappedAccountId: accountId, isReconciled: true },
            });
          }
        } else if (action === 'EDIT' && correctedData) {
          const { accountId } = JSON.parse(correctedData);
          await this.prisma.mpesaTransaction.update({
            where: { id: linkedEntityId },
            data: { mappedAccountId: accountId, isReconciled: true },
          });
        }
        break;
      }

      case 'JOURNAL_ENTRY': {
        // Approve: create the journal entry that was blocked
        if (action === 'APPROVE' && correctedData) {
          const data = JSON.parse(correctedData);
          await this.prisma.journalEntry.create({
            data: {
              companyId: review.companyId,
              accountId: data.accountId,
              description: data.description,
              amount: data.amount,
              direction: data.direction,
              reference: data.reference,
              entryDate: new Date(data.entryDate),
              postedById: data.postedById,
              serialNumber: `HITL-${Date.now()}`,
            },
          });
        }
        break;
      }

      case 'INVOICE': {
        // Approve: retry the eTIMS submission
        if (action === 'APPROVE') {
          // The eTIMS service handles retry logic internally
          // We just mark it for retry — the queue worker picks it up
          await this.prisma.eTIMSSubmission.updateMany({
            where: { invoiceId: linkedEntityId, status: 'FAILED' },
            data: { status: 'PENDING', retryCount: 0 },
          });
        }
        break;
      }
    }
  }
}
