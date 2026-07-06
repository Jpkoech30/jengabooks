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

    // M-Pesa merchant statement — text is concatenated across PDF table cells:
    // Line 1: "UG61DA7OCU2026-07-06" (receiptNo + date, no delimiter)
    // Line 2: "20:01:44" (time)
    // Lines 3-5+: description (wrapped text)
    // Amount line: "Completed400.000.00114,891.09Customer" (status + paidIn + withdrawn + balance + type)
    // Following lines: more description / other party info

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect receipt line: 8-12 uppercase alphanumeric chars followed immediately by a date
      // e.g., "UG61DA7OCU2026-07-06" then next line is "20:01:44"
      const receiptMatch = line.match(/^([A-Z0-9]{8,12})(\d{4}-\d{2}-\d{2})$/);
      if (!receiptMatch) continue;

      const receiptNo = receiptMatch[1];
      const dateStr = receiptMatch[2]; // "2026-07-06"

      // Next line should be time: "20:01:44"
      const timeLine = lines[i + 1] || '';
      const timeMatch = timeLine.match(/^(\d{2}:\d{2}:\d{2})$/);
      if (!timeMatch) continue;

      const dateTimeStr = `${dateStr}T${timeMatch[1]}`; // "2026-07-06T20:01:44"

      // Collect description from subsequent lines
      let description = '';
      let amount = 0;

      for (let j = i + 2; j < Math.min(i + 10, lines.length); j++) {
        const nextLine = lines[j];

        // If we hit another receipt, stop
        if (/^[A-Z0-9]{8,12}\d{4}-\d{2}-\d{2}$/.test(nextLine)) break;
        // If we hit a time, stop (next receipt's time)
        if (/^\d{2}:\d{2}:\d{2}$/.test(nextLine)) break;
        // Skip summary/total lines
        if (/^(Total|Summary)/i.test(nextLine)) break;

        // Check for amount line: "Completed400.000.00114,891.09Customer"
        // Pattern: status (Completed/Failed) + paidIn + withdrawn + balance + text
        const amountMatch = nextLine.match(
          /(?:Completed|Failed)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/
        );
        if (amountMatch) {
          // Extract the amount before the line (description)
          const paidIn = parseFloat(amountMatch[1].replace(/,/g, ''));
          const withdrawn = parseFloat(amountMatch[2].replace(/,/g, ''));
          amount = paidIn || withdrawn;

          // Any text before the status word in this line belongs to description
          const descPrefix = nextLine.split(/Completed|Failed/i)[0]?.trim();
          if (descPrefix) description += (description ? ' ' : '') + descPrefix;
        } else {
          // This is a description continuation line
          // Skip pure numbers, dates, times
          if (!/^[\d,.\s]+$/.test(nextLine) && !/^\d{2}:\d{2}:\d{2}$/.test(nextLine)) {
            description += (description ? ' ' : '') + nextLine;
          }
        }
      }

      if (description && amount > 0) {
        transactions.push({
          transactionDate: new Date(dateTimeStr),
          description: description.trim(),
          amount,
          phoneNumber: description.match(/2547\d{7}|0\d{9}/)?.[0] || undefined,
          receiptNo: receiptNo || undefined,
          paybill: description.match(/\d{5,7}/)?.[0] || undefined,
        });
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
