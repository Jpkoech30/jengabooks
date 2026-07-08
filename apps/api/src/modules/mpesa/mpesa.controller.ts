import { Controller, Post, Get, Patch, Delete, Body, Param, Query, Req, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MpesaService } from './mpesa.service';
import { PdfParserService } from './pdf-parser.service';
import { DarajaService } from './daraja.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('mpesa')
@UseGuards(JwtAuthGuard)
export class MpesaController {
  constructor(
    private readonly mpesaService: MpesaService,
    private readonly pdfParserService: PdfParserService,
    private readonly darajaService: DarajaService,
  ) {}

  @Post('import')
  uploadCsv(@Req() req: any, @Body() body: { csvData: string }) {
    return this.mpesaService.uploadCsv(req.user.companyId, req.user.userId, body.csvData);
  }

  @Post('import/pdf')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPdf(@Req() req: any, @UploadedFile() file: any) {
    if (!file) throw new BadRequestException('PDF file is required');
    const isPdf = file.mimetype === 'application/pdf' || file.originalname?.endsWith('.pdf');
    if (!isPdf) throw new BadRequestException('Only PDF files are accepted');

    const { transactions, bankType } = await this.pdfParserService.extractTransactions(file.buffer);
    if (transactions.length === 0) throw new BadRequestException('No transactions found in PDF');

    return this.mpesaService.bulkCreate(req.user.companyId, req.user.userId, transactions, bankType);
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

  @Patch('transactions/:id/categorize')
  categorizeTransaction(
    @Param('id') id: string,
    @Body() body: { accountId: string },
  ) {
    return this.mpesaService.mapToAccount(id, body.accountId);
  }

  @Post('transactions/batch-categorize')
  batchCategorize(
    @Body() body: { ids: string[]; accountId: string },
  ) {
    return this.mpesaService.batchCategorize(body.ids, body.accountId);
  }

  @Delete()
  deleteAllTransactions(@Req() req: any) {
    return this.mpesaService.deleteAllTransactions(req.user.companyId);
  }

  @Post(':transactionId/map')
  mapToAccount(
    @Param('transactionId') transactionId: string,
    @Body() body: { accountId: string },
  ) {
    return this.mpesaService.mapToAccount(transactionId, body.accountId);
  }

  @Delete('transactions')
  deleteTransactions(
    @Req() req: any,
    @Query('receiptNo') receiptNo?: string,
    @Body() body?: { receiptNos?: string[] },
  ) {
    const receiptNos = receiptNo ? [receiptNo] : (body?.receiptNos || []);
    return this.mpesaService.deleteTransactions(req.user.companyId, receiptNos);
  }

  @Delete('transactions/all')
  deleteAll(@Req() req: any) {
    return this.mpesaService.deleteAllTransactions(req.user.companyId);
  }

  // ─── Daraja API Endpoints ───────────────────────────────────────────────

  /**
   * Query the status of a specific M-Pesa transaction from Daraja API.
   */
  @Post('daraja/status/:transactionId')
  async queryDarajaStatus(
    @Param('transactionId') transactionId: string,
  ) {
    return this.mpesaService.pullTransactionStatus(transactionId);
  }

  /**
   * Sync transaction statuses from Daraja API for a batch of receipt numbers.
   */
  @Post('daraja/sync')
  async syncFromDaraja(
    @Req() req: any,
    @Body() body: { receiptNos: string[] },
  ) {
    if (!body.receiptNos || body.receiptNos.length === 0) {
      throw new BadRequestException('receiptNos array is required');
    }
    return this.mpesaService.syncFromDaraja(req.user.companyId, body.receiptNos);
  }

  /**
   * Check if Daraja API is configured.
   */
  @Get('daraja/config')
  checkDarajaConfig() {
    return {
      configured: this.darajaService.isConfigured,
      environment: process.env.MPESA_ENVIRONMENT || 'sandbox',
    };
  }
}
