import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { FiscalPeriodsService } from './fiscal-periods.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('ledger')
@UseGuards(JwtAuthGuard)
export class LedgerController {
  constructor(
    private readonly ledgerService: LedgerService,
    private readonly fiscalPeriodsService: FiscalPeriodsService,
  ) {}

  // ─── Chart of Accounts ─────────────────────────────────────────────────

  @Get('accounts')
  findAccounts(@Req() req: any) {
    return this.ledgerService.findAccounts(req.user.companyId);
  }

  @Get('accounts/:id')
  findAccount(@Param('id') id: string) {
    return this.ledgerService.findAccount(id);
  }

  @Post('accounts')
  createAccount(@Req() req: any, @Body() body: { code: string; name: string; type: string; parentId?: string }) {
    return this.ledgerService.createAccount(req.user.companyId, body);
  }

  @Patch('accounts/:id')
  updateAccount(@Param('id') id: string, @Body() body: { name?: string; isActive?: boolean }) {
    return this.ledgerService.updateAccount(id, body);
  }

  @Delete('accounts/:id')
  deleteAccount(@Param('id') id: string) {
    return this.ledgerService.deleteAccount(id);
  }

  // ─── Journal Entries ──────────────────────────────────────────────────

  @Get('entries')
  findJournalEntries(
    @Req() req: any,
    @Query('accountId') accountId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ledgerService.findJournalEntries(req.user.companyId, {
      accountId,
      fromDate,
      toDate,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('entries/:id')
  findJournalEntry(@Param('id') id: string) {
    return this.ledgerService.findJournalEntry(id);
  }

  @Post('entries')
  createJournalEntry(@Req() req: any, @Body() body: {
    accountId: string;
    description: string;
    amount: number;
    direction: string;
    reference?: string;
    entryDate: string;
  }) {
    return this.ledgerService.createJournalEntry(req.user.companyId, {
      ...body,
      postedById: req.user.userId,
    });
  }

  @Delete('entries/:id')
  deleteJournalEntry(@Param('id') id: string) {
    return this.ledgerService.deleteJournalEntry(id);
  }

  // ─── Income / Expense Quick Entries ────────────────────────────────────

  @Post('transactions/income')
  createIncome(
    @Req() req: any,
    @Body() body: {
      accountId: string;
      description: string;
      amount: number;
      reference?: string;
      entryDate: string;
    },
  ) {
    return this.ledgerService.createIncome(req.user.companyId, {
      ...body,
      postedById: req.user.userId,
    });
  }

  @Post('transactions/expense')
  createExpense(
    @Req() req: any,
    @Body() body: {
      accountId: string;
      description: string;
      amount: number;
      reference?: string;
      entryDate: string;
    },
  ) {
    return this.ledgerService.createExpense(req.user.companyId, {
      ...body,
      postedById: req.user.userId,
    });
  }

  // ─── Trial Balance ────────────────────────────────────────────────────

  @Get('trial-balance')
  getTrialBalance(@Req() req: any, @Query('asOf') asOf?: string) {
    return this.ledgerService.getTrialBalance(req.user.companyId, asOf);
  }

  // ─── Fiscal Periods ───────────────────────────────────────────────────

  @Get('periods')
  findPeriods(@Req() req: any) {
    return this.fiscalPeriodsService.findAll(req.user.companyId);
  }

  @Get('periods/:id')
  findPeriod(@Param('id') id: string) {
    return this.fiscalPeriodsService.findOne(id);
  }

  @Post('periods')
  createPeriod(@Req() req: any, @Body() body: { name: string; startDate: string; endDate: string }) {
    return this.fiscalPeriodsService.create(req.user.companyId, body);
  }

  @Post('periods/:id/close')
  closePeriod(@Req() req: any, @Param('id') id: string) {
    return this.fiscalPeriodsService.closePeriod(id, req.user.userId);
  }

  @Post('periods/:id/reopen')
  reopenPeriod(@Param('id') id: string) {
    return this.fiscalPeriodsService.reopenPeriod(id);
  }
}
