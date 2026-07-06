/**
 * Bulk Approve Tests
 *
 * Allow users to select pending transactions and bulk-approve them.
 * Awards "Trust the AI" XP badge when approving 10+ at once.
 */

type BulkApproveResult = {
  approved: number;
  skipped: number;
  errors: string[];
  badgeAwarded: boolean;
};

interface Transaction {
  id: string;
  amount: number;
  description: string;
  confidence: number;
  mappedAccountId?: string;
}

function validateBulkApprove(
  transactions: Transaction[],
  userId: string,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (transactions.length === 0) {
    errors.push('No transactions selected');
  }

  for (const tx of transactions) {
    if (!tx.mappedAccountId && tx.confidence < 0.7) {
      errors.push(`Transaction "${tx.description}" has no mapped account and low confidence`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function shouldAwardTrustBadge(approvedCount: number): boolean {
  return approvedCount >= 10;
}

describe('Bulk Approve', () => {
  describe('validateBulkApprove', () => {
    it('should pass for valid transactions with mapped accounts', () => {
      const result = validateBulkApprove([
        { id: '1', amount: 1000, description: 'Safaricom', confidence: 0.95, mappedAccountId: 'acc-1' },
        { id: '2', amount: 500, description: 'Rent', confidence: 0.92, mappedAccountId: 'acc-2' },
      ], 'user-1');
      expect(result.valid).toBe(true);
    });

    it('should pass for high-confidence transactions without mapped accounts', () => {
      const result = validateBulkApprove([
        { id: '1', amount: 1000, description: 'Safaricom', confidence: 0.95 },
      ], 'user-1');
      expect(result.valid).toBe(true);
    });

    it('should fail for empty selection', () => {
      const result = validateBulkApprove([], 'user-1');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('No transactions selected');
    });

    it('should flag low-confidence transactions without mapped accounts', () => {
      const result = validateBulkApprove([
        { id: '1', amount: 1000, description: 'Unknown', confidence: 0.3 },
      ], 'user-1');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Unknown');
    });

    it('should allow mixed valid and flagged transactions', () => {
      const result = validateBulkApprove([
        { id: '1', amount: 1000, description: 'Safaricom', confidence: 0.95, mappedAccountId: 'acc-1' },
        { id: '2', amount: 500, description: 'Unknown', confidence: 0.3 },
      ], 'user-1');
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('shouldAwardTrustBadge', () => {
    it('should award badge for 10+ approvals', () => {
      expect(shouldAwardTrustBadge(10)).toBe(true);
      expect(shouldAwardTrustBadge(15)).toBe(true);
    });

    it('should not award badge for fewer than 10 approvals', () => {
      expect(shouldAwardTrustBadge(5)).toBe(false);
      expect(shouldAwardTrustBadge(9)).toBe(false);
    });

    it('should not award badge for zero approvals', () => {
      expect(shouldAwardTrustBadge(0)).toBe(false);
    });
  });
});
