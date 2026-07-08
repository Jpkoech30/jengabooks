import { Queue } from 'bullmq';
import { Logger } from '@nestjs/common';

const logger = new Logger('StatementUploadQueue');

let _statementUploadQueue: Queue | null = null;
let _statementClassificationQueue: Queue | null = null;

function createQueue(name: string): Queue {
  return new Queue(name, {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      maxRetriesPerRequest: null,
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  });
}

/**
 * Get the statement upload queue. Lazily creates it on first access.
 * Returns null if Redis is unavailable (app works without queue).
 */
export function getStatementUploadQueue(): Queue | null {
  if (!_statementUploadQueue) {
    try {
      _statementUploadQueue = createQueue('statement-upload');
    } catch (error: any) {
      logger.warn(`Failed to create statement-upload queue: ${error.message}. Background processing disabled.`);
      return null;
    }
  }
  return _statementUploadQueue;
}

/**
 * Get the statement classification queue. Lazily creates it on first access.
 */
export function getStatementClassificationQueue(): Queue | null {
  if (!_statementClassificationQueue) {
    try {
      _statementClassificationQueue = createQueue('statement-classification');
    } catch (error: any) {
      logger.warn(`Failed to create statement-classification queue: ${error.message}. Background processing disabled.`);
      return null;
    }
  }
  return _statementClassificationQueue;
}
