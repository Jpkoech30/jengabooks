import React from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Modal } from '../components/ui/modal';
import { Select } from '../components/ui/select';
import { Table } from '../components/ui/table';
import { SlideOutPanel } from '../components/ui/slide-out-panel';
import { EmptyState } from '../components/ui/empty-state';
import { PageShell } from '../components/layout/page-shell';
import { PageState } from '../components/ui/page-state';
import { showToast } from '../stores/ui-store';
import { api } from '../lib/api-client';
import { ChevronDown } from 'lucide-react';

interface HitlTask {
  id: string;
  category: string;
  description: string;
  status: string;
  assignedTo?: string;
  assignedUser?: { id: string; name: string };
  resolvedUser?: { id: string; name: string };
  rawData?: string;
  conflictData?: string;
  xpAwarded?: number;
  resolution?: string;
  resolutionAction?: string;
  linkedEntityId?: string;
  linkedEntityType?: string;
  confidence?: number;
  createdAt: string;
}

const categoryIcon: Record<string, string> = {
  BACKDATED_ENTRY: '📅',
  UNMAPPED_DATA: '🔗',
  ETIMS_FAILURE: '🧾',
  RECONCILIATION_CONFLICT: '⚖️',
};

const CATEGORIES = ['BACKDATED_ENTRY', 'UNMAPPED_DATA', 'ETIMS_FAILURE', 'RECONCILIATION_CONFLICT'] as const;

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  ...CATEGORIES.map((cat) => ({
    value: cat,
    label: `${categoryIcon[cat]} ${cat.replace(/_/g, ' ')}`,
  })),
];

const RESOLUTION_ACTIONS = [
  { value: 'APPROVE', label: '✅ Approve' },
  { value: 'REJECT', label: '❌ Reject' },
  { value: 'EDIT', label: '✏️ Edit & Approve' },
];

function priorityBadge(category: string): 'warning' | 'info' | 'error' | 'neutral' {
  if (category === 'RECONCILIATION_CONFLICT') return 'warning';
  if (category === 'ETIMS_FAILURE') return 'error';
  if (category === 'BACKDATED_ENTRY') return 'warning';
  return 'info';
}

function statusBadgeVariant(status: string): 'success' | 'warning' | 'info' | 'neutral' {
  switch (status) {
    case 'PENDING': return 'warning';
    case 'IN_PROGRESS': return 'info';
    case 'RESOLVED': return 'success';
    default: return 'neutral';
  }
}

function getColumnTasks(tasks: HitlTask[], status: string) {
  return tasks.filter((t) => t.status === status);
}

