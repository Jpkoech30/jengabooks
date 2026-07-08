import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('profit-loss')
  getProfitLoss(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.getProfitLoss(req.user.companyId, req.user.userId, from, to);
  }

  @Get('balance-sheet')
  getBalanceSheet(
    @Req() req: any,
    @Query('asOf') asOf?: string,
  ) {
    return this.reportsService.getBalanceSheet(req.user.companyId, asOf);
  }

  @Get('trial-balance')
  getTrialBalance(
    @Req() req: any,
    @Query('asOf') asOf?: string,
  ) {
    return this.reportsService.getTrialBalance(req.user.companyId, asOf);
  }

  @Get('cash-flow')
  getCashFlow(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.getCashFlow(req.user.companyId, from, to);
  }

  @Get('audit-trail')
  getAuditTrail(
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('entityType') entityType?: string,
  ) {
    return this.reportsService.getAuditTrail(req.user.companyId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      entityType,
    });
  }

  @Get('analytics/dashboard')
  async getDashboardAnalytics(@Req() req: any) {
    const companyId = req.user.companyId;
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

    // Monthly income/expense for last 6 months
    const monthlyEntries = await this.prisma.journalEntry.findMany({
      where: { companyId, entryDate: { gte: sixMonthsAgo }, deletedAt: null },
      include: { account: { select: { type: true } } },
    });

    const monthlyMap = new Map<string, { income: number; expense: number }>();
    for (const entry of monthlyEntries) {
      const monthKey = entry.entryDate.toISOString().slice(0, 7);
      const current = monthlyMap.get(monthKey) || { income: 0, expense: 0 };
      if (entry.account.type === 'INCOME') {
        current.income += entry.direction === 'CREDIT' ? entry.amount : -entry.amount;
      } else if (entry.account.type === 'EXPENSE') {
        current.expense += entry.direction === 'DEBIT' ? entry.amount : -entry.amount;
      }
      monthlyMap.set(monthKey, current);
    }

    // Top 5 expense accounts
    const expenseEntries = await this.prisma.journalEntry.groupBy({
      by: ['accountId'],
      where: { companyId, account: { type: 'EXPENSE' }, deletedAt: null },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 5,
    });

    const topExpenses = await Promise.all(
      expenseEntries.map(async (e) => {
        const acct = await this.prisma.chartOfAccount.findUnique({ where: { id: e.accountId } });
        return { code: acct?.code, name: acct?.name, total: e._sum.amount || 0 };
      }),
    );

    // M-Pesa summary
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const mpesaSummary = await this.prisma.mpesaTransaction.aggregate({
      where: { companyId, transactionDate: { gte: thirtyDaysAgo } },
      _sum: { paidIn: true, withdrawn: true },
    });

    return {
      monthly: Array.from(monthlyMap.entries()).map(([month, data]) => ({ month, ...data })),
      topExpenses,
      mpesaSummary: {
        paidIn30d: mpesaSummary._sum.paidIn || 0,
        withdrawn30d: mpesaSummary._sum.withdrawn || 0,
      },
    };
  }
}
