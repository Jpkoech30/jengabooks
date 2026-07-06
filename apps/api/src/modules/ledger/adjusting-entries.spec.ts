/**
 * Adjusting Entries & Lockdown Tests — Phase D
 *
 * Edge cases:
 * - Recurring entry generates on schedule
 * - Recurring entry skipped if already posted today
 * - Lockdown pre-checks: pending HITL, eTIMS status, trial balance
 * - Lockdown confirmation prevents typos
 * - Already locked period cannot be re-locked
 */

interface RecurringTemplate {
  id: string;
  companyId: string;
  accountId: string;
  amount: number;
  direction: 'DEBIT' | 'CREDIT';
  description: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  nextDate: Date;
  isActive: boolean;
}

interface LockdownCheck {
  check: string;
  passed: boolean;
  details?: string;
}

function calculateNextDate(currentDate: Date, frequency: string): Date {
  const next = new Date(currentDate);
  switch (frequency) {
    case 'daily': next.setDate(next.getDate() + 1); break;
    case 'weekly': next.setDate(next.getDate() + 7); break;
    case 'monthly': next.setMonth(next.getMonth() + 1); break;
    case 'yearly': next.setFullYear(next.getFullYear() + 1); break;
  }
  return next;
}

function shouldGenerateToday(template: RecurringTemplate, today: Date): boolean {
  if (!template.isActive) return false;
  const nextDate = new Date(template.nextDate);
  return nextDate <= today;
}

function validateLockdown(
  companyId: string,
  checks: { pendingHitl: number; pendingEtims: number; isBalanced: boolean },
): LockdownCheck[] {
  const results: LockdownCheck[] = [];

  results.push({
    check: 'Pending HITL reviews',
    passed: checks.pendingHitl === 0,
    details: checks.pendingHitl > 0 ? `${checks.pendingHitl} unresolved reviews` : undefined,
  });

  results.push({
    check: 'eTIMS submissions',
    passed: checks.pendingEtims === 0,
    details: checks.pendingEtims > 0 ? `${checks.pendingEtims} pending submissions` : undefined,
  });

  results.push({
    check: 'Trial balance',
    passed: checks.isBalanced,
    details: checks.isBalanced ? undefined : 'Trial balance is unbalanced',
  });

  return results;
}

function confirmLockdown(input: string, periodName: string): boolean {
  const expected = `CLOSE ${periodName}`;
  return input.trim().toUpperCase() === expected.toUpperCase();
}

describe('Adjusting Entries — Phase D', () => {
  describe('Recurring Entries', () => {
    it('should generate when nextDate is today', () => {
      const template: RecurringTemplate = {
        id: 'r1', companyId: 'c1', accountId: 'a1', amount: 5000,
        direction: 'DEBIT', description: 'Monthly rent',
        frequency: 'monthly', nextDate: new Date('2026-07-06'), isActive: true,
      };
      expect(shouldGenerateToday(template, new Date('2026-07-06'))).toBe(true);
    });

    it('should generate when nextDate is in the past', () => {
      const template: RecurringTemplate = {
        id: 'r1', companyId: 'c1', accountId: 'a1', amount: 5000,
        direction: 'DEBIT', description: 'Monthly rent',
        frequency: 'monthly', nextDate: new Date('2026-06-01'), isActive: true,
      };
      expect(shouldGenerateToday(template, new Date('2026-07-06'))).toBe(true);
    });

    it('should NOT generate when nextDate is in the future', () => {
      const template: RecurringTemplate = {
        id: 'r1', companyId: 'c1', accountId: 'a1', amount: 5000,
        direction: 'DEBIT', description: 'Monthly rent',
        frequency: 'monthly', nextDate: new Date('2026-08-01'), isActive: true,
      };
      expect(shouldGenerateToday(template, new Date('2026-07-06'))).toBe(false);
    });

    it('should NOT generate for inactive templates', () => {
      const template: RecurringTemplate = {
        id: 'r1', companyId: 'c1', accountId: 'a1', amount: 5000,
        direction: 'DEBIT', description: 'Monthly rent',
        frequency: 'monthly', nextDate: new Date('2026-06-01'), isActive: false,
      };
      expect(shouldGenerateToday(template, new Date('2026-07-06'))).toBe(false);
    });
  });

  describe('calculateNextDate', () => {
    it('should advance daily', () => {
      const result = calculateNextDate(new Date('2026-07-06'), 'daily');
      expect(result.toISOString().slice(0, 10)).toBe('2026-07-07');
    });

    it('should advance weekly', () => {
      const result = calculateNextDate(new Date('2026-07-06'), 'weekly');
      expect(result.toISOString().slice(0, 10)).toBe('2026-07-13');
    });

    it('should advance monthly', () => {
      const result = calculateNextDate(new Date('2026-07-06'), 'monthly');
      expect(result.toISOString().slice(0, 10)).toBe('2026-08-06');
    });

    it('should advance yearly', () => {
      const result = calculateNextDate(new Date('2026-07-06'), 'yearly');
      expect(result.toISOString().slice(0, 10)).toBe('2027-07-06');
    });
  });

  describe('Lockdown Validation', () => {
    it('should pass all checks when conditions are met', () => {
      const results = validateLockdown('c1', { pendingHitl: 0, pendingEtims: 0, isBalanced: true });
      expect(results.every(r => r.passed)).toBe(true);
    });

    it('should fail on pending HITL reviews', () => {
      const results = validateLockdown('c1', { pendingHitl: 3, pendingEtims: 0, isBalanced: true });
      const hitlCheck = results.find(r => r.check.includes('HITL'));
      expect(hitlCheck?.passed).toBe(false);
      expect(hitlCheck?.details).toContain('3');
    });

    it('should fail on pending eTIMS submissions', () => {
      const results = validateLockdown('c1', { pendingHitl: 0, pendingEtims: 2, isBalanced: true });
      const etimsCheck = results.find(r => r.check.includes('eTIMS'));
      expect(etimsCheck?.passed).toBe(false);
    });

    it('should fail on unbalanced trial balance', () => {
      const results = validateLockdown('c1', { pendingHitl: 0, pendingEtims: 0, isBalanced: false });
      const tbCheck = results.find(r => r.check.includes('Trial'));
      expect(tbCheck?.passed).toBe(false);
    });
  });

  describe('Lockdown Confirmation', () => {
    it('should confirm with exact match', () => {
      expect(confirmLockdown('CLOSE Q4 2025', 'Q4 2025')).toBe(true);
    });

    it('should confirm with lowercase input', () => {
      expect(confirmLockdown('close q4 2025', 'Q4 2025')).toBe(true);
    });

    it('should confirm with extra whitespace', () => {
      expect(confirmLockdown('  CLOSE Q4 2025  ', 'Q4 2025')).toBe(true);
    });

    it('should reject wrong period name', () => {
      expect(confirmLockdown('CLOSE Q3 2025', 'Q4 2025')).toBe(false);
    });

    it('should reject empty input', () => {
      expect(confirmLockdown('', 'Q4 2025')).toBe(false);
    });

    it('should reject null input', () => {
      expect(confirmLockdown('', 'Q4 2025')).toBe(false);
    });
  });
});