export function HitlHub() {
  const [tasks, setTasks] = React.useState<HitlTask[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [profileId, setProfileId] = React.useState<string>('');

  // Filters
  const [filterMyTasks, setFilterMyTasks] = React.useState(false);
  const [filterCategory, setFilterCategory] = React.useState('');
  const [showResolved, setShowResolved] = React.useState(false);

  // Sorting
  const [sortKey, setSortKey] = React.useState<string>('createdAt');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');

  // Create review modal
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [newCategory, setNewCategory] = React.useState('UNMAPPED_DATA');
  const [newDescription, setNewDescription] = React.useState('');
  const [newRawData, setNewRawData] = React.useState('');
  const [newConflictData, setNewConflictData] = React.useState('');
  const [creating, setCreating] = React.useState(false);

  // Detail slide-out panel
  const [selectedTask, setSelectedTask] = React.useState<HitlTask | null>(null);
  const [resolutionAction, setResolutionAction] = React.useState<'APPROVE' | 'REJECT' | 'EDIT'>('APPROVE');
  const [resolutionNotes, setResolutionNotes] = React.useState('');
  const [resolving, setResolving] = React.useState(false);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {};
      if (filterMyTasks && profileId) params.assignedTo = profileId;
      if (filterCategory) params.category = filterCategory;

      const [taskData, profile] = await Promise.all([
        api.get<{ items: HitlTask[]; total: number }>('/hitl', params),
        api.get<{ id: string }>('/auth/profile').catch(() => null),
      ]);
      setTasks(taskData.items);
      if (profile) setProfileId(profile.id);
    } catch (e) {
      console.error('Failed to load HITL data:', e);
      showToast('error', 'Failed to load tasks', 'Please try again');
    } finally {
      setLoading(false);
    }
  }, [filterMyTasks, filterCategory, profileId]);

  React.useEffect(() => { loadData(); }, [loadData]);

  const claimTask = async (taskId: string) => {
    try {
      await api.post(`/hitl/${taskId}/assign`, {});
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: 'IN_PROGRESS', assignedTo: profileId } : t));
      showToast('success', 'Task claimed', 'The task has been assigned to you');
    } catch (e: any) {
      showToast('error', 'Failed to claim task', e?.response?.data?.message || 'Please try again');
    }
  };

  const unclaimTask = async (taskId: string) => {
    try {
      await api.post(`/hitl/${taskId}/unassign`, {});
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: 'PENDING', assignedTo: undefined } : t));
      showToast('success', 'Task unclaimed', 'Task returned to the pool');
    } catch (e: any) {
      showToast('error', 'Failed to unclaim task', e?.response?.data?.message || 'Please try again');
    }
  };

  const handleRowClick = (task: HitlTask) => {
    setSelectedTask(task);
    setResolutionAction('APPROVE');
    setResolutionNotes('');
  };

  const handleResolve = async () => {
    if (!selectedTask) return;
    setResolving(true);
    try {
      const resolutionText = resolutionNotes ||
        (resolutionAction === 'APPROVE' ? 'Approved after review' :
         resolutionAction === 'REJECT' ? 'Rejected — requires further investigation' :
         'Edited and approved');

      let correctedData: string | undefined;
      if (resolutionAction === 'EDIT' && resolutionNotes) {
        correctedData = JSON.stringify({ notes: resolutionNotes });
      }

      await api.post(`/hitl/${selectedTask.id}/resolve`, {
        resolution: resolutionText,
        action: resolutionAction,
        correctedData,
      });
      setTasks((prev) => prev.map((t) => t.id === selectedTask.id ? { ...t, status: 'RESOLVED' } : t));
      showToast('success', 'Task resolved', 'Resolution submitted');
      setSelectedTask(null);
    } catch (e: any) {
      showToast('error', 'Failed to resolve', e?.response?.data?.message || 'Please try again');
    } finally {
      setResolving(false);
    }
  };

  const handleStatusChange = async (task: HitlTask, newStatus: string) => {
    if (newStatus === task.status) return;

    if (newStatus === 'IN_PROGRESS' && task.status === 'PENDING') {
      await claimTask(task.id);
    } else if (newStatus === 'PENDING' && task.status === 'IN_PROGRESS') {
      await unclaimTask(task.id);
    }
    // RESOLVED is handled exclusively via the slide-out panel
  };

  const handleCreateReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/hitl', {
        category: newCategory,
        description: newDescription,
        rawData: newRawData || undefined,
        conflictData: newConflictData || undefined,
      });
      showToast('success', 'Review created', 'New item has been added to the review queue');
      setShowCreateModal(false);
      setNewDescription('');
      setNewRawData('');
      setNewConflictData('');
      loadData();
    } catch (err: any) {
      showToast('error', 'Failed to create review', err?.response?.data?.message || 'Please try again');
    } finally {
      setCreating(false);
    }
  };

  // ── Sorting ──────────────────────────────────────────────────────────────

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // ── Filtered + sorted data ───────────────────────────────────────────────

  const filteredTasks = React.useMemo(() => {
    let result = [...tasks];

    // "My Tasks" filter
    if (filterMyTasks && profileId) {
      result = result.filter((t) => t.assignedTo === profileId);
    }

    // Category filter
    if (filterCategory) {
      result = result.filter((t) => t.category === filterCategory);
    }

    // "Show resolved" toggle (default off → resolved items hidden)
    if (!showResolved) {
      result = result.filter((t) => t.status !== 'RESOLVED');
    }

    // Sort
    result.sort((a, b) => {
      let aVal: unknown;
      let bVal: unknown;

      if (sortKey === 'createdAt') {
        aVal = new Date(a.createdAt).getTime();
        bVal = new Date(b.createdAt).getTime();
      } else if (sortKey === 'confidence') {
        aVal = a.confidence ?? -1;
        bVal = b.confidence ?? -1;
      } else if (sortKey === 'assignedTo') {
        aVal = a.assignedUser?.name?.toLowerCase() ?? '';
        bVal = b.assignedUser?.name?.toLowerCase() ?? '';
      } else {
        aVal = (a[sortKey as keyof HitlTask] as string)?.toLowerCase() ?? '';
        bVal = (b[sortKey as keyof HitlTask] as string)?.toLowerCase() ?? '';
      }

      if (aVal == null) return 1;
      if (bVal == null) return -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [tasks, filterMyTasks, filterCategory, showResolved, sortKey, sortDir, profileId]);

  // ── Status counts ────────────────────────────────────────────────────────

  const pendingCount = getColumnTasks(tasks, 'PENDING').length;
  const inProgressCount = getColumnTasks(tasks, 'IN_PROGRESS').length;
  const resolvedCount = getColumnTasks(tasks, 'RESOLVED').length;
  const activeTasksExist = pendingCount + inProgressCount > 0;

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return <PageState state="loading" skeletonRows={3}><></></PageState>;
  }

  // ── Empty / All Clear state ──────────────────────────────────────────────
  if (!activeTasksExist) {
    return (
      <PageShell
        title="HITL Hub"
        subtitle="Human-In-The-Loop — Review and resolve AI decisions"
        actions={
          <Button variant="secondary" size="sm" onClick={() => setShowCreateModal(true)}>
            + Create Review
          </Button>
        }
      >
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card><CardContent className="text-center py-4">
            <p className="text-2xl font-bold text-kenya-amber-500">0</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Pending</p>
          </CardContent></Card>
          <Card><CardContent className="text-center py-4">
            <p className="text-2xl font-bold text-blue-500">0</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">In Progress</p>
          </CardContent></Card>
          <Card><CardContent className="text-center py-4">
            <p className="text-2xl font-bold text-kenya-green-500">{resolvedCount}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Resolved</p>
          </CardContent></Card>
        </div>

        <EmptyState
          icon="🎉"
          title="All clear! No items need review"
          description="All AI decisions have been reviewed and resolved. New items will appear here as they come in."
          animation="confetti"
          action={{ label: '+ Create Review Item', onClick: () => setShowCreateModal(true) }}
          helpLink={{ label: 'Learn more about HITL reviews', href: '/help/hitl' }}
        />

        {/* Create Review Modal */}
        <CreateReviewModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateReview}
          newCategory={newCategory}
          onCategoryChange={setNewCategory}
          newDescription={newDescription}
          onDescriptionChange={setNewDescription}
          newRawData={newRawData}
          onRawDataChange={setNewRawData}
          newConflictData={newConflictData}
          onConflictDataChange={setNewConflictData}
          creating={creating}
        />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="HITL Hub"
      subtitle="Human-In-The-Loop — Review and resolve AI decisions"
      actions={
        <Button variant="secondary" size="sm" onClick={() => setShowCreateModal(true)}>
          + Create Review
        </Button>
      }
    >
      {/* ── Filter Bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setFilterMyTasks(!filterMyTasks)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filterMyTasks
              ? 'bg-kenya-green-500 text-white'
              : 'bg-kenya-green-50 text-kenya-green-700 hover:bg-kenya-green-100 dark:bg-kenya-green-900/30 dark:text-kenya-green-300'
          }`}
        >
          <span aria-hidden="true">👤</span> My Tasks
        </button>

        <Select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          options={CATEGORY_OPTIONS}
          placeholder="All Categories"
          className="w-56"
        />

        <button
          onClick={() => setShowResolved(!showResolved)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            showResolved
              ? 'bg-kenya-green-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
          }`}
        >
          ✅ Show resolved
        </button>

        <span className="text-xs text-gray-400 ml-auto">
          {filteredTasks.length} displayed
        </span>
      </div>

      {/* ── Stat Summary Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="text-center py-4">
          <p className="text-2xl font-bold text-kenya-amber-500">{pendingCount}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Pending</p>
        </CardContent></Card>
        <Card><CardContent className="text-center py-4">
          <p className="text-2xl font-bold text-blue-500">{inProgressCount}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">In Progress</p>
        </CardContent></Card>
        <Card><CardContent className="text-center py-4">
          <p className="text-2xl font-bold text-kenya-green-500">{resolvedCount}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Resolved</p>
        </CardContent></Card>
      </div>

      {/* ── Sortable Table ──────────────────────────────────────────────── */}
      <Table
        columns={[
          {
            key: 'category',
            label: 'Category',
            sortable: true,
            render: (task: HitlTask) => (
              <div className="flex items-center gap-2">
                <span aria-hidden="true">{categoryIcon[task.category] || '📋'}</span>
                <Badge variant={priorityBadge(task.category)} size="sm">
                  {task.category.replace(/_/g, ' ')}
                </Badge>
              </div>
            ),
          },
          {
            key: 'description',
            label: 'Description',
            sortable: true,
            render: (task: HitlTask) => (
              <span className="line-clamp-2 text-sm text-gray-700 dark:text-gray-300 max-w-xs">
                {task.description}
              </span>
            ),
          },
          {
            key: 'status',
            label: 'Status',
            sortable: true,
            render: (task: HitlTask) => {
              if (task.status === 'RESOLVED') {
                return <Badge variant="success" size="sm">Resolved</Badge>;
              }

              return (
                <div className="relative inline-block">
                  <select
                    value={task.status}
                    onChange={(e) => handleStatusChange(task, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className={`appearance-none rounded-lg border px-3 py-1.5 pr-7 text-xs font-medium transition-colors cursor-pointer ${
                      task.status === 'PENDING'
                        ? 'border-kenya-amber-200 bg-kenya-amber-50 text-kenya-amber-700 dark:border-kenya-amber-800 dark:bg-kenya-amber-900/20 dark:text-kenya-amber-300'
                        : 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
                    }`}
                  >
                    <option value="PENDING">Pending</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="IN_PROGRESS" disabled className="text-gray-400">───────</option>
                    <option value="RESOLVED" disabled>Resolved (use panel)</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-current opacity-60" />
                </div>
              );
            },
          },
          {
            key: 'assignedTo',
            label: 'Assigned',
            sortable: true,
            render: (task: HitlTask) => {
              if (task.resolvedUser) {
                return (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ✅ {task.resolvedUser.name}
                  </span>
                );
              }
              if (task.assignedUser) {
                return (
                  <span className="text-xs text-gray-700 dark:text-gray-300">
                    👤 {task.assignedUser.name}
                  </span>
                );
              }
              return <span className="text-xs text-gray-400">—</span>;
            },
          },
          {
            key: 'confidence',
            label: 'Confidence',
            sortable: true,
            className: 'text-center',
            render: (task: HitlTask) => {
              if (task.confidence == null) return <span className="text-xs text-gray-400">—</span>;
              const color = task.confidence >= 0.7
                ? 'text-green-600 dark:text-green-400'
                : task.confidence >= 0.4
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-red-600 dark:text-red-400';
              return (
                <span className={`text-xs font-semibold ${color}`}>
                  {Math.round(task.confidence * 100)}%
                </span>
              );
            },
          },
          {
            key: 'createdAt',
            label: 'Created',
            sortable: true,
            render: (task: HitlTask) => (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {new Date(task.createdAt).toLocaleDateString('en-KE', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            ),
          },
        ]}
        data={filteredTasks}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        onRowClick={handleRowClick}
        rowKey={(task: HitlTask) => task.id}
        emptyMessage="No tasks match the current filters"
      />

      {/* ── Create Review Modal ─────────────────────────────────────────── */}
      <CreateReviewModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateReview}
        newCategory={newCategory}
        onCategoryChange={setNewCategory}
        newDescription={newDescription}
        onDescriptionChange={setNewDescription}
        newRawData={newRawData}
        onRawDataChange={setNewRawData}
        newConflictData={newConflictData}
        onConflictDataChange={setNewConflictData}
        creating={creating}
      />

      {/* ── Slide-Out Detail Panel ──────────────────────────────────────── */}
      <SlideOutPanel
        isOpen={selectedTask !== null}
        onClose={() => setSelectedTask(null)}
        title={selectedTask ? `${categoryIcon[selectedTask.category] || '📋'} ${selectedTask.category.replace(/_/g, ' ')}` : ''}
        subtitle={selectedTask ? `Created ${new Date(selectedTask.createdAt).toLocaleDateString('en-KE', {
          day: 'numeric', month: 'long', year: 'numeric',
        })}` : undefined}
        footer={
          selectedTask && selectedTask.status !== 'RESOLVED' ? (
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <select
                  value={resolutionAction}
                  onChange={(e) => setResolutionAction(e.target.value as 'APPROVE' | 'REJECT' | 'EDIT')}
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-4 py-3 pr-10 text-sm font-medium dark:border-gray-700 dark:bg-kenya-surface-dark dark:text-gray-100"
                >
                  {RESOLUTION_ACTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              </div>
              <Button
                size="md"
                onClick={handleResolve}
                isLoading={resolving}
                disabled={resolving || (resolutionAction !== 'APPROVE' && !resolutionNotes)}
              >
                Resolve
              </Button>
            </div>
          ) : selectedTask && selectedTask.status === 'RESOLVED' ? (
            <div className="flex items-center gap-2 text-sm text-kenya-green-600 dark:text-kenya-green-400">
              <span>✅ Resolved</span>
              {selectedTask.resolvedUser && (
                <span className="text-gray-500">by {selectedTask.resolvedUser.name}</span>
              )}
              {selectedTask.xpAwarded != null && selectedTask.xpAwarded > 0 && (
                <span className="text-kenya-amber-600 font-medium">+{selectedTask.xpAwarded} XP</span>
              )}
            </div>
          ) : null
        }
      >
        {selectedTask && (
          <div className="flex flex-col gap-5">
            {/* Description */}
            <div>
              <h4 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50 mb-1">Description</h4>
              <p className="text-sm text-gray-700 dark:text-gray-300">{selectedTask.description}</p>
            </div>

            {/* Linked entity badge */}
            {selectedTask.linkedEntityType && (
              <div>
                <h4 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50 mb-1">Linked Entity</h4>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                  selectedTask.linkedEntityType === 'MPESA_TX'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                    : selectedTask.linkedEntityType === 'JOURNAL_ENTRY'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                }`}>
                  {selectedTask.linkedEntityType === 'MPESA_TX' ? '📱 M-Pesa Transaction' :
                   selectedTask.linkedEntityType === 'JOURNAL_ENTRY' ? '📒 Journal Entry' :
                   '🧾 Invoice'}
                </span>
              </div>
            )}

            {/* Confidence gauge */}
            {selectedTask.confidence != null && (
              <div>
                <h4 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50 mb-1">AI Confidence</h4>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        selectedTask.confidence >= 0.7
                          ? 'bg-green-500'
                          : selectedTask.confidence >= 0.4
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                      }`}
                      style={{ width: `${selectedTask.confidence * 100}%` }}
                    />
                  </div>
                  <span className={`text-sm font-semibold ${
                    selectedTask.confidence >= 0.7
                      ? 'text-green-600 dark:text-green-400'
                      : selectedTask.confidence >= 0.4
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-red-600 dark:text-red-400'
                  }`}>
                    {Math.round(selectedTask.confidence * 100)}%
                  </span>
                </div>
              </div>
            )}

            {/* Raw data viewer + AI Reasoning */}
            {selectedTask.rawData && (
              <div>
                <h4 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50 mb-1">
                  {selectedTask.linkedEntityType === 'MPESA_TX' ? 'Transaction Details' : 'Raw Data'}
                </h4>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs dark:border-gray-700 dark:bg-gray-900/50">
                  {selectedTask.linkedEntityType === 'MPESA_TX' ? (
                    (() => {
                      try {
                        const tx = JSON.parse(selectedTask.rawData!);
                        return (
                          <div className="space-y-1.5">
                            <p><strong>Amount:</strong> KES {tx.amount?.toLocaleString() || 'N/A'}</p>
                            <p><strong>Description:</strong> {tx.description || 'N/A'}</p>
                            <p><strong>Phone:</strong> {tx.phoneNumber || 'N/A'}</p>
                            <p><strong>Date:</strong> {tx.transactionDate ? new Date(tx.transactionDate).toLocaleDateString() : 'N/A'}</p>
                            <p><strong>Receipt:</strong> {tx.receiptNo || 'N/A'}</p>
                            {tx.aiReasoning && (
                              <details className="mt-2 border-t border-gray-200 pt-2 dark:border-gray-700">
                                <summary className="text-kenya-amber-600 font-medium cursor-pointer">🤖 AI Reasoning</summary>
                                <p className="mt-1 text-gray-600 italic dark:text-gray-400">{tx.aiReasoning}</p>
                              </details>
                            )}
                          </div>
                        );
                      } catch {
                        return <pre className="whitespace-pre-wrap">{selectedTask.rawData}</pre>;
                      }
                    })()
                  ) : (
                    <div>
                      <pre className="whitespace-pre-wrap overflow-x-auto">{selectedTask.rawData}</pre>
                      {(() => {
                        try {
                          const data = JSON.parse(selectedTask.rawData!);
                          if (data.aiReasoning) {
                            return (
                              <details className="mt-2 border-t border-gray-200 pt-2 dark:border-gray-700">
                                <summary className="text-kenya-amber-600 font-medium cursor-pointer">🤖 AI Reasoning</summary>
                                <p className="mt-1 text-gray-600 italic dark:text-gray-400">{data.aiReasoning}</p>
                              </details>
                            );
                          }
                        } catch { /* not JSON, show as-is */ }
                        return null;
                      })()}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Conflict data */}
            {selectedTask.conflictData && (
              <div>
                <h4 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50 mb-1">Conflict Data</h4>
                <pre className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs whitespace-pre-wrap dark:border-red-900 dark:bg-red-900/20">
                  {selectedTask.conflictData}
                </pre>
              </div>
            )}

            {/* Resolution notes (when action needs explanation) */}
            {selectedTask.status !== 'RESOLVED' && (
              <div>
                <h4 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50 mb-1">
                  {resolutionAction === 'APPROVE' ? 'Notes (optional)' : 'Reason (required)'}
                </h4>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="w-full min-h-[80px] rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm dark:border-gray-700 dark:bg-kenya-surface-dark dark:text-gray-100"
                  placeholder={
                    resolutionAction === 'APPROVE'
                      ? 'Add any notes about this resolution...'
                      : 'Explain why this is being rejected/edited...'
                  }
                  required={resolutionAction !== 'APPROVE'}
                />
              </div>
            )}

            {/* XP preview */}
            {selectedTask.status !== 'RESOLVED' && (
              <div className="rounded-lg bg-kenya-amber-50 p-3 text-sm dark:bg-kenya-amber-900/20">
                <span className="font-medium text-kenya-amber-700 dark:text-kenya-amber-300">🎯 +50 XP</span>
                {' '}will be awarded for resolving this task
              </div>
            )}

            {/* Resolution info (already resolved) */}
            {selectedTask.resolution && selectedTask.status === 'RESOLVED' && (
              <div>
                <h4 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50 mb-1">Resolution</h4>
                <div className="rounded-lg bg-kenya-green-50 p-3 text-sm dark:bg-kenya-green-900/20">
                  <p className="text-kenya-green-700 dark:text-kenya-green-300">{selectedTask.resolution}</p>
                  {selectedTask.resolutionAction && (
                    <Badge variant="success" size="sm" className="mt-2">
                      {selectedTask.resolutionAction}
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </SlideOutPanel>
    </PageShell>
  );
}

// ── Sub-component: Create Review Modal ──────────────────────────────────────

interface CreateReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  newCategory: string;
  onCategoryChange: (v: string) => void;
  newDescription: string;
  onDescriptionChange: (v: string) => void;
  newRawData: string;
  onRawDataChange: (v: string) => void;
  newConflictData: string;
  onConflictDataChange: (v: string) => void;
  creating: boolean;
}

function CreateReviewModal({
  isOpen, onClose, onSubmit,
  newCategory, onCategoryChange,
  newDescription, onDescriptionChange,
  newRawData, onRawDataChange,
  newConflictData, onConflictDataChange,
  creating,
}: CreateReviewModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Review Item"
      size="lg"
      footer={
        <div className="flex gap-3 w-full">
          <Button type="button" variant="ghost" size="md" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="md" className="flex-1" disabled={creating} form="create-review-form">
            {creating ? 'Creating...' : 'Add to Queue'}
          </Button>
        </div>
      }
    >
      <form id="create-review-form" onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-kenya-green-900 dark:text-kenya-green-50">Category</label>
          <select
            value={newCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="touch-target h-12 rounded-lg border border-kenya-green-200 bg-white px-4 text-sm dark:border-kenya-green-700 dark:bg-kenya-surface-dark"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{categoryIcon[cat]} {cat.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-kenya-green-900 dark:text-kenya-green-50">Description</label>
          <textarea
            value={newDescription}
            onChange={(e) => onDescriptionChange(e.target.value)}
            className="touch-target min-h-[80px] rounded-lg border border-kenya-green-200 bg-white px-4 py-3 text-sm dark:border-kenya-green-700 dark:bg-kenya-surface-dark"
            placeholder="Describe the item requiring review"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-kenya-green-900 dark:text-kenya-green-50">Raw Data (optional)</label>
          <textarea
            value={newRawData}
            onChange={(e) => onRawDataChange(e.target.value)}
            className="touch-target min-h-[80px] rounded-lg border border-kenya-green-200 bg-white px-4 py-3 text-sm dark:border-kenya-green-700 dark:bg-kenya-surface-dark"
            placeholder="Paste CSV, JSON, or other raw data..."
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-kenya-green-900 dark:text-kenya-green-50">Conflict Data (optional)</label>
          <textarea
            value={newConflictData}
            onChange={(e) => onConflictDataChange(e.target.value)}
            className="touch-target min-h-[80px] rounded-lg border border-kenya-green-200 bg-white px-4 py-3 text-sm dark:border-kenya-green-700 dark:bg-kenya-surface-dark"
            placeholder="Paste conflicting data if applicable..."
          />
        </div>
      </form>
    </Modal>
  );
}
