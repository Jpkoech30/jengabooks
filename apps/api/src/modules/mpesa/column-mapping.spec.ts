/**
 * Column Mapping Logic Tests
 *
 * When a CSV format is unknown (not M-Pesa, not bank template),
 * the user maps source columns to known fields via drag-and-drop.
 */

type FieldMapping = {
  sourceColumn: string;
  targetField: string;
};

const KNOWN_FIELDS = [
  { id: 'transactionDate', label: 'Transaction Date', required: true },
  { id: 'description', label: 'Description', required: true },
  { id: 'amount', label: 'Amount', required: true },
  { id: 'receiptNo', label: 'Receipt Number', required: false },
  { id: 'phoneNumber', label: 'Phone Number', required: false },
];

function validateMapping(mappings: FieldMapping[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const mappedFields = new Set(mappings.map(m => m.targetField));

  // Check required fields are mapped
  for (const field of KNOWN_FIELDS) {
    if (field.required && !mappedFields.has(field.id)) {
      errors.push(`Required field "${field.label}" is not mapped`);
    }
  }

  // Check for duplicate target mappings
  const targetCounts = new Map<string, number>();
  for (const m of mappings) {
    targetCounts.set(m.targetField, (targetCounts.get(m.targetField) || 0) + 1);
  }
  for (const [field, count] of targetCounts) {
    if (count > 1) {
      errors.push(`Field "${field}" is mapped multiple times`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function autoSuggestMapping(csvHeaders: string[], knownFields: typeof KNOWN_FIELDS): FieldMapping[] {
  const suggestions: FieldMapping[] = [];
  const usedHeaders = new Set<string>();

  for (const header of csvHeaders) {
    const lower = header.toLowerCase().trim();

    // Try to match against known fields
    let matched = false;
    for (const field of knownFields) {
      const fieldLower = field.id.toLowerCase();
      if (lower.includes(fieldLower) || fieldLower.includes(lower)) {
        if (!usedHeaders.has(field.id)) {
          suggestions.push({ sourceColumn: header, targetField: field.id });
          usedHeaders.add(field.id);
          matched = true;
          break;
        }
      }
    }

    if (!matched) {
      suggestions.push({ sourceColumn: header, targetField: '' });
    }
  }

  return suggestions;
}

describe('Column Mapping', () => {
  describe('validateMapping', () => {
    it('should pass with all required fields mapped', () => {
      const result = validateMapping([
        { sourceColumn: 'Date', targetField: 'transactionDate' },
        { sourceColumn: 'Desc', targetField: 'description' },
        { sourceColumn: 'Amt', targetField: 'amount' },
      ]);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when required fields are missing', () => {
      const result = validateMapping([
        { sourceColumn: 'Date', targetField: 'transactionDate' },
      ]);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('Description'))).toBe(true);
    });

    it('should fail on duplicate target mappings', () => {
      const result = validateMapping([
        { sourceColumn: 'Date', targetField: 'transactionDate' },
        { sourceColumn: 'Desc', targetField: 'description' },
        { sourceColumn: 'Amt1', targetField: 'amount' },
        { sourceColumn: 'Amt2', targetField: 'amount' }, // duplicate
      ]);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('mapped multiple times'))).toBe(true);
    });

    it('should pass with optional fields unmapped', () => {
      const result = validateMapping([
        { sourceColumn: 'Date', targetField: 'transactionDate' },
        { sourceColumn: 'Desc', targetField: 'description' },
        { sourceColumn: 'Amt', targetField: 'amount' },
        // receiptNo and phoneNumber are optional — OK to skip
      ]);
      expect(result.valid).toBe(true);
    });
  });

  describe('autoSuggestMapping', () => {
    it('should suggest mappings based on header similarity', () => {
      const headers = ['Date', 'Description', 'Amount'];
      const result = autoSuggestMapping(headers, KNOWN_FIELDS);
      expect(result).toHaveLength(3);
      expect(result[0].targetField).toBe('transactionDate');
      expect(result[1].targetField).toBe('description');
      expect(result[2].targetField).toBe('amount');
    });

    it('should leave unmapped columns with empty target', () => {
      const headers = ['Date', 'Description', 'Amount', 'Unknown Column'];
      const result = autoSuggestMapping(headers, KNOWN_FIELDS);
      const unknown = result.find(r => r.sourceColumn === 'Unknown Column');
      expect(unknown?.targetField).toBe('');
    });

    it('should not suggest duplicate field mappings', () => {
      const headers = ['Date', 'Transaction Date'];
      const result = autoSuggestMapping(headers, KNOWN_FIELDS);
      // Only one should map to transactionDate
      const dateMappings = result.filter(r => r.targetField === 'transactionDate');
      expect(dateMappings).toHaveLength(1);
    });
  });
});
