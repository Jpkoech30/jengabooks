import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Modal } from '../components/ui/modal';
import { Table } from '../components/ui/table';
import { SlideOutPanel } from '../components/ui/slide-out-panel';
import { PageShell } from '../components/layout/page-shell';
import { PageState } from '../components/ui/page-state';
import { EmptyState } from '../components/ui/empty-state';
import { showToast } from '../stores/ui-store';
import { api } from '../lib/api-client';

// ── Types ──────────────────────────────────────────────────────────────────

interface AuditLock {
  id: string;
  fiscalYear: number;
  periodStart: string;
  periodEnd: string;
  lockType: 'FULL' | 'MODULE_SPECIFIC' | 'ROLE_BASED';
  status: 'LOCKED' | 'OPEN' | 'AMENDED';
  modules?: string[];
  lockedBy: { id: string; name: string };
  lockedAt: string;
  amendedAt?: string;
  amendReason?: string;
  unlockedModules?: string[];
}

interface ExternalAccess {
  id: string;
  recipientName: string;
  recipientEmail: string;
  accessLevel: 'VIEW' | 'LIMITED' | 'FULL';
  purpose: string;
  expiresAt: string;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  grantedBy: { id: string; name: string };
  grantedAt: string;
}

interface RedFlag {
  severity: 'error' | 'warning' | 'info';
  icon: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

interface AuditDashboard {
  complianceScore: number;
  etimsValidationRate: number;
  missingDocuments: number;
  auditRiskLevel: 'Low' | 'Medium' | 'High';
  totalInvoices: number;
  validatedInvoices: number;
}

const LOCK_TYPE_OPTIONS = [
  { value: 'FULL', label: 'Full Lock' },
  { value: 'MODULE_SPECIFIC', label: 'Module Specific' },
  { value: 'ROLE_BASED', label: 'Role Based' },
];

const MODULE_OPTIONS = [
  { value: 'LEDGER', label: '📒 Ledger' },
  { value: 'MPESA', label: '📱 M-Pesa' },
  { value: 'ETIMS', label: '🧾 eTIMS' },
  { value: 'PAYROLL', label: '💰 Payroll' },
];

const ACCESS_LEVEL_OPTIONS = [
  { value: 'VIEW', label: 'View Only' },
  { value: 'LIMITED', label: 'Limited Access' },
  { value: 'FULL', label: 'Full Access' },
];

const FISCAL_PERIODS: Array<{ label: string; start: () => string; end: () => string }> = [
  {
    label: 'Q1 2026',
    start: () => '2026-01-01',
    end: () => '2026-03-31',
  },
  {
    label: 'Q2 2026',
    start: () => '2026-04-01',
    end: () => '2026-06-30',
  },
  {
    label: 'Q3 2026',
    start: () => '2026-07-01',
    end: () => '2026-09-30',
  },
  {
    label: 'Q4 2026',
    start: () => '2026-10-01',
    end: () => '2026-12-31',
  },
  {
    label: 'FY 2026',
    start: () => '2026-01-01',
    end: () => '2026-12-31',
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function lockStatusBadge(status: string): 'error' | 'success' | 'warning' | 'info' {
  switch (status) {
    case 'LOCKED': return 'error';
    case 'OPEN': return 'success';
    case 'AMENDED': return 'warning';
    default: return 'info';
  }
}

function riskBadge(level: string): 'success' | 'warning' | 'error' | 'info' {
  switch (level) {
    case 'Low': return 'success';
    case 'Medium': return 'warning';
    case 'High': return 'error';
    default: return 'info';
  }
}

function riskEmoji(level: string): string {
  switch (level) {
    case 'Low': return '🟢';
    case 'Medium': return '🟡';
    case 'High': return '🔴';
    default: return '⚪';
  }
}

// ── Main Component ──────────────────────────────────────────────────────────

export function Audit() {
  // ── Data State ──────────────────────────────────────────────────────────
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [dashboard, setDashboard] = React.useState<AuditDashboard | null>(null);
  const [locks, setLocks] = React.useState<AuditLock[]>([]);
  const [externalAccessList, setExternalAccessList] = React.useState<ExternalAccess[]>([]);
  const [redFlags, setRedFlags] = React.useState<RedFlag[]>([]);

  // ── Lock Create Panel State ─────────────────────────────────────────────
  const [showCreateLock, setShowCreateLock] = React.useState(false);
  const [newLock, setNewLock] = React.useState({
    fiscalYear: new Date().getFullYear(),
    periodStart: '',
    periodEnd: '',
    lockType: 'FULL' as string,
    modules: [] as string[],
  });
  const [creatingLock, setCreatingLock] = React.useState(false);

  // ── Lock Amend Panel State ──────────────────────────────────────────────
  const [amendingLock, setAmendingLock] = React.useState<AuditLock | null>(null);
  const [amendReason, setAmendReason] = React.useState('');
  const [unlockModules, setUnlockModules] = React.useState<string[]>([]);
  const [submittingAmend, setSubmittingAmend] = React.useState(false);

  // ── External Access Panel State ─────────────────────────────────────────
  const [showGrantAccess, setShowGrantAccess] = React.useState(false);
  const [newAccess, setNewAccess] = React.useState({
    recipientName: '',
    recipientEmail: '',
    accessLevel: 'VIEW' as string,
    purpose: '',
    expiresAt: '',
  });
  const [grantingAccess, setGrantingAccess] = React.useState(false);

  // ── Revoke Confirmation State ───────────────────────────────────────────
  const [revokingId, setRevokingId] = React.useState<string | null>(null);
  const [revokingBusy, setRevokingBusy] = React.useState(false);

  // ── Export State ────────────────────────────────────────────────────────
  const [exporting, setExporting] = React.useState<string | null>(null);

  // ── Data Loading ────────────────────────────────────────────────────────

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [etimsData, locksData, accessData, docsData] = await Promise.all([
        api.get<{ items: any[]; total: number }>('/etims/invoices').catch(() => ({ items: [], total: 0 })),
        api.get<AuditLock[]>('/audit/locks').catch(() => []),
        api.get<ExternalAccess[]>('/audit/external-access').catch(() => []),
        api.get<{ total: number }>('/documents', { companyId: '' }).catch(() => ({ total: 0 })),
      ]);

      const totalInvoices = etimsData.total || etimsData.items?.length || 0;
      const validatedInvoices = (etimsData.items || []).filter(
        (i: any) => i.etimsSubmission?.status === 'ACCEPTED',
      ).length;
      const etimsRate = totalInvoices > 0 ? Math.round((validatedInvoices / totalInvoices) * 100) : 0;
      const missingDocs = Math.max(0, 3 - (docsData.total || 0));
      const complianceScore = Math.min(100, Math.max(0, Math.round((validatedInvoices / Math.max(totalInvoices, 1)) * 85 + (missingDocs === 0 ? 15 : 0))));
      const auditRiskLevel = complianceScore >= 70 ? 'Low' : complianceScore >= 40 ? 'Medium' : 'High';

      setDashboard({
        complianceScore,
        etimsValidationRate: etimsRate,
        missingDocuments: missingDocs,
        auditRiskLevel,
        totalInvoices,
        validatedInvoices,
      });

      setLocks(locksData);
      setExternalAccessList(accessData);

      // Build red flags
      const flags: RedFlag[] = [];
      if (missingDocs > 0) {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const missingMonths = monthNames.slice(0, Math.min(missingDocs, 12));
        flags.push({
          severity: 'error',
          icon: '⚠️',
          description: `${missingDocs} missing bank statement${missingDocs > 1 ? 's' : ''} (${missingMonths.join(', ')} 2026)`,
        });
      }
      const nonCompliantCount = (etimsData.items || []).filter(
        (i: any) => i.etimsSubmission?.status === 'FAILED',
      ).length;
      if (nonCompliantCount > 0) {
        flags.push({
          severity: 'warning',
          icon: '⚠️',
          description: `${nonCompliantCount} eTIMS invoice${nonCompliantCount > 1 ? 's have' : ' has'} non-compliant supplier PINs`,
        });
      }
      if (totalInvoices > 0 && etimsRate < 50) {
        flags.push({
          severity: 'warning',
          icon: '⚠️',
          description: `${totalInvoices - validatedInvoices} unreconciled invoice${totalInvoices - validatedInvoices > 1 ? 's' : ''} awaiting eTIMS validation`,
        });
      }
      setRedFlags(flags);
    } catch (e: any) {
      console.error('Failed to load audit data:', e);
      setError(e?.response?.data?.message || 'Failed to load audit data');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { loadData(); }, [loadData]);

  // ── Export Handlers ──────────────────────────────────────────────────────

  const handleExport = async (endpoint: string, filename: string) => {
    setExporting(filename);
    try {
      const data = await api.get<any>(endpoint);
      const csv = typeof data === 'string' ? data : jsonToCsv(data);
      downloadCsv(`${filename}-${new Date().toISOString().split('T')[0]}.csv`, csv);
      showToast('success', 'Downloaded', `${filename} exported successfully`);
    } catch (e: any) {
      showToast('error', 'Export failed', e?.response?.data?.message || 'Could not export data');
    } finally {
      setExporting(null);
    }
  };

  // ── Lock Handlers ────────────────────────────────────────────────────────

  const handleCreateLock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLock.periodStart || !newLock.periodEnd) {
      showToast('warning', 'Validation', 'Period start and end dates are required');
      return;
    }
    setCreatingLock(true);
    try {
      await api.post('/audit/locks', {
        fiscalYear: newLock.fiscalYear,
        periodStart: newLock.periodStart,
        periodEnd: newLock.periodEnd,
        lockType: newLock.lockType,
        modules: newLock.lockType === 'MODULE_SPECIFIC' ? newLock.modules : undefined,
      });
      showToast('success', 'Lock created', 'Lock-down period has been applied');
      setShowCreateLock(false);
      setNewLock({
        fiscalYear: new Date().getFullYear(),
        periodStart: '',
        periodEnd: '',
        lockType: 'FULL',
        modules: [],
      });
      loadData();
    } catch (e: any) {
      showToast('error', 'Failed to create lock', e?.response?.data?.message || 'Please try again');
    } finally {
      setCreatingLock(false);
    }
  };

