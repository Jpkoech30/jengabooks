import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

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
}
