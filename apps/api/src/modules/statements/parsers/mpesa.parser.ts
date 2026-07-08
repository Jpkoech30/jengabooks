import { Injectable, Logger } from '@nestjs/common';
import { StatementParser, NormalizedTransaction, StatementMetadata } from './statement-parser.interface';

/**
 * M-Pesa PDF Statement Parser
 *
 * Detection:
 *   Checks for "Organisation Name:", "Shortcode:", and "M-PESA FULL STATEMENT".
 *
 * Metadata:
 *   - Account number = Shortcode value
 *   - Period from "Statement Period: DD Mmm YYYY - DD Mmm YYYY"
 *   - Opening balance = null (derive from first transaction)
 *
 * Transaction Parsing:
 *   - Locate table header containing "Receipt No", "Completion Time", etc.
 *   - Read rows until disclaimer footer.
 *   - Columns: Receipt No, Completion Time, Details, Paid in, Withdrawn, Balance
 *   - Handle multi-line descriptions.
 *   - Sort by Completion Time ascending (PDF is reverse chronological).
 */
@Injectable()
export class MpesaParser implements StatementParser {
  private readonly logger = new Logger(MpesaParser.name);

  readonly institution = 'MPESA';

  /**
   * Detect M-Pesa statement from raw text.
   */
  detect(rawText: string): boolean {
    const upper = rawText.toUpperCase();
    const hasOrganisationName = /Organisation Name:\s*\w+/i.test(rawText);
    const hasShortcode = /Shortcode:\s*\d+/i.test(rawText);
    const hasFullStatement = /M-PESA FULL STATEMENT/i.test(upper);

    return (hasOrganisationName && hasShortcode) || hasFullStatement;
  }

  /**
   * Extract header metadata: shortcode (account number), statement period.
   */
  extractMetadata(rawText: string): StatementMetadata {
    const accountNumber = this.extractShortcode(rawText);
    const { periodStart, periodEnd } = this.extractPeriod(rawText);
    const openingBalance = null; // No explicit opening balance in M-Pesa statements

    return { accountNumber, periodStart, periodEnd, openingBalance };
  }

  /**
   * Parse all M-Pesa transactions from raw PDF text.
   */
  parse(rawText: string): NormalizedTransaction[] {
    const transactions: NormalizedTransaction[] = [];
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

    const noisePatterns = [
      /^M-PESA\s+FULL\s+STATEMENT/i, /^Page\s+\d+\s+of\s+\d+/i,
      /^Disclaimer/i, /^This\s+record\s+is\s+produced/i,
      /^Pay\s+merchant/i, /^Charge\s+Merchant\s+Payment/i,
      /^Merchant\s+Payment$/i, /^\d{5,7}-[A-Z]/,
      /^Receipt\s+No/i, /^Completion/i, /^Details/i, /^Transaction/i,
      /^Paid\s+in/i, /^Withdrawn/i, /^Balance/i, /^Other\s+Party/i,
      /^Account\s+Type/i, /^Organisation\s+Name/i, /^Shortcode/i,
      /^Statement\s+Period/i, /^Request\s+Date/i, /^Transaction\s+Type/i,
    ];

    const isNoise = (line: string): boolean => noisePatterns.some(p => p.test(line));

    const isSummaryLine = (line: string): boolean =>
      /^(?:Buy Goods|Pay Bill|Payment to Mobile Number|Withdraw to Bank|Withdraw at Agent|Sell Airtime|Fees|Other|Total)\s*\d/.test(line);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip summary table lines
      if (isSummaryLine(line)) continue;

      // Detect receipt line: "UG61DA7OCU2026-07-06"
      const receiptMatch = line.match(/^([A-Z0-9]{8,12})(\d{4}-\d{2}-\d{2})$/);
      if (!receiptMatch) continue;

      const reference = receiptMatch[1];
      const dateStr = receiptMatch[2];
      const timeLine = lines[i + 1] || '';
      const timeMatch = timeLine.match(/^(\d{2}:\d{2}:\d{2})$/);
      if (!timeMatch) continue;

      const dateTimeStr = `${dateStr}T${timeMatch[1]}`;

      // Collect description and extract transaction data
      let description = '';
      let paidIn = 0;
      let withdrawn = 0;
      let balanceAfter = 0;

      for (let j = i + 2; j < Math.min(i + 12, lines.length); j++) {
        const nextLine = lines[j];
        if (/^[A-Z0-9]{8,12}\d{4}-\d{2}-\d{2}$/.test(nextLine)) break;
        if (/^\d{2}:\d{2}:\d{2}$/.test(nextLine)) break;
        if (/^(Total|Summary)/i.test(nextLine)) break;
        if (isNoise(nextLine)) continue;
        if (isSummaryLine(nextLine)) continue;

        // Check for amount line: "Completed400.000.00114,891.09Customer"
        const amountMatch = nextLine.match(
          /(?:Completed|Failed)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)(?:\s*)([\d,]+\.\d{2})?/
        );
        if (amountMatch) {
          paidIn = parseFloat(amountMatch[1].replace(/,/g, ''));
          withdrawn = parseFloat(amountMatch[2].replace(/,/g, ''));
          // Balance may be in group 3
          if (amountMatch[3]) {
            balanceAfter = parseFloat(amountMatch[3].replace(/,/g, ''));
          }
          const descPrefix = nextLine.split(/Completed|Failed/i)[0]?.trim();
          if (descPrefix && !isNoise(descPrefix)) {
            description += (description ? ' ' : '') + descPrefix;
          }
        } else if (!/^[\d,.\s]+$/.test(nextLine) && !isNoise(nextLine)) {
          description += (description ? ' ' : '') + nextLine;
        }
      }

      if (description && (paidIn > 0 || withdrawn > 0)) {
        const cleanedDesc = description.replace(/\s+/g, ' ').trim();

        transactions.push({
          date: new Date(dateTimeStr).toISOString().split('T')[0],
          description: this.extractCustomerName(cleanedDesc),
          moneyOut: withdrawn,
          moneyIn: paidIn,
          balanceAfter,
          institution: this.institution,
          reference,
          rawDescription: cleanedDesc,
          calculated: false,
        });
      }
    }

    // Sort by date ASC (PDF is reverse chronological)
    transactions.sort((a, b) => a.date.localeCompare(b.date));

    this.logger.log(`Parsed ${transactions.length} M-Pesa transactions`);
    return transactions;
  }

  private extractShortcode(text: string): string | null {
    const match = text.match(/Shortcode:\s*(\d+)/i);
    return match ? match[1] : null;
  }

  private extractPeriod(text: string): { periodStart: string | null; periodEnd: string | null } {
    const match = text.match(/Statement Period:\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})\s*-\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i);
    if (match) {
      const parseDate = (dateStr: string): string | null => {
        // Parse "01 Jul 2026" into parts to avoid timezone offset issues
        const parts = dateStr.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
        if (!parts) return null;
        const months: Record<string, string> = {
          jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
          jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
        };
        const day = parts[1].padStart(2, '0');
        const month = months[parts[2].toLowerCase().slice(0, 3)] || '01';
        const year = parts[3];
        return `${year}-${month}-${day}`;
      };
      return {
        periodStart: parseDate(match[1]),
        periodEnd: parseDate(match[2]),
      };
    }
    return { periodStart: null, periodEnd: null };
  }

  private extractCustomerName(description: string): string {
    // "254725***414 - Simon kurgat" -> "Simon kurgat"
    const nameMatch = description.match(/-\s+(.+)$/);
    return nameMatch ? nameMatch[1].trim() : description;
  }
}
