import { Controller, Get, Post, Patch, Body, Param, UseGuards, Req, ValidationPipe } from '@nestjs/common';
import { EtimsService } from './etims.service';
import { ValidatePinDto } from './dto/validate-pin.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('etims')
@UseGuards(JwtAuthGuard)
export class EtimsController {
  constructor(private readonly etimsService: EtimsService) {}

  // ─── Invoices ──────────────────────────────────────────────────────────

  @Get('invoices')
  findInvoices(@Req() req: any) {
    return this.etimsService.findInvoices(req.user.companyId);
  }

  @Get('invoices/:id')
  findInvoice(@Param('id') id: string) {
    return this.etimsService.findInvoice(id);
  }

  @Post('invoices')
  createInvoice(@Req() req: any, @Body() body: {
    customerName: string;
    customerPin?: string;
    customerEmail?: string;
    lineItems: Array<{ description: string; quantity: number; unitPrice: number }>;
    taxCode?: string;
    dueDate?: string;
    notes?: string;
  }) {
    return this.etimsService.createInvoice(req.user.companyId, body);
  }

  // ─── KRA PIN Validation ────────────────────────────────────────────────

  @Post('validate-pin')
  validatePin(@Body(ValidationPipe) dto: ValidatePinDto) {
    return this.etimsService.validatePin({
      kraPin: dto.kraPin,
      supplierName: dto.supplierName,
    });
  }

  // ─── eTIMS Submissions ─────────────────────────────────────────────────

  @Get('submissions')
  findSubmissions(@Req() req: any) {
    return this.etimsService.findSubmissions(req.user.companyId);
  }

  @Get('submissions/:id')
  findSubmission(@Param('id') id: string) {
    return this.etimsService.findSubmission(id);
  }

  @Post('submissions/:invoiceId/submit')
  submitToKra(@Req() req: any, @Param('invoiceId') invoiceId: string) {
    return this.etimsService.submitToKra(invoiceId, req.user.userId, req.user.companyId);
  }

  @Post('submissions/:id/retry')
  retrySubmission(@Req() req: any, @Param('id') id: string) {
    return this.etimsService.retrySubmission(id, req.user.userId, req.user.companyId);
  }
}
