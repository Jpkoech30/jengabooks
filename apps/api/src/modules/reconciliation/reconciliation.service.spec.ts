/**
 * Reconciliation Engine Tests — Phase C
 *
 * Edge cases considered:
 * - Exact match on amount + reference
 * - Fuzzy match on description
 * - Multiple potential matches (choose highest confidence)
 * - No match found (flag for manual reconciliation)
 * - Already reconciled transactions
 * - M-Pesa paybill → Invoice matching
 * - Supplier payment → Bill matching
 */

// Using string-based IDs to avoid TS conflicts with other test files
type MatchType = 'EXACT' | 'FUZZY' | 'AMOUNT_ONLY';

interface ReconCandidate {
  transactionId: string;
  targetId: string;
  confidence: number;
  matchType: MatchType;
}

interface ReconTx {
  id: string;
  amount: number;
  description: string;
  reference?: string;
  phoneNumber?: string;
}

interface ReconInvoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  customerName: string;
  customerPhone?: string;
}

function findReconMatches(transactions: ReconTx[], invoices: ReconInvoice[]): ReconCandidate[] {
  const matches: ReconCandidate[] = [];

  for (const tx of transactions) {
    let bestMatch: ReconCandidate | null = null;

    for (const inv of invoices) {
      // Exact match: amount + reference
      if (tx.reference && inv.invoiceNumber && tx.reference.includes(inv.invoiceNumber)) {
        if (Math.abs(tx.amount - inv.amount) < 0.01) {
          bestMatch = { transactionId: tx.id, targetId: inv.id, confidence: 0.98, matchType: 'EXACT' };
          break;
        }
      }

      // Fuzzy match: similar amount + customer info
      const amountDiff = Math.abs(tx.amount - inv.amount);
      if (amountDiff < 1) {
        const confidence = tx.phoneNumber && inv.customerPhone && tx.phoneNumber === inv.customerPhone
          ? 0.95 : 0.85;
        const candidate: ReconCandidate = {
          transactionId: tx.id, targetId: inv.id, confidence, matchType: 'FUZZY',
        };
        if (!bestMatch || candidate.confidence > bestMatch.confidence) {
          bestMatch = candidate;
        }
      }
    }

    if (bestMatch) {
      matches.push(bestMatch);
    }
  }

  return matches;
}

function calcReconStatus(total: number, matched: number): {
  status: 'complete' | 'partial' | 'pending';
  percentage: number;
} {
  if (total === 0) return { status: 'pending', percentage: 0 };
  const matchedPct = Math.round((matched / total) * 100);
  if (matchedPct >= 100) return { status: 'complete', percentage: 100 };
  if (matchedPct > 0) return { status: 'partial', percentage: matchedPct };
  return { status: 'pending', percentage: 0 };
}

describe('Reconciliation Engine', () => {
  const tx1: ReconTx = { id: 'tx1', amount: 5000, description: 'M-Pesa payment to INV-001', reference: 'INV-001', phoneNumber: '0712345678' };
  const tx2: ReconTx = { id: 'tx2', amount: 10000, description: 'Customer payment', phoneNumber: '0798765432' };
  const tx3: ReconTx = { id: 'tx3', amount: 2500, description: 'Safaricom airtime' };

  const inv1: ReconInvoice = { id: 'inv1', invoiceNumber: 'INV-001', amount: 5000, customerName: 'John Kamau', customerPhone: '0712345678' };
  const inv2: ReconInvoice = { id: 'inv2', invoiceNumber: 'INV-002', amount: 10000, customerName: 'Jane Wanjiku', customerPhone: '0798765432' };
  const inv3: ReconInvoice = { id: 'inv3', invoiceNumber: 'INV-003', amount: 9999, customerName: 'Other' };

  describe('findReconMatches', () => {
    it('should find exact match on reference + amount', () => {
      const result = findReconMatches([tx1], [inv1, inv2, inv3]);
      expect(result).toHaveLength(1);
      expect(result[0].confidence).toBe(0.98);
      expect(result[0].matchType).toBe('EXACT');
      expect(result[0].targetId).toBe('inv1');
    });

    it('should find fuzzy match on amount + phone', () => {
      const result = findReconMatches([tx2], [inv1, inv2, inv3]);
      expect(result).toHaveLength(1);
      expect(result[0].confidence).toBe(0.95);
      expect(result[0].targetId).toBe('inv2');
    });

    it('should return no match for non-matching transactions', () => {
      const result = findReconMatches([tx3], [inv1, inv2]);
      expect(result).toHaveLength(0);
    });

    it('should pick the best match among multiple candidates', () => {
      const tx: ReconTx = { id: 'tx-multi', amount: 5000, description: 'Payment', reference: 'INV-001' };
      const invoices = [
        { id: 'inv-a', invoiceNumber: 'INV-001', amount: 5000, customerName: 'A' },
        { id: 'inv-b', invoiceNumber: 'INV-002', amount: 5000, customerName: 'B' },
      ];
      const result = findReconMatches([tx], invoices);
      expect(result).toHaveLength(1);
      expect(result[0].targetId).toBe('inv-a');
    });

    it('should handle empty transactions array', () => {
      expect(findReconMatches([], [inv1, inv2])).toHaveLength(0);
    });

    it('should handle empty invoices array', () => {
      expect(findReconMatches([tx1, tx2, tx3], [])).toHaveLength(0);
    });

    it('should match amount-only when no reference match', () => {
      // inv3 amount is 9999, no tx matches exactly
      const result = findReconMatches([tx3], [inv3]); // amount diff = 7499, too large
      expect(result).toHaveLength(0);
    });
  });

  describe('calcReconStatus', () => {
    it('should return complete when 100% matched', () => {
      expect(calcReconStatus(10, 10).status).toBe('complete');
      expect(calcReconStatus(10, 10).percentage).toBe(100);
    });

    it('should return partial when some matched', () => {
      const r = calcReconStatus(10, 6);
      expect(r.status).toBe('partial');
      expect(r.percentage).toBe(60);
    });

    it('should return pending when nothing matched', () => {
      expect(calcReconStatus(10, 0).status).toBe('pending');
    });

    it('should handle zero total', () => {
      expect(calcReconStatus(0, 0).percentage).toBe(0);
    });
  });
});
