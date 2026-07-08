import { Worker, Job } from 'bullmq';
import { Logger } from '@nestjs/common';
const pdfParse = require('pdf-parse');

const logger = new Logger('StatementUploadWorker');

interface UploadJobData {
  uploadId: string;
  tenantId: string;
  userId: string;
  filePath: string;
  fileType: string;
  userSelectedInstitution?: string;
}

/**
 * Worker that processes statement uploads asynchronously.
 *
 * Flow:
 * 1. Read file from filesystem
 * 2. Extract raw text (PDF via pdf-parse, CSV via text)
 * 3. Detect institution via ParserRegistry
 * 4. Parse transactions
 * 5. Update StatementUpload record with parsed data
 * 6. Enqueue classification jobs
 *
 * This worker is NOT registered as a NestJS provider directly.
 * It is instantiated in the StatementsModule's onModuleInit hook.
 */
export function createStatementUploadWorker(
  prismaService: any,
  parserRegistry: any,
  fileStorageService: any,
  classificationQueue: any,
) {
  const worker = new Worker<UploadJobData>(
    'statement-upload',
    async (job: Job<UploadJobData>) => {
      const { uploadId, tenantId, filePath, fileType, userSelectedInstitution } = job.data;
      logger.log(`Processing upload ${uploadId} (${fileType})`);

      try {
        // Update status to PARSING
        await prismaService.statementUpload.update({
          where: { id: uploadId },
          data: { status: 'PARSING' },
        });

        // Read file
        const buffer = await fileStorageService.readFile(filePath);

        // Extract raw text
        let rawText: string;
        if (fileType === 'PDF' || filePath.endsWith('.pdf')) {
          const pdfData = await pdfParse(new Uint8Array(buffer));
          rawText = pdfData.text;
        } else {
          // CSV or TXT
          rawText = buffer.toString('utf-8');
        }

        // Detect institution
        let institution: string;
        let parser: any;

        if (userSelectedInstitution) {
          institution = userSelectedInstitution;
          parser = parserRegistry.get(institution);
          if (!parser) {
            throw new Error(`No parser found for selected institution: ${institution}`);
          }
        } else {
          parser = parserRegistry.detect(rawText);
          if (!parser) {
            // Unknown format
            await prismaService.statementUpload.update({
              where: { id: uploadId },
              data: {
                status: 'FAILED',
                institution: 'OTHER',
                errorMessage: 'Unknown statement format. Please select institution manually.',
              },
            });
            return { status: 'FAILED', reason: 'Unknown format' };
          }
          institution = parser.institution;
        }

        // Extract metadata
        const metadata = parser.extractMetadata(rawText);

        // Parse transactions
        const transactions = parser.parse(rawText);

        if (transactions.length === 0) {
          await prismaService.statementUpload.update({
            where: { id: uploadId },
            data: {
              status: 'FAILED',
              institution,
              errorMessage: 'No transactions found in the statement.',
            },
          });
          return { status: 'FAILED', reason: 'No transactions' };
        }

        // Calculate totals
        const totalMoneyIn = transactions.reduce((sum: number, tx: any) => sum + (tx.moneyIn || 0), 0);
        const totalMoneyOut = transactions.reduce((sum: number, tx: any) => sum + (tx.moneyOut || 0), 0);

        // Derive period from transactions if not extracted
        const periodStart = metadata.periodStart || transactions[0]?.date || null;
        const periodEnd = metadata.periodEnd || transactions[transactions.length - 1]?.date || null;

        // Update the upload record with parsed data
        await prismaService.statementUpload.update({
          where: { id: uploadId },
          data: {
            status: 'PARSED',
            institution: parser.institution,
            detectedBy: userSelectedInstitution ? 'USER_SELECTED' : 'AUTO',
            statementPeriodStart: periodStart ? new Date(periodStart) : null,
            statementPeriodEnd: periodEnd ? new Date(periodEnd) : null,
            accountNumber: metadata.accountNumber,
            openingBalance: metadata.openingBalance,
            totalMoneyIn,
            totalMoneyOut,
            transactionCount: transactions.length,
            parsedData: transactions,
            processedAt: new Date(),
          },
        });

        // Enqueue classification jobs (in batches of 50)
        const batchSize = 50;
        for (let i = 0; i < transactions.length; i += batchSize) {
          const batch = transactions.slice(i, i + batchSize);
          await classificationQueue.add('classify-batch', {
            tenantId,
            uploadId,
            institution: parser.institution,
            transactions: batch,
            batchIndex: Math.floor(i / batchSize),
            totalBatches: Math.ceil(transactions.length / batchSize),
          });
        }

        logger.log(`Upload ${uploadId}: parsed ${transactions.length} transactions from ${institution}`);
        return {
          status: 'PARSED',
          institution: parser.institution,
          transactionCount: transactions.length,
        };
      } catch (error: any) {
        logger.error(`Upload ${uploadId} failed: ${error.message}`);

        // Update status to FAILED
        await prismaService.statementUpload.update({
          where: { id: uploadId },
          data: {
            status: 'FAILED',
            errorMessage: error.message || 'Unknown error during parsing',
          },
        });

        throw error; // Let BullMQ handle retry
      }
    },
    {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        maxRetriesPerRequest: null,
      },
      concurrency: 5,
    },
  );

  worker.on('failed', (job: any, error: Error) => {
    logger.error(`Job ${job?.id} failed after ${job?.attemptsMade} attempts: ${error.message}`);
  });

  worker.on('completed', (job: any) => {
    logger.log(`Job ${job?.id} completed successfully`);
  });

  return worker;
}
