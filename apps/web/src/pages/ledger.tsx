import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { TableSkeleton } from '../components/ui/skeleton';
import { EmptyState } from '../components/ui/empty-state';
import { PageShell } from '../components/layout/page-shell';
import { IncomeForm } from '../components/forms/income-form';
import { ExpenseForm } from '../components/forms/expense-form';
import { showToast } from '../stores/ui-store';
import { useQueryClient } from '@tanstack/react-query';
import { useCompanyRefresh } from '../hooks/use-company-refresh';
import { useJournalEntries } from '../hooks/use-api';
import { api } from '../lib/api-client';
import { formatKES, formatDate } from '../lib/utils';

function renderConfidenceBadge(confidence: number | null | undefined) {
  if (confidence == null) return <span className="text-xs text-gray-400">—</span>;

  const tier = confidence >= 0.9 ? 'high' : confidence >= 0.7 ? 'medium' : 'low';
  const colors = {
    high: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    low: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  };
  const labels = {
    high: '✓ High',
    medium: '~ Med',
    low: '! Low',
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${colors[tier]}`}>
      {labels[tier]}
    </span>
  );
}

export function Ledger() {
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [showNewEntryMenu, setShowNewEntryMenu] = React.useState(false);
  const [showIncomeForm, setShowIncomeForm] = React.useState(false);
  const [showExpenseForm, setShowExpenseForm] = React.useState(false);
  const queryClient = useQueryClient();
  const { data, isLoading } = useJournalEntries(page, search || undefined);

  const entries = data?.items || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  const totalDebit = entries.filter((e) => e.direction === 'DEBIT').reduce((sum, e) => sum + e.amount, 0);
  const totalCredit = entries.filter((e) => e.direction === 'CREDIT').reduce((sum, e) => sum + e.amount, 0);

  const handleCreateSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
    queryClient.invalidateQueries({ queryKey: ['trial-balance'] });
  };

  const handleDeleteEntry = async (id: string, description: string) => {
    if (!window.confirm(`Delete entry "${description}"? This action cannot be undone.`)) return;
    try {
      await api.delete(`/ledger/entries/${id}`);
      showToast('success', 'Entry deleted', 'The journal entry has been deleted');
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['trial-balance'] });
    } catch (err: any) {
      showToast('error', 'Failed to delete', err?.response?.data?.message || 'Could not delete entry');
    }
  };

  return (
    <PageShell
      title="General Ledger"
      subtitle="View and manage all accounting entries"
      actions={
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm">Export CSV</Button>
          <div className="relative">
            <Button size="sm" onClick={() => setShowNewEntryMenu(!showNewEntryMenu)}>
              + New Entry
            </Button>
            {showNewEntryMenu && (
              <div className="absolute right-0 top-full mt-2 z-50 w-48 rounded-xl border border-kenya-green-100 bg-white shadow-lg dark:border-kenya-green-800 dark:bg-kenya-surface-dark overflow-hidden">
                <button
                  onClick={() => { setShowIncomeForm(true); setShowNewEntryMenu(false); }}
                  className="touch-target flex w-full items-center gap-3 px-4 py-3 text-sm text-kenya-green-900 hover:bg-kenya-green-50 dark:text-kenya-green-50 dark:hover:bg-kenya-green-900/30"
                >
                  <span className="text-lg" aria-hidden="true">💰</span>
                  <span className="font-medium">Record Income</span>
                </button>
                <button
                  onClick={() => { setShowExpenseForm(true); setShowNewEntryMenu(false); }}
                  className="touch-target flex w-full items-center gap-3 px-4 py-3 text-sm text-kenya-green-900 hover:bg-kenya-green-50 dark:text-kenya-green-50 dark:hover:bg-kenya-green-900/30"
                >
                  <span className="text-lg" aria-hidden="true">💳</span>
                  <span className="font-medium">Record Expense</span>
                </button>
              </div>
            )}
          </div>
        </div>
      }
    >
      {/* Income Form Modal */}
      <IncomeForm
        isOpen={showIncomeForm}
        onClose={() => { setShowIncomeForm(false); setShowNewEntryMenu(false); }}
        onSuccess={handleCreateSuccess}
      />

      {/* Expense Form Modal */}
      <ExpenseForm
        isOpen={showExpenseForm}
        onClose={() => { setShowExpenseForm(false); setShowNewEntryMenu(false); }}
        onSuccess={handleCreateSuccess}
      />

      {/* Summary Bar */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Debits</p>
            <p className="text-xl font-bold text-kenya-green-700 dark:text-kenya-green-300">{formatKES(totalDebit)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Credits</p>
            <p className="text-xl font-bold text-kenya-amber-600 dark:text-kenya-amber-400">{formatKES(totalCredit)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Entries</p>
            <p className="text-xl font-bold text-kenya-green-900 dark:text-kenya-green-50">{total}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search entries or references..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ledger Table */}
      <Card>
        <CardHeader>
          <CardTitle>Entries ({total})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={5} />
          ) : entries.length === 0 ? (
            search ? (
              <EmptyState
                icon="📒"
                title="No entries found"
                description="Try different search terms"
              />
            ) : (
              <EmptyState
                icon="📒"
                title="No entries found"
                description="Record your first transaction to get started"
                action={{ label: 'Add Income', onClick: () => setShowIncomeForm(true) }}
              />
            )
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-kenya-green-100 dark:border-kenya-green-800">
                      <th className="text-left py-3 px-3 font-medium text-gray-500">Date</th>
                      <th className="text-left py-3 px-3 font-medium text-gray-500">Description</th>
                      <th className="text-left py-3 px-3 font-medium text-gray-500">Account</th>
                      <th className="text-center py-3 px-3 font-medium text-gray-500">Confidence</th>
                      <th className="text-right py-3 px-3 font-medium text-gray-500">Debit</th>
                      <th className="text-right py-3 px-3 font-medium text-gray-500">Credit</th>
                      <th className="text-left py-3 px-3 font-medium text-gray-500">Posted By</th>
                      <th className="text-center py-3 px-3 font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.id} className="border-b border-kenya-green-50 dark:border-kenya-green-900 last:border-0 hover:bg-kenya-green-50/50 dark:hover:bg-kenya-green-900/30">
                        <td className="py-3 px-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {formatDate(entry.entryDate)}
                        </td>
                        <td className="py-3 px-3 text-kenya-green-900 dark:text-kenya-green-50 font-medium">{entry.description}</td>
                        <td className="py-3 px-3">
                          <Badge variant="neutral" size="sm">{entry.account?.code} {entry.account?.name}</Badge>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {renderConfidenceBadge(entry.aiConfidence)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-sm text-kenya-green-700 dark:text-kenya-green-300">
                          {entry.direction === 'DEBIT' ? formatKES(entry.amount) : '-'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-sm text-kenya-amber-600 dark:text-kenya-amber-400">
                          {entry.direction === 'CREDIT' ? formatKES(entry.amount) : '-'}
                        </td>
                        <td className="py-3 px-3 text-gray-600 dark:text-gray-400">{entry.postedBy?.name || '-'}</td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => handleDeleteEntry(entry.id, entry.description)}
                            className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                            title="Delete entry"
                          >
                            🗑️
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
            </>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
