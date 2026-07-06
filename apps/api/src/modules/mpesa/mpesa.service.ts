import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';
import { HitlService } from '../hitl/hitl.service';

@Injectable()
export class MpesaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamificationService: GamificationService,
    private readonly hitlService: HitlService,
  ) {}

  async uploadCsv(companyId: string, userId: string, csvData: string) {
    // Parse CSV rows
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) {
      throw new BadRequestException('CSV must have a header row and at least one data row');
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const parsedRows = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim());
      if (values.length !== headers.length) continue;

      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx];
      });

      parsedRows.push({
        companyId,
        receiptNo: row['receipt'] || row['receiptno'] || row['transaction id'] || null,
        transactionDate: new Date(row['date'] || row['transactiondate'] || row['time'] || Date.now()),
        description: row['description'] || row['details'] || row['notes'] || '',
        amount: parseFloat(row['amount'] || row['value'] || '0'),
        phoneNumber: row['phone'] || row['phonenumber'] || row['sender'] || null,
        paybill: row['paybill'] || row['business'] || row['till'] || null,
        rawCsv: JSON.stringify(row),
      });
    }

    if (parsedRows.length === 0) {
      throw new BadRequestException('No valid transactions found in CSV');
    }

    // Bulk insert using createManyAndReturn to get back the created records with their IDs
    const transactions = await this.prisma.mpesaTransaction.createManyAndReturn({
      data: parsedRows,
    });

    // Auto-categorize using rules (transactions now have real IDs from the DB)
    const categorized = await this.autoCategorize(companyId, transactions);

    // Award XP for importing M-Pesa transactions
    const xpAmount = Math.min(transactions.length * 2, 25); // 2 XP per tx, max 25
    if (transactions.length > 0 && userId) {
      await this.gamificationService.awardXp(
        userId,
        companyId,
        xpAmount,
        `Imported ${transactions.length} M-Pesa transactions`,
      ).catch(() => {});
    }

    return {
      imported: transactions.length,
      categorized: categorized.length,
      message: `Successfully imported ${transactions.length} M-Pesa transactions`,
    };
  }

  async findTransactions(companyId: string, filters?: {
    isReconciled?: boolean;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = { companyId };
    if (filters?.isReconciled !== undefined) {
      where.isReconciled = filters.isReconciled;
    }

    const [items, total] = await Promise.all([
      this.prisma.mpesaTransaction.findMany({
        where,
        include: { mappedAccount: { select: { id: true, code: true, name: true } } },
        orderBy: { transactionDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.mpesaTransaction.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async mapToAccount(transactionId: string, accountId: string) {
    const transaction = await this.prisma.mpesaTransaction.findUnique({
      where: { id: transactionId },
    });
    if (!transaction) {
      throw new BadRequestException(`Transaction ${transactionId} not found`);
    }

    const account = await this.prisma.chartOfAccount.findFirst({
      where: { id: accountId, companyId: transaction.companyId },
    });
    if (!account) {
      throw new BadRequestException(`Account ${accountId} not found in this company`);
    }

    return this.prisma.mpesaTransaction.update({
      where: { id: transactionId },
      data: { mappedAccountId: accountId, isReconciled: true },
      include: { mappedAccount: true },
    });
  }

  private async autoCategorize(companyId: string, transactions: any[], userId?: string) {
    const rules = await this.prisma.categoryRule.findMany({
      where: { companyId, isActive: true },
      orderBy: { priority: 'desc' },
    });

    const categorized: string[] = [];

    for (const tx of transactions) {
      const matchingRule = rules.find((rule) =>
        tx.description.toLowerCase().includes(rule.keyword.toLowerCase()),
      );

      if (matchingRule) {
        const account = await this.prisma.chartOfAccount.findUnique({
          where: { companyId_code: { companyId, code: matchingRule.accountCode } },
        });

        if (account) {
          await this.prisma.mpesaTransaction.updateMany({
            where: { id: tx.id || 'none' },
            data: {
              mappedAccountId: account.id,
              category: matchingRule.keyword,
              isReconciled: true,
            },
          });
          categorized.push(tx.id);
        }
      }
    }

    // Auto-create HITL tasks for unmapped transactions (low confidence)
    const unmappedTxns = transactions.filter((tx) => !categorized.includes(tx.id));
    for (const tx of unmappedTxns) {
      await this.hitlService.create(companyId, {
        category: 'UNMAPPED_DATA',
        description: `M-Pesa transaction: KES ${tx.amount} — ${tx.description || 'No description'}`,
        rawData: JSON.stringify(tx),
        linkedEntityId: tx.id,
        linkedEntityType: 'MPESA_TX',
        confidence: 0,
      }).catch(() => {});
    }

    return categorized;
  }
}
