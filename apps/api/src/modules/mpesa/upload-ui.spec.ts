/**
 * Upload UI Logic Tests — B4 (Mobile Upload), B5 (Web Upload), B6 (Progress), B7 (Receipt)
 *
 * Edge cases:
 * - File size limits
 * - Unsupported file types
 * - Multiple file upload
 * - Upload progress tracking
 * - Receipt OCR data extraction
 */

type UploadProgress = {
  fileName: string;
  progress: number; // 0-100
  status: 'pending' | 'processing' | 'complete' | 'error';
  message?: string;
};

type ReceiptData = {
  amount?: number;
  date?: string;
  supplier?: string;
  vat?: number;
  confidence: number;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/pdf', 'text/plain'];

function validateUpload(file: { name: string; size: number; type: string }): { valid: boolean; error?: string } {
  if (!file || !file.name) {
    return { valid: false, error: 'No file provided' };
  }

  if (file.size === 0) {
    return { valid: false, error: 'File is empty' };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB` };
  }

  const ext = file.name.split('.').pop()?.toLowerCase();
  const isAllowedType = ALLOWED_TYPES.includes(file.type) ||
    ['csv', 'xlsx', 'xls', 'pdf'].includes(ext || '');

  if (!isAllowedType) {
    return { valid: false, error: `Unsupported file type: .${ext}. Accepted: CSV, XLSX, PDF` };
  }

  return { valid: true };
}

function calculateProgress(current: number, total: number): UploadProgress['progress'] {
  if (total === 0) return 0;
  return Math.min(Math.round((current / total) * 100), 100);
}

function parseReceiptText(text: string): ReceiptData {
  const result: ReceiptData = { confidence: 0 };
  let matches = 0;

  // Extract amount (KES X,XXX or X,XXX.XX patterns)
  const amountMatch = text.match(/(?:KES|KSh|ksh)?\s*([\d,]+\.?\d{0,2})/i);
  if (amountMatch) {
    result.amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    matches++;
  }

  // Extract date (DD/MM/YYYY or YYYY-MM-DD)
  const dateMatch = text.match(/(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    result.date = dateMatch[1];
    matches++;
  }

  // Extract supplier name (first line is often the supplier)
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length > 0) {
    // Supplier is typically the first non-empty, non-date line
    const firstLine = lines.find(l => !l.match(/(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})/));
    if (firstLine && firstLine.length > 2 && firstLine.length < 100) {
      result.supplier = firstLine.trim();
      matches++;
    }
  }

  // Extract VAT (16% of total or explicit VAT line)
  const vatMatch = text.match(/VAT\s*[:]?\s*KES?\s*([\d,]+\.?\d{0,2})/i);
  if (vatMatch) {
    result.vat = parseFloat(vatMatch[1].replace(/,/g, ''));
    matches++;
  }

  result.confidence = Math.min(matches / 4, 1);
  return result;
}

describe('Upload UI — B4/B5/B6/B7', () => {
  describe('validateUpload (B4/B5)', () => {
    it('should accept valid CSV file', () => {
      const result = validateUpload({ name: 'statement.csv', size: 1024, type: 'text/csv' });
      expect(result.valid).toBe(true);
    });

    it('should accept valid XLSX file', () => {
      const result = validateUpload({ name: 'statement.xlsx', size: 2048, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      expect(result.valid).toBe(true);
    });

    it('should accept PDF file', () => {
      const result = validateUpload({ name: 'receipt.pdf', size: 5120, type: 'application/pdf' });
      expect(result.valid).toBe(true);
    });

    it('should reject files exceeding 10MB', () => {
      const result = validateUpload({ name: 'large.csv', size: 15 * 1024 * 1024, type: 'text/csv' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('10MB');
    });

    it('should reject empty files', () => {
      const result = validateUpload({ name: 'empty.csv', size: 0, type: 'text/csv' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should reject unsupported file types', () => {
      const result = validateUpload({ name: 'image.png', size: 1024, type: 'image/png' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsupported');
    });

    it('should reject files without name', () => {
      const result = validateUpload({ name: '', size: 0, type: '' });
      expect(result.valid).toBe(false);
    });

    it('should detect file type by extension when MIME is generic', () => {
      const result = validateUpload({ name: 'data.csv', size: 1024, type: 'application/octet-stream' });
      expect(result.valid).toBe(true);
    });
  });

  describe('calculateProgress (B6)', () => {
    it('should return 0% for no progress', () => {
      expect(calculateProgress(0, 100)).toBe(0);
    });

    it('should return 50% at halfway', () => {
      expect(calculateProgress(50, 100)).toBe(50);
    });

    it('should return 100% when complete', () => {
      expect(calculateProgress(100, 100)).toBe(100);
    });

    it('should cap at 100%', () => {
      expect(calculateProgress(150, 100)).toBe(100);
    });

    it('should handle zero total gracefully', () => {
      expect(calculateProgress(0, 0)).toBe(0);
    });
  });

  describe('parseReceiptText (B7)', () => {
    it('should extract amount from receipt text', () => {
      const result = parseReceiptText('Nakumatt\nKES 5,000.00\n15/03/2026');
      expect(result.amount).toBe(5000);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should extract date from receipt', () => {
      const result = parseReceiptText('Shoprite\nItems total: KES 2,500\n2026-03-15');
      expect(result.date).toBe('2026-03-15');
    });

    it('should extract supplier name', () => {
      const result = parseReceiptText('Java House\nKES 1,200\n15/03/2026\nVAT: KES 192');
      expect(result.supplier).toBe('Java House');
    });

    it('should extract VAT amount', () => {
      const result = parseReceiptText('Safaricom\nKES 5,000\n15/03/2026\nVAT: KES 800');
      expect(result.vat).toBe(800);
    });

    it('should return low confidence for unparseable text', () => {
      const result = parseReceiptText('random unstructured text without clear patterns');
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should handle empty text', () => {
      const result = parseReceiptText('');
      expect(result.amount).toBeUndefined();
      expect(result.confidence).toBe(0);
    });

    it('should handle KSh notation', () => {
      const result = parseReceiptText('Total KSh 3,200');
      expect(result.amount).toBe(3200);
    });
  });
});
