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
  reports: ReportTemplate[];
}

const categories: ReportCategory[] = [
  {
    key: 'financial',
    title: 'Financial Statements',
    icon: '📊',
    description: 'Core financial reports for tracking business performance — Profit & Loss, Balance Sheet, Cash Flow',
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

  // ─── FILTERED VIEW: Single Section ──────────────────────────────────
  if (activeCat) {
    return (
      <div className="flex flex-col gap-6">
        {/* Back link */}
        <a href="/reports" className="text-sm text-kenya-green-600 hover:text-kenya-green-700 dark:text-kenya-green-400 inline-flex items-center gap-1 w-fit">
          ← Back to all reports
        </a>

        {/* Section Hero */}
        <div className="rounded-2xl bg-gradient-to-br from-kenya-green-500 to-kenya-green-700 p-6 text-white">
          <div className="flex items-start gap-4">
            <span className="text-4xl">{activeCat.icon}</span>
            <div>
              <h1 className="text-xl font-bold">{activeCat.title}</h1>
              <p className="text-sm text-kenya-green-100 mt-1 max-w-xl">{activeCat.description}</p>
            </div>
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
                  ? 'border-kenya-green-500 bg-kenya-green-50 dark:bg-kenya-green-900/20 shadow-md'
                  : 'border-gray-200 dark:border-gray-700 hover:border-kenya-green-300 hover:shadow-sm'
              }`}
            >
              <span className="text-3xl">{r.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-semibold text-kenya-green-900 dark:text-kenya-green-50">{r.name}</h3>
                  {r.popular && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-kenya-amber-100 text-kenya-amber-700 dark:bg-kenya-amber-900/30 dark:text-kenya-amber-300 font-medium">
                      Popular
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{r.description}</p>
                <span className={`text-xs mt-2 inline-block font-medium ${
                  r.endpoint ? 'text-kenya-green-600' : 'text-kenya-amber-500'
                }`}>
                  {r.endpoint ? '✓ Ready to generate' : '⚡ Coming soon'}
                </span>
              </div>
              {selectedReport === r.id && (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-kenya-green-500 text-white text-xs">✓</span>
              )}
            </button>
          ))}
        </div>

        {/* Config + Result */}
        {selectedTemplate && (
          <div ref={configRef} className="grid grid-cols-1 lg:grid-cols-2 gap-6 scroll-mt-4">
            <Card>
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50 mb-4">
                  {selectedTemplate.icon} {selectedTemplate.name}
                </h3>
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="From" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                    <Input label="To" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                  </div>
                  <Button onClick={handleGenerate} size="lg" disabled={generating || !selectedTemplate.endpoint}>
                    {generating ? '⏳ Generating...' : '📥 Generate Report'}
                  </Button>
                  {!selectedTemplate.endpoint && (
                    <p className="text-xs text-kenya-amber-500 text-center">Coming soon</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50 mb-4">Result</h3>
                {lastResult ? (
                  <div className="space-y-2">
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
        <p className="text-sm text-gray-500 dark:text-gray-400">Select a category from the sidebar to get started</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categories.map((cat) => (
          <a
            key={cat.key}
            href={`/reports#${cat.key}`}
            className="touch-target rounded-xl border-2 border-gray-200 dark:border-gray-700 p-5 hover:border-kenya-green-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-start gap-4">
              <span className="text-3xl">{cat.icon}</span>
              <div>
                <h3 className="text-base font-semibold text-kenya-green-900 dark:text-kenya-green-50">{cat.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{cat.description}</p>
                <p className="text-xs text-kenya-green-600 dark:text-kenya-green-400 mt-2">
                  {cat.reports.length} report{cat.reports.length > 1 ? 's' : ''} available
                </p>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      <span className={`text-sm font-mono ${bold ? 'font-bold text-kenya-green-700' : 'font-medium'}`}>
        KES {value?.toLocaleString() || '0'}
      </span>
    </div>
  );
}
