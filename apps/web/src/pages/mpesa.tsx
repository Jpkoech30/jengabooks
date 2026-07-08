import React from 'react';
import { useCompanyRefresh } from '../hooks/use-company-refresh';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Select } from '../components/ui/select';
import { FileUpload } from '../components/ui/file-upload';
import { PageShell } from '../components/layout/page-shell';
import { PageState } from '../components/ui/page-state';
import { EmptyState } from '../components/ui/empty-state';
import { SlideOutPanel } from '../components/ui/slide-out-panel';
import { api, apiClient } from '../lib/api-client';
import { showToast } from '../stores/ui-store';
import { cn } from '../lib/utils';
import { formatKES } from '../lib/utils';
import { ChevronDown, ChevronRight, Upload, Loader2, Search } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MpesaTx {
  id: string;
  receiptNo: string | null;
  transactionDate: string;
  description: string;
  amount: number;
  paidIn: number;
  withdrawn: number;
  phoneNumber: string | null;
  customerName: string | null;
  paybill: string | null;
  transactionType: string | null;
  isReconciled: boolean;
  mappedAccount?: { id: string; code: string; name: string } | null;
  category?: string | null;
}

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'unmapped' | 'needs-review' | 'reconciled';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unmapped', label: 'Unmapped' },
  { key: 'needs-review', label: 'Needs Review' },
  { key: 'reconciled', label: 'Reconciled' },
];

const TYPE_COLORS: Record<string, string> = {
  MERCHANT_PAYMENT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  MERCHANT_FEE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  OTC_BUY_AIRTIME: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  AIRTIME_COMMISSION: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  OTHER: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
};

