/**
 * Workflow Dashboard — Tests
 *
 * Aggregates status across all 5 bookkeeping phases into a unified view.
 */

type PhaseStatus = 'complete' | 'in_progress' | 'pending' | 'error';

interface Phase {
  id: string;
  label: string;
  icon: string;
  status: PhaseStatus;
  details?: string;
  actionUrl?: string;
}

interface WorkflowState {
  overallProgress: number; // 0-100
  phases: Phase[];
  currentPhase?: string;
}

function calculateWorkflow(data: {
  hasUploads: boolean;
  hasCategorized: boolean;
  categorizationRate: number; // 0-1
  hasReconciled: boolean;
  reconciliationRate: number; // 0-1
  hasAdjustments: boolean;
  lockdownComplete: boolean;
  reportsGenerated: boolean;
}): WorkflowState {
  let completedPhases = 0;
  const totalPhases = 5;
  const phases: Phase[] = [];

  // Phase 1: Data Collection
  if (data.hasUploads) {
    phases.push({ id: 'data-collection', label: 'Data Collection', icon: '📤', status: 'complete', details: 'Uploads complete' });
    completedPhases++;
  } else {
    phases.push({ id: 'data-collection', label: 'Data Collection', icon: '📤', status: 'pending', details: 'Upload M-Pesa or bank statements', actionUrl: '/mpesa' });
  }

  // Phase 2: Categorization
  if (data.categorizationRate >= 1) {
    phases.push({ id: 'categorization', label: 'Categorization', icon: '🏷️', status: 'complete', details: 'All transactions categorized' });
    completedPhases++;
  } else if (data.categorizationRate > 0) {
    phases.push({ id: 'categorization', label: 'Categorization', icon: '🏷️', status: 'in_progress', details: `${Math.round(data.categorizationRate * 100)}% categorized`, actionUrl: '/ledger' });
  } else {
    phases.push({ id: 'categorization', label: 'Categorization', icon: '🏷️', status: 'pending', details: 'Waiting for data', actionUrl: '/ledger' });
  }

  // Phase 3: Reconciliation
  if (data.reconciliationRate >= 1) {
    phases.push({ id: 'reconciliation', label: 'Reconciliation', icon: '🔄', status: 'complete', details: 'All matched' });
    completedPhases++;
  } else if (data.reconciliationRate > 0) {
    phases.push({ id: 'reconciliation', label: 'Reconciliation', icon: '🔄', status: 'in_progress', details: `${Math.round(data.reconciliationRate * 100)}% reconciled`, actionUrl: '/reports' });
  } else {
    phases.push({ id: 'reconciliation', label: 'Reconciliation', icon: '🔄', status: 'pending', details: 'Pending categorization', actionUrl: '/reports' });
  }

  // Phase 4: Adjustments & Lockdown
  if (data.lockdownComplete) {
    phases.push({ id: 'adjustments', label: 'Month-End Close', icon: '🔒', status: 'complete', details: 'Period locked' });
    completedPhases++;
  } else if (data.hasAdjustments) {
    phases.push({ id: 'adjustments', label: 'Month-End Close', icon: '🔒', status: 'in_progress', details: 'Adjustments posted, pending lockdown', actionUrl: '/ledger' });
  } else {
    phases.push({ id: 'adjustments', label: 'Month-End Close', icon: '🔒', status: 'pending', details: 'Waiting for reconciliation', actionUrl: '/ledger' });
  }

  // Phase 5: Review & Reporting
  if (data.reportsGenerated) {
    phases.push({ id: 'reporting', label: 'Reporting', icon: '📊', status: 'complete', details: 'Reports ready to share' });
    completedPhases++;
  } else {
    phases.push({ id: 'reporting', label: 'Reporting', icon: '📊', status: 'pending', details: 'Generate reports', actionUrl: '/reports' });
  }

  const currentPhase = phases.find(p => p.status === 'in_progress' || (p.status === 'pending' && p.id === 'data-collection'));

  return {
    overallProgress: Math.round((completedPhases / totalPhases) * 100),
    phases,
    currentPhase: currentPhase?.id,
  };
}

describe('Workflow Dashboard', () => {
  describe('calculateWorkflow', () => {
    it('should show empty state for new client', () => {
      const result = calculateWorkflow({
        hasUploads: false, hasCategorized: false, categorizationRate: 0,
        hasReconciled: false, reconciliationRate: 0,
        hasAdjustments: false, lockdownComplete: false, reportsGenerated: false,
      });
      expect(result.overallProgress).toBe(0);
      expect(result.phases[0].status).toBe('pending');
      expect(result.currentPhase).toBe('data-collection');
    });

    it('should show progress after data upload', () => {
      const result = calculateWorkflow({
        hasUploads: true, hasCategorized: true, categorizationRate: 0.5,
        hasReconciled: false, reconciliationRate: 0,
        hasAdjustments: false, lockdownComplete: false, reportsGenerated: false,
      });
      expect(result.overallProgress).toBe(20); // 1/5 = 20%
      expect(result.phases[0].status).toBe('complete');
      expect(result.phases[1].status).toBe('in_progress');
    });

    it('should show complete state for finished month', () => {
      const result = calculateWorkflow({
        hasUploads: true, hasCategorized: true, categorizationRate: 1,
        hasReconciled: true, reconciliationRate: 1,
        hasAdjustments: true, lockdownComplete: true, reportsGenerated: true,
      });
      expect(result.overallProgress).toBe(100);
      expect(result.phases.every(p => p.status === 'complete')).toBe(true);
      expect(result.currentPhase).toBeUndefined();
    });

    it('should handle partial reconciliation', () => {
      const result = calculateWorkflow({
        hasUploads: true, hasCategorized: true, categorizationRate: 1,
        hasReconciled: true, reconciliationRate: 0.6,
        hasAdjustments: false, lockdownComplete: false, reportsGenerated: false,
      });
      expect(result.phases[2].status).toBe('in_progress');
      expect(result.phases[2].details).toContain('60%');
    });

    it('should show correct progress for each completed phase', () => {
      const result = calculateWorkflow({
        hasUploads: true, hasCategorized: true, categorizationRate: 1,
        hasReconciled: true, reconciliationRate: 1,
        hasAdjustments: false, lockdownComplete: false, reportsGenerated: false,
      });
      expect(result.overallProgress).toBe(60); // 3/5 = 60%
    });
  });
});
