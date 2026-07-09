import { Injectable, NotFoundException, BadRequestException, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { GamificationService } from '../gamification/gamification.service';
import { EtimsRetryWorker } from '../../queues/etims.queue';
import Redis from 'ioredis';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PinValidationResult {
  kraPin: string;
  valid: boolean;
  supplierName: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'NOT_FOUND' | 'UNREACHABLE';
  registeredDate: string | null;
  etimsCompliant: boolean;
  validationErrors: string[];
}

export interface ValidatePinInput {
  kraPin: string;
  supplierName?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const KRA_PIN_REGEX = /^[A-Z0-9]{11}$/;
const KRA_PIN_CACHE_TTL_SEC = 86_400; // 24 hours
const CACHE_KEY_PREFIX = 'kra:pin:';

@Injectable()
export class EtimsService {
  private readonly logger = new Logger(EtimsService.name);
  private readonly kraApiUrl: string | undefined;
  private readonly kraClientId: string | undefined;
  private redis: Redis | null = null;
  private redisAvailable = true;

  constructor(
    private readonly prisma: PrismaService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly gamificationService: GamificationService,
    private readonly retryWorker: EtimsRetryWorker,
  ) {
    this.kraApiUrl = process.env.KRA_API_URL;
    this.kraClientId = process.env.KRA_CLIENT_ID;
    if (this.kraApiUrl) {
      this.logger.log(`eTIMS configured with KRA API: ${this.kraApiUrl}`);
    } else {
      this.logger.warn('KRA_API_URL not set — eTIMS submissions will use mock responses');
    }
  }

  // ─── Redis Client (lazy) ───────────────────────────────────────────────────

  private getRedis(): Redis | null {
    if (this.redis) return this.redis;
    if (!this.redisAvailable) return null;
    // Skip Redis in test environment or when no REDIS_HOST is explicitly configured
    if (process.env.NODE_ENV === 'test' || !process.env.REDIS_HOST) return null;

    try {
      this.redis = new Redis({
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        maxRetriesPerRequest: 2,
        lazyConnect: true,
        retryStrategy: (times) => {
          if (times > 2) {
            this.logger.warn('Redis connection retries exhausted for PIN cache. Disabling cache.');
            this.redisAvailable = false;
            return null;
          }
          return Math.min(times * 100, 500);
        },
      });

      this.redis.on('error', (err) => {
        this.logger.warn(`Redis error (PIN cache): ${err.message}`);
      });

      return this.redis;
    } catch (err: any) {
      this.logger.warn(`Failed to create Redis client for PIN cache: ${err.message}`);
      this.redisAvailable = false;
      return null;
    }
  }

  // ─── PIN Validation ────────────────────────────────────────────────────────

  /**
   * Validates a supplier KRA PIN against the KRA database.
   *
   * Flow:
   * 1. Normalize PIN to uppercase
   * 2. Validate format locally — return validation error without API call if invalid
   * 3. Check Redis cache (key: `kra:pin:{kraPin}`)
   * 4. If cached and not stale, return cached result
   * 5. In production: call KRA PIN validation API
   * 6. In dev/sandbox: return mock response
   * 7. Cache result in Redis with 24h TTL
   *
   * Edge cases:
   * - Invalid format → local validation error, no API call
   * - KRA API timeout → return cached data if available, else UNREACHABLE status
   * - Mixed case → normalized to uppercase
   * - Repeated same PIN → cache hit
   */
  async validatePin(input: ValidatePinInput): Promise<PinValidationResult> {
    const normalizedPin = input.kraPin.toUpperCase().trim();
    const errors: string[] = [];

    // ── Step 1: Local format validation ────────────────────────────────────
    if (!KRA_PIN_REGEX.test(normalizedPin)) {
      errors.push('KRA PIN must be exactly 11 uppercase alphanumeric characters');
    }
    if (!/[0-9]/.test(normalizedPin)) {
      errors.push('KRA PIN must contain at least one digit');
    }

    if (errors.length > 0) {
      return {
        kraPin: normalizedPin,
        valid: false,
        supplierName: input.supplierName || null,
        status: 'NOT_FOUND',
        registeredDate: null,
        etimsCompliant: false,
        validationErrors: errors,
      };
    }

    // ── Step 2: Check Redis cache ──────────────────────────────────────────
    const cacheKey = `${CACHE_KEY_PREFIX}${normalizedPin}`;
    const redis = this.getRedis();

    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          const parsed: PinValidationResult = JSON.parse(cached);
          this.logger.log(`PIN cache hit for ${normalizedPin}`);
          return parsed;
        }
      } catch (err: any) {
        this.logger.warn(`Failed to read PIN cache: ${err.message}`);
      }
    }

    // ── Step 3: Call KRA or Mock ───────────────────────────────────────────
    let result: PinValidationResult;

    if (this.kraApiUrl) {
      result = await this.callKraPinValidation(normalizedPin, input.supplierName);
    } else {
      result = this.mockPinValidation(normalizedPin, input.supplierName);
    }

    // ── Step 4: Cache result ───────────────────────────────────────────────
    if (redis) {
      try {
        await redis.setex(cacheKey, KRA_PIN_CACHE_TTL_SEC, JSON.stringify(result));
      } catch (err: any) {
        this.logger.warn(`Failed to cache PIN result: ${err.message}`);
      }
    }

    return result;
  }

  /**
   * Calls the real KRA PIN validation API via the circuit breaker.
   * Falls back to UNREACHABLE status on timeout/error.
   */
  private async callKraPinValidation(
    kraPin: string,
    supplierName?: string,
  ): Promise<PinValidationResult> {
    try {
      const response = await this.circuitBreaker.call(async () => {
        const axios = require('axios');
        const apiResponse = await axios.post(
          `${this.kraApiUrl}/pin-validation`,
          { kraPin, supplierName },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Client-ID': this.kraClientId || '',
              'X-API-Version': '1.0',
            },
            timeout: 10_000,
          },
        );

        const data = apiResponse.data;
        return {
          kraPin,
          valid: data.status === 'ACTIVE',
          supplierName: data.supplierName || supplierName || null,
          status: data.status || 'NOT_FOUND',
          registeredDate: data.registeredDate || null,
          etimsCompliant: data.etimsCompliant ?? (data.status === 'ACTIVE'),
          validationErrors: data.errors || [],
        } satisfies PinValidationResult;
      });

      return response;
    } catch (err: any) {
      this.logger.error(`KRA PIN validation API error: ${err.message}`);

      // ── Attempt cache fallback (re-read in case of race condition) ──────
      const redis = this.getRedis();
      if (redis) {
        try {
          const cacheKey = `${CACHE_KEY_PREFIX}${kraPin}`;
          const stale = await redis.get(cacheKey);
          if (stale) {
            this.logger.log(`Returning stale cached PIN data for ${kraPin} after API error`);
            return JSON.parse(stale);
          }
        } catch { /* ignore */ }
      }

      return {
        kraPin,
        valid: false,
        supplierName: supplierName || null,
        status: 'UNREACHABLE',
        registeredDate: null,
        etimsCompliant: false,
        validationErrors: ['KRA validation service is currently unreachable. Please try again later.'],
      };
    }
  }

  /**
   * Generates a deterministic mock PIN validation response for dev/sandbox.
   *
   * - PIN starting with 'P' (individual) → ACTIVE, compliant
   * - PIN starting with 'X' → NOT_FOUND
   * - Any other → INACTIVE
   */
  private mockPinValidation(kraPin: string, supplierName?: string): PinValidationResult {
    const firstChar = kraPin.charAt(0);

    if (firstChar === 'X') {
      return {
        kraPin,
        valid: false,
        supplierName: supplierName || null,
        status: 'NOT_FOUND',
        registeredDate: null,
        etimsCompliant: false,
        validationErrors: ['KRA PIN not found in database. Please verify the PIN.'],
      };
    }

    if (firstChar === 'P') {
      // Active, compliant supplier
      return {
        kraPin,
        valid: true,
        supplierName: (supplierName || 'UNKNOWN SUPPLIER').toUpperCase(),
        status: 'ACTIVE',
        registeredDate: '2020-03-15',
        etimsCompliant: true,
        validationErrors: [],
      };
    }

    // INACTIVE but found
    return {
      kraPin,
        valid: false,
        supplierName: (supplierName || 'UNKNOWN SUPPLIER').toUpperCase(),
        status: 'INACTIVE',
        registeredDate: '2019-06-01',
        etimsCompliant: false,
        validationErrors: ['KRA PIN is registered but INACTIVE. Supplier must renew KRA registration.'],
    };
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

    if (existing && existing.status === 'FAILED_PERMANENT') {
      throw new BadRequestException('Invoice submission permanently failed — manual intervention required');
    }

    // Build KRA XML payload
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
          serialNumber = response.data.serialNumber || `KRA-${invoiceId.substring(0, 8)}`;
          this.logger.log(`eTIMS submission: ${submissionStatus} — ${serialNumber}`);
        } catch (apiError: any) {
          const errorType = apiError.code === 'ECONNABORTED' ? 'TIMEOUT' : 'REJECTION';
          this.logger.error(`KRA API error (${errorType}): ${apiError.message}`);

          kraResponse = { status: 'FAILED', error: apiError.message, type: errorType, serialNumber: '' };
          submissionStatus = 'FAILED';
          serialNumber = `FAILED-${invoiceId.substring(0, 8)}`;
        }
      } else {
        // ─── Placeholder Mock (Development) ─────────────────────────────
        const serialCount = await this.prisma.eTIMSSubmission.count();
        kraResponse = { status: 'PENDING', serialNumber: `ETIMS-${invoice.invoiceNumber}-${String(serialCount + 1).padStart(5, '0')}` };
        submissionStatus = kraResponse.status;
        serialNumber = kraResponse.serialNumber;
      }

      // Upsert submission — omit submittedAt to let DB @default(now()) fire (TIME-TRAVEL rule)
      const retryCount = existing?.retryCount ?? 0;
      return this.prisma.eTIMSSubmission.upsert({
        where: { invoiceId },
        update: {
          xmlPayload,
          kraResponse: JSON.stringify(kraResponse),
          status: submissionStatus,
          serialNumber,
          retryCount: submissionStatus === 'FAILED' ? { increment: 1 } : retryCount,
          lastError: submissionStatus === 'FAILED' ? JSON.stringify(kraResponse) : null,
        },
        create: {
          invoiceId,
          serialNumber,
          xmlPayload,
          kraResponse: JSON.stringify(kraResponse),
          status: submissionStatus,
        },
      });
    });

    // ─── Post-submission actions ────────────────────────────────────────

    if (submission.status === 'ACCEPTED') {
      // Clear any pending retry/poll jobs for this invoice
      await this.retryWorker.clearPendingJobs(invoiceId);

      // Award XP
      if (userId && companyId) {
        await this.gamificationService.awardXp(
          userId,
          companyId,
          30,
          'Submitted an eTIMS invoice',
        ).catch(() => {});
      }
    } else if (submission.status === 'FAILED') {
      // Schedule retry job with BullMQ delay (TIME-TRAVEL: no Date.now())
      await this.retryWorker.scheduleRetry(invoiceId, companyId, userId, 0);
    } else if (submission.status === 'PENDING') {
      // Schedule first poll
      await this.retryWorker.schedulePoll(invoiceId, companyId, userId, 0);
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

    if (submission.status === 'FAILED_PERMANENT') {
      throw new BadRequestException('Submission permanently failed — manual intervention required');
    }

    // When manually retrying, pass the current retryCount as attempt
    return this.submitToKra(submission.invoiceId, userId, companyId);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  private buildXmlPayload(invoice: any): string {
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
