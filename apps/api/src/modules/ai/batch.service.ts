import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { FraudDetectionAgent } from './agents/fraud-detection.agent';
import { HitlService } from '../hitl/hitl.service';

@Injectable()
export class BatchService {
  private readonly logger = new Logger(BatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fraudDetectionAgent: FraudDetectionAgent,
    private readonly hitlService: HitlService,
  ) {}

  /**
   * Nightly fraud detection — runs at 2:00 AM every day.
   * For each active company, scans recent transactions and flags suspicious ones.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async runNightlyFraudDetection(): Promise<{ processed: number; flagged: number; errors: number }> {
    this.logger.log('Starting nightly fraud detection batch...');

    let processed = 0;
    let flagged = 0;
    let errors = 0;

    try {
      const companies = await this.prisma.company.findMany({
        where: { isActive: true },
        select: { id: true },
      });

      if (companies.length === 0) {
        this.logger.log('No active companies found. Skipping.');
        return { processed: 0, flagged: 0, errors: 0 };
      }

      for (const company of companies) {
        try {
          const result = await this.processCompany(company.id);
          processed++;
          flagged += result.flagged;
          errors += result.errors;
        } catch (companyError: any) {
          this.logger.error(`Failed to process company ${company.id}: ${companyError.message}`);
          errors++;
        }
      }
    } catch (error: any) {
      this.logger.error(`Nightly fraud detection failed: ${error.message}`);
      errors++;
    }

    this.logger.log(`Nightly fraud detection complete. Processed: ${processed}, Flagged: ${flagged}, Errors: ${errors}`);
    return { processed, flagged, errors };
  }

  private async processCompany(companyId: string): Promise<{ flagged: number; errors: number }> {
    let flagged = 0;
    let errors = 0;

    // Scan recent journal entries (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentEntries = await this.prisma.journalEntry.findMany({
      where: {
        companyId,
        createdAt: { gte: oneDayAgo },
      },
      take: 100,
    });

    if (recentEntries.length === 0) {
      return { flagged: 0, errors: 0 };
    }

    for (const entry of recentEntries) {
      try {
        const result = await this.fraudDetectionAgent.analyze({
          companyId,
          transactionId: entry.id,
          amount: entry.amount,
          pattern: entry.description || '',
        });

        if (result.fraudScore >= 0.7 || result.recommendedAction === 'FLAG' || result.recommendedAction === 'BLOCK') {
          flagged++;
          await this.hitlService.create(companyId, {
            category: 'RECONCILIATION_CONFLICT',
            description: `Fraud alert: KES ${entry.amount} — ${entry.description || 'No description'}`,
            rawData: JSON.stringify({ ...entry, fraudAnalysis: result }),
            linkedEntityId: entry.id,
            linkedEntityType: 'JOURNAL_ENTRY',
            confidence: 1 - result.fraudScore,
          }).catch(() => {});
        }
      } catch (txError: any) {
        this.logger.warn(`Fraud detection failed for entry ${entry.id}: ${txError.message}`);
        errors++;
      }
    }

    return { flagged, errors };
  }
}
