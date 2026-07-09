import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { PageShell } from '../components/layout/page-shell';
import { Skeleton } from '../components/ui/skeleton';
import { EmptyState } from '../components/ui/empty-state';
import { showToast, useUiStore } from '../stores/ui-store';
import { t } from '../lib/plain-english';
import { api } from '../lib/api-client';
import { formatKES } from '../lib/utils';

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  popular?: boolean;
  endpoint?: string;
}

interface ReportCategory {
  key: string;
  title: string;
  icon: string;
  description: string;
  color: string;
  reports: ReportTemplate[];
}

const categoryAccent: Record<string, string> = {
  financial: 'border-l-kenya-green-500 bg-gradient-to-r from-kenya-green-50/50 to-white dark:from-kenya-green-900/10 dark:to-kenya-surface-dark',
  tax: 'border-l-kenya-amber-500 bg-gradient-to-r from-kenya-amber-50/50 to-white dark:from-kenya-amber-900/10 dark:to-kenya-surface-dark',
  accounting: 'border-l-sky-600 bg-gradient-to-r from-sky-50/50 to-white dark:from-sky-900/10 dark:to-kenya-surface-dark',
  audit: 'border-l-sky-600 bg-gradient-to-r from-sky-50/50 to-white dark:from-sky-900/10 dark:to-kenya-surface-dark',
};

const categories: ReportCategory[] = [
  {
    key: 'financial',
    title: 'Financial Statements',
    icon: '📊',
    description: 'Core financial reports for tracking business performance — Profit & Loss, Balance Sheet, Cash Flow',
    color: 'kenya-green',
    reports: [
      { id: '1', name: 'Profit & Loss', description: 'Revenue, expenses, and net income over a period', icon: '📊', popular: true, endpoint: '/reports/profit-loss' },
      { id: '2', name: 'Balance Sheet', description: 'Assets, liabilities, and equity at a point in time', icon: '⚖️', popular: true, endpoint: '/reports/balance-sheet' },
      { id: '3', name: 'Cash Flow Statement', description: 'Cash inflows and outflows from operations', icon: '💰', popular: true, endpoint: '/reports/cash-flow' },
    ],
  },
  {
    key: 'tax',
    title: 'Tax & Compliance',
    icon: '🧾',
    description: 'KRA eTIMS, VAT calculations, and tax compliance reports',
    color: 'kenya-amber',
    reports: [
      { id: '5', name: 'Tax Summary', description: 'VAT and withholding tax summary', icon: '🧾', popular: true },
      { id: '7', name: 'eTIMS Compliance', description: 'KRA eTIMS submission status tracker', icon: '🛡️', popular: true },
      { id: '9', name: 'VAT Return Summary', description: 'VAT filing preparation with KRA iTax-compatible export', icon: '📄', popular: true, endpoint: '/tax/vat' },
    ],
  },
  {
    key: 'accounting',
    title: 'Accounting',
    icon: '📋',
    description: 'Trial balance, aging, and reconciliation reports',
    color: 'blue',
    reports: [
      { id: '4', name: 'Trial Balance', description: 'Complete list of general ledger accounts', icon: '📋', endpoint: '/reports/trial-balance' },
      { id: '6', name: 'Aging Report', description: 'Accounts receivable aging analysis', icon: '⏳' },
    ],
  },
  {
    key: 'audit',
    title: 'Audit & Controls',
    icon: '🔍',
    description: 'Audit trail and compliance monitoring reports',
    color: 'kenya-red',
    reports: [
      { id: '8', name: 'Audit Trail', description: 'Complete change history for all entries', icon: '🔍', endpoint: '/reports/audit-trail' },
    ],
  },
];

// Only reports with endpoints are available
const allReports = categories.flatMap((c) => c.reports.filter((r) => r.endpoint));

const hashToKey: Record<string, string> = {
  financial: 'financial',
  tax: 'tax',
  accounting: 'accounting',
  audit: 'audit',
};

const QUICK_RANGES: Array<{ label: string; start: () => Date; end?: () => Date }> = [
  { label: 'This Month', start: () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); } },
  { label: 'Last Month', start: () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() - 1, 1); }, end: () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 0); } },
  { label: 'This Quarter', start: () => { const d = new Date(); return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1); } },
  { label: 'This Year', start: () => new Date(new Date().getFullYear(), 0, 1) },
];

// ─── Color-coded metric preview card ──────────────────────────────────