const PAGE_LIMIT = 25;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string | null }) {
  const color = TYPE_COLORS[type || 'OTHER'] || TYPE_COLORS.OTHER;
  const label = (type || 'OTHER').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${color}`}
    >
      {label}
    </span>
  );
}

function shortDesc(desc: string) {
  return desc.length > 50 ? desc.slice(0, 50) + '…' : desc;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function MpesaImport() {
  const { refreshKey } = useCompanyRefresh();

  // Data state
  const [transactions, setTransactions] = React.useState<MpesaTx[]>([]);
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [importProgress, setImportProgress] = React.useState(0);
  const [parseError, setParseError] = React.useState<{ line?: number; message: string } | null>(null);
  const [importResult, setImportResult] = React.useState<{ imported: number; categorized: number; message: string } | null>(null);

  // UX state
  const [activeFilter, setActiveFilter] = React.useState<FilterTab>('all');
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [batchAccountId, setBatchAccountId] = React.useState('');
  const [batching, setBatching] = React.useState(false);
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set());

  // Slide-out panel state
  const [panelTx, setPanelTx] = React.useState<MpesaTx | null>(null);
  const [panelAccountId, setPanelAccountId] = React.useState('');
  const [panelCategorizing, setPanelCategorizing] = React.useState(false);

  // ─── Derived Data ──────────────────────────────────────────────────────────

  // Compute counts per filter tab from the total (unfiltered) data
  const totalUnmapped = transactions.filter((t) => !t.isReconciled && !t.mappedAccount).length;
  const totalNeedsReview = transactions.filter((t) => t.isReconciled && !t.mappedAccount).length;
  const totalReconciled = transactions.filter((t) => t.isReconciled && t.mappedAccount).length;

  const filteredTransactions = React.useMemo(() => {
    switch (activeFilter) {
      case 'unmapped':
        return transactions.filter((t) => !t.isReconciled && !t.mappedAccount);
      case 'needs-review':
        return transactions.filter((t) => t.isReconciled && !t.mappedAccount);
      case 'reconciled':
        return transactions.filter((t) => t.isReconciled && t.mappedAccount);
      default:
        return transactions;
    }
  }, [transactions, activeFilter]);

  const totalPaidIn = filteredTransactions.reduce((s, t) => s + (t.paidIn || 0), 0);
  const totalWithdrawn = filteredTransactions.reduce((s, t) => s + (t.withdrawn || 0), 0);

  // ─── Data Loading ──────────────────────────────────────────────────────────

  const loadTransactions = React.useCallback(
    async (pageNum: number = 1, searchTerm?: string) => {
      setLoading(true);
      try {
        const params: Record<string, unknown> = { page: pageNum, limit: PAGE_LIMIT };
        if (searchTerm) params.search = searchTerm;
        // Pass filter status to API if supported, otherwise client-side filter handles it
        const data = await api.get<{ items: MpesaTx[]; total: number; totalPages?: number; page?: number }>(
          '/mpesa',
          params,
        );
        setTransactions(data.items);
        setTotal(data.total);
        setTotalPages(data.totalPages || Math.ceil(data.total / PAGE_LIMIT));
      } catch (err: any) {
        showToast(
          'error',
          'Failed to load transactions',
          err?.response?.data?.message || 'Could not load M-Pesa transactions',
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const loadAccounts = React.useCallback(async () => {
    try {
      const data = await api.get<Account[]>('/ledger/accounts');
      setAccounts(data);
    } catch (err: any) {
      showToast('error', 'Failed to load accounts', err?.response?.data?.message || 'Could not load chart of accounts');
    }
  }, []);

  React.useEffect(() => {
    loadTransactions(page, search || undefined);
    loadAccounts();
  }, [refreshKey, page, search, loadTransactions, loadAccounts]);

  // ─── Selection ─────────────────────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTransactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTransactions.map((t) => t.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setBatchAccountId('');
  };

  // ─── Row Expand ────────────────────────────────────────────────────────────

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ─── Batch Categorize ─────────────────────────────────────────────────────

  const handleBatchCategorize = async () => {
    if (!batchAccountId || selectedIds.size === 0) return;
    setBatching(true);
    try {
      await api.post('/mpesa/transactions/batch-categorize', {
        ids: Array.from(selectedIds),
        accountId: batchAccountId,
      });
      showToast('success', 'Categorized', `${selectedIds.size} transactions categorized`);
      clearSelection();
      loadTransactions(page);
    } catch (err: any) {
      showToast('error', 'Batch categorize failed', err?.response?.data?.message || 'Could not categorize transactions');
    } finally {
      setBatching(false);
    }
  };

  // ─── Slide-Out Panel ─────────────────────────────────────────────────────

  const openPanel = (tx: MpesaTx) => {
    setPanelTx(tx);
    setPanelAccountId(tx.mappedAccount?.id || '');
  };

  const closePanel = () => {
    setPanelTx(null);
    setPanelAccountId('');
  };

  const handlePanelCategorize = async () => {
    if (!panelTx || !panelAccountId) return;
    setPanelCategorizing(true);
    try {
      await api.patch(`/mpesa/transactions/${panelTx.id}/categorize`, { accountId: panelAccountId });
      showToast('success', 'Categorized', 'Transaction categorized successfully');
      closePanel();
      loadTransactions(page);
    } catch (err: any) {
      showToast('error', 'Failed to categorize', err?.response?.data?.message || 'Could not categorize transaction');
    } finally {
      setPanelCategorizing(false);
    }
  };

  const handlePanelDelete = async () => {
    if (!panelTx) return;
    try {
      await apiClient.delete(`/mpesa/transactions?receiptNo=${panelTx.receiptNo || ''}`);
      showToast('success', 'Deleted', 'Transaction deleted successfully');
      closePanel();
      loadTransactions();
    } catch {
      showToast('error', 'Failed', 'Could not delete transaction');
    }
  };

  // ─── File Upload ──────────────────────────────────────────────────────────

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setImporting(true);
    setImportProgress(0);
    setParseError(null);
    setImportResult(null);

    try {
      // Simulate progress updates (real progress would come from API with onUploadProgress)
      const progressInterval = setInterval(() => {
        setImportProgress((prev) => Math.min(prev + 15, 90));
      }, 300);

      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        const formData = new FormData();
        formData.append('file', file);
        const data = await apiClient
          .post<{ imported: number; categorized: number; message: string }>('/mpesa/import/pdf', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
          .then((res) => res.data);
        clearInterval(progressInterval);
        setImportProgress(100);
        setImportResult(data);
      } else {
        const text = await file.text();
        const data = await api.post<{ imported: number; categorized: number; message: string }>('/mpesa/import', {
          csvData: text,
          fileName: file.name,
        });
        clearInterval(progressInterval);
        setImportProgress(100);
        setImportResult(data);
      }

      setPage(1);
      await loadTransactions(1);
    } catch (err: any) {
      const serverMsg = err?.response?.data?.message || '';
      // Try to extract line number from error message
      const lineMatch = serverMsg.match(/line\s*(\d+)/i);
      setParseError({
        line: lineMatch ? parseInt(lineMatch[1], 10) : undefined,
        message: serverMsg || 'Failed to import file',
      });
    } finally {
      setImporting(false);
    }
  };

  // ─── Filter Reset ─────────────────────────────────────────────────────────

  const handleFilterChange = (filter: FilterTab) => {
    setActiveFilter(filter);
    setPage(1);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const isEmpty = total === 0 && !loading;

  return (
    <PageShell title="M-Pesa Import" subtitle="Import and categorize M-Pesa business transactions">
      {/* Summary Stats */}
      {total > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-kenya-green-100 p-3 bg-white dark:bg-kenya-surface-dark">
            <p className="text-xs text-gray-500">Total Transactions</p>
            <p className="text-lg font-bold text-kenya-green-700">{total}</p>
          </div>
          <div className="rounded-xl border border-kenya-green-100 p-3 bg-white dark:bg-kenya-surface-dark">
            <p className="text-xs text-gray-500">Total Paid In</p>
            <p className="text-lg font-bold text-green-600">{formatKES(totalPaidIn)}</p>
          </div>
          <div className="rounded-xl border border-kenya-green-100 p-3 bg-white dark:bg-kenya-surface-dark">
            <p className="text-xs text-gray-500">Total Withdrawn</p>
            <p className="text-lg font-bold text-red-600">{formatKES(totalWithdrawn)}</p>
          </div>
          <div className="rounded-xl border border-kenya-green-100 p-3 bg-white dark:bg-kenya-surface-dark">
            <p className="text-xs text-gray-500">Mapped / Unmapped</p>
            <p className="text-lg font-bold text-kenya-green-900">
              {transactions.filter((t) => t.isReconciled && t.mappedAccount).length} / {totalUnmapped}
            </p>
          </div>
        </div>
      )}

      {/* Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle>Upload M-Pesa Statement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <FileUpload
              accept=".csv,.txt,.pdf,text/csv,application/pdf"
              onFileSelect={handleFileUpload}
              disabled={importing}
            />

            {/* Progress indicator */}
            {importing && (
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-kenya-green-600" aria-hidden="true" />
                <div className="flex-1">
                  <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-kenya-green-500 transition-all duration-300"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs text-gray-500 whitespace-nowrap">{importProgress}%</span>
              </div>
            )}

            {/* Import result */}
            {importResult && (
              <div className="rounded-lg bg-kenya-green-50 p-4 text-sm text-kenya-green-700 dark:bg-kenya-green-900/30 dark:text-kenya-green-300">
                <p className="font-medium">{importResult.message}</p>
                <div className="mt-2 flex gap-4 text-xs">
                  <span>{importResult.imported} imported</span>
                  <span>{importResult.categorized} auto-categorized</span>
                </div>
              </div>
            )}

            {/* Parse error with line number */}
            {parseError && (
              <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400" role="alert">
                <p className="font-medium">
                  {parseError.line ? `Error at line ${parseError.line}` : 'Import Error'}
                </p>
                <p className="mt-1 text-xs">{parseError.message}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transactions Section */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 w-full">
            {/* Title row */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full">
              <CardTitle className="shrink-0">Transactions ({total})</CardTitle>
              <div className="flex-1 max-w-sm relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none"
                  aria-hidden="true"
                />
                <Input
                  placeholder="Search transactions..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Quick Filter Tabs */}
            <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700" role="tablist">
              {FILTER_TABS.map((tab) => {
                const count =
                  tab.key === 'all'
                    ? total
                    : tab.key === 'unmapped'
                      ? totalUnmapped
                      : tab.key === 'needs-review'
                        ? totalNeedsReview
                        : totalReconciled;

                return (
                  <button
                    key={tab.key}
                    role="tab"
                    aria-selected={activeFilter === tab.key}
                    onClick={() => handleFilterChange(tab.key)}
                    className={cn(
                      'touch-target flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                      activeFilter === tab.key
                        ? 'border-kenya-green-500 text-kenya-green-700 dark:text-kenya-green-300'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:hover:text-gray-300',
                    )}
                  >
                    {tab.label}
                    {count > 0 && (
                      <span
                        className={cn(
                          'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-medium',
                          activeFilter === tab.key
                            ? 'bg-kenya-green-100 text-kenya-green-700 dark:bg-kenya-green-900/40 dark:text-kenya-green-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
                        )}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <PageState
            state={loading ? 'loading' : isEmpty ? 'empty' : 'ready'}
            icon="📄"
            title="No transactions yet"
            description="Upload a CSV or PDF statement to get started."
            action={{ label: 'Upload CSV', onClick: () => document.querySelector<HTMLElement>('[data-upload-trigger]')?.click() }}
          >
            {/* Batch Action Toolbar */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 bg-kenya-green-50 dark:bg-kenya-green-900/30 border border-kenya-green-100 dark:border-kenya-green-800 rounded-lg mb-4">
                <span className="text-xs font-medium text-kenya-green-700 dark:text-kenya-green-300 whitespace-nowrap">
                  {selectedIds.size} selected
                </span>
                <div className="flex-1 max-w-[220px]">
                  <Select
                    placeholder="Categorize as..."
                    value={batchAccountId}
                    onChange={(e) => setBatchAccountId(e.target.value)}
                    options={accounts.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }))}
                  />
                </div>
                <Button size="sm" disabled={!batchAccountId || batching} onClick={handleBatchCategorize}>
                  {batching ? 'Applying...' : 'Apply'}
                </Button>
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  Clear
                </Button>
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <th className="w-10 py-3 px-3">
                      <input
                        type="checkbox"
                        checked={filteredTransactions.length > 0 && selectedIds.size === filteredTransactions.length}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300"
                        aria-label="Select all transactions"
                      />
                    </th>
                    <th className="w-8 py-3 px-1" />
                    <th className="text-left py-3 px-3 font-medium text-gray-500 text-[11px] uppercase tracking-wider">
                      Date
                    </th>
                    <th className="text-left py-3 px-3 font-medium text-gray-500 text-[11px] uppercase tracking-wider">
                      Description
                    </th>
                    <th className="text-right py-3 px-3 font-medium text-gray-500 text-[11px] uppercase tracking-wider">
                      Paid In
                    </th>
                    <th className="text-right py-3 px-3 font-medium text-gray-500 text-[11px] uppercase tracking-wider">
                      Withdrawn
                    </th>
                    <th className="text-center py-3 px-3 font-medium text-gray-500 text-[11px] uppercase tracking-wider">
                      Type
                    </th>
                    <th className="text-left py-3 px-3 font-medium text-gray-500 text-[11px] uppercase tracking-wider">
                      Account
                    </th>
                    <th className="text-center py-3 px-3 font-medium text-gray-500 text-[11px] uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((tx) => {
                    const isExpanded = expandedRows.has(tx.id);
                    return (
                      <React.Fragment key={tx.id}>
                        <tr
                          onClick={() => openPanel(tx)}
                          className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-kenya-green-50/50 dark:hover:bg-kenya-green-900/20 cursor-pointer transition-colors"
                        >
                          <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(tx.id)}
                              onChange={() => toggleSelect(tx.id)}
                              className="rounded border-gray-300"
                              aria-label={`Select transaction ${tx.receiptNo || tx.id}`}
                            />
                          </td>
                          <td className="py-2.5 px-1">
                            <button
                              onClick={(e) => toggleExpand(tx.id, e)}
                              className="touch-target flex items-center justify-center w-8 h-8 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                              aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                              aria-expanded={isExpanded}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                          </td>
                          <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400 whitespace-nowrap text-xs">
                            {new Date(tx.transactionDate).toLocaleDateString('en-KE', {
                              day: '2-digit',
                              month: 'short',
                            })}
                          </td>
                          <td className="py-2.5 px-3 text-xs text-gray-600 dark:text-gray-400 max-w-[200px]" title={tx.description}>
                            {shortDesc(tx.description)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-xs font-medium text-green-600 dark:text-green-400 whitespace-nowrap">
                            {tx.paidIn > 0 ? formatKES(tx.paidIn) : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-xs font-medium text-red-600 dark:text-red-400 whitespace-nowrap">
                            {tx.withdrawn > 0 ? formatKES(tx.withdrawn) : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <TypeBadge type={tx.transactionType} />
                          </td>
                          <td className="py-2.5 px-3">
                            {tx.mappedAccount ? (
                              <Badge variant="success" size="sm">
                                {tx.mappedAccount.code}
                              </Badge>
                            ) : (
                              <span className="text-xs text-gray-400 italic">Uncategorized</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={cn(
                                'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium',
                                tx.isReconciled && tx.mappedAccount
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                  : tx.isReconciled
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
                              )}
                            >
                              {tx.isReconciled && tx.mappedAccount
                                ? '✓ Reconciled'
                                : tx.isReconciled
                                  ? '○ Needs Review'
                                  : '○ Unmapped'}
                            </span>
                          </td>
                        </tr>

                        {/* Expanded row: receipt#, customer name, phone */}
                        {isExpanded && (
                          <tr className="bg-gray-50/50 dark:bg-gray-800/20">
                            <td colSpan={9} className="px-12 py-3">
                              <div className="flex flex-wrap gap-x-8 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
                                <div>
                                  <span className="font-medium text-gray-700 dark:text-gray-300">Receipt No:</span>{' '}
                                  <span className="font-mono">{tx.receiptNo || '—'}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-700 dark:text-gray-300">Customer:</span>{' '}
                                  {tx.customerName || '—'}
                                </div>
                                <div>
                                  <span className="font-medium text-gray-700 dark:text-gray-300">Phone:</span>{' '}
                                  {tx.phoneNumber || '—'}
                                </div>
                                <div>
                                  <span className="font-medium text-gray-700 dark:text-gray-300">Paybill:</span>{' '}
                                  {tx.paybill || '—'}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page <= 1 || importing}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-500">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page >= totalPages || importing}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </PageState>
        </CardContent>
      </Card>

      {/* Slide-Out Panel — Transaction Details & Categorization */}
      <SlideOutPanel
        isOpen={!!panelTx}
        onClose={closePanel}
        title="Transaction Details"
        subtitle={panelTx?.receiptNo ? `Receipt #${panelTx.receiptNo}` : undefined}
        footer={
          <div className="flex gap-3">
            <Button
              variant="primary"
              size="md"
              className="flex-1"
              disabled={!panelAccountId || panelAccountId === panelTx?.mappedAccount?.id || panelCategorizing}
              onClick={handlePanelCategorize}
            >
              {panelCategorizing ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="destructive" size="md" onClick={handlePanelDelete}>
              Delete
            </Button>
          </div>
        }
      >
        {panelTx && (
          <div className="space-y-6">
            {/* Full transaction details */}
            <div className="grid grid-cols-2 gap-4">
              <DetailItem label="Date" value={new Date(panelTx.transactionDate).toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' })} />
              <DetailItem label="Receipt No" value={panelTx.receiptNo || '—'} mono />
              <DetailItem label="Customer" value={panelTx.customerName || '—'} />
              <DetailItem label="Phone" value={panelTx.phoneNumber || '—'} />
              <DetailItem label="Paybill" value={panelTx.paybill || '—'} />
              <DetailItem label="Type" value={panelTx.transactionType || 'OTHER'} badge={<TypeBadge type={panelTx.transactionType} />} />
              <DetailItem label="Paid In" value={panelTx.paidIn > 0 ? formatKES(panelTx.paidIn) : '—'} />
              <DetailItem label="Withdrawn" value={panelTx.withdrawn > 0 ? formatKES(panelTx.withdrawn) : '—'} />
              <DetailItem label="Status" value={panelTx.isReconciled ? 'Reconciled' : 'Unmapped'} />
            </div>

            {/* Description */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Description</p>
              <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                {panelTx.description}
              </p>
            </div>

            {/* Categorization */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Categorize as</label>
              <Select
                placeholder="Select account..."
                value={panelAccountId}
                onChange={(e) => setPanelAccountId(e.target.value)}
                options={accounts.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }))}
              />
              {panelTx.mappedAccount && (
                <p className="mt-1.5 text-xs text-gray-400">
                  Currently mapped to: <span className="font-medium text-kenya-green-600">{panelTx.mappedAccount.code} — {panelTx.mappedAccount.name}</span>
                </p>
              )}
            </div>

            {/* Amount summary */}
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Paid In</span>
                <span className="font-medium text-green-600">{formatKES(panelTx.paidIn)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Withdrawn</span>
                <span className="font-medium text-red-600">{formatKES(panelTx.withdrawn)}</span>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700 pt-1 flex justify-between text-sm">
                <span className="font-medium text-gray-700 dark:text-gray-300">Net</span>
                <span className={cn('font-medium', panelTx.paidIn - panelTx.withdrawn >= 0 ? 'text-green-600' : 'text-red-600')}>
                  {formatKES(panelTx.paidIn - panelTx.withdrawn)}
                </span>
              </div>
            </div>
          </div>
        )}
      </SlideOutPanel>
    </PageShell>
  );
}

// ─── Detail Item Sub-component ─────────────────────────────────────────────────

function DetailItem({
  label,
  value,
  mono,
  badge,
}: {
  label: string;
  value: string;
  mono?: boolean;
  badge?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-0.5">{label}</p>
      {badge || (
        <p className={cn('text-sm text-gray-900 dark:text-gray-100', mono && 'font-mono')}>{value}</p>
      )}
    </div>
  );
}
