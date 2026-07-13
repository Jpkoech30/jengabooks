import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gamificationService: GamificationService,
  ) { }

  async getProfitLoss(
    companyId: string,
    userId: string,
    fromDate?: string,
    toDate?: string,
    now?: Date,
    compareWithPrevious?: boolean,
  ) {
    const timestamp = now || new Date();
    const currentPeriod = await this.computePnl(companyId, fromDate, toDate);

    let previousPeriod = null;
    if (compareWithPrevious) {
      const prevFrom = this.offsetPeriod(fromDate, toDate, true);
      const prevTo = fromDate;
      previousPeriod = await this.computePnl(companyId, prevFrom, prevTo);
    }

    if (fromDate || toDate) {
      await this.gamificationService.awardXp(userId, companyId, 5, 'Generated a Profit & Loss report').catch(() => { });
    }

    return {
      period: { from: fromDate || 'All time', to: toDate || 'All time' },
      ...currentPeriod,
      ...(compareWithPrevious && previousPeriod ? {
        previousPeriod: {
          period: { from: this.offsetPeriod(fromDate, toDate, true), to: fromDate || 'All time' },
          ...previousPeriod,
        },
        changes: {
          totalIncome: this.pctChange(currentPeriod.totalIncome, previousPeriod.totalIncome),
          totalExpenses: this.pctChange(currentPeriod.totalExpenses, previousPeriod.totalExpenses),
          netIncome: this.pctChange(currentPeriod.netIncome, previousPeriod.netIncome),
        },
      } : {}),
      generatedAt: timestamp.toISOString(),
    };
  }

  private async computePnl(companyId: string, fromDate?: string, toDate?: string) {
    const where: any = { companyId, deletedAt: null };
    if (fromDate || toDate) {
      where.entryDate = {};
      if (fromDate) where.entryDate.gte = new Date(fromDate);
      if (toDate) where.entryDate.lte = new Date(toDate);
    }

    const entries = await this.prisma.journalEntry.findMany({
      where,
      include: { account: { select: { id: true, code: true, name: true, type: true } } },
    });

    const incomeMap = new Map<string, { code: string; name: string; amount: number }>();
    const expenseMap = new Map<string, { code: string; name: string; amount: number }>();

    for (const entry of entries) {
      const key = entry.account.code;
      if (entry.account.type === 'INCOME') {
        const current = incomeMap.get(key) || { code: entry.account.code, name: entry.account.name, amount: 0 };
        current.amount += entry.direction === 'CREDIT' ? entry.amount : -entry.amount;
        incomeMap.set(key, current);
      } else if (entry.account.type === 'EXPENSE') {
        const current = expenseMap.get(key) || { code: entry.account.code, name: entry.account.name, amount: 0 };
        current.amount += entry.direction === 'DEBIT' ? entry.amount : -entry.amount;
        expenseMap.set(key, current);
      }
    }

    const income = Array.from(incomeMap.values()).filter((a) => a.amount !== 0);
    const expenses = Array.from(expenseMap.values()).filter((a) => a.amount !== 0);
    const totalIncome = income.reduce((sum, a) => sum + a.amount, 0);
    const totalExpenses = expenses.reduce((sum, a) => sum + a.amount, 0);
    const netIncome = totalIncome - totalExpenses;
    return { income, expenses, totalIncome, totalExpenses, netIncome };
  }

  async getBalanceSheet(companyId: string, asOf?: string, now?: Date, compareWithPrevious?: boolean) {
    const timestamp = now || new Date();
    const currentPeriod = await this.computeBalanceSheet(companyId, asOf);

    let previousPeriod = null;
    if (compareWithPrevious && asOf) {
      const prevAsOf = this.offsetDate(asOf, true);
      previousPeriod = await this.computeBalanceSheet(companyId, prevAsOf);
    }

    return {
      asOf: asOf || timestamp.toISOString(),
      ...currentPeriod,
      ...(compareWithPrevious && previousPeriod ? {
        previousPeriod: { asOf: this.offsetDate(asOf, true), ...previousPeriod },
        changes: {
          totalAssets: this.pctChange(currentPeriod.totalAssets, previousPeriod.totalAssets),
          totalLiabilities: this.pctChange(currentPeriod.totalLiabilities, previousPeriod.totalLiabilities),
          totalEquity: this.pctChange(currentPeriod.totalEquity, previousPeriod.totalEquity),
        },
      } : {}),
      generatedAt: timestamp.toISOString(),
    };
  }

  private async computeBalanceSheet(companyId: string, asOf?: string) {
    const where: any = { companyId, deletedAt: null };
    if (asOf) where.entryDate = { lte: new Date(asOf) };

    const entries = await this.prisma.journalEntry.findMany({
      where,
      include: { account: { select: { id: true, code: true, name: true, type: true } } },
    });

    const assetMap = new Map<string, { code: string; name: string; balance: number }>();
    const liabilityMap = new Map<string, { code: string; name: string; balance: number }>();
    const equityMap = new Map<string, { code: string; name: string; balance: number }>();

    for (const entry of entries) {
      const key = entry.account.code;
      if (entry.account.type === 'ASSET') {
        const current = assetMap.get(key) || { code: entry.account.code, name: entry.account.name, balance: 0 };
        current.balance += entry.direction === 'DEBIT' ? entry.amount : -entry.amount;
        assetMap.set(key, current);
      } else if (entry.account.type === 'LIABILITY') {
        const current = liabilityMap.get(key) || { code: entry.account.code, name: entry.account.name, balance: 0 };
        current.balance += entry.direction === 'CREDIT' ? entry.amount : -entry.amount;
        liabilityMap.set(key, current);
      } else if (entry.account.type === 'EQUITY') {
        const current = equityMap.get(key) || { code: entry.account.code, name: entry.account.name, balance: 0 };
        current.balance += entry.direction === 'CREDIT' ? entry.amount : -entry.amount;
        equityMap.set(key, current);
      }
    }

    const assets = Array.from(assetMap.values()).filter((a) => a.balance !== 0);
    const liabilities = Array.from(liabilityMap.values()).filter((a) => a.balance !== 0);
    const equity = Array.from(equityMap.values()).filter((a) => a.balance !== 0);
    const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
    const totalLiabilities = liabilities.reduce((sum, a) => sum + a.balance, 0);
    const totalEquity = equity.reduce((sum, a) => sum + a.balance, 0);

    return { assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity };
  }

  async getTrialBalance(companyId: string, asOf?: string, now?: Date, compareWithPrevious?: boolean) {
    const timestamp = now || new Date();
    const where: any = { companyId, deletedAt: null };
    if (asOf) where.entryDate = { lte: new Date(asOf) };

    const entries = await this.prisma.journalEntry.findMany({
      where,
      include: { account: { select: { id: true, code: true, name: true, type: true } } },
    });

    const balanceMap = new Map<string, { code: string; name: string; type: string; debit: number; credit: number }>();

    for (const entry of entries) {
      const key = entry.accountId;
      const current = balanceMap.get(key) || {
        code: entry.account.code, name: entry.account.name, type: entry.account.type, debit: 0, credit: 0,
      };
      if (entry.direction === 'DEBIT') current.debit += entry.amount;
      else current.credit += entry.amount;
      balanceMap.set(key, current);
    }

    const accounts = Array.from(balanceMap.values());
    const totalDebits = accounts.reduce((sum, a) => sum + a.debit, 0);
    const totalCredits = accounts.reduce((sum, a) => sum + a.credit, 0);

    return {
      accounts, totalDebits, totalCredits,
      balanced: Math.abs(totalDebits - totalCredits) < 0.01,
      asOf: asOf || timestamp.toISOString(),
      generatedAt: timestamp.toISOString(),
    };
  }

  async getCashFlow(companyId: string, fromDate?: string, toDate?: string, now?: Date, compareWithPrevious?: boolean) {
    const timestamp = now || new Date();
    const currentPeriod = await this.computeCashFlow(companyId, fromDate, toDate);

    let previousPeriod = null;
    if (compareWithPrevious) {
      const prevFrom = this.offsetPeriod(fromDate, toDate, true);
      const prevTo = fromDate;
      previousPeriod = await this.computeCashFlow(companyId, prevFrom, prevTo);
    }

    return {
      period: { from: fromDate || 'All time', to: toDate || 'All time' },
      ...currentPeriod,
      ...(compareWithPrevious && previousPeriod ? {
        previousPeriod: {
          period: { from: this.offsetPeriod(fromDate, toDate, true), to: fromDate || 'All time' },
          ...previousPeriod,
        },
        changes: {
          netOperating: this.pctChange(currentPeriod.operating.net, previousPeriod.operating.net),
          netInvesting: this.pctChange(currentPeriod.investing.net, previousPeriod.investing.net),
          netFinancing: this.pctChange(currentPeriod.financing.net, previousPeriod.financing.net),
          netCashChange: this.pctChange(currentPeriod.netCashChange, previousPeriod.netCashChange),
        },
      } : {}),
      generatedAt: timestamp.toISOString(),
    };
  }

  private async computeCashFlow(companyId: string, fromDate?: string, toDate?: string) {
    const where: any = { companyId, deletedAt: null };
    if (fromDate || toDate) {
      where.entryDate = {};
      if (fromDate) where.entryDate.gte = new Date(fromDate);
      if (toDate) where.entryDate.lte = new Date(toDate);
    }

    const entries = await this.prisma.journalEntry.findMany({
      where,
      include: { account: { select: { id: true, code: true, name: true, type: true } } },
    });

    const cashAccountCodes = ['1001', '1002', '1003', '1101', '1102', '1103', '1201'];
    let operatingInflow = 0, operatingOutflow = 0;
    let investingInflow = 0, investingOutflow = 0;
    let financingInflow = 0, financingOutflow = 0;

    for (const entry of entries) {
      const isCashAccount = cashAccountCodes.includes(entry.account.code);
      const isIncome = entry.account.type === 'INCOME';
      const isExpense = entry.account.type === 'EXPENSE';

      if (isCashAccount) {
        if (entry.direction === 'DEBIT') operatingInflow += entry.amount;
        else operatingOutflow += entry.amount;
      } else if (isIncome) {
        if (entry.direction === 'CREDIT') operatingInflow += entry.amount;
      } else if (isExpense) {
        if (entry.direction === 'DEBIT') operatingOutflow += entry.amount;
      }
    }

    const netOperating = operatingInflow - operatingOutflow;
    const netInvesting = investingInflow - investingOutflow;
    const netFinancing = financingInflow - financingOutflow;
    const netCashChange = netOperating + netInvesting + netFinancing;

    return {
      operating: { inflows: operatingInflow, outflows: operatingOutflow, net: netOperating },
      investing: { inflows: investingInflow, outflows: investingOutflow, net: netInvesting },
      financing: { inflows: financingInflow, outflows: financingOutflow, net: netFinancing },
      netCashChange,
    };
  }

  async getAuditTrail(companyId: string, options?: { limit?: number; offset?: number; entityType?: string }, now?: Date) {
    const timestamp = now || new Date();
    const take = options?.limit || 50;
    const skip = options?.offset || 0;
    const where: any = { companyId };
    if (options?.entityType) where.entityType = options.entityType;

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where, orderBy: { createdAt: 'desc' }, take, skip,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, limit: take, offset: skip, generatedAt: timestamp.toISOString() };
  }

  private pctChange(current: number, previous: number): { amount: number; percentage: number | null } {
    const amount = current - previous;
    const percentage = previous !== 0 ? Math.round((amount / previous) * 10000) / 100 : null;
    return { amount, percentage };
  }

  private offsetPeriod(fromDate?: string, toDate?: string, isStart?: boolean): string | undefined {
    if (!fromDate) return undefined;
    const from = new Date(fromDate);
    const to = toDate ? new Date(toDate) : new Date();
    const diffMs = to.getTime() - from.getTime();
    const prevFrom = new Date(from.getTime() - diffMs);
    return isStart ? prevFrom.toISOString().split('T')[0] : fromDate;
  }

  private offsetDate(asOf: string, isStart?: boolean): string | undefined {
    if (!asOf) return undefined;
    const date = new Date(asOf);
    // Offset by the same number of days back
    const prev = new Date(date.getTime() - (date.getTime() - new Date(0).getTime()));
    return prev.toISOString().split('T')[0];
  }
}
