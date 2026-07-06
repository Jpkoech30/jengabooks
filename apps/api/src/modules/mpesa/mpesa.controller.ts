import { Controller, Post, Get, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { MpesaService } from './mpesa.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('mpesa')
@UseGuards(JwtAuthGuard)
export class MpesaController {
  constructor(private readonly mpesaService: MpesaService) {}

  @Post('import')
  uploadCsv(@Req() req: any, @Body() body: { csvData: string }) {
    return this.mpesaService.uploadCsv(req.user.companyId, req.user.userId, body.csvData);
  }

  @Get()
  findTransactions(
    @Req() req: any,
    @Query('isReconciled') isReconciled?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const filters: any = {};
    if (isReconciled !== undefined) filters.isReconciled = isReconciled === 'true';
    if (page) filters.page = parseInt(page, 10);
    if (limit) filters.limit = parseInt(limit, 10);
    return this.mpesaService.findTransactions(req.user.companyId, filters);
  }

  @Post(':transactionId/map')
  mapToAccount(
    @Param('transactionId') transactionId: string,
    @Body() body: { accountId: string },
  ) {
    return this.mpesaService.mapToAccount(transactionId, body.accountId);
  }
}
