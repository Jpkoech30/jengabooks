import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { TableSkeleton } from '../components/ui/skeleton';
import { EmptyState } from '../components/ui/empty-state';
import { SlideOutPanel } from '../components/ui/slide-out-panel';
import { Modal } from '../components/ui/modal';
import { PageShell } from '../components/layout/page-shell';
import { IncomeForm } from '../components/forms/income-form';
import { ExpenseForm } from '../components/forms/expense-form';
import { showToast, useUiStore } from '../stores/ui-store';
import { t } from '../lib/plain-english';
import { useQueryClient } from '@tanstack/react-query';
import { useJournalEntries } from '../hooks/use-api';
import { api } from '../lib/api-client';
import { formatKES, formatDate, cn } from '../lib/utils';
import type { JournalEntry } from '../lib/types';
import { Filter, Plus, Trash2, User, ChevronDown } from 'lucide-react';

// ─── Constants ─────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

// ─── Confidence Badge ───────────────────────────────────────────────────────

function renderConfidenceBadge(confidence: number | null | undefined) {
  if (confidence == null) return <span className="text-xs text-gray-400">—</span>;

  const tier = confidence >= 0.9 ? 'high' : confidence >= 0.7 ? 'medium' : 'low';
  const colors = {
    high: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    low: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  };
  const labels: Record<string, string> = {
    high: '✓ High',
    medium: '~ Med',
    low: '! Low',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${colors[tier]}`}
    >
      {labels[tier]}
    </span>
  );
}

// ─── Row Background ─────────────────────────────────────────────────────────

function rowBgClass(direction: 'DEBIT' | 'CREDIT'): string {
  return direction === 'DEBIT'
    ? 'bg-emerald-50/40 dark:bg-emerald-900/10'
    : 'bg-red-50/40 dark:bg-red-900/10';
}

// ─── Ledger Page ────────────────────────────────────────────────────────────

export function Ledger() {
  const plainEnglish = useUiStore((state) => state.plainEnglish);

  // ── State ──────────────────────────────────────────────────────────────
  const [search, setSearch] = React.useState('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [sortField, setSortField] = React.useState<string>('entryDate');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');
  const [showNewEntryMenu, setShowNewEntryMenu] = React.useState(false);
  const [showIncomeForm, setShowIncomeForm] = React.useState(false);
  const [showExpenseForm, setShowExpenseForm] = React.useState(false);
  const [showFilterPanel, setShowFilterPanel] = React.useState(false);

  // Slide-out panel
  const [selectedEntry, setSelectedEntry] = React.useState<JournalEntry | null>(null);
  const [showSlidePanel, setShowSlidePanel] = React.useState(false);

  // Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = React.useState<JournalEntry | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const queryClient = useQueryClient();
  const { data, isLoading } = useJournalEntries(page, search || undefined);

  // Accumulate entries across pages for "Load More" pattern
  const [allEntries, setAllEntries] = React.useState<JournalEntry[]>([]);

  React.useEffect(() => {
    if (data?.items) {
      if (page === 1) {
        setAllEntries(data.items);
      } else {
        setAllEntries((prev) => [...prev, ...data.items]);
      }
    }
  }, [data, page]);

  const entries = allEntries;
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  const hasMore = entries.length < total;
  const useLoadMore = total < 1000;

  const totalDebit = entries
    .filter((e) => e.direction === 'DEBIT')
    .reduce((sum, e) => sum + e.amount, 0);
  const totalCredit = entries
    .filter((e) => e.direction === 'CREDIT')
    .reduce((sum, e) => sum + e.amount, 0);

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleCreateSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
    queryClient.invalidateQueries({ queryKey: ['trial-balance'] });
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sortArrow = (field: string) => {
    if (sortField !== field) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  };

  const handleRowClick = (entry: JournalEntry) => {
    setSelectedEntry(entry);
    setShowSlidePanel(true);
  };

  const handleDeleteRequest = (entry: JournalEntry) => {
    setDeleteTarget(entry);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.delete(`/ledger/entries/${deleteTarget.id}`);
      showToast('success', 'Entry deleted', 'The journal entry has been deleted');
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['trial-balance'] });
      setShowSlidePanel(false);
      setSelectedEntry(null);
    } catch (err: any) {
      showToast('error', 'Failed to delete', err?.response?.data?.message || 'Could not delete entry');
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleLoadMore = () => {
    setPage((prev) => prev + 1);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleClearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setSearch('');
    setPage(1);
    setShowFilterPanel(false);
  };

  const hasActiveFilters = dateFrom || dateTo || search;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <PageShell
      title={t('General Ledger', plainEnglish)}
      subtitle={plainEnglish ? 'View all your business transactions' : 'View and manage all accounting entries'}
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

      {/* New Entry FAB Menu */}
      {showNewEntryMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowNewEntryMenu(false)}
            aria-hidden="true"
          />
          <div className="fixed bottom-24 right-6 z-50 flex flex-col gap-2">
            <button
              onClick={() => { setShowIncomeForm(true); setShowNewEntryMenu(false); }}
              className="flex items-center gap-3 rounded-xl bg-kenya-green-500 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-kenya-green-600 transition-colors"
            >
              <span className="text-lg" aria-hidden="true">💰</span>
              Record Income
            </button>
            <button
              onClick={() => { setShowExpenseForm(true); setShowNewEntryMenu(false); }}
              className="flex items-center gap-3 rounded-xl bg-kenya-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-kenya-amber-600 transition-colors"
            >
              <span className="text-lg" aria-hidden="true">💳</span>
              Record Expense
            </button>
          </div>
        </>
      )}

      {/* FAB */}
      <button
        onClick={() => setShowNewEntryMenu(!showNewEntryMenu)}
        className={cn(
          'fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition-all duration-200',
          'bg-kenya-green-500 text-white hover:bg-kenya-green-600 hover:scale-105 active:scale-95',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kenya-green-500 focus-visible:ring-offset-2',
        )}
        aria-label="New entry"
        title="New entry"
      >
        <Plus className={cn('h-6 w-6 transition-transform duration-200', showNewEntryMenu && 'rotate-45')} />
      </button>

      {/* Summary Bar */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('Total Debits', plainEnglish)}</p>
            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
              {formatKES(totalDebit)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('Total Credits', plainEnglish)}</p>
            <p className="text-xl font-bold text-amber-700 dark:text-amber-400">
              {formatKES(totalCredit)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Entries</p>
            <p className="text-xl font-bold text-kenya-gray-900 dark:text-kenya-green-50">
              {total}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Toggle + Search */}
      <Card>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search entries or references..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={hasActiveFilters ? 'primary' : 'secondary'}
                size="sm"
                leftIcon={<Filter className="h-4 w-4" />}
                onClick={() => setShowFilterPanel(!showFilterPanel)}
              >
                {hasActiveFilters ? `Filters (${[dateFrom, dateTo, search].filter(Boolean).length})` : 'Filter'}
              </Button>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Filter Dropdown */}
          {showFilterPanel && (
            <div className="mt-4 rounded-lg border border-kenya-green-100 bg-kenya-green-50/50 p-4 dark:border-kenya-green-800 dark:bg-kenya-green-900/10">
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500 dark:text-gray-400">From</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                    className="touch-target h-10 rounded-lg border border-kenya-green-200 bg-white px-3 text-sm dark:border-kenya-green-700 dark:bg-kenya-surface-dark"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500 dark:text-gray-400">To</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                    className="touch-target h-10 rounded-lg border border-kenya-green-200 bg-white px-3 text-sm dark:border-kenya-green-700 dark:bg-kenya-surface-dark"
                  />
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setShowFilterPanel(false); }}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ledger Table */}
      <Card>
        <CardHeader>
          <CardTitle>Entries ({total})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && page === 1 ? (
            <TableSkeleton rows={5} />
          ) : entries.length === 0 ? (
            search ? (
              <EmptyState
                icon="🔍"
                title="No entries found"
                description="Try different search terms or clear your filters"
              />
            ) : (
              <EmptyState
                icon="📒"
                title="No entries found"
                description="Record your first transaction to get started. You can import M-Pesa statements or manually add income and expenses."
                action={{ label: 'Record your first transaction → M-Pesa import', onClick: () => setShowIncomeForm(true) }}
              />
            )
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-kenya-green-100 dark:border-kenya-green-800">
                      <th
                        className="text-left py-3 px-3 font-medium text-gray-500 cursor-pointer hover:text-kenya-green-600 select-none"
                        onClick={() => handleSort('entryDate')}
                      >
                        Date{sortArrow('entryDate')}
                      </th>
                      <th
                        className="text-left py-3 px-3 font-medium text-gray-500 cursor-pointer hover:text-kenya-green-600 select-none"
                        onClick={() => handleSort('description')}
                      >
                        Description{sortArrow('description')}
                      </th>
                      <th className="text-left py-3 px-3 font-medium text-gray-500">Account</th>
                      <th
                        className="text-right py-3 px-3 font-medium text-gray-500 cursor-pointer hover:text-kenya-green-600 select-none"
                        onClick={() => handleSort('amount')}
                      >
                        {t('Debit', plainEnglish)}{sortArrow('amount')}
                      </th>
                      <th className="text-right py-3 px-3 font-medium text-gray-500">{t('Credit', plainEnglish)}</th>
                      <th className="text-center py-3 px-3 font-medium text-gray-500">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr
                        key={entry.id}
                        onClick={() => handleRowClick(entry)}
                        className={cn(
                          'border-b border-kenya-green-50 dark:border-kenya-green-900 last:border-0',
                          'cursor-pointer transition-colors duration-150',
                          'hover:brightness-95 dark:hover:brightness-110',
                          rowBgClass(entry.direction),
                        )}
                      >
                        <td className="py-3 px-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {formatDate(entry.entryDate)}
                        </td>
                        <td className="py-3 px-3 text-kenya-gray-900 dark:text-kenya-green-50 font-medium">
                          {entry.description}
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant="neutral" size="sm">
                            {entry.account?.code} {entry.account?.name}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-sm text-emerald-700 dark:text-emerald-300">
                          {entry.direction === 'DEBIT' ? formatKES(entry.amount) : '-'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-sm text-amber-700 dark:text-amber-400">
                          {entry.direction === 'CREDIT' ? formatKES(entry.amount) : '-'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {renderConfidenceBadge(entry.aiConfidence)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination / Load More */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center mt-6">
                  {useLoadMore ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLoadMore}
                      disabled={!hasMore || isLoading}
                      leftIcon={isLoading ? undefined : <ChevronDown className="h-4 w-4" />}
                    >
                      {isLoading
                        ? 'Loading...'
                        : hasMore
                          ? `Load More (${entries.length} of ${total})`
                          : `All ${total} entries loaded`}
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={page <= 1}
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
                        disabled={page >= totalPages}
                        onClick={() => setPage(page + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Slide-out Panel ─────────────────────────────────────────────── */}
      <SlideOutPanel
        isOpen={showSlidePanel}
        onClose={() => { setShowSlidePanel(false); setSelectedEntry(null); }}
        title={selectedEntry?.description ?? 'Entry Details'}
        subtitle={
          selectedEntry
            ? `${formatDate(selectedEntry.entryDate)} · ${selectedEntry.account?.code} ${selectedEntry.account?.name}`
            : undefined
        }
      >
        {selectedEntry && (
          <div className="space-y-6">
            {/* Amount */}
            <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800/50">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('Debit', plainEnglish)}</p>
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                    {selectedEntry.direction === 'DEBIT' ? formatKES(selectedEntry.amount) : 'KES 0.00'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('Credit', plainEnglish)}</p>
                  <p className="text-lg font-bold text-amber-700 dark:text-amber-400">
                    {selectedEntry.direction === 'CREDIT' ? formatKES(selectedEntry.amount) : 'KES 0.00'}
                  </p>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Posted By</p>
                <p className="text-sm font-medium text-kenya-gray-900 dark:text-kenya-green-50 flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400" />
                  {selectedEntry.postedBy?.name || '-'}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Account</p>
                <p className="text-sm text-kenya-gray-900 dark:text-kenya-green-50">
                  <Badge variant="neutral" size="sm">
                    {selectedEntry.account?.code} {selectedEntry.account?.name}
                  </Badge>
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Direction</p>
                <p className="text-sm font-medium text-kenya-gray-900 dark:text-kenya-green-50">
                  {selectedEntry.direction === 'DEBIT' ? (
                    <span className="text-emerald-700">{t('Debit', plainEnglish)}</span>
                  ) : (
                    <span className="text-amber-700">{t('Credit', plainEnglish)}</span>
                  )}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Reference</p>
                <p className="text-sm text-kenya-gray-900 dark:text-kenya-green-50">
                  {selectedEntry.reference || '-'}
                </p>
              </div>

              {selectedEntry.serialNumber && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Serial Number</p>
                  <p className="text-sm text-kenya-gray-900 dark:text-kenya-green-50 font-mono">
                    {selectedEntry.serialNumber}
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">AI Confidence</p>
                <div className="mt-1">{renderConfidenceBadge(selectedEntry.aiConfidence)}</div>
              </div>

              {selectedEntry.aiReasoning && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">AI Reasoning</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                    "{selectedEntry.aiReasoning}"
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Created</p>
                <p className="text-sm text-kenya-gray-900 dark:text-kenya-green-50">
                  {formatDate(selectedEntry.createdAt)}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Reconciled</p>
                <p className="text-sm text-kenya-gray-900 dark:text-kenya-green-50">
                  {selectedEntry.isReconciled ? (
                    <span className="text-kenya-green-600">Yes</span>
                  ) : (
                    <span className="text-gray-400">No</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
      </SlideOutPanel>

      {/* ── Slide-out Panel Footer ──────────────────────────────────────── */}
      {selectedEntry && showSlidePanel && (
        <div
          className={cn(
            'fixed bottom-0 right-0 z-50 border-t border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-kenya-surface-dark',
            'sm:w-[440px] lg:w-[480px]',
          )}
          style={{ maxWidth: '100vw' }}
        >
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="destructive"
              size="sm"
              leftIcon={<Trash2 className="h-4 w-4" />}
              onClick={() => handleDeleteRequest(selectedEntry)}
              disabled={isDeleting}
            >
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ───────────────────────────────────── */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Entry"
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDeleteConfirm} isLoading={isDeleting}>
              Delete
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Are you sure you want to delete this entry?
          </p>
          {deleteTarget && (
            <div className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                "{deleteTarget.description}"
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                {formatKES(deleteTarget.amount)} ·{' '}
                {deleteTarget.direction === 'DEBIT' ? t('Debit', plainEnglish) : t('Credit', plainEnglish)}
              </p>
            </div>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            This action cannot be undone.
          </p>
        </div>
      </Modal>
    </PageShell>
  );
}
