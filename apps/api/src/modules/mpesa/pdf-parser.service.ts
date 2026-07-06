import { Injectable, Logger } from '@nestjs/common';
const pdfParse = require('pdf-parse');

interface ExtractedTransaction {
  transactionDate: Date;
  description: string;
  amount: number;       // net: paidIn - withdrawn (positive = merchant received)
  paidIn: number;        // amount credited to merchant
  withdrawn: number;     // amount debited from merchant
  phoneNumber?: string;
  receiptNo?: string;
  paybill?: string;
  customerName?: string;
  transactionType?: string;
}

@Injectable()
export class PdfParserService {
  private readonly logger = new Logger(PdfParserService.name);

  async extractTransactions(buffer: Buffer): Promise<{
    transactions: ExtractedTransaction[];
    rawText: string;
    bankType: 'mpesa' | 'bank' | 'unknown';
  }> {
    const pdfBuffer = buffer instanceof Buffer ? new Uint8Array(buffer) : buffer;
    const data = await pdfParse(pdfBuffer);
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

  /**
   * Detect summary table lines like "Buy Goods84,298.000.00" or "Fees0.00463.60"
   * These are concatenated text+number patterns from the PDF summary section.
   */
  private isSummaryLine(line: string): boolean {
    // Lines where text is immediately followed by a formatted number (no space)
    // e.g., "Buy Goods84,298.000.00", "Fees0.00463.60", "Pay Bill0.000.00",
    //       "Payment to Mobile Number0.000.00", "Withdraw to Bank0.000.00",
    //       "Withdraw at Agent0.000.00", "Sell Airtime0.00300.00",
    //       "Other13,785.0011.00", "Total98,083.00774.60"
    return /^[A-Za-z\s]+\d{1,3}(?:,\d{3})*\.\d{2}\d{1,3}(?:,\d{3})*\.\d{2}/.test(line);
  }

  private parseMpesaStatement(text: string): ExtractedTransaction[] {
    const transactions: ExtractedTransaction[] = [];
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // PDF structural/noise keywords
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

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip summary table lines (concatenated text+numbers like "Buy Goods84,298.000.00")
      if (this.isSummaryLine(line)) continue;

      // Detect receipt line: "UG61DA7OCU2026-07-06"
      const receiptMatch = line.match(/^([A-Z0-9]{8,12})(\d{4}-\d{2}-\d{2})$/);
      if (!receiptMatch) continue;

      const receiptNo = receiptMatch[1];
      const dateStr = receiptMatch[2];
      const timeLine = lines[i + 1] || '';
      const timeMatch = timeLine.match(/^(\d{2}:\d{2}:\d{2})$/);
      if (!timeMatch) continue;

      const dateTimeStr = `${dateStr}T${timeMatch[1]}`;

      // Collect description and extract transaction data
      let description = '';
      let paidIn = 0;
      let withdrawn = 0;

      for (let j = i + 2; j < Math.min(i + 12, lines.length); j++) {
        const nextLine = lines[j];
        if (/^[A-Z0-9]{8,12}\d{4}-\d{2}-\d{2}$/.test(nextLine)) break;
        if (/^\d{2}:\d{2}:\d{2}$/.test(nextLine)) break;
        if (/^(Total|Summary)/i.test(nextLine)) break;
        if (isNoise(nextLine)) continue;
        if (this.isSummaryLine(nextLine)) continue;

        // Check for amount line: "Completed400.000.00114,891.09Customer"
        const amountMatch = nextLine.match(
          /(?:Completed|Failed)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/
        );
        if (amountMatch) {
          paidIn = parseFloat(amountMatch[1].replace(/,/g, ''));
          withdrawn = parseFloat(amountMatch[2].replace(/,/g, ''));
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
        // Extract customer name: "254725***414 - Simon kurgat" -> "Simon kurgat"
        const nameMatch = cleanedDesc.match(/-\s+(.+)$/);
        const customerName = nameMatch ? nameMatch[1].trim() : undefined;

        transactions.push({
          transactionDate: new Date(dateTimeStr),
          description: cleanedDesc,
          amount: paidIn - withdrawn, // net: positive = received, negative = paid out
          paidIn,
          withdrawn,
          phoneNumber: cleanedDesc.match(/2547\d{7}|0\d{9}/)?.[0] || undefined,
          receiptNo: receiptNo || undefined,
          paybill: cleanedDesc.match(/\d{5,7}(?![\d-])/)?.[0] || undefined,
          customerName,
          transactionType: cleanedDesc.includes('OTC Buy Airtime') ? 'OTC_BUY_AIRTIME'
            : cleanedDesc.includes('Pay merchant Charge') ? 'MERCHANT_FEE'
            : cleanedDesc.includes('Airtime Commission') ? 'AIRTIME_COMMISSION'
            : cleanedDesc.includes('Merchant Payment') ? 'MERCHANT_PAYMENT'
            : 'OTHER',
        });
      }
    }

    // Sort by date ASC (PDF is reverse chronological)
    transactions.sort((a, b) => a.transactionDate.getTime() - b.transactionDate.getTime());

    return transactions;
  }

  private parseBankStatement(text: string): ExtractedTransaction[] {
    const transactions: ExtractedTransaction[] = [];
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const linePattern = /^(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})\s+([A-Za-z0-9\s\/\-]+?)\s+([\d,]+\.?\d*)?\s+([\d,]+\.?\d*)?\s+([\d,]+\.?\d*)?$/;

    for (const line of lines) {
      const match = line.match(linePattern);
      if (match) {
        const debit = parseFloat((match[3] || '0').replace(/,/g, ''));
        const credit = parseFloat((match[4] || '0').replace(/,/g, ''));
        if (debit || credit) {
          transactions.push({
            transactionDate: new Date(match[1]),
            description: match[2].trim(),
            amount: credit || -debit,
            paidIn: credit,
            withdrawn: debit,
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
            paidIn: amount,
            withdrawn: 0,
          });
        }
      }
    }
    return transactions;
  }
}