const cardGradients: Record<string, string> = {
  revenue: 'from-green-50 to-emerald-50/50 dark:from-green-900/10 dark:to-emerald-900/5 border-green-200 dark:border-green-800',
  expense: 'from-red-50 to-rose-50/50 dark:from-red-900/10 dark:to-rose-900/5 border-red-200 dark:border-red-800',
  net: 'from-blue-50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/5 border-blue-200 dark:border-blue-800',
  asset: 'from-sky-50 to-blue-50/50 dark:from-sky-900/10 dark:to-blue-900/5 border-sky-200 dark:border-sky-800',
  liability: 'from-amber-50 to-yellow-50/50 dark:from-amber-900/10 dark:to-yellow-900/5 border-amber-200 dark:border-amber-800',
  equity: 'from-purple-50 to-violet-50/50 dark:from-purple-900/10 dark:to-violet-900/5 border-purple-200 dark:border-purple-800',
  audit: 'from-gray-50 to-slate-50/50 dark:from-gray-800 dark:to-slate-800 border-gray-200 dark:border-gray-700',
};

function MetricBadge({ label, value, gradient, bold }: { label: string; value: number; gradient?: string; bold?: boolean }) {
  const plainEnglish = useUiStore((state) => state.plainEnglish);
  return (
    <div className={`rounded-lg border p-3 ${gradient ?? ''}`}>
      <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t(label, plainEnglish)}</p>
      <p className={`text-sm font-mono mt-0.5 ${bold ? 'font-bold text-gray-900 dark:text-white' : 'font-semibold text-gray-800 dark:text-gray-200'}`}>
        {formatKES(value)}
      </p>
    </div>
  );
}