  const handleAmendLock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amendReason.trim()) {
      showToast('warning', 'Validation', 'Reason is required for audit trail');
      return;
    }
    if (!amendingLock) return;
    setSubmittingAmend(true);
    try {
      await api.post(`/audit/locks/${amendingLock.id}/amend`, {
        reason: amendReason,
        unlockModules: unlockModules,
      });
      showToast('success', 'Lock amended', 'Amendment has been recorded in audit trail');
      setAmendingLock(null);
      setAmendReason('');
      setUnlockModules([]);
      loadData();
    } catch (e: any) {
      showToast('error', 'Failed to amend lock', e?.response?.data?.message || 'Please try again');
    } finally {
      setSubmittingAmend(false);
    }
  };

  // ── External Access Handlers ─────────────────────────────────────────────

  const handleGrantAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccess.recipientName || !newAccess.recipientEmail || !newAccess.purpose || !newAccess.expiresAt) {
      showToast('warning', 'Validation', 'All fields are required');
      return;
    }
    setGrantingAccess(true);
    try {
      await api.post('/audit/external-access', newAccess);
      showToast('success', 'Access granted', 'External access has been granted');
      setShowGrantAccess(false);
      setNewAccess({
        recipientName: '',
        recipientEmail: '',
        accessLevel: 'VIEW',
        purpose: '',
        expiresAt: '',
      });
      loadData();
    } catch (e: any) {
      showToast('error', 'Failed to grant access', e?.response?.data?.message || 'Please try again');
    } finally {
      setGrantingAccess(false);
    }
  };

  const handleRevokeAccess = async () => {
    if (!revokingId) return;
    setRevokingBusy(true);
    try {
      await api.post(`/audit/external-access/${revokingId}/revoke`);
      showToast('success', 'Access revoked', 'External access has been revoked');
      setRevokingId(null);
      loadData();
    } catch (e: any) {
      showToast('error', 'Failed to revoke', e?.response?.data?.message || 'Please try again');
    } finally {
      setRevokingBusy(false);
    }
  };

  const toggleModule = (module: string, list: string[], setter: (v: string[]) => void) => {
    if (list.includes(module)) {
      setter(list.filter((m) => m !== module));
    } else {
      setter([...list, module]);
    }
  };

  const applyPeriodPreset = (preset: typeof FISCAL_PERIODS[number]) => {
    setNewLock((prev) => ({
      ...prev,
      periodStart: preset.start(),
      periodEnd: preset.end(),
    }));
  };

  // ── Loading / Error / Empty States ──────────────────────────────────────

  if (loading) {
    return (
      <PageShell title="KRA Audit Defense Kit" subtitle="Audit readiness and lock-down period management">
        <PageState state="loading" skeletonRows={6}><></></PageState>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell title="KRA Audit Defense Kit" subtitle="Audit readiness and lock-down period management">
        <PageState
          state="error"
          error={error}
          onRetry={loadData}
        ><></></PageState>
      </PageShell>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <PageShell
      title="KRA Audit Defense Kit"
      subtitle="Audit readiness, compliance monitoring, and lock-down period management"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={loadData}>
            🔄 Refresh
          </Button>
        </div>
      }
    >
      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Compliance Score</p>
                <p className={`text-3xl font-bold mt-1 ${
                  (dashboard?.complianceScore ?? 0) >= 70
                    ? 'text-green-600 dark:text-green-400'
                    : (dashboard?.complianceScore ?? 0) >= 40
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-red-600 dark:text-red-400'
                }`}>
                  {(dashboard?.complianceScore ?? 0) >= 70 ? '🟢' : (dashboard?.complianceScore ?? 0) >= 40 ? '🟡' : '🔴'} {dashboard?.complianceScore ?? 0}%
                </p>
              </div>
              <span className="text-3xl" aria-hidden="true">🛡️</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">eTIMS Validated</p>
                <p className={`text-3xl font-bold mt-1 ${
                  (dashboard?.etimsValidationRate ?? 0) >= 70
                    ? 'text-green-600 dark:text-green-400'
                    : (dashboard?.etimsValidationRate ?? 0) >= 40
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-red-600 dark:text-red-400'
                }`}>
                  {dashboard?.etimsValidationRate ?? 0}%
                </p>
              </div>
              <span className="text-3xl" aria-hidden="true">🧾</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {dashboard?.validatedInvoices ?? 0} of {dashboard?.totalInvoices ?? 0} invoices
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Missing Documents</p>
                <p className={`text-3xl font-bold mt-1 ${
                  (dashboard?.missingDocuments ?? 0) > 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-green-600 dark:text-green-400'
                }`}>
                  {dashboard?.missingDocuments ?? 0}
                </p>
              </div>
              <span className="text-3xl" aria-hidden="true">📄</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Audit Risk Level</p>
                <p className={`text-3xl font-bold mt-1 ${
                  dashboard?.auditRiskLevel === 'Low'
                    ? 'text-green-600 dark:text-green-400'
                    : dashboard?.auditRiskLevel === 'Medium'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-red-600 dark:text-red-400'
                }`}>
                  {riskEmoji(dashboard?.auditRiskLevel ?? 'Low')} {dashboard?.auditRiskLevel ?? 'Low'}
                </p>
              </div>
              <span className="text-3xl" aria-hidden="true">🎯</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Red Flags Section ──────────────────────────────────────────────── */}
      {redFlags.length > 0 && (
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-2">
                <span>🔴</span> Red Flags
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {redFlags.map((flag, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 rounded-lg bg-red-50 dark:bg-red-900/10 p-4 border border-red-100 dark:border-red-900/30"
                >
                  <span className="text-lg shrink-0 mt-0.5" aria-hidden="true">{flag.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-red-800 dark:text-red-200">{flag.description}</p>
                  </div>
                  {flag.action && (
                    <Button variant="ghost" size="sm" onClick={flag.action.onClick}>
                      {flag.action.label}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Export Section ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Export for KRA Audit</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Button
              variant="secondary"
              size="md"
              leftIcon={<span>📥</span>}
              isLoading={exporting === 'etims-invoices'}
              disabled={exporting !== null}
              onClick={() => handleExport('/reports/audit-trail', 'etims-invoices')}
            >
              Export All eTIMS Invoices
            </Button>
            <Button
              variant="secondary"
              size="md"
              leftIcon={<span>📥</span>}
              isLoading={exporting === 'audit-trail'}
              disabled={exporting !== null}
              onClick={() => handleExport('/reports/audit-trail', 'audit-trail')}
            >
              Export Audit Trail
            </Button>
            <Button
              variant="secondary"
              size="md"
              leftIcon={<span>📥</span>}
              isLoading={exporting === 'documents'}
              disabled={exporting !== null}
              onClick={() => handleExport('/documents', 'all-documents')}
            >
              Export All Documents
            </Button>
            <Button
              variant="secondary"
              size="md"
              leftIcon={<span>📥</span>}
              isLoading={exporting === 'gl'}
              disabled={exporting !== null}
              onClick={() => handleExport('/reports/trial-balance', 'general-ledger')}
            >
              Export GL (PDF/CSV)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Lock-Down Periods Section ───────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Lock-Down Periods</CardTitle>
          <Button variant="primary" size="sm" onClick={() => setShowCreateLock(true)}>
            + New Lock Period
          </Button>
        </CardHeader>
        <CardContent>
          {locks.length === 0 ? (
            <EmptyState
              icon="🔓"
              title="No lock-down periods configured"
              description="Lock-down periods prevent modifications to financial data during audit windows. Configure your first lock period to secure your data."
              action={{ label: 'Create Lock Period', onClick: () => setShowCreateLock(true) }}
            />
          ) : (
            <Table
              columns={[
                {
                  key: 'period',
                  label: 'Period',
                  render: (lock: AuditLock) => (
                    <span className="font-medium text-kenya-green-900 dark:text-kenya-green-50">
                      {lock.fiscalYear} —
                      {' '}{formatDate(lock.periodStart)} to {formatDate(lock.periodEnd)}
                    </span>
                  ),
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (lock: AuditLock) => {
                    const emoji = lock.status === 'LOCKED' ? '🔒' : lock.status === 'OPEN' ? '🔓' : '🔶';
                    return (
                      <Badge variant={lockStatusBadge(lock.status)} size="sm">
                        {emoji} {lock.status}
                      </Badge>
                    );
                  },
                },
                {
                  key: 'lockType',
                  label: 'Type',
                  render: (lock: AuditLock) => (
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {lock.lockType.replace(/_/g, ' ')}
                    </span>
                  ),
                },
                {
                  key: 'modules',
                  label: 'Modules',
                  render: (lock: AuditLock) => {
                    if (!lock.modules || lock.modules.length === 0) return <span className="text-xs text-gray-400">All</span>;
                    return (
                      <div className="flex gap-1 flex-wrap">
                        {lock.modules.map((m) => (
                          <Badge key={m} variant="info" size="sm">{m}</Badge>
                        ))}
                      </div>
                    );
                  },
                },
                {
                  key: 'lockedAt',
                  label: 'Locked',
                  render: (lock: AuditLock) => (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {lock.lockedAt ? formatDate(lock.lockedAt) : '—'}
                    </span>
                  ),
                },
                {
                  key: 'lockedBy',
                  label: 'Locked By',
                  render: (lock: AuditLock) => (
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {lock.lockedBy?.name || '—'}
                    </span>
                  ),
                },
                {
                  key: 'actions',
                  label: 'Actions',
                  className: 'text-right',
                  render: (lock: AuditLock) => (
                    <div className="flex gap-2 justify-end">
                      {lock.status === 'LOCKED' || lock.status === 'AMENDED' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAmendingLock(lock);
                            setAmendReason('');
                            setUnlockModules([]);
                          }}
                        >
                          Amend
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setNewLock((prev) => ({
                              ...prev,
                              fiscalYear: lock.fiscalYear,
                              periodStart: lock.periodStart,
                              periodEnd: lock.periodEnd,
                            }));
                            setShowCreateLock(true);
                          }}
                        >
                          Lock
                        </Button>
                      )}
                    </div>
                  ),
                },
              ]}
              data={locks}
              rowKey={(lock: AuditLock) => lock.id}
              emptyMessage="No lock-down periods configured"
            />
          )}
        </CardContent>
      </Card>

      {/* ── External Access Section ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>External Access</CardTitle>
          <Button variant="primary" size="sm" onClick={() => setShowGrantAccess(true)}>
            + Grant External Access
          </Button>
        </CardHeader>
        <CardContent>
          {externalAccessList.length === 0 ? (
            <EmptyState
              icon="🔐"
              title="No external access grants"
              description="Grant temporary access to external auditors, KRA officials, or compliance officers."
              action={{ label: 'Grant Access', onClick: () => setShowGrantAccess(true) }}
            />
          ) : (
            <Table
              columns={[
                {
                  key: 'recipient',
                  label: 'Recipient',
                  render: (access: ExternalAccess) => (
                    <div>
                      <p className="font-medium text-kenya-green-900 dark:text-kenya-green-50">
                        {access.recipientName}
                      </p>
                      <p className="text-xs text-gray-400">{access.recipientEmail}</p>
                    </div>
                  ),
                },
                {
                  key: 'accessLevel',
                  label: 'Level',
                  render: (access: ExternalAccess) => (
                    <Badge
                      variant={access.accessLevel === 'FULL' ? 'warning' : access.accessLevel === 'LIMITED' ? 'info' : 'success'}
                      size="sm"
                    >
                      {access.accessLevel.replace(/_/g, ' ')}
                    </Badge>
                  ),
                },
                {
                  key: 'expiresAt',
                  label: 'Expires',
                  render: (access: ExternalAccess) => (
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(access.expiresAt)}
                    </span>
                  ),
                },
                {
                  key: 'purpose',
                  label: 'Purpose',
                  render: (access: ExternalAccess) => (
                    <span className="text-sm text-gray-700 dark:text-gray-300 max-w-[200px] truncate block">
                      {access.purpose}
                    </span>
                  ),
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (access: ExternalAccess) => (
                    <Badge
                      variant={access.status === 'ACTIVE' ? 'success' : access.status === 'EXPIRED' ? 'warning' : 'error'}
                      size="sm"
                    >
                      {access.status}
                    </Badge>
                  ),
                },
                {
                  key: 'actions',
                  label: 'Actions',
                  className: 'text-right',
                  render: (access: ExternalAccess) => (
                    access.status === 'ACTIVE' ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRevokingId(access.id);
                        }}
                      >
                        Revoke
                      </Button>
                    ) : null
                  ),
                },
              ]}
              data={externalAccessList}
              rowKey={(access: ExternalAccess) => access.id}
              emptyMessage="No external access grants"
            />
          )}
        </CardContent>
      </Card>

      {/* ── Create Lock SlideOutPanel ──────────────────────────────────────── */}
      <SlideOutPanel
        isOpen={showCreateLock}
        onClose={() => setShowCreateLock(false)}
        title="Create Lock Period"
        subtitle="Lock-down fiscal periods to prevent modifications during audit"
        footer={
          <div className="flex gap-3 w-full">
            <Button variant="ghost" size="md" className="flex-1" onClick={() => setShowCreateLock(false)}>
              Cancel
            </Button>
            <Button
              size="md"
              className="flex-1"
              isLoading={creatingLock}
              disabled={creatingLock}
              onClick={handleCreateLock}
            >
              {creatingLock ? 'Creating...' : 'Create Lock'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreateLock} className="flex flex-col gap-5">
          {/* Fiscal Year */}
          <Input
            label="Fiscal Year"
            type="number"
            value={String(newLock.fiscalYear)}
            onChange={(e) => setNewLock((prev) => ({ ...prev, fiscalYear: parseInt(e.target.value) || new Date().getFullYear() }))}
            required
          />

          {/* Period Presets */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Quick Select
            </label>
            <div className="flex flex-wrap gap-1.5">
              {FISCAL_PERIODS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPeriodPreset(preset)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 hover:border-kenya-green-300 hover:text-kenya-green-700 dark:hover:text-kenya-green-300 transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Period Dates */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Period Start"
              type="date"
              value={newLock.periodStart}
              onChange={(e) => setNewLock((prev) => ({ ...prev, periodStart: e.target.value }))}
              required
            />
            <Input
              label="Period End"
              type="date"
              value={newLock.periodEnd}
              onChange={(e) => setNewLock((prev) => ({ ...prev, periodEnd: e.target.value }))}
              required
            />
          </div>

          {/* Lock Type */}
          <Select
            label="Lock Type"
            value={newLock.lockType}
            onChange={(e) => setNewLock((prev) => ({ ...prev, lockType: e.target.value, modules: [] }))}
            options={LOCK_TYPE_OPTIONS}
          />

          {/* Module Selection (only for MODULE_SPECIFIC) */}
          {newLock.lockType === 'MODULE_SPECIFIC' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Modules to Lock
              </label>
              <div className="flex flex-col gap-2">
                {MODULE_OPTIONS.map((mod) => (
                  <label
                    key={mod.value}
                    className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={newLock.modules.includes(mod.value)}
                      onChange={() => toggleModule(mod.value, newLock.modules, (v) => setNewLock((prev) => ({ ...prev, modules: v })))}
                      className="h-4 w-4 rounded border-gray-300 text-kenya-green-500 focus:ring-kenya-green-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{mod.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </form>
      </SlideOutPanel>

      {/* ── Amend Lock SlideOutPanel ────────────────────────────────────────── */}
      <SlideOutPanel
        isOpen={amendingLock !== null}
        onClose={() => setAmendingLock(null)}
        title={amendingLock ? `Amend Lock — ${amendingLock.fiscalYear}` : ''}
        subtitle={amendingLock ? `${formatDate(amendingLock.periodStart)} to ${formatDate(amendingLock.periodEnd)}` : undefined}
        footer={
          <div className="flex gap-3 w-full">
            <Button variant="ghost" size="md" className="flex-1" onClick={() => setAmendingLock(null)}>
              Cancel
            </Button>
            <Button
              size="md"
              className="flex-1"
              isLoading={submittingAmend}
              disabled={submittingAmend || !amendReason.trim()}
              onClick={handleAmendLock}
            >
              {submittingAmend ? 'Submitting...' : 'Submit Amendment'}
            </Button>
          </div>
        }
      >
        {amendingLock && (
          <form onSubmit={handleAmendLock} className="flex flex-col gap-5">
            {/* Warning Banner */}
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
              <div className="flex items-start gap-3">
                <span className="text-lg shrink-0" aria-hidden="true">⚠️</span>
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    This action is recorded in the audit trail
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    All amendments to lock-down periods are permanently logged for compliance purposes.
                  </p>
                </div>
              </div>
            </div>

            {/* Current Lock Details */}
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Current Lock Details</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Type:</span>{' '}
                  <span className="font-medium text-gray-800 dark:text-gray-200">{amendingLock.lockType.replace(/_/g, ' ')}</span>
                </div>
                <div>
                  <span className="text-gray-500">Status:</span>{' '}
                  <Badge variant={lockStatusBadge(amendingLock.status)} size="sm">{amendingLock.status}</Badge>
                </div>
                <div>
                  <span className="text-gray-500">Locked By:</span>{' '}
                  <span className="font-medium text-gray-800 dark:text-gray-200">{amendingLock.lockedBy?.name || '—'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Locked At:</span>{' '}
                  <span className="font-medium text-gray-800 dark:text-gray-200">{amendingLock.lockedAt ? formatDate(amendingLock.lockedAt) : '—'}</span>
                </div>
              </div>
              {amendingLock.modules && amendingLock.modules.length > 0 && (
                <div className="mt-2">
                  <span className="text-gray-500 text-sm">Locked Modules:</span>{' '}
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {amendingLock.modules.map((m) => (
                      <Badge key={m} variant="info" size="sm">{m}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Module Unlock Toggles */}
            {amendingLock.modules && amendingLock.modules.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Modules to Unlock
                </label>
                <div className="flex flex-col gap-2">
                  {amendingLock.modules.map((mod) => (
                    <label
                      key={mod}
                      className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={unlockModules.includes(mod)}
                        onChange={() => toggleModule(mod, unlockModules, setUnlockModules)}
                        className="h-4 w-4 rounded border-gray-300 text-kenya-green-500 focus:ring-kenya-green-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Unlock {mod}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Reason */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={amendReason}
                onChange={(e) => setAmendReason(e.target.value)}
                className="w-full min-h-[100px] rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm dark:border-gray-700 dark:bg-kenya-surface-dark dark:text-gray-100 touch-target"
                placeholder="Explain why this lock-down period is being amended (recorded in audit trail)..."
                required
              />
              <p className="text-xs text-gray-400">
                This reason will be permanently recorded in the audit trail.
              </p>
            </div>
          </form>
        )}
      </SlideOutPanel>

      {/* ── Grant External Access SlideOutPanel ─────────────────────────────── */}
      <SlideOutPanel
        isOpen={showGrantAccess}
        onClose={() => setShowGrantAccess(false)}
        title="Grant External Access"
        subtitle="Provide temporary access for auditors or compliance officers"
        footer={
          <div className="flex gap-3 w-full">
            <Button variant="ghost" size="md" className="flex-1" onClick={() => setShowGrantAccess(false)}>
              Cancel
            </Button>
            <Button
              size="md"
              className="flex-1"
              isLoading={grantingAccess}
              disabled={grantingAccess}
              onClick={handleGrantAccess}
            >
              {grantingAccess ? 'Granting...' : 'Grant Access'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleGrantAccess} className="flex flex-col gap-5">
          <Input
            label="Recipient Name"
            placeholder="e.g., Jane Doe, KRA Auditor"
            value={newAccess.recipientName}
            onChange={(e) => setNewAccess((prev) => ({ ...prev, recipientName: e.target.value }))}
            required
          />
          <Input
            label="Recipient Email"
            type="email"
            placeholder="jane.doe@kra.go.ke"
            value={newAccess.recipientEmail}
            onChange={(e) => setNewAccess((prev) => ({ ...prev, recipientEmail: e.target.value }))}
            required
          />
          <Select
            label="Access Level"
            value={newAccess.accessLevel}
            onChange={(e) => setNewAccess((prev) => ({ ...prev, accessLevel: e.target.value }))}
            options={ACCESS_LEVEL_OPTIONS}
          />
          <Input
            label="Purpose / Reason"
            placeholder="e.g., KRA compliance audit Q1 2026"
            value={newAccess.purpose}
            onChange={(e) => setNewAccess((prev) => ({ ...prev, purpose: e.target.value }))}
            required
          />
          <Input
            label="Expires At"
            type="date"
            value={newAccess.expiresAt}
            onChange={(e) => setNewAccess((prev) => ({ ...prev, expiresAt: e.target.value }))}
            required
          />
        </form>
      </SlideOutPanel>

      {/* ── Revoke Confirmation Modal ───────────────────────────────────────── */}
      <Modal
        isOpen={revokingId !== null}
        onClose={() => setRevokingId(null)}
        title="Revoke External Access"
        size="sm"
        footer={
          <div className="flex gap-3 w-full">
            <Button variant="ghost" size="md" className="flex-1" onClick={() => setRevokingId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="md"
              className="flex-1"
              isLoading={revokingBusy}
              disabled={revokingBusy}
              onClick={handleRevokeAccess}
            >
              {revokingBusy ? 'Revoking...' : 'Yes, Revoke'}
            </Button>
          </div>
        }
      >
        <div className="text-center py-2">
          <p className="text-3xl mb-3">⚠️</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Are you sure you want to revoke this external access grant? This action cannot be undone.
          </p>
        </div>
      </Modal>
    </PageShell>
  );
}

// ── Utility: Convert JSON response to CSV ────────────────────────────────────

function jsonToCsv(data: Record<string, unknown>): string {
  const rows: string[] = [];

  // Flatten array fields
  const arrayFields = ['items', 'income', 'expenses', 'assets', 'liabilities', 'equity', 'accounts', 'transactions', 'entries'];
  for (const field of arrayFields) {
    if (Array.isArray(data[field]) && (data[field] as unknown[]).length > 0) {
      const items = data[field] as Record<string, unknown>[];
      rows.push(`"${field.toUpperCase()}"`);
      const firstItem = items[0] as Record<string, unknown>;
      const keys = Object.keys(firstItem);
      rows.push(keys.map((k) => `"${k}"`).join(','));
      for (const item of items) {
        rows.push(keys.map((k) => `"${String(item[k] ?? '')}"`).join(','));
      }
      for (const item of items) {
        rows.push(keys.map((k) => `"${String(item[k] ?? '')}"`).join(','));
      }
      rows.push('');
    }
  }

  // Scalar summary fields
  const scalarFields = Object.keys(data).filter(
    (k) => !arrayFields.includes(k) && typeof data[k] !== 'object' && !Array.isArray(data[k]),
  );
  if (scalarFields.length > 0) {
    rows.push('"SUMMARY"');
    rows.push(scalarFields.map((k) => `"${k}"`).join(','));
    rows.push(scalarFields.map((k) => `"${String(data[k] ?? '')}"`).join(','));
  }

  return rows.join('\n');
}
