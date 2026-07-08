import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Modal } from '../components/ui/modal';
import { Table } from '../components/ui/table';
import { SlideOutPanel } from '../components/ui/slide-out-panel';
import { EmptyState } from '../components/ui/empty-state';
import { PageShell } from '../components/layout/page-shell';
import { PageState } from '../components/ui/page-state';
import { showToast } from '../stores/ui-store';
import { api } from '../lib/api-client';
import { formatDate } from '../lib/utils';
import type { CollaborationTask, TaskPriority, TaskStatus } from '../lib/types';

// ─── Constants ──────────────────────────────────────────────────────────────

const PRIORITY_ICONS: Record<TaskPriority, string> = {
  HIGH: '🔴',
  MEDIUM: '🟡',
  LOW: '🟢',
};

const STATUS_ICONS: Record<TaskStatus, string> = {
  PENDING: '⏳',
  IN_PROGRESS: '🔄',
  COMPLETED: '✅',
  OVERDUE: '🔴',
};

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'PENDING', label: '⏳ Pending' },
  { value: 'IN_PROGRESS', label: '🔄 In Progress' },
  { value: 'COMPLETED', label: '✅ Completed' },
  { value: 'OVERDUE', label: '🔴 Overdue' },
];

function priorityBadgeVariant(p: TaskPriority): 'error' | 'warning' | 'success' {
  switch (p) {
    case 'HIGH': return 'error';
    case 'MEDIUM': return 'warning';
    case 'LOW': return 'success';
  }
}

function statusBadgeVariant(s: TaskStatus): 'warning' | 'info' | 'success' | 'error' {
  switch (s) {
    case 'PENDING': return 'warning';
    case 'IN_PROGRESS': return 'info';
    case 'COMPLETED': return 'success';
    case 'OVERDUE': return 'error';
  }
}

function isOverdue(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
}

