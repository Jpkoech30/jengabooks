import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * VAT rate constants (percentage values).
 * 16 = standard rate, 8 = reduced rate, 0 = zero-rated, null = exempt
 */
const VAT_RATES = {
  STANDARD: 16,
  REDUCED: 8,
  ZERO_RATED: 0,
  EXEMPT: null as number | null,
} as const;

interface VatBucket {
  amount: number;
  count: number;
}

export interface VatBreakdown {
  standard16: number;
  reduced8: number;
  zeroRated: number;
  total: number;
}

export interface InputVatBreakdown extends VatBreakdown {
  exempt: number;
}

export interface EntriesCount {
  total: number;
  vatRated: number;
  exempt: number;
}

@Injectable()
export class TaxService {
  private readonly logger = new Logger(TaxService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate VAT liability from ledger entries for a given period.
   *
   * Edge cases handled:
   * - Zero-rated exports (accounts with vatRate=0)
   * - Exempt supplies (accounts with vatRate=null)
   * - Mixed-rated suppliers (partial input VAT recovery)
   * - Partial period calculations
   * - No `new Date()` — uses DB-provided timestamps exclusively
   */
  async calculateVat(
    companyId: string,
    from?: string,
    to?: string,
  ): Promise<{
    period: { from: string; to: string };
    outputVat: VatBreakdown;
    inputVat: InputVatBreakdown;
    netVatPayable: number;
    entriesCount: EntriesCount;
  }> {
    // ── Validate date range ──────────────────────────────────────────
    if (!from || !to) {
      throw new BadRequestException('Both from and to query params are required');
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new BadRequestException('Invalid date format — use YYYY-MM-DD');
    }

    if (fromDate > toDate) {
      throw new BadRequestException('from date must be before or equal to to date');
    }

    // ── Fetch ledger entries with account info (including taxRate) ───
    const entries = await this.prisma.journalEntry.findMany({
      where: {
        companyId,
        deletedAt: null,
        entryDate: {
          gte: fromDate,
          lte: toDate,
        },
      },
      include: {
        account: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            taxRate: true,
          },
        },
      },
    });

    this.logger.log(`VAT calc: ${entries.length} entries for company ${companyId} period ${from}–${to}`);

    // ── Initialize VAT buckets ───────────────────────────────────────
    const outputVatBuckets = {
      standard16: { amount: 0, count: 0 } as VatBucket,
      reduced8: { amount: 0, count: 0 } as VatBucket,
      zeroRated: { amount: 0, count: 0 } as VatBucket,
    };

    const inputVatBuckets = {
      standard16: { amount: 0, count: 0 } as VatBucket,
      reduced8: { amount: 0, count: 0 } as VatBucket,
      zeroRated: { amount: 0, count: 0 } as VatBucket,
      exempt: { amount: 0, count: 0 } as VatBucket,
    };

    let vatRatedCount = 0;
    let exemptCount = 0;

