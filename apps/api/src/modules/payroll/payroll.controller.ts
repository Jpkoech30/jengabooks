import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CalculatePayeDto } from './dto/calculate-paye.dto';
import { CreatePayrollRunDto } from './dto/create-payroll-run.dto';
import { PaginatedQueryDto } from './dto/paginated-query.dto';
import { PrepareFilingDto } from './dto/prepare-filing.dto';
import { SubmitFilingDto } from './dto/submit-filing.dto';

@Controller('payroll')
@UseGuards(JwtAuthGuard)
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  /**
   * POST /api/v1/payroll/calculate
   * Calculate PAYE and all statutory deductions for a single employee.
   */
  @Post('calculate')
  calculatePaye(
    @Req() req: any,
    @Body(new ValidationPipe({ transform: true })) body: CalculatePayeDto,
  ) {
    return this.payrollService.calculatePaye({
      employeeId: body.employeeId,
      grossPay: body.grossPay,
      benefitsTotal: body.benefitsTotal ?? 0,
      payrollRunId: body.payrollRunId,
    });
  }

  /**
   * POST /api/v1/payroll/runs
   * Create a new payroll run for a company.
   */
  @Post('runs')
  createPayrollRun(
    @Req() req: any,
    @Body(new ValidationPipe({ transform: true })) body: CreatePayrollRunDto,
  ) {
    return this.payrollService.createPayrollRun({
      companyId: body.companyId,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
    });
  }

  /**
   * GET /api/v1/payroll/runs
   * List payroll runs with pagination and optional companyId filter.
   */
  @Get('runs')
  listPayrollRuns(
    @Req() req: any,
    @Query(new ValidationPipe({ transform: true })) query: PaginatedQueryDto,
  ) {
    return this.payrollService.listPayrollRuns({
      companyId: query.companyId,
      page: query.page,
      limit: query.limit,
    });
  }

  /**
   * GET /api/v1/payroll/runs/:id
   * Get a single payroll run with all its entries.
   */
  @Get('runs/:id')
  getPayrollRun(@Param('id') id: string) {
    return this.payrollService.getPayrollRun(id);
  }

  /**
   * POST /api/v1/payroll/runs/:id/lock
   * Lock a payroll run to prevent further edits.
   */
  @Post('runs/:id/lock')
  lockPayrollRun(@Param('id') id: string) {
    return this.payrollService.lockPayrollRun(id);
  }

  /**
   * POST /api/v1/payroll/runs/:id/calculate-all
   * Calculate all employees in a payroll run.
   */
  @Post('runs/:id/calculate-all')
  calculateAllInRun(@Param('id') id: string) {
    return this.payrollService.calculateAllInRun(id);
  }

  /**
   * POST /api/v1/payroll/runs/:id/prepare-filing
   * Generate filing data (CSV) for a statutory return.
   */
  @Post('runs/:id/prepare-filing')
  prepareFiling(
    @Param('id') id: string,
    @Body(new ValidationPipe({ transform: true })) body: PrepareFilingDto,
  ) {
    return this.payrollService.prepareFiling(id, body.type);
  }

  /**
   * POST /api/v1/payroll/runs/:id/submit-filing
   * Submit a statutory filing to KRA (mock).
   */
  @Post('runs/:id/submit-filing')
  submitFiling(
    @Param('id') id: string,
    @Body(new ValidationPipe({ transform: true })) body: SubmitFilingDto,
  ) {
    return this.payrollService.submitFiling(id, body.type);
  }
}
