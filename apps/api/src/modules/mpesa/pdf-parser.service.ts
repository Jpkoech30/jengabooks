import { Injectable, Logger } from '@nestjs/common';

interface ExtractedTransaction {
  transactionDate: Date;
  description: string;
  amount: number;
  phoneNumber?: string;
  receiptNo?: string;
  paybill?: string;
}

// pdf-parse v2 is ESM-only; lazy-init with dynamic import for CommonJS compat
let _pdfParse: any = null;
async function loadPdfParse(): Promise<any> {
  if (!_pdfParse) {
    const mod = await import('pdf-parse');
    _pdfParse = mod.default || mod;
  }
  return _pdfParse;
}

@Injectable()
export class PdfParserService {
  private readonly logger = new Logger(PdfParserService.name);

  async extractTransactions(buffer: Buffer): Promise<{
    transactions: ExtractedTransaction[];
    rawText: string;
    bankType: 'mpesa' | 'bank' | 'unknown';
  }> {
    const pdfParse = await loadPdfParse();
    const data = await pdfParse(buffer);
    const text = data.text;

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

    const mpesaPatterns = [
      /(Paid to|Received from|Sent to)\s+(.+?)\s+on\s+(\d{1,2}\/\d{1,2}\/\d{4}).*?KES\s+([\d,]+\.?\d*)/i,
      /(sent|received|paid)\s+kes\s+([\d,]+\.?\d*)\s+(to|from)\s+(\S+)\s+on\s+(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
    ];

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
