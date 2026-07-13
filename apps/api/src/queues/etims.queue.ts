import { Worker, Job, Queue } from 'bullmq';
import { Injectable, OnModuleInit, OnModuleDestroy, Inject, Logger } from '@nestjs/common';
import { ETIMS_RETRY_QUEUE } from './queue.module';
import { PrismaService } from '../prisma/prisma.service';

// ─── Retry delay schedule ────────────────────────────────────────────────
// Retry 1: 30s, Retry 2: 2min, Retry 3: 10min, Retry 4: 1hr, Retry 5: 6hr
export const RETRY_DELAYS = [30_000, 120_000, 600_000, 3_600_000, 21_600_000];

// Poll every 5 minutes, max 24 hours = 288 polls
export const POLL_DELAY_MS = 300_000;
export const MAX_POLL_COUNT = 288;

// ─── Job name prefixes ───────────────────────────────────────────────────
export const RETRY_JOB_PREFIX = 'retry';
export const POLL_JOB_PREFIX = 'poll';

export interface EtimsRetryJobData {
  invoiceId: string;
  companyId?: string;
  userId?: string;
  attempt: number;       // 0-based; 0 = initial failure, 1..5 = retry attempt
  type: 'retry' | 'poll';
  pollCount?: number;
}

/**
 * Generates a deterministic BullMQ jobId for deduplication.
 * Retry jobs use: "retry:{invoiceId}"
 * Poll jobs use:  "poll:{invoiceId}"
 */
export function retryJobId(invoiceId: string): string {
  return `${RETRY_JOB_PREFIX}:${invoiceId}`;
}

export function pollJobId(invoiceId: string): string {
  return `${POLL_JOB_PREFIX}:${invoiceId}`;
}

/**
 * Determines the delay for the next retry based on current attempt.
 * attempt 0 → RETRY_DELAYS[0] (30s)
 * attempt 1 → RETRY_DELAYS[1] (2min)
 * etc.
 */
export function getRetryDelay(attempt: number): number {
  if (attempt < 0) return RETRY_DELAYS[0];
  if (attempt >= RETRY_DELAYS.length) return RETRY_DELAYS[RETRY_DELAYS.length - 1];
  return RETRY_DELAYS[attempt];
}

// ─── Redis connection config (shared) ─────────────────────────────────────
function redisConnection() {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: null,
  };
}

// ─── EtimsRetryWorker ─────────────────────────────────────────────────────
// Processes retry jobs from the 'etims-retry' queue.
// Registered as a NestJS provider in EtimsModule.

