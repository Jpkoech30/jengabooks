/**
 * Bank CSV Template Detection Tests
 *
 * Kenyan bank statement formats:
 * - KCB: TransactionDate, ValueDate, Description, Debit, Credit, Balance
 * - Equity: Date, Description, Debit, Credit, Balance
 * - Co-operative: TransDate, Description, Debit, Credit, RunningBalance
 * - Standard Chartered: Date, Value Date, Description, Debit, Amount, Balance
 *
 * Edge cases:
 * - Auto-detect bank from header patterns
 * - Handle extra whitespace in headers
 * - Handle different date formats (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD)
 * - Handle header order variations
 * - Unknown format returns generic template
 */

type BankTemplate = {
  bank: 'kcb' | 'equity' | 'coop' | 'stanchart' | 'generic';
  name: string;
  headerPatterns: RegExp[];
  dateFormat: string;
  columnMap: Record<string, string>;
};

const BANK_TEMPLATES: BankTemplate[] = [
  // Most specific templates first (checked before generic ones)
  {
    bank: 'stanchart',
    name: 'Standard Chartered',
    headerPatterns: [/value date/i, /debit/i, /amount/i, /balance/i],
    dateFormat: 'DD/MM/YYYY',
    columnMap: {
      date: 'transactionDate',
      'value date': 'valueDate',
      description: 'description',
      debit: 'debit',
      amount: 'credit',
      balance: 'balance',
    },
  },
  {
    bank: 'coop',
    name: 'Co-operative Bank',
    headerPatterns: [/transdate/i, /runningbalance/i],
    dateFormat: 'DD/MM/YYYY',
    columnMap: {
      transdate: 'transactionDate',
      description: 'description',
      debit: 'debit',
      credit: 'credit',
      runningbalance: 'balance',
    },
  },
  {
    bank: 'kcb',
    name: 'KCB Bank',
    headerPatterns: [/transactiondate/i, /valuedate/i, /debit/i, /credit/i],
    dateFormat: 'DD/MM/YYYY',
    columnMap: {
      transactiondate: 'transactionDate',
      valuedate: 'valueDate',
      description: 'description',
      debit: 'debit',
      credit: 'credit',
      balance: 'balance',
    },
  },
  {
    bank: 'equity',
    name: 'Equity Bank',
    headerPatterns: [/date/i, /description/i, /debit/i, /credit/i, /balance/i],
    dateFormat: 'DD/MM/YYYY',
    columnMap: {
      date: 'transactionDate',
      description: 'description',
      debit: 'debit',
      credit: 'credit',
      balance: 'balance',
    },
  },
];

function detectBank(headers: string[]): BankTemplate {
  const normalizedHeaders = headers.map(h => h.trim());

  // Use first-match wins with specific patterns checked before generic ones
  for (const template of BANK_TEMPLATES) {
    const matchCount = template.headerPatterns.filter(pattern =>
      normalizedHeaders.some(h => pattern.test(h))
    ).length;

    // Require 100% match for specific templates with few patterns
    // Require 80% for templates with many patterns
    const requiredRatio = template.headerPatterns.length <= 2 ? 1.0 : 0.8;
    if (matchCount >= Math.ceil(template.headerPatterns.length * requiredRatio)) {
      return template;
    }
  }

  return {
    bank: 'generic',
    name: 'Generic CSV',
    headerPatterns: [],
    dateFormat: 'YYYY-MM-DD',
    columnMap: {},
  };
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, ' ');
}

describe('Bank CSV Template Detection', () => {
  describe('detectBank', () => {
    it('should detect KCB format from headers', () => {
      const headers = ['TransactionDate', 'ValueDate', 'Description', 'Debit', 'Credit', 'Balance'];
      const result = detectBank(headers);
      expect(result.bank).toBe('kcb');
      expect(result.name).toBe('KCB Bank');
    });

    it('should detect Equity format from headers', () => {
      const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
      const result = detectBank(headers);
      expect(result.bank).toBe('equity');
    });

    it('should detect Co-operative format from headers', () => {
      const headers = ['TransDate', 'Description', 'Debit', 'Credit', 'RunningBalance'];
      const result = detectBank(headers);
      expect(result.bank).toBe('coop');
    });

    it('should detect Standard Chartered format from headers', () => {
      const headers = ['Date', 'Value Date', 'Description', 'Debit', 'Amount', 'Balance'];
      const result = detectBank(headers);
      expect(result.bank).toBe('stanchart');
    });

    it('should return generic for unknown headers', () => {
      const headers = ['Name', 'Phone', 'Email', 'Amount'];
      const result = detectBank(headers);
      expect(result.bank).toBe('generic');
    });

    it('should handle extra whitespace in headers', () => {
      const headers = ['  TransactionDate  ', 'ValueDate', 'Description', 'Debit', 'Credit'];
      const result = detectBank(headers);
      expect(result.bank).toBe('kcb');
    });

    it('should handle case-insensitive header matching', () => {
      const headers = ['transactiondate', 'valuedate', 'description', 'debit', 'credit'];
      const result = detectBank(headers);
      expect(result.bank).toBe('kcb');
    });

    it('should detect with full header match', () => {
      // All KCB patterns present (needs 4/4 at 80% threshold)
      const headers = ['TransactionDate', 'ValueDate', 'Description', 'Debit', 'Credit'];
      const result = detectBank(headers);
      expect(result.bank).toBe('kcb');
    });
  });

  describe('normalizeHeader', () => {
    it('should trim whitespace', () => {
      expect(normalizeHeader('  Date  ')).toBe('date');
    });

    it('should lowercase', () => {
      expect(normalizeHeader('TransactionDate')).toBe('transactiondate');
    });

    it('should normalize internal whitespace', () => {
      expect(normalizeHeader('Value  Date')).toBe('value date');
    });
  });
});
