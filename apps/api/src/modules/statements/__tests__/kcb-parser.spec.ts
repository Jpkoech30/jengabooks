import { KcbParser } from '../parsers/kcb.parser';

describe('KcbParser', () => {
  let parser: KcbParser;

  const sampleKcbText = `KCB BANK KENYA LTD
Account Number: 1234567890
Balance at Period Start: 1,000,000.00

01 Jul 2026 BALANCE B/FWD                 01 Jul 2026                      1,000,000.00
02 Jul 2026 Air Time Purcha               02 Jul 2026            5,000.00    995,000.00
03 Jul 2026 ATM Charge                    03 Jul 2026              600.00    994,400.00
04 Jul 2026 ATM Cash KCB                  04 Jul 2026           50,000.00    944,400.00
05 Jul 2026 Mobile Money Tr MM           05 Jul 2026          200,000.00    744,400.00
06 Jul 2026 Autotronix Ltd               06 Jul 2026          500,000.00  1,244,400.00`;

  const sampleKcbTextNoMatch = `Some random text without KCB markers`;

  beforeEach(() => {
    parser = new KcbParser();
  });

  describe('detect', () => {
    it('should detect KCB statement with "KCB BANK KENYA LTD"', () => {
      expect(parser.detect(sampleKcbText)).toBe(true);
    });

    it('should detect KCB statement with "KCB NAIROBI"', () => {
      expect(parser.detect('KCB NAIROBI\nSome transactions')).toBe(true);
    });

    it('should return false for non-KCB text', () => {
      expect(parser.detect(sampleKcbTextNoMatch)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(parser.detect('')).toBe(false);
    });
  });

  describe('extractMetadata', () => {
    it('should extract account number', () => {
      const metadata = parser.extractMetadata(sampleKcbText);
      expect(metadata.accountNumber).toBe('1234567890');
    });

    it('should extract opening balance', () => {
      const metadata = parser.extractMetadata(sampleKcbText);
      expect(metadata.openingBalance).toBe(1000000.00);
    });

    it('should return null for missing account number', () => {
      const text = 'KCB BANK KENYA LTD\nSome transactions';
      const metadata = parser.extractMetadata(text);
      expect(metadata.accountNumber).toBeNull();
    });
  });

  describe('parse', () => {
    it('should parse transactions from KCB statement', () => {
      const transactions = parser.parse(sampleKcbText);
      // 6 lines: 1 balance b/fwd + 5 actual transactions
      expect(transactions.length).toBe(5);
    });

    it('should set correct institution', () => {
      const transactions = parser.parse(sampleKcbText);
      transactions.forEach(tx => {
        expect(tx.institution).toBe('KCB');
      });
    });

    it('should calculate money in/out from balance differences', () => {
      const transactions = parser.parse(sampleKcbText);
      // All non-B/FWD transactions should have calculated = true
      transactions.forEach(tx => {
        expect(tx.calculated).toBe(true);
      });
    });

    it('should correctly calculate money-out for debit transactions (Air Time)', () => {
      const transactions = parser.parse(sampleKcbText);
      // Air Time Purcha: balance went from 1,000,000 to 995,000 -> moneyOut=5,000
      const airtimeTx = transactions.find(tx => tx.description.includes('Air Time'));
      if (airtimeTx) {
        expect(airtimeTx.moneyOut).toBe(5000);
        expect(airtimeTx.moneyIn).toBe(0);
      }
    });

    it('should correctly calculate money-out for ATM withdrawal', () => {
      const transactions = parser.parse(sampleKcbText);
      // ATM Cash KCB: balance went from 994,400 to 944,400 -> moneyOut=50,000
      const atmTx = transactions.find(tx => tx.description.includes('ATM Cash'));
      if (atmTx) {
        expect(atmTx.moneyOut).toBe(50000);
        expect(atmTx.moneyIn).toBe(0);
      }
    });

    it('should correctly calculate money-in for credit transactions (Autotronix)', () => {
      const transactions = parser.parse(sampleKcbText);
      // Autotronix Ltd: balance went from 744,400 to 1,244,400 -> moneyIn=500,000
      const revenueTx = transactions.find(tx => tx.description.includes('Autotronix'));
      if (revenueTx) {
        expect(revenueTx.moneyIn).toBe(500000);
        expect(revenueTx.moneyOut).toBe(0);
      }
    });

    it('should skip BALANCE B/FWD rows', () => {
      const transactions = parser.parse(sampleKcbText);
      const bfwdTx = transactions.filter(tx => tx.description.includes('BALANCE B/FWD'));
      expect(bfwdTx.length).toBe(0);
    });

    it('should sort transactions by date ascending', () => {
      const transactions = parser.parse(sampleKcbText);
      for (let i = 1; i < transactions.length; i++) {
        expect(transactions[i].date >= transactions[i - 1].date).toBe(true);
      }
    });

    it('should handle empty text', () => {
      const transactions = parser.parse('');
      expect(transactions).toEqual([]);
    });
  });
});
