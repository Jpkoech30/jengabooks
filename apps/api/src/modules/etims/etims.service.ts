import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { GamificationService } from '../gamification/gamification.service';

@Injectable()
export class EtimsService {
  private readonly logger = new Logger(EtimsService.name);
  private readonly kraApiUrl: string | undefined;
  private readonly kraClientId: string | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly gamificationService: GamificationService,
  ) {
    this.kraApiUrl = process.env.KRA_API_URL;
    this.kraClientId = process.env.KRA_CLIENT_ID;
    if (this.kraApiUrl) {
      this.logger.log(`eTIMS configured with KRA API: ${this.kraApiUrl}`);
    } else {
      this.logger.warn('KRA_API_URL not set — eTIMS submissions will use mock responses');
    }
  }

  // ─── Invoices ──────────────────────────────────────────────────────────

  async findInvoices(companyId: string) {
    return this.prisma.invoice.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      include: { etimsSubmission: true },
    });
  }

  async findInvoice(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { etimsSubmission: true },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with id ${id} not found`);
    }
    return invoice;
  }

  async createInvoice(companyId: string, data: {
    customerName: string;
    customerPin?: string;
    customerEmail?: string;
    lineItems: Array<{ description: string; quantity: number; unitPrice: number }>;
    taxCode?: string;
    dueDate?: string;
    notes?: string;
  }) {
    const subtotal = data.lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const vatRate = data.taxCode === 'E' || data.taxCode === 'Z' ? 0 : 0.16;
    const vat = subtotal * vatRate;
    const total = subtotal + vat;

    // Generate invoice number
    const count = await this.prisma.invoice.count({ where: { companyId } });
    const invoiceNumber = `INV-${companyId.substring(0, 4).toUpperCase()}-${String(count + 1).padStart(5, '0')}`;

    const invoice = await this.prisma.invoice.create({
      data: {
        companyId,
        invoiceNumber,
        customerName: data.customerName,
        customerPin: data.customerPin,
        customerEmail: data.customerEmail,
        lineItems: JSON.stringify(data.lineItems),
        subtotal,
        vat,
        total,
        taxCode: data.taxCode || 'S',
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        notes: data.notes,
      },
    });

    return invoice;
  }

  // ─── eTIMS Submissions ─────────────────────────────────────────────────

  async findSubmissions(companyId: string) {
    return this.prisma.eTIMSSubmission.findMany({
      where: { invoice: { companyId } },
      include: { invoice: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findSubmission(id: string) {
    const submission = await this.prisma.eTIMSSubmission.findUnique({
      where: { id },
      include: { invoice: true },
    });

    if (!submission) {
      throw new NotFoundException(`eTIMS submission with id ${id} not found`);
    }
    return submission;
  }

  async submitToKra(invoiceId: string, userId?: string, companyId?: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with id ${invoiceId} not found`);
    }

    // Check existing submission
    const existing = await this.prisma.eTIMSSubmission.findUnique({
      where: { invoiceId },
    });

    if (existing && existing.status === 'ACCEPTED') {
      throw new BadRequestException('Invoice already submitted and accepted by KRA');
    }

    // Build KRA XML payload (simplified placeholder)
    const xmlPayload = this.buildXmlPayload(invoice);

    // Submit via circuit breaker
    const submission = await this.circuitBreaker.call(async () => {
      let kraResponse: { status: string; serialNumber: string; [key: string]: unknown };
      let submissionStatus: string;
      let serialNumber: string;

      if (this.kraApiUrl) {
        // ─── Real KRA eTIMS API Call ────────────────────────────────────
        try {
          const axios = require('axios');
          const response = await axios.post(
            `${this.kraApiUrl}/submissions`,
            xmlPayload,
            {
              headers: {
                'Content-Type': 'application/xml',
                'X-Client-ID': this.kraClientId || '',
                'X-API-Version': '1.0',
              },
              timeout: 15000,
            },
          );
          kraResponse = response.data;
          submissionStatus = response.data.status || 'PENDING';
          serialNumber = response.data.serialNumber || `KRA-${Date.now()}`;
          this.logger.log(`eTIMS submission successful: ${serialNumber}`);
        } catch (apiError: any) {
          this.logger.error(`KRA API error: ${apiError.message}`, apiError.stack);
          // Fall through to create a failed submission record for retry
          kraResponse = { status: 'FAILED', error: apiError.message, serialNumber: '' };
          submissionStatus = 'FAILED';
          serialNumber = `FAILED-${Date.now()}`;
        }
      } else {
        // ─── Placeholder Mock (Development) ─────────────────────────────
        const serialCount = await this.prisma.eTIMSSubmission.count();
        kraResponse = { status: 'PENDING', serialNumber: `ETIMS-${invoice.invoiceNumber}-${String(serialCount + 1).padStart(5, '0')}` };
        submissionStatus = kraResponse.status;
        serialNumber = kraResponse.serialNumber;
      }

      return this.prisma.eTIMSSubmission.upsert({
        where: { invoiceId },
        update: {
          xmlPayload,
          kraResponse: JSON.stringify(kraResponse),
          status: submissionStatus,
          serialNumber,
          submittedAt: new Date(),
          retryCount: { increment: existing?.retryCount || 0 },
          lastError: submissionStatus === 'FAILED' ? JSON.stringify(kraResponse) : null,
        },
        create: {
          invoiceId,
          serialNumber,
          xmlPayload,
          kraResponse: JSON.stringify(kraResponse),
          status: submissionStatus,
          submittedAt: new Date(),
        },
      });
    });

    // Award XP for successful submission
    if (submission.status === 'ACCEPTED' && userId && companyId) {
      await this.gamificationService.awardXp(
        userId,
        companyId,
        30,
        'Submitted an eTIMS invoice',
      ).catch(() => {});
    }

    return submission;
  }

  async retrySubmission(id: string, userId?: string, companyId?: string) {
    const submission = await this.prisma.eTIMSSubmission.findUnique({
      where: { id },
      include: { invoice: true },
    });

    if (!submission) {
      throw new NotFoundException(`Submission with id ${id} not found`);
    }

    if (submission.status === 'ACCEPTED') {
      throw new BadRequestException('Submission already accepted');
    }

    if (submission.retryCount >= 5) {
      throw new BadRequestException('Max retry attempts reached (5)');
    }

    return this.submitToKra(submission.invoiceId, userId, companyId);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  private buildXmlPayload(invoice: any): string {
    // Simplified XML builder — in production, use a proper XML library
    const items = JSON.parse(invoice.lineItems || '[]');
    const itemXml = items
      .map(
        (item: any) =>
          `<Item><Description>${item.description}</Description><Quantity>${item.quantity}</Quantity><UnitPrice>${item.unitPrice}</UnitPrice></Item>`,
      )
      .join('');

    return `<?xml version="1.0"?><Invoice><InvoiceNumber>${invoice.invoiceNumber}</InvoiceNumber><CustomerName>${invoice.customerName}</CustomerName><CustomerPin>${invoice.customerPin || ''}</CustomerPin><Subtotal>${invoice.subtotal}</Subtotal><VAT>${invoice.vat}</VAT><Total>${invoice.total}</Total><TaxCode>${invoice.taxCode}</TaxCode>${itemXml}</Invoice>`;
  }
}
