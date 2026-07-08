import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { XPBar } from '../components/ui/xp-bar';
import { useCompanyRefresh } from '../hooks/use-company-refresh';
import { showToast } from '../stores/ui-store';
import { api } from '../lib/api-client';

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

interface XpData {
  score: number;
  level: number;
  xpToNextLevel: number;
}

const categoryIcon: Record<string, string> = {
  BACKDATED_ENTRY: '📅',
  UNMAPPED_DATA: '🔗',
  ETIMS_FAILURE: '🧾',
  RECONCILIATION_CONFLICT: '⚖️',
};

const CATEGORIES = ['BACKDATED_ENTRY', 'UNMAPPED_DATA', 'ETIMS_FAILURE', 'RECONCILIATION_CONFLICT'] as const;

export function HitlHub() {
  const [tasks, setTasks] = React.useState<HitlTask[]>([]);
  const [xpData, setXpData] = React.useState<XpData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [profileId, setProfileId] = React.useState<string>('');

  // Filters
  const [filterMyTasks, setFilterMyTasks] = React.useState(false);
  const [filterCategory, setFilterCategory] = React.useState('');

  // Create review modal
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [newCategory, setNewCategory] = React.useState('UNMAPPED_DATA');
  const [newDescription, setNewDescription] = React.useState('');
  const [newRawData, setNewRawData] = React.useState('');
  const [newConflictData, setNewConflictData] = React.useState('');
  const [creating, setCreating] = React.useState(false);

  // Resolution dialog
  const [resolveTask, setResolveTask] = React.useState<HitlTask | null>(null);
  const [resolutionAction, setResolutionAction] = React.useState<'APPROVE' | 'REJECT' | 'EDIT'>('APPROVE');
  const [resolutionNotes, setResolutionNotes] = React.useState('');
  const [resolving, setResolving] = React.useState(false);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {};
      if (filterMyTasks && profileId) params.assignedTo = profileId;
      if (filterCategory) params.category = filterCategory;

      const [taskData, xp, profile] = await Promise.all([
        api.get<{ items: HitlTask[]; total: number }>('/hitl', params),
        api.get<XpData>('/gamification/profile').catch(() => null),
        api.get<{ id: string }>('/auth/profile').catch(() => null),
      ]);
      setTasks(taskData.items);
      if (xp) setXpData({ score: xp.score, level: xp.level, xpToNextLevel: xp.xpToNextLevel });
      if (profile) setProfileId(profile.id);
    } catch (e) {
      console.error('Failed to load HITL data:', e);
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

  const openResolveDialog = (task: HitlTask) => {
    setResolveTask(task);
    setResolutionAction('APPROVE');
    setResolutionNotes('');
  };

  const handleResolve = async () => {
    if (!resolveTask) return;
    setResolving(true);
    try {
      const resolutionText = resolutionNotes ||
        (resolutionAction === 'APPROVE' ? 'Approved after review' :
         resolutionAction === 'REJECT' ? 'Rejected — requires further investigation' :
         'Edited and approved');

      // Build correctedData based on resolution action
      let correctedData: string | undefined;
      if (resolutionAction === 'EDIT' && resolutionNotes) {
        correctedData = JSON.stringify({ notes: resolutionNotes });
      }

      await api.post(`/hitl/${resolveTask.id}/resolve`, {
        resolution: resolutionText,
        action: resolutionAction,
        correctedData,
      });
      setTasks((prev) => prev.map((t) => t.id === resolveTask.id ? { ...t, status: 'RESOLVED' } : t));
      showToast('success', 'Task resolved', 'Resolution submitted');
      setResolveTask(null);
    } catch (e: any) {
      showToast('error', 'Failed to resolve', e?.response?.data?.message || 'Please try again');
    } finally {
      setResolving(false);
    }
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

  const getColumnTasks = (status: string) => {
    return tasks.filter((t) => t.status === status);
  };

  const priorityBadge = (category: string): 'warning' | 'info' | 'neutral' | 'error' => {
    if (category === 'RECONCILIATION_CONFLICT') return 'warning';
    if (category === 'ETIMS_FAILURE') return 'error';
    if (category === 'BACKDATED_ENTRY') return 'warning';
    return 'info';
  };

  if (loading) {
    return <div className="flex justify-center py-12"><p className="text-gray-500">Loading HITL hub...</p></div>;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-kenya-green-900 dark:text-kenya-green-50">HITL Hub</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Human-In-The-Loop — Review and resolve AI decisions</p>
        </div>
        <div className="flex items-center gap-3">
          {xpData && <XPBar current={xpData.score} max={xpData.score + xpData.xpToNextLevel} showLevel={false} className="w-48" />}
          <Button variant="secondary" size="sm" onClick={() => setShowCreateModal(true)}>+ Create Review</Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-4 flex-wrap">
        <button
          onClick={() => setFilterMyTasks(!filterMyTasks)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filterMyTasks
              ? 'bg-kenya-green-500 text-white'
              : 'bg-kenya-green-50 text-kenya-green-700 hover:bg-kenya-green-100 dark:bg-kenya-green-900/30 dark:text-kenya-green-300'
          }`}
        >
          👤 My Tasks
        </button>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="touch-target h-10 rounded-lg border border-kenya-green-200 bg-white px-3 text-sm dark:border-kenya-green-700 dark:bg-kenya-surface-dark"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{categoryIcon[cat]} {cat.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <span className="text-xs text-gray-400">
          {tasks.length} total · {getColumnTasks('PENDING').length} pending · {getColumnTasks('IN_PROGRESS').length} in progress
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="text-center py-4">
          <p className="text-2xl font-bold text-kenya-amber-500">{getColumnTasks('PENDING').length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Pending</p>
        </CardContent></Card>
        <Card><CardContent className="text-center py-4">
          <p className="text-2xl font-bold text-blue-500">{getColumnTasks('IN_PROGRESS').length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">In Progress</p>
        </CardContent></Card>
        <Card><CardContent className="text-center py-4">
          <p className="text-2xl font-bold text-kenya-green-500">{getColumnTasks('RESOLVED').length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Resolved</p>
        </CardContent></Card>
        <Card><CardContent className="text-center py-4">
          <p className="text-2xl font-bold text-kenya-green-900 dark:text-kenya-green-50">{tasks.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Total Tasks</p>
        </CardContent></Card>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {[
          { status: 'PENDING', label: 'Pending Review', color: 'border-t-kenya-amber-500' },
          { status: 'IN_PROGRESS', label: 'In Progress', color: 'border-t-blue-500' },
          { status: 'RESOLVED', label: 'Resolved', color: 'border-t-kenya-green-500' },
        ].map((column) => (
          <div key={column.status} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50">{column.label}</h3>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-kenya-green-100 text-xs font-bold text-kenya-green-700 dark:bg-kenya-green-900 dark:text-kenya-green-300">
                {getColumnTasks(column.status).length}
              </span>
            </div>
            <div className="flex flex-col gap-3 min-h-[200px]">
              {getColumnTasks(column.status).map((task) => (
                <Card key={task.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <Badge variant={priorityBadge(task.category)} size="sm">{task.category.replace(/_/g, ' ')}</Badge>
                      <span className="text-lg">{categoryIcon[task.category] || '📋'}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-3">{task.description}</p>
                    {task.linkedEntityType && (
                      <div className="mb-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                          task.linkedEntityType === 'MPESA_TX' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                          task.linkedEntityType === 'JOURNAL_ENTRY' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                          'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                        }`}>
                          {task.linkedEntityType === 'MPESA_TX' ? '📱 M-Pesa' :
                           task.linkedEntityType === 'JOURNAL_ENTRY' ? '📒 Journal' :
                           '🧾 Invoice'}
                        </span>
                        {task.confidence != null && (
                          <span className={`ml-2 text-xs font-medium ${
                            task.confidence >= 0.7 ? 'text-green-600' :
                            task.confidence >= 0.4 ? 'text-amber-600' : 'text-red-600'
                          }`}>
                            {Math.round(task.confidence * 100)}% confidence
                          </span>
                        )}
                      </div>
                    )}
                    {task.xpAwarded != null && task.xpAwarded > 0 && (
                      <p className="text-xs text-kenya-amber-600 mb-2">+{task.xpAwarded} XP awarded</p>
                    )}
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                      <span>{new Date(task.createdAt).toLocaleDateString()}</span>
                      {task.assignedUser && <span>👤 {task.assignedUser.name}</span>}
                      {task.resolvedUser && <span>✅ {task.resolvedUser.name}</span>}
                    </div>
                    <div className="mt-3 flex gap-2">
                      {column.status === 'PENDING' && (
                        <Button size="sm" className="flex-1" onClick={() => claimTask(task.id)}>
                          Claim Task
                        </Button>
                      )}
                      {column.status === 'IN_PROGRESS' && (
                        <>
                          <Button size="sm" variant="secondary" className="flex-1" onClick={() => openResolveDialog(task)}>
                            Resolve
                          </Button>
                          <Button size="sm" variant="ghost" className="flex-shrink-0 px-2">⋯</Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {getColumnTasks(column.status).length === 0 && (
                <div className="flex items-center justify-center h-32 rounded-xl border-2 border-dashed border-kenya-green-200 dark:border-kenya-green-700">
                  <p className="text-sm text-gray-400">No {column.label.toLowerCase()}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create Review Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-2xl border border-kenya-green-100 bg-white p-6 shadow-lg dark:border-kenya-green-800 dark:bg-kenya-surface-dark">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-kenya-green-900 dark:text-kenya-green-50">Create Review Item</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <form onSubmit={handleCreateReview} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-kenya-green-900 dark:text-kenya-green-50">Category</label>
                <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
                  className="touch-target h-12 rounded-lg border border-kenya-green-200 bg-white px-4 text-sm dark:border-kenya-green-700 dark:bg-kenya-surface-dark">
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{categoryIcon[cat]} {cat.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <Input label="Description" placeholder="Describe the item requiring review" value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)} required />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-kenya-green-900 dark:text-kenya-green-50">Raw Data (optional)</label>
                <textarea value={newRawData} onChange={(e) => setNewRawData(e.target.value)}
                  className="touch-target min-h-[80px] rounded-lg border border-kenya-green-200 bg-white px-4 py-3 text-sm dark:border-kenya-green-700 dark:bg-kenya-surface-dark"
                  placeholder="Paste CSV, JSON, or other raw data..." />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-kenya-green-900 dark:text-kenya-green-50">Conflict Data (optional)</label>
                <textarea value={newConflictData} onChange={(e) => setNewConflictData(e.target.value)}
                  className="touch-target min-h-[80px] rounded-lg border border-kenya-green-200 bg-white px-4 py-3 text-sm dark:border-kenya-green-700 dark:bg-kenya-surface-dark"
                  placeholder="Paste conflicting data if applicable..." />
              </div>
              <div className="flex gap-3 mt-2">
                <Button type="button" variant="ghost" size="lg" className="flex-1" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                <Button type="submit" size="lg" className="flex-1" disabled={creating}>
                  {creating ? 'Creating...' : 'Add to Queue'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolution Dialog */}
      {resolveTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-2xl border border-kenya-green-100 bg-white p-6 shadow-lg dark:border-kenya-green-800 dark:bg-kenya-surface-dark">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-kenya-green-900 dark:text-kenya-green-50">Resolve Task</h2>
              <button onClick={() => setResolveTask(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            {/* Task Info */}
            <div className="mb-4 p-3 rounded-lg bg-kenya-green-50 dark:bg-kenya-green-900/30">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={priorityBadge(resolveTask.category)} size="sm">{resolveTask.category.replace(/_/g, ' ')}</Badge>
                <span className="text-lg">{categoryIcon[resolveTask.category] || '📋'}</span>
                {resolveTask.linkedEntityType && (
                  <span className={`ml-auto text-xs px-2 py-0.5 rounded font-medium ${
                    resolveTask.linkedEntityType === 'MPESA_TX' ? 'bg-green-100 text-green-700' :
                    resolveTask.linkedEntityType === 'JOURNAL_ENTRY' ? 'bg-blue-100 text-blue-700' :
                    'bg-purple-100 text-purple-700'
                  }`}>
                    {resolveTask.linkedEntityType === 'MPESA_TX' ? '📱 M-Pesa Transaction' :
                     resolveTask.linkedEntityType === 'JOURNAL_ENTRY' ? '📒 Journal Entry' :
                     '🧾 Invoice'}
                  </span>
                )}
              </div>
              <p className="text-sm text-kenya-green-900 dark:text-kenya-green-50">{resolveTask.description}</p>
              
              {/* Confidence gauge */}
              {resolveTask.confidence != null && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${
                      resolveTask.confidence >= 0.7 ? 'bg-green-500' :
                      resolveTask.confidence >= 0.4 ? 'bg-amber-500' : 'bg-red-500'
                    }`} style={{ width: `${resolveTask.confidence * 100}%` }} />
                  </div>
                  <span className={`text-xs font-medium ${
                    resolveTask.confidence >= 0.7 ? 'text-green-600' :
                    resolveTask.confidence >= 0.4 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {Math.round(resolveTask.confidence * 100)}% confidence
                  </span>
                </div>
              )}

              {/* Parse and show raw data as preview for M-Pesa transactions */}
              {resolveTask.rawData && (
                <details className="mt-2">
                  <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                    {resolveTask.linkedEntityType === 'MPESA_TX' ? '📱 View transaction details' :
                     resolveTask.linkedEntityType === 'JOURNAL_ENTRY' ? '📒 View entry details' :
                     'View raw data'}
                  </summary>
                  <div className="mt-1 text-xs bg-white dark:bg-kenya-surface-dark p-2 rounded border overflow-x-auto">
                    {resolveTask.linkedEntityType === 'MPESA_TX' ? (
                      (() => {
                        try {
                          const tx = JSON.parse(resolveTask.rawData);
                          return (
                            <div className="space-y-1">
                              <p><strong>Amount:</strong> KES {tx.amount?.toLocaleString() || 'N/A'}</p>
                              <p><strong>Description:</strong> {tx.description || 'N/A'}</p>
                              <p><strong>Phone:</strong> {tx.phoneNumber || 'N/A'}</p>
                              <p><strong>Date:</strong> {tx.transactionDate ? new Date(tx.transactionDate).toLocaleDateString() : 'N/A'}</p>
                              <p><strong>Receipt:</strong> {tx.receiptNo || 'N/A'}</p>
                              {/* Show AI reasoning if available */}
                              {tx.aiReasoning && (
                                <details className="mt-2 border-t border-gray-200 pt-2">
                                  <summary className="text-kenya-amber-600 font-medium cursor-pointer">🤖 AI Reasoning</summary>
                                  <p className="mt-1 text-gray-600 italic">{tx.aiReasoning}</p>
                                </details>
                              )}
                            </div>
                          );
                        } catch { return <pre className="whitespace-pre-wrap">{resolveTask.rawData}</pre>; }
                      })()
                    ) : (
                      <div>
                        <pre className="whitespace-pre-wrap">{resolveTask.rawData}</pre>
                        {(() => {
                          try {
                            const data = JSON.parse(resolveTask.rawData);
                            if (data.aiReasoning) {
                              return (
                                <details className="mt-2 border-t border-gray-200 pt-2">
                                  <summary className="text-kenya-amber-600 font-medium cursor-pointer">🤖 AI Reasoning</summary>
                                  <p className="mt-1 text-gray-600 italic">{data.aiReasoning}</p>
                                </details>
                              );
                            }
                          } catch {}
                          return null;
                        })()}
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>

            {/* Resolution Actions */}
            <div className="flex gap-3 mb-4">
              {(['APPROVE', 'REJECT', 'EDIT'] as const).map((action) => (
                <button
                  key={action}
                  onClick={() => setResolutionAction(action)}
                  className={`flex-1 py-3 px-3 rounded-lg text-sm font-medium transition-colors border-2 ${
                    resolutionAction === action
                      ? action === 'APPROVE'
                        ? 'border-kenya-green-500 bg-kenya-green-50 text-kenya-green-700 dark:bg-kenya-green-900/30 dark:text-kenya-green-300'
                        : action === 'REJECT'
                        ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                        : 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-700'
                  }`}
                >
                  <div className="text-lg mb-1">
                    {action === 'APPROVE' ? '✅' : action === 'REJECT' ? '❌' : '✏️'}
                  </div>
                  <div>{action.charAt(0) + action.slice(1).toLowerCase()}</div>
                </button>
              ))}
            </div>

            {/* Resolution Notes */}
            <div className="flex flex-col gap-1.5 mb-4">
              <label className="text-sm font-medium text-kenya-green-900 dark:text-kenya-green-50">
                {resolutionAction === 'APPROVE' ? 'Notes (optional)' : 'Reason (required)'}
              </label>
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                className="touch-target min-h-[80px] rounded-lg border border-kenya-green-200 bg-white px-4 py-3 text-sm dark:border-kenya-green-700 dark:bg-kenya-surface-dark"
                placeholder={
                  resolutionAction === 'APPROVE'
                    ? 'Add any notes about this resolution...'
                    : 'Explain why this is being rejected/edited...'
                }
                required={resolutionAction !== 'APPROVE'}
              />
            </div>

            {/* XP Preview */}
            <div className="mb-4 p-3 rounded-lg bg-kenya-amber-50 dark:bg-kenya-amber-900/20 text-sm">
              <span className="font-medium text-kenya-amber-700 dark:text-kenya-amber-300">🎯 +50 XP</span>
              {' '}will be awarded for resolving this task
            </div>

            <div className="flex gap-3">
              <Button type="button" variant="ghost" size="lg" className="flex-1" onClick={() => setResolveTask(null)}>Cancel</Button>
              <Button type="button" size="lg" className="flex-1" disabled={resolving || (resolutionAction !== 'APPROVE' && !resolutionNotes)} onClick={handleResolve}>
                {resolving ? 'Resolving...' : `Confirm ${resolutionAction.charAt(0) + resolutionAction.slice(1).toLowerCase()}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