function isToday(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false;
  const today = new Date(new Date().toDateString());
  const due = new Date(new Date(dueDate).toDateString());
  return due.getTime() === today.getTime();
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function Tasks() {
  const navigate = useNavigate();

  // Data
  const [tasks, setTasks] = React.useState<CollaborationTask[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Filters
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');

  // Sorting
  const [sortKey, setSortKey] = React.useState<string>('dueDate');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');

  // Slide-out detail
  const [selectedTask, setSelectedTask] = React.useState<CollaborationTask | null>(null);

  // Confirmation modals
  const [confirmComplete, setConfirmComplete] = React.useState<CollaborationTask | null>(null);
  const [confirmEscalate, setConfirmEscalate] = React.useState<CollaborationTask | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);

  // Generate tasks
  const [generating, setGenerating] = React.useState(false);

  // ── Data Loading ────────────────────────────────────────────────────────

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;

      const data = await api.get<CollaborationTask[]>('/collab/tasks', params);
      setTasks(data);
    } catch (e: any) {
      console.error('Failed to load tasks:', e);
      setError(e?.response?.data?.message || 'Failed to load tasks');
      showToast('error', 'Failed to load tasks', 'Please try again');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  React.useEffect(() => { loadData(); }, [loadData]);

  // ── Actions ─────────────────────────────────────────────────────────────

  const handleGenerateTasks = async () => {
    setGenerating(true);
    try {
      await api.post('/collab/tasks/generate');
      showToast('success', 'Tasks generated', 'New tasks have been generated');
      loadData();
    } catch (e: any) {
      showToast('error', 'Failed to generate tasks', e?.response?.data?.message || 'Please try again');
    } finally {
      setGenerating(false);
    }
  };

  const handleCompleteTask = async (task: CollaborationTask) => {
    setActionLoading(true);
    try {
      await api.patch(`/collab/tasks/${task.id}`, { status: 'COMPLETED' });
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: 'COMPLETED' } : t));
      showToast('success', 'Task completed', `"${task.title}" has been marked as complete`);
      setConfirmComplete(null);
    } catch (e: any) {
      showToast('error', 'Failed to update task', e?.response?.data?.message || 'Please try again');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEscalateTask = async (task: CollaborationTask) => {
    setActionLoading(true);
    try {
      await api.post(`/collab/tasks/${task.id}/escalate`);
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, priority: 'HIGH' as TaskPriority } : t));
      showToast('success', 'Task escalated', `"${task.title}" has been escalated to high priority`);
      setConfirmEscalate(null);
    } catch (e: any) {
      showToast('error', 'Failed to escalate task', e?.response?.data?.message || 'Please try again');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRowClick = (task: CollaborationTask) => {
    setSelectedTask(task);
  };

  // ── Sorting ─────────────────────────────────────────────────────────────

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // ── Filtered + Sorted Data ──────────────────────────────────────────────

  const filteredTasks = React.useMemo(() => {
    let result = [...tasks];

    // Local search filter (additional to server-side)
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.clientName && t.clientName.toLowerCase().includes(q)) ||
          (t.category && t.category.toLowerCase().includes(q)),
      );
    }

    // Sort
    result.sort((a, b) => {
      let aVal: unknown;
      let bVal: unknown;

      switch (sortKey) {
        case 'title':
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
          break;
        case 'clientName':
          aVal = (a.clientName || '').toLowerCase();
          bVal = (b.clientName || '').toLowerCase();
          break;
        case 'priority': {
          const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
          aVal = order[a.priority] ?? 1;
          bVal = order[b.priority] ?? 1;
          break;
        }
        case 'dueDate':
          aVal = a.dueDate || '9999-12-31';
          bVal = b.dueDate || '9999-12-31';
          break;
        case 'status': {
          const sOrder = { PENDING: 0, IN_PROGRESS: 1, OVERDUE: 2, COMPLETED: 3 };
          aVal = sOrder[a.status] ?? 0;
          bVal = sOrder[b.status] ?? 0;
          break;
        }
        default:
          aVal = (a as any)[sortKey]?.toString().toLowerCase() || '';
          bVal = (b as any)[sortKey]?.toString().toLowerCase() || '';
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [tasks, search, sortKey, sortDir]);

  // ── KPI Counts ──────────────────────────────────────────────────────────

  const kpis = React.useMemo(() => {
    const pending = tasks.filter((t) => t.status === 'PENDING').length;
    const todayDue = tasks.filter((t) => isToday(t.dueDate) && t.status !== 'COMPLETED').length;
    const overdue = tasks.filter((t) => isOverdue(t.dueDate) && t.status !== 'COMPLETED').length;
    const total = tasks.length;
    return { pending, todayDue, overdue, total };
  }, [tasks]);

  // ── Render: Loading ─────────────────────────────────────────────────────

  if (loading) {
    return <PageState state="loading" skeletonRows={4}><></></PageState>;
  }

  // ── Render: Error ───────────────────────────────────────────────────────

  if (error) {
    return (
      <PageShell title="Tasks" subtitle="Manage and track your tasks">
        <Card>
          <CardContent className="py-8 text-center">
            <span className="mb-4 text-4xl block" aria-hidden="true">⚠️</span>
            <h3 className="mb-2 text-lg font-semibold text-kenya-gray-900 dark:text-kenya-green-50">
              Failed to load tasks
            </h3>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">{error}</p>
            <Button variant="primary" size="md" onClick={loadData}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  // ── Render: Empty / No Tasks ────────────────────────────────────────────

  if (tasks.length === 0 && !search && !statusFilter) {
    return (
      <PageShell
        title="Tasks"
        subtitle="Manage and track your tasks"
        actions={
          <Button variant="primary" size="md" onClick={handleGenerateTasks} isLoading={generating}>
            + Generate Tasks
          </Button>
        }
      >
        {/* KPI cards (all zeros) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Pending', value: 0, color: 'text-kenya-amber-500' },
            { label: "Today's Due", value: 0, color: 'text-blue-500' },
            { label: 'Overdue', value: 0, color: 'text-red-500' },
            { label: 'Total', value: 0, color: 'text-kenya-green-500' },
          ].map((kpi) => (
            <Card key={kpi.label}>
              <CardContent className="text-center py-4">
                <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{kpi.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <EmptyState
          icon="📋"
          title="No tasks yet"
          description="Generate tasks to get started with automated task creation based on your workflow."
          action={{ label: '+ Generate Tasks', onClick: handleGenerateTasks }}
          helpLink={{ label: 'Learn more about tasks', href: '/help/tasks' }}
        />
      </PageShell>
    );
  }

  // ── Render: Main View ───────────────────────────────────────────────────

  return (
    <PageShell
      title="Tasks"
      subtitle="Manage and track your tasks"
      actions={
        <Button variant="primary" size="md" onClick={handleGenerateTasks} isLoading={generating}>
          + Generate Tasks
        </Button>
      }
    >
      {/* ── KPI Summary Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="text-center py-4">
            <p className="text-2xl font-bold text-kenya-amber-500">{kpis.pending}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center py-4">
            <p className="text-2xl font-bold text-blue-500">{kpis.todayDue}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Today's Due</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center py-4">
            <p className="text-2xl font-bold text-red-500">{kpis.overdue}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Overdue</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center py-4">
            <p className="text-2xl font-bold text-kenya-green-500">{kpis.total}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Filter Bar ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] max-w-sm">
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={STATUS_FILTER_OPTIONS}
          placeholder="Filter: All"
          className="w-48"
        />

        {filteredTasks.length !== tasks.length && (
          <span className="text-xs text-gray-400 ml-auto">
            {filteredTasks.length} of {tasks.length} displayed
          </span>
        )}
        {filteredTasks.length === tasks.length && (
          <span className="text-xs text-gray-400 ml-auto">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ── Sortable Table ──────────────────────────────────────────────── */}
      <Table
        columns={[
          {
            key: 'title',
            label: 'Title',
            sortable: true,
            render: (task: CollaborationTask) => (
              <div className="flex items-center gap-2 max-w-xs">
                <span className="text-sm font-medium text-kenya-gray-900 dark:text-kenya-green-50 truncate">
                  {task.title}
                </span>
                {task.category && (
                  <Badge variant="neutral" size="sm">{task.category}</Badge>
                )}
              </div>
            ),
          },
          {
            key: 'clientName',
            label: 'Client',
            sortable: true,
            render: (task: CollaborationTask) => (
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {task.clientName || '—'}
              </span>
            ),
          },
          {
            key: 'priority',
            label: 'Priority',
            sortable: true,
            render: (task: CollaborationTask) => (
              <Badge variant={priorityBadgeVariant(task.priority)} size="sm">
                <span className="flex items-center gap-1">
                  <span aria-hidden="true">{PRIORITY_ICONS[task.priority]}</span>
                  {task.priority}
                </span>
              </Badge>
            ),
          },
          {
            key: 'dueDate',
            label: 'Due Date',
            sortable: true,
            render: (task: CollaborationTask) => {
              if (!task.dueDate) return <span className="text-xs text-gray-400">—</span>;
              const overdue = isOverdue(task.dueDate) && task.status !== 'COMPLETED';
              return (
                <span className={`text-sm ${overdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                  {formatDate(task.dueDate)}
                  {overdue && <span className="ml-1 text-xs">⚠️</span>}
                </span>
              );
            },
          },
          {
            key: 'status',
            label: 'Status',
            sortable: true,
            render: (task: CollaborationTask) => (
              <Badge variant={statusBadgeVariant(task.status)} size="sm">
                <span className="flex items-center gap-1">
                  <span aria-hidden="true">{STATUS_ICONS[task.status]}</span>
                  {task.status === 'IN_PROGRESS' ? 'In Progress' : task.status.charAt(0) + task.status.slice(1).toLowerCase()}
                </span>
              </Badge>
            ),
          },
          {
            key: 'actions',
            label: 'Actions',
            className: 'text-right',
            render: (task: CollaborationTask) => (
              <div className="flex items-center justify-end gap-1">
                {task.status !== 'COMPLETED' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmComplete(task); }}
                    className="touch-target flex h-8 w-8 items-center justify-center rounded-lg text-sm text-kenya-green-600 hover:bg-kenya-green-50 dark:text-kenya-green-400 dark:hover:bg-kenya-green-900/30 transition-colors"
                    aria-label={`Complete "${task.title}"`}
                    title="Complete"
                  >
                    ✓
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedTask(task); }}
                  className="touch-target flex h-8 w-8 items-center justify-center rounded-lg text-sm text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
                  aria-label={`View details for "${task.title}"`}
                  title="View Detail"
                >
                  ▸
                </button>
                {task.status !== 'COMPLETED' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmEscalate(task); }}
                    className="touch-target flex h-8 w-8 items-center justify-center rounded-lg text-sm text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                    aria-label={`Escalate "${task.title}"`}
                    title="Escalate"
                  >
                    ↗
                  </button>
                )}
              </div>
            ),
          },
        ]}
        data={filteredTasks}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        onRowClick={handleRowClick}
        rowKey={(task: CollaborationTask) => task.id}
        emptyMessage="No tasks match the current filters"
      />

      {/* ── Confirm Complete Modal ──────────────────────────────────────── */}
      <Modal
        isOpen={confirmComplete !== null}
        onClose={() => setConfirmComplete(null)}
        title="Complete Task"
        size="sm"
        footer={
          <div className="flex gap-3 w-full">
            <Button
              type="button"
              variant="ghost"
              size="md"
              className="flex-1"
              onClick={() => setConfirmComplete(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              className="flex-1"
              isLoading={actionLoading}
              onClick={() => confirmComplete && handleCompleteTask(confirmComplete)}
            >
              ✓ Complete
            </Button>
          </div>
        }
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Mark <strong className="text-kenya-gray-900 dark:text-kenya-green-50">{confirmComplete?.title}</strong> as completed?
        </p>
      </Modal>

      {/* ── Confirm Escalate Modal ──────────────────────────────────────── */}
      <Modal
        isOpen={confirmEscalate !== null}
        onClose={() => setConfirmEscalate(null)}
        title="Escalate Task"
        size="sm"
        footer={
          <div className="flex gap-3 w-full">
            <Button
              type="button"
              variant="ghost"
              size="md"
              className="flex-1"
              onClick={() => setConfirmEscalate(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="md"
              className="flex-1"
              isLoading={actionLoading}
              onClick={() => confirmEscalate && handleEscalateTask(confirmEscalate)}
            >
              ↗ Escalate
            </Button>
          </div>
        }
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Escalate <strong className="text-kenya-gray-900 dark:text-kenya-green-50">{confirmEscalate?.title}</strong> to high priority?
        </p>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          This will notify supervisors and prioritize this task.
        </p>
      </Modal>

      {/* ── Task Detail Slide-Out Panel ─────────────────────────────────── */}
      <SlideOutPanel
        isOpen={selectedTask !== null}
        onClose={() => setSelectedTask(null)}
        title={selectedTask?.title || ''}
        subtitle={selectedTask ? `Created ${formatDate(selectedTask.createdAt)}` : undefined}
        footer={
          selectedTask && selectedTask.status !== 'COMPLETED' ? (
            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                size="sm"
                className="flex-1"
                onClick={() => { setSelectedTask(null); setConfirmComplete(selectedTask); }}
              >
                ✓ Mark Complete
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="flex-1"
                onClick={() => { setSelectedTask(null); setConfirmEscalate(selectedTask); }}
              >
                ↗ Escalate
              </Button>
            </div>
          ) : selectedTask?.status === 'COMPLETED' ? (
            <div className="flex items-center gap-2 text-sm text-kenya-green-600 dark:text-kenya-green-400">
              <span>✅ Completed</span>
            </div>
          ) : null
        }
      >
        {selectedTask && (
          <div className="flex flex-col gap-5">
            {/* Status + Priority badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={statusBadgeVariant(selectedTask.status)} size="md">
                {STATUS_ICONS[selectedTask.status]} {selectedTask.status === 'IN_PROGRESS' ? 'In Progress' : selectedTask.status.charAt(0) + selectedTask.status.slice(1).toLowerCase()}
              </Badge>
              <Badge variant={priorityBadgeVariant(selectedTask.priority)} size="md">
                {PRIORITY_ICONS[selectedTask.priority]} {selectedTask.priority}
              </Badge>
            </div>

            {/* Description */}
            {selectedTask.description && (
              <div>
                <h4 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50 mb-1">Description</h4>
                <p className="text-sm text-gray-700 dark:text-gray-300">{selectedTask.description}</p>
              </div>
            )}

            {/* Client */}
            {selectedTask.clientName && (
              <div>
                <h4 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50 mb-1">Client</h4>
                <p className="text-sm text-gray-700 dark:text-gray-300">{selectedTask.clientName}</p>
              </div>
            )}

            {/* Category */}
            {selectedTask.category && (
              <div>
                <h4 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50 mb-1">Category</h4>
                <Badge variant="neutral" size="md">{selectedTask.category}</Badge>
              </div>
            )}

            {/* Due Date */}
            {selectedTask.dueDate && (
              <div>
                <h4 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50 mb-1">Due Date</h4>
                <p className={`text-sm ${isOverdue(selectedTask.dueDate) && selectedTask.status !== 'COMPLETED' ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
                  {formatDate(selectedTask.dueDate)}
                  {isOverdue(selectedTask.dueDate) && selectedTask.status !== 'COMPLETED' && (
                    <span className="ml-2 text-xs text-red-500">Overdue</span>
                  )}
                </p>
              </div>
            )}

            {/* Assigned User */}
            {selectedTask.assignedUser && (
              <div>
                <h4 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50 mb-1">Assigned To</h4>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  👤 {selectedTask.assignedUser.name}
                </p>
              </div>
            )}

            {/* Created / Updated timestamps */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
                <span>Created: {formatDate(selectedTask.createdAt)}</span>
                <span>Updated: {formatDate(selectedTask.updatedAt)}</span>
              </div>
            </div>
          </div>
        )}
      </SlideOutPanel>
    </PageShell>
  );
}
