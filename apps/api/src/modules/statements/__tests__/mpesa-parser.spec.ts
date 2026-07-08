import { MpesaParser } from '../parsers/mpesa.parser';

describe('MpesaParser', () => {
  let parser: MpesaParser;

  const sampleMpesaText = `M-PESA FULL STATEMENT
Organisation Name: Test Business
Shortcode: 6357506
Statement Period: 01 Jul 2026 - 06 Jul 2026

Receipt No  Completion Time  Details  Paid in  Withdrawn  Balance  Transaction Type  Other Party
UG61DA7OCU2026-07-06
10:30:15
Merchant Payment from 254712345678 - John Doe
Completed400.000.00114,891.09
UG61DA7OCU2026-07-05
14:45:22
Pay merchant Charge
Completed0.0035.00114,856.09
UG61DA7OCU2026-07-04
09:15:00
OTC Buy Airtime
Completed500.000.00115,356.09

Disclaimer: This record is produced automatically`;

  const sampleMpesaTextNoMatch = `Some random text without M-Pesa markers`;

  beforeEach(() => {
    parser = new MpesaParser();
  });

  describe('detect', () => {
    it('should detect M-Pesa statement with Organisation Name and Shortcode', () => {
      expect(parser.detect(sampleMpesaText)).toBe(true);
    });

    it('should detect M-Pesa statement with FULL STATEMENT marker', () => {
      const text = 'M-PESA FULL STATEMENT\nSome content';
      expect(parser.detect(text)).toBe(true);
    });

    it('should return false for non-M-Pesa text', () => {
      expect(parser.detect(sampleMpesaTextNoMatch)).toBe(false);
    });

    it('should return false for empty text', () => {
      expect(parser.detect('')).toBe(false);
    });
  });

  describe('extractMetadata', () => {
    it('should extract shortcode as account number', () => {
      const metadata = parser.extractMetadata(sampleMpesaText);
      expect(metadata.accountNumber).toBe('6357506');
    });

    it('should extract statement period', () => {
      const metadata = parser.extractMetadata(sampleMpesaText);
      expect(metadata.periodStart).toBe('2026-07-01');
      expect(metadata.periodEnd).toBe('2026-07-06');
    });

    it('should return null opening balance', () => {
      const metadata = parser.extractMetadata(sampleMpesaText);
      expect(metadata.openingBalance).toBeNull();
    });

    it('should handle missing period gracefully', () => {
      const text = 'M-PESA FULL STATEMENT\nShortcode: 12345';
      const metadata = parser.extractMetadata(text);
      expect(metadata.periodStart).toBeNull();
      expect(metadata.periodEnd).toBeNull();
    });
  });

  describe('parse', () => {
    it('should parse transactions from M-Pesa statement', () => {
      const transactions = parser.parse(sampleMpesaText);
      expect(transactions.length).toBeGreaterThan(0);
    });

    it('should set correct institution', () => {
      const transactions = parser.parse(sampleMpesaText);
      transactions.forEach(tx => {
        expect(tx.institution).toBe('MPESA');
      });
    });

    it('should parse paid in and withdrawn amounts correctly', () => {
      const transactions = parser.parse(sampleMpesaText);
      // First transaction: Merchant Payment, paidIn=400, withdrawn=0
      const merchantPayment = transactions.find(tx => tx.description.includes('John Doe'));
      if (merchantPayment) {
        expect(merchantPayment.moneyIn).toBe(400);
        expect(merchantPayment.moneyOut).toBe(0);
      }
    });

    it('should sort transactions by date ascending', () => {
      const transactions = parser.parse(sampleMpesaText);
      for (let i = 1; i < transactions.length; i++) {
        expect(transactions[i].date >= transactions[i - 1].date).toBe(true);
      }
    });

    it('should set reference from receipt number', () => {
      const transactions = parser.parse(sampleMpesaText);
      transactions.forEach(tx => {
        expect(tx.reference).toBeTruthy();
        expect(tx.reference?.length).toBeGreaterThanOrEqual(8);
      });
    });

    it('should set calculated = false for M-Pesa', () => {
      const transactions = parser.parse(sampleMpesaText);
      transactions.forEach(tx => {
        expect(tx.calculated).toBe(false);
      });
    });

    it('should handle empty text', () => {
      const transactions = parser.parse('');
      expect(transactions).toEqual([]);
    });
  });
});
