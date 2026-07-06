/**
 * M-Pesa File Parser Tests
 *
 * Edge cases considered:
 * - CSV with BOM (byte order mark)
 * - Excel files with multiple sheets
 * - PDF with table data
 * - Files with no valid transactions
 * - Files with mixed date formats
 * - Files with currency symbols (KES, KSh)
 * - Files with thousand separators
 * - Empty files
 */

type ParsedTransaction = {
  receiptNo?: string;
  transactionDate: Date;
  description: string;
  amount: number;
  phoneNumber?: string;
};

// CSV parser function (to be implemented in mpesa.service.ts)
function parseCsvContent(csvData: string): Omit<ParsedTransaction, 'transactionDate'>[] {
  const lines = csvData.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/^\uFEFF/, ''));
  const parsedRows: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    if (values.length !== headers.length) continue;

    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx];
    });

    const amount = parseAmount(row['amount'] || row['value'] || '0');
    if (amount <= 0) continue;

    parsedRows.push({
      receiptNo: row['receipt'] || row['receiptno'] || row['transaction id'] || null,
      description: row['description'] || row['details'] || row['notes'] || '',
      amount,
      phoneNumber: row['phone'] || row['phonenumber'] || row['sender'] || null,
    });
  }

  return parsedRows;
}

function parseAmount(value: string): number {
  // Remove KES, KSh, commas, spaces
  const cleaned = value.replace(/[KESKSh,\s]/g, '').trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function detectFileFormat(filename: string): 'csv' | 'xlsx' | 'pdf' | 'unknown' {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'csv') return 'csv';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  if (ext === 'pdf') return 'pdf';
  return 'unknown';
}

describe('M-Pesa File Parser', () => {
  describe('detectFileFormat', () => {
    it('should detect CSV files', () => {
      expect(detectFileFormat('statement.csv')).toBe('csv');
      expect(detectFileFormat('M-PESA_2026.csv')).toBe('csv');
    });

    it('should detect Excel files', () => {
      expect(detectFileFormat('statement.xlsx')).toBe('xlsx');
      expect(detectFileFormat('statement.xls')).toBe('xlsx');
    });

    it('should detect PDF files', () => {
      expect(detectFileFormat('statement.pdf')).toBe('pdf');
    });

    it('should return unknown for unsupported formats', () => {
      expect(detectFileFormat('data.json')).toBe('unknown');
      expect(detectFileFormat('image.png')).toBe('unknown');
    });

    it('should return unknown for no extension', () => {
      expect(detectFileFormat('statement')).toBe('unknown');
    });
  });

  describe('parseCsvContent', () => {
    it('should parse standard CSV with headers', () => {
      const csv = 'receipt,date,amount,description\nRCP001,2026-01-01,500,Safaricom';
      const result = parseCsvContent(csv);
      expect(result).toHaveLength(1);
      expect(result[0].receiptNo).toBe('RCP001');
      expect(result[0].amount).toBe(500);
    });

    it('should handle BOM character in CSV', () => {
      const csv = '\uFEFFreceipt,date,amount\nRCP001,2026-01-01,500';
      const result = parseCsvContent(csv);
      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(500);
    });

    it('should handle KES currency prefix in amount field', () => {
      const csv = 'description,amount\nSafaricom,KES 1000';
      const result = parseCsvContent(csv);
      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(1000);
    });

    it('should handle KSh currency prefix', () => {
      const csv = 'description,amount\nSafaricom,KSh 500';
      const result = parseCsvContent(csv);
      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(500);
    });

    it('should skip rows with zero amounts', () => {
      const csv = 'description,amount\nZero,0\nValid,1000';
      const result = parseCsvContent(csv);
      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(1000);
    });

    it('should skip malformed rows', () => {
      const csv = 'receipt,date,amount\nRCP001,2026-01-01\nRCP002,2026-01-01,1000';
      const result = parseCsvContent(csv);
      expect(result).toHaveLength(1);
    });

    it('should return empty for header-only CSV', () => {
      const csv = 'receipt,date,amount';
      const result = parseCsvContent(csv);
      expect(result).toHaveLength(0);
    });

    it('should return empty for empty string', () => {
      expect(parseCsvContent('')).toHaveLength(0);
    });

    it('should map multiple header variants', () => {
      const csv = 'transaction id,date,value,notes\nTXN001,2026-01-01,2000,Payment';
      const result = parseCsvContent(csv);
      expect(result[0].receiptNo).toBe('TXN001');
      expect(result[0].amount).toBe(2000);
      expect(result[0].description).toBe('Payment');
    });

    it('should handle sender as phone number header', () => {
      const csv = 'sender,date,amount\n0712345678,2026-01-01,300';
      const result = parseCsvContent(csv);
      expect(result[0].phoneNumber).toBe('0712345678');
    });
  });
});
