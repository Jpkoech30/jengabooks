import { Injectable, Logger } from '@nestjs/common';
import { StatementParser, NormalizedTransaction, StatementMetadata } from './statement-parser.interface';

/**
 * KCB Bank PDF Statement Parser
 *
 * Detection:
 *   Checks for "KCB BANK KENYA LTD", "KCB NAIROBI", or "KCB BANK".
 *
 * Metadata:
 *   - Account number: try to extract from "Account Number:" line; null if not found
 *   - Period: derive from first and last transaction dates
 *   - Opening balance: look for "Balance at Period Start" or similar
 *
 * Transaction Parsing:
 *   - Table columns: TXN DATE, DESCRIPTION, VALUE DATE, (blank), MONEY OUT, MONEY IN, LEDGER BALANCE
 *   - CRITICAL: MONEY OUT and MONEY IN columns are often empty.
 *     Amount must be calculated from LEDGER BALANCE differences.
 *   - Algorithm:
 *     1. Parse table rows, extracting TXN DATE, DESCRIPTION, LEDGER BALANCE
 *     2. Track previous balance
 *     3. Difference = currentBalance - previousBalance
 *     4. If difference > 0 -> moneyIn = difference, moneyOut = 0
 *     5. If difference < 0 -> moneyOut = -difference, moneyIn = 0
 *     6. Set calculated = true
 *   - Handle multi-line descriptions (common in KCB statements)
 */
@Injectable()
export class KcbParser implements StatementParser {
  private readonly logger = new Logger(KcbParser.name);

  readonly institution = 'KCB';

  /**
   * Detect KCB statement from raw text.
   */
  detect(rawText: string): boolean {
    const upper = rawText.toUpperCase();
    return /KCB BANK KENYA LTD/i.test(rawText) ||
           /KCB NAIROBI/i.test(rawText) ||
           /KCB\s+BANK/i.test(rawText) ||
           (upper.includes('KCB') && upper.includes('BANK'));
  }

  /**
   * Extract metadata: account number, period, opening balance.
   */
  extractMetadata(rawText: string): StatementMetadata {
    const accountNumber = this.extractAccountNumber(rawText);
    const openingBalance = this.extractOpeningBalance(rawText);

    // Period will be derived from first/last transaction after parsing
    return {
      accountNumber,
      periodStart: null,
      periodEnd: null,
      openingBalance,
    };
  }

  /**
   * Parse all KCB transactions from raw PDF text.
   */
  parse(rawText: string): NormalizedTransaction[] {
    const transactions: NormalizedTransaction[] = [];
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

    let previousBalance: number | null = null;
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Detect transaction line: starts with a date
      // KCB format: "DD Mon YYYY" or "DD/MM/YYYY"
      const dateMatch = line.match(/^(\d{2}\s+[A-Za-z]{3}\s+\d{4})\s+/);
      if (!dateMatch) {
        i++;
        continue;
      }

      const dateStr = dateMatch[1];
      let remainder = line.slice(dateMatch[0].length).trim();

      // Try to match remaining data: description + value date + (blank) + money out + money in + balance
      // Format: DESCRIPTION  VALUE_DATE    MONEY_OUT   MONEY_IN   LEDGER_BALANCE
      // The money columns are often empty, so we use a flexible approach.

      // Extract the LEDGER BALANCE (last number in the line)
      const balanceMatch = remainder.match(/([\d,]+\.\d{2})\s*$/);
      let balanceAfter = 0;
      if (balanceMatch) {
        balanceAfter = parseFloat(balanceMatch[1].replace(/,/g, ''));
        remainder = remainder.slice(0, balanceMatch.index).trim();
      }

      // Extract value date (a date-like pattern after the description)
      const valueDateMatch = remainder.match(/(\d{2}\s+[A-Za-z]{3}\s+\d{4})\s*/);
      let description = remainder;
      if (valueDateMatch) {
        description = remainder.slice(0, valueDateMatch.index).trim();
      }

      // Clean up description
      description = description.replace(/\s+/g, ' ').trim();

      // Skip opening balance rows and ignore lines
      if (/BALANCE B\/FWD/i.test(description) || /BALANCE C\/FWD/i.test(description)) {
        if (balanceAfter > 0) {
          previousBalance = balanceAfter;
        }
        i++;
        continue;
      }

      // Calculate money in/out from balance difference
      let moneyIn = 0;
      let moneyOut = 0;
      let calculated = false;

      if (previousBalance !== null && balanceAfter > 0) {
        const diff = balanceAfter - previousBalance;
        if (diff > 0) {
          moneyIn = Math.round(diff * 100) / 100;
        } else if (diff < 0) {
          moneyOut = Math.round(Math.abs(diff) * 100) / 100;
        }
        calculated = true;
      }

      // Extract reference (alphanumeric codes)
      const reference = this.extractReference(description);

      if (description && (moneyIn > 0 || moneyOut > 0 || balanceAfter > 0)) {
        const formattedDate = this.formatDate(dateStr);

        transactions.push({
          date: formattedDate,
          description: description,
          moneyOut,
          moneyIn,
          balanceAfter,
          institution: this.institution,
          reference,
          rawDescription: description,
          calculated,
        });
      }

      if (balanceAfter > 0) {
        previousBalance = balanceAfter;
      }
      i++;
    }

    // Sort by date ascending
    transactions.sort((a, b) => a.date.localeCompare(b.date));

    this.logger.log(`Parsed ${transactions.length} KCB transactions`);
    return transactions;
  }

  private extractAccountNumber(text: string): string | null {
    const match = text.match(/Account\s+(?:Number|No)[.:\s]*(\d+)/i);
    return match ? match[1] : null;
  }

  private extractOpeningBalance(text: string): number | null {
    const match = text.match(/Balance\s+(?:at\s+)?Period\s+Start[:\s]*([\d,]+\.\d{2})/i);
    if (match) return parseFloat(match[1].replace(/,/g, ''));
    // Try alternative: "Opening Balance"
    const altMatch = text.match(/Opening\s+Balance[:\s]*([\d,]+\.\d{2})/i);
    return altMatch ? parseFloat(altMatch[1].replace(/,/g, '')) : null;
  }

  private extractReference(description: string): string | null {
    const match = description.match(/([A-Z0-9]{8,})/);
    return match ? match[1] : null;
  }

  private formatDate(dateStr: string): string {
    // Convert "06 Jul 2026" to "2026-07-06"
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const match = dateStr.match(/(\d{2})\s+([A-Za-z]{3})\s+(\d{4})/);
    if (match) {
      const [, day, month, year] = match;
      const monthNum = months[month.toLowerCase()] || '01';
      return `${year}-${monthNum}-${day}`;
    }
    return dateStr;
  }
}
