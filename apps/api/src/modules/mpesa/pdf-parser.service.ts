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
    const data = await pdfParse(buffer);
    const text = data.text;

    // Detect bank type from header text
    const bankType = this.detectBankType(text);
    this.logger.log(`Detected bank type: ${bankType}, PDF pages: ${data.numpages}`);

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

    // M-Pesa statement patterns:
    // "Paid to JOHN DOE on 15/01/2026 at 14:30 KES 1,500.00"
    // "Received from 0712345678 on 15/01/2026 at 14:30 KES 500.00"
    // "Sent to 0712345678 on 15/01/2026 KES 1,000.00"
    // "Transaction Cost,KES 0.00"
    // "Receipt No: ABC123DEF"

    const mpesaPatterns = [
      // Paid to / Received from / Sent to patterns
      /(Paid to|Received from|Sent to)\s+(.+?)\s+on\s+(\d{1,2}\/\d{1,2}\/\d{4}).*?KES\s+([\d,]+\.?\d*)/i,
      // "You have sent KES 1,000.00 to 0712345678 on 15/1/2026"
      /(sent|received|paid)\s+kes\s+([\d,]+\.?\d*)\s+(to|from)\s+(\S+)\s+on\s+(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
    ];

    // Also look for structured CSV-like data within PDF
    let receiptNo = '';
    for (const line of lines) {
      const receiptMatch = line.match(/Receipt\s*No[:\s]+([A-Z0-9]+)/i);
      if (receiptMatch) receiptNo = receiptMatch[1];

      for (const pattern of mpesaPatterns) {
        const match = line.match(pattern);
        if (match) {
          const description = match[2] || match[4] || 'M-Pesa transaction';
          const dateStr = match[3] || match[5];
          const amountStr = match[4] || match[2];
          const amount = parseFloat(amountStr.replace(/,/g, ''));

          if (!isNaN(amount) && amount > 0) {
            transactions.push({
              transactionDate: new Date(dateStr),
              description: description.trim(),
              amount,
              phoneNumber: description.match(/0\d{9}/)?.[0] || undefined,
              receiptNo: receiptNo || undefined,
              paybill: description.match(/\d{5,7}/)?.[0] || undefined,
            });
            receiptNo = '';
          }
        }
      }
    }

    return transactions;
  }

  private parseBankStatement(text: string): ExtractedTransaction[] {
    const transactions: ExtractedTransaction[] = [];
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // Kenyan bank statement format:
    // Date | Description | Debit | Credit | Balance
    // 15/01/2026 | M-PESA WITHDRAWAL | 5,000.00 | | 150,000.00
    // 16/01/2026 | SALARY DEPOSIT | | 100,000.00 | 250,000.00

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

    // Generic fallback: find any line with a date and a number
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
