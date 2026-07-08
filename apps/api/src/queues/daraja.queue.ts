import { Worker, Job, Queue } from 'bullmq';
import { Injectable, OnModuleInit, OnModuleDestroy, Inject, Logger } from '@nestjs/common';
import { DARAJA_QUEUE } from './queue.module';
import { DarajaService } from '../modules/mpesa/daraja.service';
import * as crypto from 'crypto';

// ─── Retry delay schedule ────────────────────────────────────────────────
// Retry 1: 30s, Retry 2: 2min, Retry 3: 10min, Retry 4: 1hr, Retry 5: 6hr
export const DARAJA_RETRY_DELAYS = [30_000, 120_000, 600_000, 3_600_000, 21_600_000];

export function darajaRetryDelay(attempt: number): number {
  if (attempt < 0) return DARAJA_RETRY_DELAYS[0];
  if (attempt >= DARAJA_RETRY_DELAYS.length) return DARAJA_RETRY_DELAYS[DARAJA_RETRY_DELAYS.length - 1];
  return DARAJA_RETRY_DELAYS[attempt];
}

// ─── Job types ───────────────────────────────────────────────────────────

export interface DarajaJobData {
  type: 'query-transaction-status' | 'sync-batch';
  receiptNo?: string;
  receiptNos?: string[];
  companyId?: string;
  attempt: number;
}

// ─── Redis connection ────────────────────────────────────────────────────

function redisConnection() {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: null,
  };
}

// ─── Worker ──────────────────────────────────────────────────────────────

@Injectable()
export class DarajaRetryWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DarajaRetryWorker.name);
  private worker: Worker | null = null;

  constructor(
    @Inject(DARAJA_QUEUE) private readonly darajaQueue: Queue,
    private readonly darajaService: DarajaService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.worker = new Worker<DarajaJobData>(
      'daraja-api',
      async (job: Job<DarajaJobData>) => this.processJob(job),
      { connection: redisConnection() },
    );

    this.worker.on('completed', (job: Job<DarajaJobData>) => {
      this.logger.log(`Daraja job ${job.id} (${job.data.type}) completed`);
    });

    this.worker.on('failed', (job: Job<DarajaJobData> | undefined, err: Error) => {
      this.logger.error(`Daraja job ${job?.id} failed: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async processJob(job: Job<DarajaJobData>): Promise<void> {
    const { type, attempt = 0 } = job.data;

    switch (type) {
      case 'query-transaction-status':
        await this.handleQueryStatus(job.data);
        break;
      case 'sync-batch':
        await this.handleSyncBatch(job.data);
        break;
      default:
        this.logger.warn(`Unknown Daraja job type: ${type}`);
    }
  }

  /**
   * Retries a transaction status query via DarajaService.
   * On failure, re-queues with exponential backoff up to max retries.
   */
  private async handleQueryStatus(data: DarajaJobData): Promise<void> {
    const { receiptNo, companyId, attempt = 0 } = data;
    if (!receiptNo) {
      this.logger.warn('Daraja query-status job missing receiptNo');
      return;
    }

    this.logger.log(`Retrying Daraja status query for ${receiptNo} (attempt ${attempt + 1})`);

    if (attempt >= 5) {
      this.logger.warn(`Daraja status query for ${receiptNo} — max retries reached`);
      return;
    }

    try {
      const result = await this.darajaService.queryTransactionStatus(receiptNo);
      this.logger.log(`Daraja status query succeeded for ${receiptNo}: ${result.ResponseDescription}`);
    } catch (err: any) {
      this.logger.warn(`Daraja status query failed for ${receiptNo}: ${err.message}`);
      await this.scheduleRetry('query-transaction-status', { receiptNo, companyId }, attempt + 1);
    }
  }

  /**
   * Retries a batch sync operation — loops through receiptNos and queries each.
   */
  private async handleSyncBatch(data: DarajaJobData): Promise<void> {
    const { receiptNos, companyId, attempt = 0 } = data;
    if (!receiptNos || receiptNos.length === 0) {
      this.logger.warn('Daraja sync-batch job missing receiptNos');
      return;
    }

    this.logger.log(`Retrying Daraja batch sync for ${receiptNos.length} receipts (attempt ${attempt + 1})`);

    if (attempt >= 5) {
      this.logger.warn(`Daraja batch sync — max retries reached for ${receiptNos.length} receipts`);
      return;
    }

    const failed: string[] = [];

    for (const receiptNo of receiptNos) {
      try {
        const result = await this.darajaService.queryTransactionStatus(receiptNo);
        this.logger.log(`Daraja batch sync succeeded for ${receiptNo}: ${result.ResponseDescription}`);
      } catch (err: any) {
        this.logger.warn(`Daraja batch sync failed for ${receiptNo}: ${err.message}`);
        failed.push(receiptNo);
      }
    }

    // Re-queue any failed receipts
    if (failed.length > 0) {
      await this.scheduleRetry('sync-batch', { receiptNos: failed, companyId }, attempt + 1);
    }
  }

  // ─── Scheduling Helpers ─────────────────────────────────────────────────

  /**
   * Schedules a retry for a failed Daraja API call with exponential backoff.
   */
  async scheduleRetry(
    type: DarajaJobData['type'],
    data: Partial<DarajaJobData>,
    attempt: number = 0,
  ): Promise<void> {
    const delay = darajaRetryDelay(attempt);
    const jobId = `daraja-${type}-${data.receiptNo || crypto.randomUUID()}-${attempt}`;

    this.logger.log(`Scheduling Daraja retry ${type} attempt ${attempt + 1} in ${delay}ms`);

    await this.darajaQueue.add(
      jobId,
      { ...data, type, attempt } as DarajaJobData,
      {
        jobId,
        delay,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }
}