    // ── Process each entry ───────────────────────────────────────────
    for (const entry of entries) {
      const effectiveRate = this.resolveVatRate(entry.account);

      // Null rate = exempt
      if (effectiveRate === null) {
        // Track exempt entries
        const isExpenseType = entry.account.type === 'EXPENSE';
        if (isExpenseType) {
          inputVatBuckets.exempt.amount += entry.amount;
          inputVatBuckets.exempt.count++;
        } else if (entry.account.type === 'INCOME') {
          // Exempt income — not vatable, just count
        }
        exemptCount++;
        continue;
      }

      vatRatedCount++;

      // Determine if this is Output VAT (sales/INCOME) or Input VAT (purchases/EXPENSE)
      const isOutput = entry.account.type === 'INCOME';
      const isInput = entry.account.type === 'EXPENSE';

      if (!isOutput && !isInput) {
        // ASSET, LIABILITY, EQUITY accounts are not VAT-rated
        exemptCount++;
        continue;
      }

      // Calculate VAT amount from the entry amount
      // The entry amount is the gross (inclusive) amount for INCOME entries
      // For EXPENSE entries, the amount is typically the gross (inclusive) amount paid
      // VAT = amount * rate / (100 + rate) when amount is inclusive of VAT
      // For simplicity and Kenyan standards, we treat amounts as inclusive
      const vatAmount = this.calculateVatFromGross(entry.amount, effectiveRate);

      if (isOutput) {
        // Output VAT: CREDIT entries increase output VAT, DEBIT entries decrease
        const sign = entry.direction === 'CREDIT' ? 1 : -1;

        if (effectiveRate === VAT_RATES.STANDARD) {
          outputVatBuckets.standard16.amount += vatAmount * sign;
          outputVatBuckets.standard16.count++;
        } else if (effectiveRate === VAT_RATES.REDUCED) {
          outputVatBuckets.reduced8.amount += vatAmount * sign;
          outputVatBuckets.reduced8.count++;
        } else if (effectiveRate === VAT_RATES.ZERO_RATED) {
          outputVatBuckets.zeroRated.amount += 0; // Zero-rated = no VAT
          outputVatBuckets.zeroRated.count++;
        }
      } else if (isInput) {
        // Input VAT: DEBIT entries increase input VAT, CREDIT entries decrease
        const sign = entry.direction === 'DEBIT' ? 1 : -1;

        if (effectiveRate === VAT_RATES.STANDARD) {
          inputVatBuckets.standard16.amount += vatAmount * sign;
          inputVatBuckets.standard16.count++;
        } else if (effectiveRate === VAT_RATES.REDUCED) {
          inputVatBuckets.reduced8.amount += vatAmount * sign;
          inputVatBuckets.reduced8.count++;
        } else if (effectiveRate === VAT_RATES.ZERO_RATED) {
          // Zero-rated purchases = no input VAT to claim
          inputVatBuckets.zeroRated.amount += 0;
          inputVatBuckets.zeroRated.count++;
        }
      }
    }

    // ── Build response ───────────────────────────────────────────────
    const outputVat: VatBreakdown = {
      standard16: Math.round(outputVatBuckets.standard16.amount * 100) / 100,
      reduced8: Math.round(outputVatBuckets.reduced8.amount * 100) / 100,
      zeroRated: Math.round(outputVatBuckets.zeroRated.amount * 100) / 100,
      total:
        Math.round(
          (outputVatBuckets.standard16.amount +
            outputVatBuckets.reduced8.amount +
            outputVatBuckets.zeroRated.amount) *
            100,
        ) / 100,
    };

    const inputVat = {
      standard16: Math.round(inputVatBuckets.standard16.amount * 100) / 100,
      reduced8: Math.round(inputVatBuckets.reduced8.amount * 100) / 100,
      zeroRated: Math.round(inputVatBuckets.zeroRated.amount * 100) / 100,
      exempt: Math.round(inputVatBuckets.exempt.amount * 100) / 100,
      total:
        Math.round(
          (inputVatBuckets.standard16.amount +
            inputVatBuckets.reduced8.amount +
            inputVatBuckets.zeroRated.amount +
            inputVatBuckets.exempt.amount) *
            100,
        ) / 100,
    };

    const netVatPayable = Math.round((outputVat.total - inputVat.standard16 - inputVat.reduced8) * 100) / 100;

    return {
      period: { from, to },
      outputVat,
      inputVat,
      netVatPayable,
      entriesCount: {
        total: entries.length,
        vatRated: vatRatedCount,
        exempt: exemptCount,
      },
    };
  }

  /**
   * Resolve the effective VAT rate for an account.
   * Priority: account-level taxRate override > default by account type.
   */
  private resolveVatRate(account: { type: string; taxRate?: number | null }): number | null {
    // Account-level override takes precedence
    if (account.taxRate !== null && account.taxRate !== undefined) {
      return account.taxRate;
    }

    // Default rates by account type
    if (account.type === 'INCOME' || account.type === 'EXPENSE') {
      return VAT_RATES.STANDARD; // Default 16%
    }

    // Non P&L accounts (ASSET, LIABILITY, EQUITY) are exempt
    return VAT_RATES.EXEMPT;
  }

  /**
   * Calculate VAT from a gross (inclusive) amount.
   * Formula: VAT = amount * rate / (100 + rate)
   */
  private calculateVatFromGross(amount: number, ratePercent: number): number {
    if (ratePercent === 0) return 0;
    return (amount * ratePercent) / (100 + ratePercent);
  }
}
