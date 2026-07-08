import { Global, Module, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

const logger = new Logger('QueueModule');

/**
 * Creates a BullMQ queue with graceful degradation when Redis is unavailable.
 * Returns null if the queue cannot be created (app works without queues).
 */
function createQueue(name: string, attempts = 3): Queue | null {
  try {
    return new Queue(name, {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        maxRetriesPerRequest: null,
      },
      defaultJobOptions: {
        attempts,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });
  } catch (error: any) {
    logger.warn(`Failed to create queue "${name}": ${error.message}. Background processing disabled.`);
    return null;
  }
}

// Injection tokens for typed access
export const AI_QUEUE = 'AI_QUEUE';
export const ETIMS_QUEUE = 'ETIMS_QUEUE';
export const SYNC_QUEUE = 'SYNC_QUEUE';
export const STATEMENT_UPLOAD_QUEUE = 'STATEMENT_UPLOAD_QUEUE';
export const STATEMENT_CLASSIFICATION_QUEUE = 'STATEMENT_CLASSIFICATION_QUEUE';

@Global()
@Module({
  providers: [
    {
      provide: AI_QUEUE,
      useFactory: () => createQueue('ai-processing', 5),
    },
    {
      provide: ETIMS_QUEUE,
      useFactory: () => createQueue('etims-submission', 5),
    },
    {
      provide: SYNC_QUEUE,
      useFactory: () => createQueue('offline-sync', 5),
    },
    {
      provide: STATEMENT_UPLOAD_QUEUE,
      useFactory: () => createQueue('statement-upload', 3),
    },
    {
      provide: STATEMENT_CLASSIFICATION_QUEUE,
      useFactory: () => createQueue('statement-classification', 3),
    },
  ],
  exports: [
    AI_QUEUE,
    ETIMS_QUEUE,
    SYNC_QUEUE,
    STATEMENT_UPLOAD_QUEUE,
    STATEMENT_CLASSIFICATION_QUEUE,
  ],
})
export class QueueModule {}
