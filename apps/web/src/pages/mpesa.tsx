import React from 'react';
import { useCompanyRefresh } from '../hooks/use-company-refresh';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { FileUpload } from '../components/ui/file-upload';
import { Modal } from '../components/ui/modal';
import { PageShell } from '../components/layout/page-shell';
import { PageState } from '../components/ui/page-state';
import { api, apiClient } from '../lib/api-client';
import { showToast } from '../stores/ui-store';

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

const TYPE_COLORS: Record<string, string> = {
  MERCHANT_PAYMENT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  MERCHANT_FEE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  OTC_BUY_AIRTIME: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  AIRTIME_COMMISSION: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  OTHER: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
};

function TypeBadge({ type }: { type: string | null }) {
  const color = TYPE_COLORS[type || 'OTHER'] || TYPE_COLORS.OTHER;
  const label = (type || 'OTHER').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${color}`}>{label}</span>;
}

export function MpesaImport() {
  const { refreshKey } = useCompanyRefresh();
  const [transactions, setTransactions] = React.useState<MpesaTx[]>([]);
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [result, setResult] = React.useState<{ imported: number; categorized: number; message: string } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [batchAccountId, setBatchAccountId] = React.useState('');
  const [batching, setBatching] = React.useState(false);
  const PAGE_LIMIT = 25;
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map((t) => t.id)));
    }
  };

  const handleBatchCategorize = async () => {
    if (!batchAccountId || selectedIds.size === 0) return;
    setBatching(true);
    try {
      await api.post('/mpesa/transactions/batch-categorize', {
        ids: Array.from(selectedIds),
        accountId: batchAccountId,
      });
      showToast('success', 'Categorized', `${selectedIds.size} transactions categorized`);
      setSelectedIds(new Set());
      setBatchAccountId('');
      loadTransactions(page);
    } catch (err: any) {
      showToast('error', 'Batch categorize failed', err?.response?.data?.message || 'Could not categorize transactions');
    } finally {
      setBatching(false);
    }
  };

  const loadTransactions = async (pageNum: number = 1) => {
    setLoading(true);
    try {
      const data = await api.get<{ items: MpesaTx[]; total: number; totalPages?: number; page?: number }>('/mpesa', { page: pageNum, limit: PAGE_LIMIT });
      setTransactions(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages || Math.ceil(data.total / PAGE_LIMIT));
    } catch (err: any) {
      showToast('error', 'Failed to load transactions', err?.response?.data?.message || 'Could not load M-Pesa transactions');
    } finally { setLoading(false); }
  };

  const loadAccounts = async () => {
    try {
      const data = await api.get<Account[]>('/ledger/accounts');
      setAccounts(data);
    } catch (err: any) {
      showToast('error', 'Failed to load accounts', err?.response?.data?.message || 'Could not load chart of accounts');
    }
  };

  React.useEffect(() => {
    loadTransactions(page);
    loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, page]);

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setImporting(true);
    setError(null);
    setResult(null);
    try {
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        const formData = new FormData();
        formData.append('file', file);
        const data = await apiClient.post<{ imported: number; categorized: number; message: string }>('/mpesa/import/pdf', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        }).then(res => res.data);
        setResult(data);
      } else {
        const text = await file.text();
        const data = await api.post<{ imported: number; categorized: number; message: string }>('/mpesa/import', {
          csvData: text,
          fileName: file.name,
        });
        setResult(data);
      }
      setPage(1);
      loadTransactions(1);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to import file');
    } finally {
      setImporting(false);
    }
  };

  const [deleteConfirm, setDeleteConfirm] = React.useState<{ open: boolean; type: 'single' | 'all'; receiptNo?: string; txId?: string }>({ open: false, type: 'all' });

  const handleDeleteTransaction = async (receiptNo: string) => {
    try {
      await apiClient.delete(`/mpesa/transactions?receiptNo=${receiptNo}`);
      showToast('success', 'Deleted', 'Transaction deleted successfully');
      loadTransactions();
    } catch { showToast('error', 'Failed', 'Could not delete transaction'); }
    setDeleteConfirm({ open: false, type: 'single' });
  };

  const handleDeleteAll = async () => {
    try {
      await apiClient.delete('/mpesa/transactions/all');
      showToast('success', 'Deleted', 'All transactions deleted successfully');
      loadTransactions();
    } catch { showToast('error', 'Failed', 'Could not delete transactions'); }
    setDeleteConfirm({ open: false, type: 'all' });
  };

  const handleCategorize = async (txId: string, accountId: string) => {
    try {
      await api.patch(`/mpesa/transactions/${txId}/categorize`, { accountId });
      loadTransactions();
    } catch (err: any) {
      showToast('error', 'Failed to categorize', err?.response?.data?.message || 'Could not categorize transaction');
    }
  };

  const formatKES = (amount: number) => `KES ${amount.toLocaleString('en-KE')}`;
  const shortDesc = (desc: string) => desc.length > 40 ? desc.slice(0, 40) + '…' : desc;

  // Stats
  const totalPaidIn = transactions.reduce((s, t) => s + (t.paidIn || 0), 0);
  const totalWithdrawn = transactions.reduce((s, t) => s + (t.withdrawn || 0), 0);
  const mapped = transactions.filter(t => t.isReconciled).length;

  return (
    <PageShell
      title="M-Pesa Import"
      subtitle="Import and categorize M-Pesa business transactions"
    >

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
            <p className="text-lg font-bold text-kenya-green-900">{mapped} / {transactions.length - mapped}</p>
          </div>
        </div>
      )}

      {/* Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle>Upload M-Pesa CSV / PDF</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <FileUpload
              accept=".csv,.txt,.pdf,text/csv,application/pdf"
              onFileSelect={handleFileUpload}
              disabled={importing}
            />
            {result && (
              <div className="rounded-lg bg-kenya-green-50 p-4 text-sm text-kenya-green-700 dark:bg-kenya-green-900/30 dark:text-kenya-green-300">
                {result.message}
              </div>
            )}
            {error && (
              <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
                {error}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <CardTitle>Transactions ({total})</CardTitle>
            {transactions.length > 0 && (
              <Button variant="destructive" size="sm" onClick={() => setDeleteConfirm({ open: true, type: 'all' })}>
                Delete All
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <PageState
            state={loading ? 'loading' : transactions.length === 0 ? 'empty' : 'ready'}
            icon="📄"
            title="No transactions yet"
            description="Upload a CSV or PDF statement to get started."
            skeletonRows={5}
          >
            <div className="overflow-x-auto">
              {/* Batch action bar */}
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-3 px-4 py-2 bg-kenya-green-50 dark:bg-kenya-green-900/30 border-b border-kenya-green-100 dark:border-kenya-green-800">
                  <span className="text-xs font-medium text-kenya-green-700 dark:text-kenya-green-300">
                    {selectedIds.size} selected
                  </span>
                  <select
                    value={batchAccountId}
                    onChange={(e) => setBatchAccountId(e.target.value)}
                    className="text-xs rounded border border-kenya-green-200 px-2 py-1.5 dark:border-kenya-green-700 dark:bg-kenya-surface-dark"
                  >
                    <option value="">Categorize as...</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                    ))}
                  </select>
                  <Button size="sm" disabled={!batchAccountId || batching} onClick={handleBatchCategorize}>
                    {batching ? 'Applying...' : 'Apply'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedIds(new Set()); setBatchAccountId(''); }}>
                    Clear
                  </Button>
                </div>
              )}

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-kenya-green-100 dark:border-kenya-green-800">
                    <th className="w-8 py-3 px-2">
                      <input
                        type="checkbox"
                        checked={transactions.length > 0 && selectedIds.size === transactions.length}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300"
                        aria-label="Select all transactions"
                      />
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500 text-[11px] uppercase">Date</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500 text-[11px] uppercase">Receipt</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500 text-[11px] uppercase">Customer</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500 text-[11px] uppercase">Description</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-500 text-[11px] uppercase">Paid In</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-500 text-[11px] uppercase">Withdrawn</th>
                    <th className="text-center py-3 px-2 font-medium text-gray-500 text-[11px] uppercase">Type</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500 text-[11px] uppercase">Account</th>
                    <th className="text-center py-3 px-2 font-medium text-gray-500 text-[11px] uppercase">Status</th>
                    <th className="w-8 py-3 px-2" />
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-kenya-green-50 dark:border-kenya-green-900 last:border-0 hover:bg-kenya-green-50/50 dark:hover:bg-kenya-green-900/30">
                      <td className="py-2.5 px-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(tx.id)}
                          onChange={() => toggleSelect(tx.id)}
                          className="rounded border-gray-300"
                          aria-label={`Select transaction ${tx.receiptNo || tx.id}`}
                        />
                      </td>
                      <td className="py-2.5 px-2 text-gray-600 dark:text-gray-400 whitespace-nowrap text-xs">
                        {new Date(tx.transactionDate).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' })}
                      </td>
                      <td className="py-2.5 px-2 font-mono text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap max-w-[80px] truncate" title={tx.receiptNo || ''}>
                        {tx.receiptNo || '—'}
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="flex flex-col">
                          {tx.customerName && <span className="text-xs font-medium text-kenya-green-900 dark:text-kenya-green-50 truncate max-w-[120px]" title={tx.customerName}>{tx.customerName}</span>}
                          {tx.phoneNumber && <span className="text-[10px] text-gray-400">{tx.phoneNumber}</span>}
                          {!tx.customerName && !tx.phoneNumber && <span className="text-xs text-gray-400">—</span>}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-xs text-gray-600 dark:text-gray-400 max-w-[160px]" title={tx.description}>
                        {shortDesc(tx.description)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-xs font-medium text-green-600 dark:text-green-400 whitespace-nowrap">
                        {tx.paidIn > 0 ? formatKES(tx.paidIn) : '—'}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-xs font-medium text-red-600 dark:text-red-400 whitespace-nowrap">
                        {tx.withdrawn > 0 ? formatKES(tx.withdrawn) : '—'}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <TypeBadge type={tx.transactionType} />
                      </td>
                      <td className="py-2.5 px-2">
                        {tx.mappedAccount ? (
                          <Badge variant="success" size="sm">{tx.mappedAccount.code}</Badge>
                        ) : (
                          <select
                            className="text-[10px] rounded border border-kenya-green-200 px-1.5 py-1 max-w-[110px] dark:border-kenya-green-700 dark:bg-kenya-surface-dark"
                            onChange={(e) => e.target.value && handleCategorize(tx.id, e.target.value)}
                            defaultValue=""
                          >
                            <option value="" disabled>Categorize...</option>
                            {accounts.map((a) => (
                              <option key={a.id} value={a.id}>{a.code}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          tx.isReconciled
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                        }`}>
                          {tx.isReconciled ? '✓ Mapped' : '○ Unmapped'}
                        </span>
                      </td>
                      <td className="py-2.5 px-2">
                        <button
                          onClick={() => setDeleteConfirm({ open: true, type: 'single', receiptNo: tx.receiptNo || undefined, txId: tx.id })}
                          className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          aria-label="Delete"
                          title="Delete transaction"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <span className="text-sm text-gray-500">
                  Page {page} of {totalPages}
                </span>
                <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  Next
                </Button>
              </div>
            )}
          </PageState>
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, type: 'all' })}
        title={deleteConfirm.type === 'all' ? 'Delete All Transactions' : 'Delete Transaction'}
        size="sm"
        footer={
          <div className="flex gap-3 w-full">
            <Button variant="secondary" size="md" className="flex-1" onClick={() => setDeleteConfirm({ open: false, type: 'all' })}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="md"
              className="flex-1"
              onClick={() => deleteConfirm.type === 'all' ? handleDeleteAll() : deleteConfirm.receiptNo && handleDeleteTransaction(deleteConfirm.receiptNo)}
            >
              {deleteConfirm.type === 'all' ? 'Delete All' : 'Delete'}
            </Button>
          </div>
        }
      >
        <div className="py-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {deleteConfirm.type === 'all'
              ? 'Are you sure you want to delete all imported transactions? This action cannot be undone.'
              : 'Are you sure you want to delete this transaction? This action cannot be undone.'}
          </p>
        </div>
      </Modal>
    </PageShell>
  );
}
