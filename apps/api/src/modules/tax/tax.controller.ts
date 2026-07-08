import { Controller, Get, Query, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { TaxService } from './tax.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VatQueryDto } from './dto/vat-query.dto';

@Controller('tax')
@UseGuards(JwtAuthGuard)
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  /**
   * GET /api/v1/tax/vat?from=2026-01-01&to=2026-01-31
   * Calculate VAT liability from ledger entries for a given period.
   */
  @Get('vat')
  calculateVat(
    @Req() req: any,
    @Query(new ValidationPipe({ transform: true })) query: VatQueryDto,
  ) {
    return this.taxService.calculateVat(req.user.companyId, query.from, query.to);
  }
}
