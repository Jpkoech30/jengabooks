import { Worker, Job } from 'bullmq';
import { Logger } from '@nestjs/common';

const logger = new Logger('StatementClassificationWorker');

interface ClassificationJobData {
  tenantId: string;
  uploadId: string;
  userId?: string;
  institution: string;
  transactions: any[];
  batchIndex: number;
  totalBatches: number;
}

/**
 * Default classification regex patterns per institution.
 * These map transaction descriptions to Chart of Accounts categories.
 *
 * Confidence scoring:
 *   - 100%: Exact regex match
 *   - 85%:  Strong keyword match
 *   - 70%:  Partial match
 *   - 50%:  Low confidence → send to HITL
 */
const CLASSIFICATION_RULES: Record<string, Array<{
  pattern: RegExp;
  category: string;
  confidence: number;
  direction: 'IN' | 'OUT' | 'IGNORE';
}>> = {
  MPESA: [
    { pattern: /Merchant Payment from/i, category: 'Sales Revenue', confidence: 1.0, direction: 'IN' },
    { pattern: /Pay merchant Charge/i, category: 'Bank Fees', confidence: 1.0, direction: 'OUT' },
    { pattern: /OTC Buy Airtime/i, category: 'Airtime Revenue', confidence: 0.85, direction: 'OUT' },
    { pattern: /OTC Airtime Commission/i, category: 'Commission Revenue', confidence: 1.0, direction: 'IN' },
    { pattern: /Withdraw at Agent/i, category: 'Cash Withdrawal', confidence: 1.0, direction: 'OUT' },
    { pattern: /Payment to Mobile/i, category: 'Supplier Payment', confidence: 0.85, direction: 'OUT' },
    { pattern: /OTC Merchant Airtime Sale/i, category: 'Airtime Revenue', confidence: 0.85, direction: 'IN' },
    { pattern: /Funds Received/i, category: 'Sales Revenue', confidence: 0.7, direction: 'IN' },
  ],
  KCB: [
    { pattern: /Autotronix Ltd/i, category: 'Sales Revenue', confidence: 1.0, direction: 'IN' },
    { pattern: /INHouse CHQ.*deposit/i, category: 'Sales Revenue', confidence: 1.0, direction: 'IN' },
    { pattern: /Mobile Money Tr MM/i, category: 'M-Pesa Float Withdrawal', confidence: 0.85, direction: 'OUT' },
    { pattern: /ATM Cash KCB/i, category: 'Cash Withdrawal', confidence: 1.0, direction: 'OUT' },
    { pattern: /Quick Serve ATM/i, category: 'Cash Withdrawal', confidence: 1.0, direction: 'OUT' },
    { pattern: /ATM Charge/i, category: 'Bank Fees', confidence: 1.0, direction: 'OUT' },
    { pattern: /POS Txm/i, category: 'Suspense Expense', confidence: 0.5, direction: 'OUT' },
    { pattern: /Air Time Purcha/i, category: 'Telephone Expenses', confidence: 0.85, direction: 'OUT' },
    { pattern: /BALANCE B\/FWD/i, category: null as any, confidence: 1.0, direction: 'IGNORE' },
  ],
};

/**
 * Creates and returns a BullMQ Worker for classifying statement transactions.
 * Uses regex patterns to map transactions to Chart of Accounts with confidence scoring.
 */
export function createStatementClassificationWorker(
  prismaService: any,
  hitlService: any,
  gamificationService: any,
) {
  const worker = new Worker<ClassificationJobData>(
    'statement-classification',
    async (job: Job<ClassificationJobData>) => {
      const { tenantId, uploadId, institution, transactions, batchIndex, totalBatches } = job.data;
      logger.log(`Classifying batch ${batchIndex + 1}/${totalBatches} for upload ${uploadId}`);

      const rules = CLASSIFICATION_RULES[institution] || [];
      let classifiedCount = 0;
      let hitlCount = 0;

      for (const tx of transactions) {
        // Find matching rule
        const matchingRule = rules.find(r =>
          r.direction !== 'IGNORE' && r.pattern.test(tx.description || tx.rawDescription || ''),
        );

        if (matchingRule) {
          const description = tx.description || tx.rawDescription || '';

          // High confidence: record classification
          tx.category = matchingRule.category;
          tx.confidence = matchingRule.confidence;
          tx.direction = matchingRule.direction;

          // If confidence >= 90%, auto-create journal entry
          if (matchingRule.confidence >= 0.9 && gamificationService) {
            try {
              // Find the Chart of Accounts entry
              const account = await prismaService.chartOfAccount.findFirst({
                where: {
                  companyId: tenantId,
                  name: { contains: matchingRule.category, mode: 'insensitive' },
                },
              });

              if (account) {
                const direction = matchingRule.direction === 'IN' ? 'CREDIT' : 'DEBIT';
                await prismaService.journalEntry.create({
                  data: {
                    companyId: tenantId,
                    accountId: account.id,
                    description: `Auto: ${matchingRule.category} — ${description}`,
                    amount: tx.moneyIn || tx.moneyOut || 0,
                    direction,
                    entryDate: new Date(tx.date),
                    postedById: job.data.userId || 'system',
                    aiConfidence: matchingRule.confidence,
                    aiReasoning: `Regex matched: ${matchingRule.pattern}`,
                    reference: tx.reference || null,
                  },
                }).catch(() => {
                  // Non-critical: journal entry creation may fail for various reasons
                  logger.warn(`Failed to auto-create journal entry for ${uploadId} tx`);
                });
              }
            } catch {
              // Non-critical
            }
          }

          classifiedCount++;
        } else if (hitlService) {
          // Low confidence or no match → send to HITL
          try {
            await hitlService.create(tenantId, {
              category: 'UNMAPPED_DATA',
              description: `${institution}: KES ${tx.moneyIn || tx.moneyOut || 0} — ${tx.description || 'No description'}`,
              rawData: JSON.stringify(tx),
              linkedEntityId: uploadId,
              linkedEntityType: 'STATEMENT_UPLOAD',
              confidence: 0.5,
            });
            hitlCount++;
          } catch {
            // Non-critical
          }
        }
      }

      logger.log(`Batch ${batchIndex + 1}/${totalBatches}: classified ${classifiedCount}, HITL ${hitlCount}`);
      return { classifiedCount, hitlCount };
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
    logger.error(`Classification job ${job?.id} failed: ${error.message}`);
  });

  return worker;
}
