import React from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { showToast } from '../stores/ui-store';
import { api } from '../lib/api-client';

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
  accounting: 'border-l-blue-500 bg-gradient-to-r from-blue-50/50 to-white dark:from-blue-900/10 dark:to-kenya-surface-dark',
  audit: 'border-l-kenya-red bg-gradient-to-r from-red-50/50 to-white dark:from-red-900/10 dark:to-kenya-surface-dark',
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

const allReports = categories.flatMap((c) => c.reports);

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

export function Reports() {
  const [selectedReport, setSelectedReport] = React.useState<string | null>(null);
  const [activeCategory, setActiveCategory] = React.useState<string | null>(null);
  const configRef = React.useRef<HTMLDivElement>(null);
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [generating, setGenerating] = React.useState(false);
  const [lastResult, setLastResult] = React.useState<any>(null);

  const selectedTemplate = selectedReport ? allReports.find((r) => r.id === selectedReport) : null;
  const activeCat = activeCategory ? categories.find((c) => c.key === activeCategory) : null;

  // Scroll to config when a report is selected
  React.useEffect(() => {
    if (selectedReport && configRef.current) {
      setTimeout(() => {
        configRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [selectedReport]);

  React.useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hashToKey[hash]) setActiveCategory(hash);
  }, []);

  React.useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      setActiveCategory(hashToKey[hash] || null);
      setSelectedReport(null);
      setLastResult(null);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleGenerate = async () => {
    if (!selectedReport || !selectedTemplate?.endpoint) return;
    setGenerating(true);
    setLastResult(null);
    try {
      const params: Record<string, string> = {};
      if (dateFrom) params.from = new Date(dateFrom).toISOString();
      if (dateTo) params.to = new Date(dateTo).toISOString();
      if (selectedTemplate.id === '2' || selectedTemplate.id === '4') params.asOf = dateTo || new Date().toISOString();
      const result = await api.get<any>(selectedTemplate.endpoint, params);
      setLastResult(result);
      showToast('success', 'Report generated', `${selectedTemplate.name} generated successfully`);
    } catch (e: any) {
      showToast('error', 'Failed', e?.response?.data?.message || 'Could not generate report');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadCsv = () => {
    if (!lastResult) return;
    const rows: string[] = [];

    // Handle array data (income, expenses, accounts)
    const arrayFields = ['income', 'expenses', 'assets', 'liabilities', 'equity', 'accounts'];
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

    // Handle scalar fields (totals, metadata)
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
  };

  const applyQuickRange = (range: typeof QUICK_RANGES[number]) => {
    const start = range.start();
    const end = range.end ? range.end() : new Date();
    setDateFrom(start.toISOString().split('T')[0] ?? '');
    setDateTo(end.toISOString().split('T')[0] ?? '');
  };

  const readyCount = activeCat ? activeCat.reports.filter(r => r.endpoint).length : 0;
  const totalCount = activeCat ? activeCat.reports.length : 0;

  // ─── FILTERED VIEW: Single Section ──────────────────────────────────
  if (activeCat) {
    return (
      <div className="flex flex-col gap-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm">
          <a href="/reports" className="text-gray-500 hover:text-kenya-green-600 dark:text-gray-400 dark:hover:text-kenya-green-400 transition-colors">
            Reports
          </a>
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
                {readyCount} ready · {totalCount - readyCount} coming soon
              </p>
            </div>
            <span className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/10 text-xs font-medium">
              {readyCount}/{totalCount} reports
            </span>
          </div>
        </div>

        {/* Report Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeCat.reports.map((r) => (
            <button
              key={r.id}
              onClick={() => { setSelectedReport(r.id); setLastResult(null); }}
              className={`touch-target flex items-start gap-4 rounded-xl border-2 p-5 text-left transition-all ${
                selectedReport === r.id
                  ? 'border-kenya-green-500 bg-kenya-green-50 dark:bg-kenya-green-900/20 shadow-md ring-2 ring-kenya-green-500/20'
                  : r.endpoint
                    ? 'border-gray-200 dark:border-gray-700 hover:border-kenya-green-300 hover:shadow-sm'
                    : 'border-gray-100 dark:border-gray-800 opacity-70'
              }`}
            >
              <span className="text-3xl">{r.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-semibold text-kenya-green-900 dark:text-kenya-green-50">{r.name}</h3>
                  {r.popular && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-kenya-amber-100 text-kenya-amber-700 dark:bg-kenya-amber-900/30 dark:text-kenya-amber-300 font-medium shrink-0">
                      Popular
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{r.description}</p>
                <span className={`text-xs mt-2 inline-block font-medium ${
                  r.endpoint ? 'text-kenya-green-600 dark:text-kenya-green-400' : 'text-kenya-amber-500'
                }`}>
                  {r.endpoint ? '✓ Ready to generate' : '⚡ Coming soon'}
                </span>
              </div>
              {selectedReport === r.id && (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-kenya-green-500 text-white text-xs shrink-0">✓</span>
              )}
            </button>
          ))}
        </div>

        {/* Config + Result */}
        {selectedTemplate && (
          <div ref={configRef} className="grid grid-cols-1 lg:grid-cols-2 gap-6 scroll-mt-4">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl">{selectedTemplate.icon}</span>
                  <h3 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50">
                    {selectedTemplate.name}
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
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">From</label>
                        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">To</label>
                        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                      </div>
                    </div>
                  </div>
                  <Button onClick={handleGenerate} size="lg" disabled={generating || !selectedTemplate.endpoint}
                    className={selectedTemplate.endpoint ? '' : 'opacity-50'}>
                    {generating ? (
                      <span className="flex items-center gap-2">⏳ Generating...</span>
                    ) : (
                      <span className="flex items-center gap-2">📥 Generate Report</span>
                    )}
                  </Button>
                  {!selectedTemplate.endpoint && (
                    <p className="text-xs text-kenya-amber-500 text-center flex items-center justify-center gap-1">
                      <span>⚡</span> Coming soon — backend integration in progress
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50">Result</h3>
                  {lastResult && (
                    <span className="text-[10px] text-gray-400">
                      Generated {new Date(lastResult.generatedAt || Date.now()).toLocaleTimeString()}
                    </span>
                  )}
                </div>
                {generating ? (
                  <div className="space-y-3 animate-pulse py-6">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                  </div>
                ) : lastResult ? (
                  <div className="space-y-2">
                    {/* Audit Trail results */}
                    {lastResult.items && (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-500 mb-2">{lastResult.total} records found</p>
                        <div className="max-h-[400px] overflow-y-auto space-y-1">
                          {lastResult.items.map((item: any) => (
                            <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-sm">
                              <span className="text-lg shrink-0">{item.action === 'LOGIN' ? '🔐' : item.action === 'CREATE_ENTRY' ? '📝' : '⚙️'}</span>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-800 dark:text-gray-200 truncate">{item.action?.replace(/_/g, ' ')}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                  {item.user?.name || 'System'} · {item.entityType?.replace(/_/g, ' ')}
                                </p>
                              </div>
                              <span className="text-xs text-gray-400 shrink-0">
                                {new Date(item.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Financial report results */}
                    {lastResult.totalIncome !== undefined && (
                      <>
                        <Row label="Revenue" value={lastResult.totalIncome} />
                        <Row label="Expenses" value={lastResult.totalExpenses} />
                        <Row label="Net Income" value={lastResult.netIncome} bold />
                      </>
                    )}
                    {lastResult.totalAssets !== undefined && (
                      <>
                        <Row label="Assets" value={lastResult.totalAssets} />
                        <Row label="Liabilities" value={lastResult.totalLiabilities} />
                        <Row label="Equity" value={lastResult.totalEquity} />
                        <p className={`text-xs font-medium ${lastResult.balanced ? 'text-green-600' : 'text-red-600'}`}>
                          {lastResult.balanced ? '✅ Balanced' : '❌ Unbalanced'}
                        </p>
                      </>
                    )}
                    {lastResult.totalDebits !== undefined && (
                      <>
                        <Row label="Debits" value={lastResult.totalDebits} />
                        <Row label="Credits" value={lastResult.totalCredits} />
                        <p className={`text-xs font-medium ${lastResult.balanced ? 'text-green-600' : 'text-red-600'}`}>
                          {lastResult.balanced ? '✅ Balanced' : '❌ Unbalanced'}
                        </p>
                      </>
                    )}
                    <Button variant="ghost" size="sm" onClick={handleDownloadCsv} className="w-full mt-3">
                      📥 Download CSV
                    </Button>
                  </div>
                ) : (
                  <div className="py-10 text-center text-gray-400">
                    <p className="text-3xl mb-2">📄</p>
                    <p className="text-sm">Configure date range and generate</p>
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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-kenya-green-900 dark:text-kenya-green-50">Reports</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Select a category to view and generate reports</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {categories.map((cat) => {
          const catReadyCount = cat.reports.filter(r => r.endpoint).length;
          return (
            <a
              key={cat.key}
              href={`/reports#${cat.key}`}
              className={`touch-target rounded-xl border-2 border-l-4 ${categoryAccent[cat.key] || ''} p-5 hover:shadow-md transition-all group`}
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
            </a>
          );
        })}
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      <span className={`text-sm font-mono ${bold ? 'font-bold text-kenya-green-700 dark:text-kenya-green-300' : 'font-medium'}`}>
        KES {value?.toLocaleString() || '0'}
      </span>
    </div>
  );
}
