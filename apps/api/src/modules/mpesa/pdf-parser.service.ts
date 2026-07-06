import { Injectable, Logger } from '@nestjs/common';
const pdfParse = require('pdf-parse');

interface ExtractedTransaction {
  transactionDate: Date;
  description: string;
  amount: number;
  phoneNumber?: string;
  receiptNo?: string;
  paybill?: string;
}

@Injectable()
export class PdfParserService {
  private readonly logger = new Logger(PdfParserService.name);

  async extractTransactions(buffer: Buffer): Promise<{
    transactions: ExtractedTransaction[];
    rawText: string;
    bankType: 'mpesa' | 'bank' | 'unknown';
  }> {
    // Ensure buffer is a proper Uint8Array for pdf-parse
    const pdfBuffer = buffer instanceof Buffer ? new Uint8Array(buffer) : buffer;
    const data = await pdfParse(pdfBuffer);
    const text = data.text;

    const bankType = this.detectBankType(text);
    this.logger.log(`Detected bank type: ${bankType}, PDF pages: ${data.numpages}`);
    this.logger.log(`First 800 chars: ${text.slice(0, 800).replace(/\n/g, '\\n')}`);

    let transactions: ExtractedTransaction[];

    switch (bankType) {
      case 'mpesa':
        transactions = this.parseMpesaStatement(text);
        break;
      case 'bank':
        transactions = this.parseBankStatement(text);
        break;
      default:
        transactions = this.parseFallback(text);
    }

    return { transactions, rawText: text, bankType };
  }

  private detectBankType(text: string): 'mpesa' | 'bank' | 'unknown' {
    const upper = text.toUpperCase();
    if (upper.includes('M-PESA') || upper.includes('MPESA') || upper.includes('SAFARICOM')) {
      return 'mpesa';
    }
    if (upper.includes('KCB') || upper.includes('EQUITY') || upper.includes('CO-OPERATIVE')
        || upper.includes('BANK') || upper.includes('STATEMENT')) {
      return 'bank';
    }
    return 'unknown';
  }

  private parseMpesaStatement(text: string): ExtractedTransaction[] {
    const transactions: ExtractedTransaction[] = [];
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // M-Pesa merchant statement format (tabular):
    // Receipt No | Completion Time | Details | Status | Paid in | Withdrawn | Balance | Type | Other Party
    // UG61DA7OCU | 2026-07-06 20:01:44 | Merchant Payment from 254725***414 - Name | Completed | 400.00 | 0.00 | ...

    // Each transaction has 2 lines: receipt+date line, then details line
    let receiptBuffer = '';
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for receipt number (e.g., UG61DA7OCU, SG7ABC)
      const receiptMatch = line.match(/^([A-Z0-9]{8,12})\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);
      if (receiptMatch) {
        receiptBuffer = receiptMatch[1];
        const dateTimeStr = receiptMatch[2]; // "2026-07-06 20:01:44"

        // Look ahead for the details line (next line or next lines)
        // Also look for "Paid in" and "Withdrawn" values
        // The details might be scattered across lines after the receipt
        let details = '';
        let paidIn = 0;
        let withdrawn = 0;

        // Collect details from following lines until we hit another receipt or summary
        for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
          const nextLine = lines[j];

          // Stop if we hit another receipt
          if (/^[A-Z0-9]{8,12}\s+\d{4}-\d{2}-\d{2}/.test(nextLine)) break;
          // Stop if we hit "Summary" or totals
          if (/^(Total|Summary)/i.test(nextLine)) break;

          // Look for "Paid in" and "Withdrawn" amounts
          // Format: Completed | 400.00 | 0.00 | 114,891.09
          const amountMatch = nextLine.match(/(?:Completed|Failed)\s*\|\s*([\d,]+\.?\d*)\s*\|\s*([\d,]+\.?\d*)/);
          if (amountMatch) {
            paidIn = parseFloat(amountMatch[1].replace(/,/g, ''));
            withdrawn = parseFloat(amountMatch[2].replace(/,/g, ''));
          }

          // Collect description text (skip pure numbers/dates)
          if (!/^[\d,.\s]+$/.test(nextLine) && !/^\d{4}-\d{2}-\d{2}/.test(nextLine) && !nextLine.includes('|')) {
            details += (details ? ' ' : '') + nextLine;
          }
        }

        if (details) {
          const amount = paidIn || withdrawn;
          if (amount > 0) {
            transactions.push({
              transactionDate: new Date(dateTimeStr),
              description: details.trim(),
              amount,
              phoneNumber: details.match(/2547\d{7}|0\d{9}/)?.[0] || undefined,
              receiptNo: receiptBuffer || undefined,
              paybill: details.match(/\d{5,7}/)?.[0] || undefined,
            });
          }
        }
        receiptBuffer = '';
      }
    }

    return transactions;
  }

  private parseBankStatement(text: string): ExtractedTransaction[] {
    const transactions: ExtractedTransaction[] = [];
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    const linePattern = /^(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})\s+([A-Za-z0-9\s\/\-]+?)\s+([\d,]+\.?\d*)?\s+([\d,]+\.?\d*)?\s+([\d,]+\.?\d*)?$/;

    for (const line of lines) {
      const match = line.match(linePattern);
      if (match) {
        const dateStr = match[1];
        const description = match[2].trim();
        const debitStr = match[3];
        const creditStr = match[4];

        const debit = debitStr ? parseFloat(debitStr.replace(/,/g, '')) : 0;
        const credit = creditStr ? parseFloat(creditStr.replace(/,/g, '')) : 0;
        const amount = debit || credit;

        if (!isNaN(amount) && amount > 0) {
          transactions.push({
            transactionDate: new Date(dateStr),
            description,
            amount,
            phoneNumber: description.match(/0\d{9}/)?.[0] || undefined,
          });
        }
      }
    }

    return transactions;
  }

  private parseFallback(text: string): ExtractedTransaction[] {
    const transactions: ExtractedTransaction[] = [];
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    const datePattern = /\b(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})\b/;
    const amountPattern = /KES\s*([\d,]+\.?\d*)/i;

    for (const line of lines) {
      const dateMatch = line.match(datePattern);
      const amountMatch = line.match(amountPattern);

      if (dateMatch && amountMatch) {
        const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
        if (!isNaN(amount) && amount > 0) {
          transactions.push({
            transactionDate: new Date(dateMatch[1]),
            description: line.slice(0, 100),
            amount,
          });
        }
      }
    }

    return transactions;
  }
}