@Injectable()
export class EtimsRetryWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EtimsRetryWorker.name);
  private worker: Worker | null = null;

  constructor(
    @Inject(ETIMS_RETRY_QUEUE) private readonly retryQueue: Queue,
    private readonly prisma: PrismaService,
  ) { }

  async onModuleInit(): Promise<void> {
    this.worker = new Worker<EtimsRetryJobData>(
      'etims-retry',
      async (job: Job<EtimsRetryJobData>) => this.processJob(job),
      { connection: redisConnection() },
    );

    this.worker.on('completed', (job: Job<EtimsRetryJobData>) => {
      this.logger.log(`Retry job ${job.id} (${job.data.type}) completed for invoice ${job.data.invoiceId}`);
    });

    this.worker.on('failed', (job: Job<EtimsRetryJobData> | undefined, err: Error) => {
      this.logger.error(`Retry job ${job?.id} failed: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  // ─── Job Dispatcher ─────────────────────────────────────────────────────

  private async processJob(job: Job<EtimsRetryJobData>): Promise<void> {
    const { invoiceId, type } = job.data;

    // Idempotency guard — skip if submission already resolved
    const submission = await this.prisma.eTIMSSubmission.findUnique({
      where: { invoiceId },
      include: { invoice: true },
    });

    if (!submission) {
      this.logger.warn(`Submission for invoice ${invoiceId} not found — skipping`);
      return;
    }

    if (submission.status === 'ACCEPTED' || submission.status === 'FAILED_PERMANENT') {
      this.logger.log(`Submission ${invoiceId} already ${submission.status} — skipping job`);
      return;
    }

    if (type === 'retry') {
      await this.handleRetry(job.data, submission);
    } else if (type === 'poll') {
      await this.handlePoll(job.data, submission);
    }
  }

  // ─── Retry Handler ──────────────────────────────────────────────────────

  private async handleRetry(
    data: EtimsRetryJobData,
    submission: any,
  ): Promise<void> {
    const { invoiceId, companyId, userId, attempt } = data;
    const invoice = submission.invoice;
    const xmlPayload = this.buildXmlPayload(invoice);
    const kraApiUrl = process.env.KRA_API_URL;
    const kraClientId = process.env.KRA_CLIENT_ID;

    let kraResponse: any;
    let submissionStatus: string;
    let serialNumber: string;

    try {
      if (kraApiUrl) {
        // ─── Real KRA API call ──────────────────────────────────────────
        const axios = require('axios');
        const response = await axios.post(
          `${kraApiUrl}/submissions`,
          xmlPayload,
          {
            headers: {
              'Content-Type': 'application/xml',
              'X-Client-ID': kraClientId || '',
              'X-API-Version': '1.0',
            },
            timeout: 15000,
          },
        );
        kraResponse = response.data;
        submissionStatus = response.data.status || 'PENDING';
        serialNumber = response.data.serialNumber || this.fallbackSerial(invoiceId, attempt);
        this.logger.log(`Retry attempt ${attempt + 1} succeeded for invoice ${invoiceId}: ${submissionStatus}`);
      } else {
        // ─── Dev mock ───────────────────────────────────────────────────
        // In dev mode, simulate eventual acceptance after 2 retries
        const mockAccepted = attempt >= 2;
        submissionStatus = mockAccepted ? 'ACCEPTED' : 'PENDING';
        serialNumber = `ETIMS-${invoice.invoiceNumber}-RETRY-${attempt + 1}`;
        kraResponse = { status: submissionStatus, serialNumber };
      }

      // Upsert submission record (use DB now() — omit submittedAt to let @default(now()) fire)
      const updated = await this.prisma.eTIMSSubmission.upsert({
        where: { invoiceId },
        update: {
          xmlPayload,
          kraResponse: JSON.stringify(kraResponse),
          status: submissionStatus,
          serialNumber,
          retryCount: attempt + 1,
          lastError: submissionStatus === 'FAILED' ? JSON.stringify(kraResponse) : null,
        },
        create: {
          invoiceId,
          serialNumber,
          xmlPayload,
          kraResponse: JSON.stringify(kraResponse),
          status: submissionStatus,
          retryCount: attempt + 1,
        },
      });

      // Handle outcome
      if (submissionStatus === 'ACCEPTED') {
        this.logger.log(`Invoice ${invoiceId} ACCEPTED on retry attempt ${attempt + 1}`);
        // Clear pending retry & poll jobs for this submission
        await this.clearPendingJobs(invoiceId);

        // Award XP if user/company present
        if (userId && companyId) {
          try {
            const { GamificationService } = await import('../modules/gamification/gamification.service');
            const gamification = new GamificationService(null as any, null as any);
            // We only import for side-effect; the actual awarding happens via direct Prisma call
            // to avoid full DI complexity in the worker
            await this.prisma.xPRecord.create({
              data: {
                userId,
                companyId,
                points: 30,
                reason: 'Submitted an eTIMS invoice (retry)',
              },
            }).catch(() => { });
          } catch { /* non-blocking */ }
        }
      } else if (submissionStatus === 'PENDING') {
        // Schedule a poll job
        await this.schedulePoll(invoiceId, companyId, userId, 0);
      } else if (submissionStatus === 'FAILED' || submissionStatus.startsWith('FAILED')) {
        // Schedule next retry or mark as FAILED_PERMANENT
        const nextAttempt = attempt + 1;
        if (nextAttempt >= 5) {
          this.logger.warn(`Invoice ${invoiceId} — max retries reached, marking FAILED_PERMANENT`);
          await this.prisma.eTIMSSubmission.update({
            where: { invoiceId },
            data: {
              status: 'FAILED_PERMANENT',
              lastError: JSON.stringify(kraResponse),
            },
          });
        } else {
          await this.scheduleRetry(invoiceId, companyId, userId, nextAttempt);
        }
      }
    } catch (apiError: any) {
      this.logger.error(`Retry attempt ${attempt + 1} failed for invoice ${invoiceId}: ${apiError.message}`);

      // Distinguish timeout vs rejection for logging
      const errorType = apiError.code === 'ECONNABORTED' ? 'TIMEOUT' : 'REJECTION';
      await this.prisma.eTIMSSubmission.update({
        where: { invoiceId },
        data: {
          status: 'FAILED',
          lastError: JSON.stringify({ error: apiError.message, type: errorType }),
        },
      });

      const nextAttempt = attempt + 1;
      if (nextAttempt >= 5) {
        this.logger.warn(`Invoice ${invoiceId} — max retries reached, marking FAILED_PERMANENT`);
        await this.prisma.eTIMSSubmission.update({
          where: { invoiceId },
          data: { status: 'FAILED_PERMANENT' },
        });
      } else {
        await this.scheduleRetry(invoiceId, companyId, userId, nextAttempt);
      }
    }
  }

  // ─── Poll Handler ───────────────────────────────────────────────────────

  private async handlePoll(
    data: EtimsRetryJobData,
    submission: any,
  ): Promise<void> {
    const { invoiceId, companyId, userId, pollCount = 0 } = data;

    if (pollCount >= MAX_POLL_COUNT) {
      this.logger.warn(`Invoice ${invoiceId} — max polls (${MAX_POLL_COUNT}) reached without resolution`);
      await this.prisma.eTIMSSubmission.update({
        where: { invoiceId },
        data: { status: 'FAILED_PERMANENT' },
      });
      return;
    }

    // Query KRA for current status of this submission
    const kraApiUrl = process.env.KRA_API_URL;
    let currentStatus = 'PENDING';

    try {
      if (kraApiUrl) {
        const axios = require('axios');
        const response = await axios.get(
          `${kraApiUrl}/submissions/${submission.serialNumber}`,
          {
            headers: { 'X-Client-ID': process.env.KRA_CLIENT_ID || '' },
            timeout: 15000,
          },
        );
        currentStatus = response.data.status || 'PENDING';
      } else {
        // Dev mock — accept after 3 polls
        currentStatus = pollCount >= 3 ? 'ACCEPTED' : 'PENDING';
      }
    } catch (err: any) {
      this.logger.error(`Poll failed for invoice ${invoiceId}: ${err.message}`);
      // Re-schedule poll even on error
      await this.schedulePoll(invoiceId, companyId, userId, pollCount + 1);
      return;
    }

    if (currentStatus === 'ACCEPTED') {
      this.logger.log(`Invoice ${invoiceId} ACCEPTED on poll ${pollCount + 1}`);
      await this.prisma.eTIMSSubmission.update({
        where: { invoiceId },
        data: {
          status: 'ACCEPTED',
          kraResponse: JSON.stringify({ status: 'ACCEPTED', serialNumber: submission.serialNumber }),
        },
      });
      await this.clearPendingJobs(invoiceId);
    } else {
      // Still PENDING — schedule next poll
      await this.schedulePoll(invoiceId, companyId, userId, pollCount + 1);
    }
  }

  // ─── Scheduling Helpers ─────────────────────────────────────────────────

  /**
   * Add a retry job to the queue with the appropriate delay.
   * Uses deterministic jobId so duplicate submissions don't create duplicates.
   */
  async scheduleRetry(
    invoiceId: string,
    companyId?: string,
    userId?: string,
    attempt: number = 0,
  ): Promise<void> {
    const delay = getRetryDelay(attempt);
    this.logger.log(`Scheduling retry ${attempt + 1} for invoice ${invoiceId} in ${delay}ms`);

    await this.retryQueue.add(
      `${RETRY_JOB_PREFIX}:${invoiceId}`,
      { invoiceId, companyId, userId, attempt, type: 'retry' } as EtimsRetryJobData,
      {
        jobId: retryJobId(invoiceId),
        delay,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }

  /**
   * Add a poll job to the queue with 5-minute delay.
   */
  async schedulePoll(
    invoiceId: string,
    companyId?: string,
    userId?: string,
    pollCount: number = 0,
  ): Promise<void> {
    this.logger.log(`Scheduling poll ${pollCount + 1} for invoice ${invoiceId}`);

    await this.retryQueue.add(
      `${POLL_JOB_PREFIX}:${invoiceId}`,
      { invoiceId, companyId, userId, attempt: 0, type: 'poll', pollCount } as EtimsRetryJobData,
      {
        jobId: pollJobId(invoiceId),
        delay: POLL_DELAY_MS,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }

  /**
   * Remove all pending retry and poll jobs for a given invoice.
   * Called when a submission is ACCEPTED.
   */
  async clearPendingJobs(invoiceId: string): Promise<void> {
    try {
      const retryId = retryJobId(invoiceId);
      const pollId = pollJobId(invoiceId);

      await Promise.allSettled([
        this.retryQueue.remove(retryId),
        this.retryQueue.remove(pollId),
      ]);

      this.logger.log(`Cleared pending retry/poll jobs for invoice ${invoiceId}`);
    } catch (err: any) {
      this.logger.warn(`Failed to clear pending jobs for invoice ${invoiceId}: ${err.message}`);
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

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

  private fallbackSerial(invoiceId: string, attempt: number): string {
    // Use a deterministic fallback — no Date.now()
    return `KRA-RETRY-${invoiceId.substring(0, 8)}-${attempt + 1}`;
  }
}