function ReportPreviewCard({ result, template }: { result: any; template: ReportTemplate }) {
  const plainEnglish = useUiStore((state) => state.plainEnglish);

  // Detect if result has no meaningful data
  const hasNoData =
    !result ||
    Object.keys(result).length === 0 ||
    (result.totalIncome === 0 && result.totalExpenses === 0 && result.netIncome === 0) ||
    (result.totalAssets === 0 && result.totalLiabilities === 0 && result.totalEquity === 0) ||
    (result.items && result.items.length === 0);

  if (hasNoData) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/30 p-6 text-center">
        <p className="text-2xl mb-2">📭</p>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No data found for this period</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Try adjusting the date range or check if transactions exist.</p>
      </div>
    );
  }

  // ── Profit & Loss ──────────────────────────────────────────────
  if (result.totalIncome !== undefined) {
    return (
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">📊 {t(template.name, plainEnglish)}</h4>
        <div className="grid grid-cols-3 gap-2">
          <MetricBadge label="Revenue" value={result.totalIncome} gradient={cardGradients.revenue} />
          <MetricBadge label="Expenses" value={result.totalExpenses} gradient={cardGradients.expense} />
          <MetricBadge label="Net Income" value={result.netIncome} gradient={cardGradients.net} bold />
        </div>
      </div>
    );
  }

  // ── Balance Sheet ──────────────────────────────────────────────
  if (result.totalAssets !== undefined) {
    return (
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">⚖️ {t(template.name, plainEnglish)}</h4>
        <div className="grid grid-cols-3 gap-2">
          <MetricBadge label="Assets" value={result.totalAssets} gradient={cardGradients.asset} />
          <MetricBadge label="Liabilities" value={result.totalLiabilities} gradient={cardGradients.liability} />
          <MetricBadge label="Equity" value={result.totalEquity} gradient={cardGradients.equity} />
        </div>
        <p className={`text-xs font-medium mt-1 ${result.balanced ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {result.balanced ? '✅ Balanced' : '❌ Unbalanced'}
        </p>
      </div>
    );
  }

  // ── Trial Balance ──────────────────────────────────────────────
  if (result.totalDebits !== undefined) {
    return (
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">📋 {t(template.name, plainEnglish)}</h4>
        <div className="grid grid-cols-2 gap-2">
          <MetricBadge label="Total Debits" value={result.totalDebits} gradient={cardGradients.audit} />
          <MetricBadge label="Total Credits" value={result.totalCredits} gradient={cardGradients.audit} />
        </div>
        <p className={`text-xs font-medium mt-1 ${result.balanced ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {result.balanced ? '✅ Balanced' : '❌ Unbalanced'}
        </p>
      </div>
    );
  }

  // ── Audit Trail ────────────────────────────────────────────────
  if (result.items && Array.isArray(result.items)) {
    return (
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">🔍 {t(template.name, plainEnglish)}</h4>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 p-3">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{result.total || result.items.length} records found</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Showing {result.items.length > 5 ? 'latest 5' : result.items.length} entries
          </p>
          <div className="mt-2 space-y-1 max-h-[200px] overflow-y-auto">
            {result.items.slice(0, 5).map((item: any) => (
              <div key={item.id} className="flex items-center gap-2 p-1.5 rounded text-xs">
                <span>{item.action === 'LOGIN' ? '🔐' : item.action === 'CREATE_ENTRY' ? '📝' : '⚙️'}</span>
                <span className="text-gray-600 dark:text-gray-300 truncate flex-1">
                  {item.action?.replace(/_/g, ' ')}
                </span>
                <span className="text-gray-400 shrink-0">{new Date(item.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Fallback: show whatever Row-compatible data exists ─────────
  const scalarFields = Object.keys(result).filter(
    (k) => typeof result[k] === 'number' && !Array.isArray(result[k]),
  );
  if (scalarFields.length > 0) {
    return (
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{template.icon} {t(template.name, plainEnglish)}</h4>
        <div className="space-y-1">
          {scalarFields.map((key) => (
            <Row key={key} label={key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())} value={result[key]} />
          ))}
        </div>
      </div>
    );
  }

  return null;
}

export function Reports() {
  const { category } = useParams<{ category?: string }>();
  const navigate = useNavigate();
  const plainEnglish = useUiStore((state) => state.plainEnglish);
  const [selectedReport, setSelectedReport] = React.useState<string | null>(null);
  const configRef = React.useRef<HTMLDivElement>(null);
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [generating, setGenerating] = React.useState(false);
  const [downloadBusy, setDownloadBusy] = React.useState(false);
  const [lastResult, setLastResult] = React.useState<any>(null);

  const activeCategory = category && hashToKey[category] ? category : null;
  const selectedTemplate = selectedReport ? allReports.find((r) => r.id === selectedReport) : null;
  const activeCat = activeCategory ? categories.find((c) => c.key === activeCategory) : null;

  // Only show reports with endpoints
  const workingReports = activeCat ? activeCat.reports.filter((r) => r.endpoint) : [];
  const readyCount = workingReports.length;

  // Scroll to config when a report is selected
  React.useEffect(() => {
    if (selectedReport && configRef.current) {
      setTimeout(() => {
        configRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [selectedReport]);

  const buildParams = () => {
    const params: Record<string, string> = {};
    if (dateFrom) params.from = new Date(dateFrom).toISOString();
    if (dateTo) params.to = new Date(dateTo).toISOString();
    if (selectedTemplate && (selectedTemplate.id === '2' || selectedTemplate.id === '4')) params.asOf = dateTo || new Date().toISOString();
    return params;
  };

  const handleGenerate = async () => {
    if (!selectedReport || !selectedTemplate?.endpoint) return;
    setGenerating(true);
    setLastResult(null);
    try {
      const params = buildParams();
      const result = await api.get<any>(selectedTemplate.endpoint, params);
      setLastResult(result);
      showToast('success', 'Report generated', `${selectedTemplate.name} generated successfully`);
    } catch (e: any) {
      showToast('error', 'Failed', e?.response?.data?.message || 'Could not generate report');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateAndDownload = async () => {
    if (!selectedReport || !selectedTemplate?.endpoint) return;
    setDownloadBusy(true);
    try {
      const params = buildParams();
      const result = await api.get<any>(selectedTemplate.endpoint, params);
      setLastResult(result);

      // Build CSV and trigger download immediately
      const rows: string[] = [];
      const arrayFields = ['income', 'expenses', 'assets', 'liabilities', 'equity', 'accounts', 'items'];
      for (const field of arrayFields) {
        if (Array.isArray(result[field]) && result[field].length > 0) {
          const items = result[field];
          rows.push(`"${field.toUpperCase()}"`);
          const itemKeys = Object.keys(items[0]);
          rows.push(itemKeys.map((k) => `"${k}"`).join(','));
          for (const item of items) {
            rows.push(itemKeys.map((k) => `"${item[k] ?? ''}"`).join(','));
          }
          rows.push('');
        }
      }
      const scalarFields = Object.keys(result).filter(
        (k) => !arrayFields.includes(k) && typeof result[k] !== 'object',
      );
      if (scalarFields.length > 0) {
        rows.push('"SUMMARY"');
        rows.push(scalarFields.map((k) => `"${k}"`).join(','));
        rows.push(scalarFields.map((k) => `"${String(result[k] ?? '')}"`).join(','));
      }

      const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${selectedReport}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      showToast('success', 'Downloaded', `${selectedTemplate.name} generated and downloaded`);
    } catch (e: any) {
      showToast('error', 'Failed', e?.response?.data?.message || 'Could not generate report');
    } finally {
      setDownloadBusy(false);
    }
  };

  const handleRetry = () => {
    handleGenerate();
  };

  const applyQuickRange = (range: typeof QUICK_RANGES[number]) => {
    const start = range.start();
    const end = range.end ? range.end() : new Date();
    setDateFrom(start.toISOString().split('T')[0] ?? '');
    setDateTo(end.toISOString().split('T')[0] ?? '');
  };

  const hasEmptyResult =
    lastResult &&
    (Object.keys(lastResult).length === 0 ||
      (lastResult.totalIncome === 0 && lastResult.totalExpenses === 0 && lastResult.netIncome === 0) ||
      (lastResult.totalAssets === 0 && lastResult.totalLiabilities === 0 && lastResult.totalEquity === 0) ||
      (lastResult.items && lastResult.items.length === 0));

  // ─── FILTERED VIEW: Single Section ──────────────────────────────────
  if (activeCat) {
    // Edge case: category has no reports with endpoints
    if (workingReports.length === 0) {
      return (
        <div className="flex flex-col gap-6">
          <nav className="flex items-center gap-2 text-sm">
            <button onClick={() => navigate('/reports')} className="text-gray-500 hover:text-kenya-green-600 dark:text-gray-400 dark:hover:text-kenya-green-400 transition-colors">
              Reports
            </button>
            <span className="text-gray-300 dark:text-gray-600">/</span>
            <span className="font-medium text-kenya-green-900 dark:text-kenya-green-50">{activeCat.title}</span>
          </nav>
          <EmptyState
            icon={activeCat.icon}
            title="No ready reports yet"
            description={`Reports in ${activeCat.title} are still being built. Check back soon or browse other report categories.`}
            action={{ label: '← Browse all reports', onClick: () => navigate('/reports') }}
          />
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm">
          <button onClick={() => navigate('/reports')} className="text-gray-500 hover:text-kenya-green-600 dark:text-gray-400 dark:hover:text-kenya-green-400 transition-colors">
            Reports
          </button>
          <span className="text-gray-300 dark:text-gray-600">/</span>
          <span className="font-medium text-kenya-green-900 dark:text-kenya-green-50">{activeCat.title}</span>
        </nav>

        {/* Section Hero */}
        <div className="rounded-2xl bg-gradient-to-br from-kenya-green-500 to-kenya-green-700 p-6 text-white shadow-lg">
          <div className="flex items-start gap-4">
            <span className="text-4xl">{activeCat.icon}</span>
            <div className="flex-1">
              <h1 className="text-xl font-bold">{activeCat.title}</h1>
              <p className="text-sm text-kenya-green-100 mt-1 max-w-xl">{activeCat.description}</p>
              <p className="text-xs text-kenya-green-200 mt-2">
                {readyCount} report{readyCount !== 1 ? 's' : ''} available
              </p>
            </div>
            <span className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/10 text-xs font-medium">
              {readyCount} ready
            </span>
          </div>
        </div>

        {/* Report Cards — only working reports with endpoints */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {workingReports.map((r) => (
            <button
              key={r.id}
              onClick={() => { setSelectedReport(r.id); setLastResult(null); }}
              className={`touch-target flex items-start gap-4 rounded-xl border-2 p-5 text-left transition-all ${
                selectedReport === r.id
                  ? 'border-kenya-green-500 bg-kenya-green-50 dark:bg-kenya-green-900/20 shadow-md ring-2 ring-kenya-green-500/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-kenya-green-300 hover:shadow-sm'
              }`}
            >
              <span className="text-3xl">{r.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-semibold text-kenya-green-900 dark:text-kenya-green-50">{t(r.name, plainEnglish)}</h3>
                  {r.popular && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-kenya-amber-100 text-kenya-amber-700 dark:bg-kenya-amber-900/30 dark:text-kenya-amber-300 font-medium shrink-0">
                      Popular
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{r.description}</p>
                <span className="text-xs mt-2 inline-block font-medium text-kenya-green-600 dark:text-kenya-green-400">
                  ✓ Ready to generate
                </span>
              </div>
              {selectedReport === r.id && (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-kenya-green-500 text-white text-xs shrink-0">✓</span>
              )}
            </button>
          ))}
        </div>

        {/* Config + Result */}
        {selectedReport === '9' ? (
          <VatReturnSummary />
        ) : selectedTemplate && (
          <div ref={configRef} className="grid grid-cols-1 lg:grid-cols-2 gap-6 scroll-mt-4">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl">{selectedTemplate.icon}</span>
                  <h3 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50">
                    {t(selectedTemplate.name, plainEnglish)}
                  </h3>
                </div>
                <div className="flex flex-col gap-4">
                  {/* Date Range with Quick Select */}
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 block">Date Range</label>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {QUICK_RANGES.map((range) => (
                        <button
                          key={range.label}
                          type="button"
                          onClick={() => applyQuickRange(range)}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 hover:border-kenya-green-300 hover:text-kenya-green-700 dark:hover:text-kenya-green-300 transition-colors"
                        >
                          {range.label}
                        </button>
                      ))}
                    </div>
                    {/* Improved custom date alignment */}
                    <div className="flex items-end gap-3">
                      <div className="flex-1">
                        <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">From</label>
                        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                      </div>
                      <span className="text-gray-300 dark:text-gray-600 pb-2 text-sm">—</span>
                      <div className="flex-1">
                        <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">To</label>
                        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                      </div>
                    </div>
                  </div>

                  {/* Two-button action row: Preview + Generate & Download */}
                  <div className="flex gap-3">
                    <Button
                      onClick={handleGenerate}
                      size="md"
                      disabled={generating || downloadBusy}
                      className="flex-1"
                      variant="secondary"
                    >
                      {generating ? (
                        <span className="flex items-center gap-2">⏳ Previewing...</span>
                      ) : (
                        <span className="flex items-center gap-2">👁️ Preview</span>
                      )}
                    </Button>
                    <Button
                      onClick={handleGenerateAndDownload}
                      size="md"
                      disabled={generating || downloadBusy}
                      className="flex-1"
                    >
                      {downloadBusy ? (
                        <span className="flex items-center gap-2">⏳ Downloading...</span>
                      ) : (
                        <span className="flex items-center gap-2">📥 Generate & Download</span>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50">Result</h3>
                  {lastResult && !hasEmptyResult && (
                    <span className="text-[10px] text-gray-400">
                      Generated {new Date(lastResult.generatedAt || Date.now()).toLocaleTimeString()}
                    </span>
                  )}
                </div>

                {/* Loading skeleton */}
                {generating || downloadBusy ? (
                  <div className="space-y-3 py-4">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-3/5" />
                  </div>
                ) : lastResult && hasEmptyResult ? (
                  /* Empty data state */
                  <div className="py-6 text-center">
                    <p className="text-3xl mb-2">📭</p>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">No data found for this period</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Try adjusting the date range to see results.</p>
                    <Button variant="secondary" size="sm" onClick={() => { setLastResult(null); }}>
                      Adjust Date Range
                    </Button>
                  </div>
                ) : lastResult ? (
                  /* Report preview card */
                  <div className="space-y-3">
                    <ReportPreviewCard result={lastResult} template={selectedTemplate} />
                    <Button variant="ghost" size="sm" onClick={() => {
                      // Reuse the download logic inline
                      const rows: string[] = [];
                      const arrayFields = ['income', 'expenses', 'assets', 'liabilities', 'equity', 'accounts', 'items'];
                      for (const field of arrayFields) {
                        if (Array.isArray(lastResult[field]) && lastResult[field].length > 0) {
                          const items = lastResult[field];
                          rows.push(`"${field.toUpperCase()}"`);
                          const itemKeys = Object.keys(items[0]);
                          rows.push(itemKeys.map((k) => `"${k}"`).join(','));
                          for (const item of items) {
                            rows.push(itemKeys.map((k) => `"${item[k] ?? ''}"`).join(','));
                          }
                          rows.push('');
                        }
                      }
                      const scalarFields = Object.keys(lastResult).filter(
                        (k) => !arrayFields.includes(k) && typeof lastResult[k] !== 'object',
                      );
                      if (scalarFields.length > 0) {
                        rows.push('"SUMMARY"');
                        rows.push(scalarFields.map((k) => `"${k}"`).join(','));
                        rows.push(scalarFields.map((k) => `"${String(lastResult[k] ?? '')}"`).join(','));
                      }
                      const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `report-${selectedReport}-${new Date().toISOString().split('T')[0]}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }} className="w-full mt-2">
                      📥 Download CSV
                    </Button>
                  </div>
                ) : (
                  /* Initial idle state */
                  <div className="py-10 text-center text-gray-400">
                    <p className="text-3xl mb-2">📄</p>
                    <p className="text-sm">Configure date range and generate</p>
                  </div>
                )}

                {/* Error retry — only show when there's an error (detected by lastResult being null but no generation happening) */}
                {!generating && !downloadBusy && !lastResult && selectedReport && (
                  <div className="mt-2 text-center">
                    <p className="text-xs text-gray-400 dark:text-gray-500">Click <strong>Preview</strong> or <strong>Generate & Download</strong> above to run this report.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  }

  // ─── OVERVIEW: All Sections ─────────────────────────────────────────
  return (
    <PageShell
      title="Reports"
      subtitle="Select a category to view and generate reports"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {categories.map((cat) => {
          const catReadyCount = cat.reports.filter(r => r.endpoint).length;
          return (
            <button
              key={cat.key}
              onClick={() => navigate(`/reports/${cat.key}`)}
              className={`touch-target rounded-xl border-2 border-l-4 text-left w-full ${categoryAccent[cat.key] || ''} p-5 hover:shadow-md transition-all group`}
            >
              <div className="flex items-start gap-4">
                <span className="text-3xl">{cat.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-kenya-green-900 dark:text-kenya-green-50 group-hover:text-kenya-green-600 dark:group-hover:text-kenya-green-400 transition-colors">
                      {cat.title}
                    </h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
                      catReadyCount === cat.reports.length
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-kenya-amber-100 text-kenya-amber-700 dark:bg-kenya-amber-900/30 dark:text-kenya-amber-300'
                    }`}>
                      {catReadyCount}/{cat.reports.length}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{cat.description}</p>
                  <div className="flex items-center gap-3 mt-3">
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {cat.reports.length} report{cat.reports.length > 1 ? 's' : ''}
                    </span>
                    {cat.reports.some(r => r.popular) && (
                      <span className="text-[10px] text-kenya-amber-600 dark:text-kenya-amber-400">★ Popular</span>
                    )}
                  </div>
                </div>
                <span className="text-gray-300 dark:text-gray-600 group-hover:text-kenya-green-500 transition-colors text-lg self-center">→</span>
              </div>
            </button>
          );
        })}
      </div>
    </PageShell>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      <span className={`text-sm font-mono ${bold ? 'font-bold text-kenya-green-700 dark:text-kenya-green-300' : 'font-medium'}`}>
        {formatKES(value)}
      </span>
    </div>
  );
}

// ─── VAT Return Summary Component ────────────────────────────────────

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface VatData {
  outputVatStandard16: number;
  outputVatZeroRated: number;
  outputVatExempt: number;
  totalOutputVat: number;
  inputVatStandard16: number;
  inputVatReduced8: number;
  totalInputVat: number;
  netVatPayable: number;
  period: string;
}

interface FilingRecord {
  period: string;
  filedAt: string;
}

const FILING_STORAGE_KEY = 'jengabooks_vat_filings';

function getFilingRecord(period: string): FilingRecord | null {
  try {
    const raw = localStorage.getItem(FILING_STORAGE_KEY);
    if (!raw) return null;
    const records: FilingRecord[] = JSON.parse(raw);
    return records.find((r) => r.period === period) ?? null;
  } catch {
    return null;
  }
}

function saveFilingRecord(period: string): void {
  try {
    const raw = localStorage.getItem(FILING_STORAGE_KEY);
    const records: FilingRecord[] = raw ? JSON.parse(raw) : [];
    const existing = records.findIndex((r) => r.period === period);
    const record: FilingRecord = { period, filedAt: new Date().toISOString() };
    if (existing >= 0) {
      records[existing] = record;
    } else {
      records.push(record);
    }
    localStorage.setItem(FILING_STORAGE_KEY, JSON.stringify(records));
  } catch {
    // silently fail
  }
}

function calculateDeadline(year: number, month: number): Date {
  // Period end is the last day of the selected month
  // Deadline is the 20th of the month after period end
  const deadlineMonth = month + 1; // month after the period end
  const deadlineYear = deadlineMonth > 11 ? year + 1 : year;
  return new Date(deadlineYear, deadlineMonth > 11 ? 0 : deadlineMonth, 20);
}

function isFuturePeriod(year: number, month: number): boolean {
  const now = new Date();
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth();
  if (year > nowYear) return true;
  if (year === nowYear && month > nowMonth) return true;
  return false;
}

function generateKraCsv(data: VatData): string {
  const rows: string[] = [];

  // Header row — KRA iTax compatible
  rows.push('VAT TYPE,RATE,AMOUNT,DESCRIPTION');

  // Output VAT
  rows.push(`OUTPUT,16%,${data.outputVatStandard16.toFixed(2)},"Standard rated sales (16%)"`);
  rows.push(`OUTPUT,0%,${data.outputVatZeroRated.toFixed(2)},"Zero-rated sales"`);
  rows.push(`OUTPUT,EXEMPT,${data.outputVatExempt.toFixed(2)},"Exempt sales"`);
  rows.push(`OUTPUT,TOTAL,${data.totalOutputVat.toFixed(2)},"Total Output VAT"`);

  // Input VAT
  rows.push(`INPUT,16%,${data.inputVatStandard16.toFixed(2)},"Standard rated purchases (16%)"`);
  rows.push(`INPUT,8%,${data.inputVatReduced8.toFixed(2)},"Reduced rate purchases (8%)"`);
  rows.push(`INPUT,TOTAL,${data.totalInputVat.toFixed(2)},"Total Input VAT"`);

  // Summary row
  rows.push('');
  rows.push(`NET VAT PAYABLE,,,${data.netVatPayable.toFixed(2)}`);

  return rows.join('\n');
}

function VatReturnSummary() {
  const plainEnglish = useUiStore((state) => state.plainEnglish);
  const now = new Date();
  const [year, setYear] = React.useState(now.getFullYear());
  const [month, setMonth] = React.useState(now.getMonth());
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [vatData, setVatData] = React.useState<VatData | null>(null);
  const [downloadBusy, setDownloadBusy] = React.useState(false);

  const periodKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const futurePeriod = isFuturePeriod(year, month);
  const filingRecord = getFilingRecord(periodKey);
  const deadline = calculateDeadline(year, month);
  const deadlineFormatted = deadline.toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' });

  const fetchVat = React.useCallback(async () => {
    if (futurePeriod) {
      setVatData(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    setVatData(null);
    try {
      const periodStart = new Date(year, month, 1);
      const periodEnd = new Date(year, month + 1, 0, 23, 59, 59);
      const from = periodStart.toISOString();
      const to = periodEnd.toISOString();
      const result = await api.get<any>('/tax/vat', { from, to });
      // Normalise response — handle both camelCase and snake_case
      const d: VatData = {
        outputVatStandard16: result.outputVatStandard16 ?? result.output_vat_standard_16 ?? 0,
        outputVatZeroRated: result.outputVatZeroRated ?? result.output_vat_zero_rated ?? 0,
        outputVatExempt: result.outputVatExempt ?? result.output_vat_exempt ?? 0,
        totalOutputVat: result.totalOutputVat ?? result.total_output_vat ?? 0,
        inputVatStandard16: result.inputVatStandard16 ?? result.input_vat_standard_16 ?? 0,
        inputVatReduced8: result.inputVatReduced8 ?? result.input_vat_reduced_8 ?? 0,
        totalInputVat: result.totalInputVat ?? result.total_input_vat ?? 0,
        netVatPayable: result.netVatPayable ?? result.net_vat_payable ?? 0,
        period: periodKey,
      };
      setVatData(d);
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Could not load VAT data. Please try again.';
      setError(msg);
      showToast('error', 'VAT Data Error', msg);
    } finally {
      setLoading(false);
    }
  }, [year, month, futurePeriod, periodKey]);

  // Auto-fetch on period change
  React.useEffect(() => {
    fetchVat();
  }, [fetchVat]);

  const handleMarkAsFiled = () => {
    saveFilingRecord(periodKey);
    showToast('success', 'Filed', `VAT return for ${MONTHS[month]} ${year} marked as filed`);
    // Force re-render to update filing status
    setVatData((prev) => prev ? { ...prev } : prev);
  };

  const handleDownloadKraCsv = () => {
    if (!vatData) return;
    setDownloadBusy(true);
    try {
      const csv = generateKraCsv(vatData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kra-vat-return-${periodKey}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('success', 'Downloaded', 'KRA iTax-compatible CSV exported');
    } catch {
      showToast('error', 'Export Failed', 'Could not generate CSV file');
    } finally {
      setDownloadBusy(false);
    }
  };

  const isEmpty =
    vatData &&
    vatData.outputVatStandard16 === 0 &&
    vatData.outputVatZeroRated === 0 &&
    vatData.outputVatExempt === 0 &&
    vatData.inputVatStandard16 === 0 &&
    vatData.inputVatReduced8 === 0;

  // Generate years for selector (current year - 2 to current year + 1)
  const years = React.useMemo(() => {
    const y = now.getFullYear();
    return [y - 2, y - 1, y, y + 1];
  }, [now]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Config panel */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">📄</span>
            <h3 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50">
              VAT Return — Period Selector
            </h3>
          </div>

          {/* Month / Year selector */}
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 block">VAT Period</label>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Month</label>
                  <select
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                    className="w-full h-12 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-kenya-green-500"
                  >
                    {MONTHS.map((name, idx) => (
                      <option key={idx} value={idx}>{name}</option>
                    ))}
                  </select>
                </div>
                <div className="w-28">
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Year</label>
                  <select
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="w-full h-12 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-kenya-green-500"
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {futurePeriod && (
              <div className="rounded-lg bg-kenya-amber-50 dark:bg-kenya-amber-900/20 border border-kenya-amber-200 dark:border-kenya-amber-800 p-3 text-sm text-kenya-amber-700 dark:text-kenya-amber-300">
                ⏳ This period is in the future. VAT calculation is only available for completed periods.
              </div>
            )}

            <div className="flex gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>Filing deadline:</span>
              <span className="font-medium text-gray-700 dark:text-gray-300">{deadlineFormatted}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Result panel */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50">
              VAT Return — {MONTHS[month]} {year}
            </h3>
            {vatData && !isEmpty && (
              <Button variant="ghost" size="sm" onClick={handleDownloadKraCsv} disabled={downloadBusy}>
                {downloadBusy ? '⏳' : '📥'} Download CSV
              </Button>
            )}
          </div>

          {/* Loading state */}
          {loading && (
            <div className="space-y-3 py-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="py-6 text-center">
              <p className="text-3xl mb-2">⚠️</p>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Failed to load VAT data</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">{error}</p>
              <Button variant="secondary" size="sm" onClick={fetchVat}>
                🔄 Retry
              </Button>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && isEmpty && (
            <div className="py-6 text-center">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">No transactions in this period</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">There are no VAT-related transactions for {MONTHS[month]} {year}. Try a different period.</p>
            </div>
          )}

          {/* Future period state */}
          {!loading && !error && futurePeriod && (
            <div className="py-10 text-center">
              <p className="text-3xl mb-2">📅</p>
              <p className="text-sm text-gray-400">Select a completed period to view VAT data</p>
            </div>
          )}

          {/* Initial state */}
          {!loading && !error && !vatData && !futurePeriod && (
            <div className="py-10 text-center text-gray-400">
              <p className="text-3xl mb-2">📄</p>
              <p className="text-sm">Select a period to calculate VAT</p>
            </div>
          )}

          {/* VAT data card */}
          {!loading && !error && vatData && !isEmpty && (
            <div className="space-y-4">
              {/* Output VAT */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Output VAT (Sales)</h4>
                <div className="space-y-1">
                  <Row label="Standard 16%" value={vatData.outputVatStandard16} />
                  <Row label="Zero-rated" value={vatData.outputVatZeroRated} />
                  <Row label="Exempt" value={vatData.outputVatExempt} />
                  <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Total Output VAT</span>
                    <span className="text-sm font-mono font-bold text-kenya-green-700 dark:text-kenya-green-300">
                      {formatKES(vatData.totalOutputVat)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Input VAT */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Input VAT (Purchases)</h4>
                <div className="space-y-1">
                  <Row label="Standard 16%" value={vatData.inputVatStandard16} />
                  <Row label="Reduced 8%" value={vatData.inputVatReduced8} />
                  <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Total Input VAT</span>
                    <span className="text-sm font-mono font-bold text-kenya-green-700 dark:text-kenya-green-300">
                      {formatKES(vatData.totalInputVat)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-dashed border-gray-300 dark:border-gray-600" />

              {/* Net VAT Payable */}
              <div className="flex justify-between py-2">
                <span className="text-sm font-bold text-gray-900 dark:text-white">NET VAT PAYABLE</span>
                <span className="text-sm font-mono font-bold text-lg text-kenya-amber-600 dark:text-kenya-amber-400">
                  {formatKES(vatData.netVatPayable)}
                </span>
              </div>

              {/* Filing Status */}
              <div className="flex items-center justify-between py-2 border-t border-gray-100 dark:border-gray-800">
                <span className="text-sm text-gray-600 dark:text-gray-400">Filing Status</span>
                {filingRecord ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 dark:bg-green-900/30 px-3 py-1 text-xs font-medium text-green-700 dark:text-green-400">
                    ✅ Filed on {new Date(filingRecord.filedAt).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-kenya-amber-100 dark:bg-kenya-amber-900/30 px-3 py-1 text-xs font-medium text-kenya-amber-700 dark:text-kenya-amber-300">
                    📄 Not yet filed
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-gray-600 dark:text-gray-400">Filing Deadline</span>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{deadlineFormatted}</span>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                {!filingRecord && (
                  <Button variant="secondary" size="sm" onClick={handleMarkAsFiled} className="flex-1">
                    ✓ Mark as Filed
                  </Button>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleDownloadKraCsv}
                  disabled={downloadBusy}
                  className="flex-1"
                >
                  {downloadBusy ? '⏳' : '📥'} Download KRA CSV
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
