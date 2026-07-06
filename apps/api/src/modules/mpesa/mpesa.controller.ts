import { Controller, Post, Get, Body, Param, Query, Req, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MpesaService } from './mpesa.service';
import { PdfParserService } from './pdf-parser.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('mpesa')
@UseGuards(JwtAuthGuard)
export class MpesaController {
  constructor(
    private readonly mpesaService: MpesaService,
    private readonly pdfParserService: PdfParserService,
  ) {}

  @Post('import')
  uploadCsv(@Req() req: any, @Body() body: { csvData: string }) {
    return this.mpesaService.uploadCsv(req.user.companyId, req.user.userId, body.csvData);
  }

  @Post('import/pdf')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPdf(@Req() req: any, @UploadedFile() file: any) {
    if (!file) throw new BadRequestException('PDF file is required');
    if (file.mimetype !== 'application/pdf') throw new BadRequestException('Only PDF files are accepted');

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

  @Post(':transactionId/map')
  mapToAccount(
    @Param('transactionId') transactionId: string,
    @Body() body: { accountId: string },
  ) {
    return this.mpesaService.mapToAccount(transactionId, body.accountId);
  }
}
