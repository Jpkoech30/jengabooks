import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { CashflowService, ForecastResponse, InsightsResponse } from './cashflow.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('cashflow')
@UseGuards(JwtAuthGuard)
export class CashflowController {
  constructor(private readonly cashflowService: CashflowService) {}

  /**
   * GET /api/v1/cashflow/forecast?companyId=xxx&months=3
   * Returns 3-month cash flow forecast with alerts.
   */
  @Get('forecast')
  getForecast(
    @Req() req: any,
    @Query('companyId') companyId?: string,
    @Query('months') months?: string,
  ): Promise<ForecastResponse> {
    const resolvedCompanyId = companyId || req.user.companyId;
    const resolvedMonths = months ? parseInt(months, 10) : 3;
    return this.cashflowService.getForecast(resolvedCompanyId, resolvedMonths);
  }

  /**
   * GET /api/v1/cashflow/insights?companyId=xxx
   * Returns cash flow pattern insights.
   */
  @Get('insights')
  getInsights(
    @Req() req: any,
    @Query('companyId') companyId?: string,
  ): Promise<InsightsResponse> {
    const resolvedCompanyId = companyId || req.user.companyId;
    return this.cashflowService.getInsights(resolvedCompanyId);
  }
}
