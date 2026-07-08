import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { DashboardSkeleton } from '../components/ui/skeleton';
import { XPBar } from '../components/ui/xp-bar';
import { HealthDot } from '../components/dashboard/health-dot';
import { IncomeForm } from '../components/forms/income-form';
import { ExpenseForm } from '../components/forms/expense-form';
import { api } from '../lib/api-client';
import { useAuthStore } from '../stores/auth-store';

/* ──────────────────────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────────────────────── */

interface DashboardData {
  totalEntries: number;
  recentEntries: Array<{ id: string; description: string; amount: number; direction: string; entryDate: string; account: { code: string; name: string }; aiConfidence?: number | null }>;
  xpScore?: { score: number; level: number; xpToNextLevel: number };
}

interface FirmClient {
  id: string;
  name: string;
  tier: string;
  role: string;
  healthScore: number | null;
  pendingReviews: number;
  failedEtims: number;
  totalEntries: number;
}

interface FirmDashboardData {
  totalClients: number;
  needingAttention: number;
  totalPendingReviews: number;
  totalFailedEtims: number;
  clients: FirmClient[];
}

interface AnalyticsData {
  monthly: Array<{ month: string; income: number; expense: number }>;
  topExpenses: Array<{ code: string; name: string; total: number }>;
  mpesaSummary: { paidIn30d: number; withdrawn30d: number };
}

type ViewMode = 'firm' | 'client';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* ──────────────────────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────────────────────── */

function healthColor(score: number | null): string {
  if (score === null) return 'text-gray-400';
  if (score >= 70) return 'text-green-600';
  if (score >= 40) return 'text-amber-600';
  return 'text-red-600';
}

function healthLabel(score: number | null): string {
  if (score === null) return '—';
  if (score >= 70) return '✅ Healthy';
  if (score >= 40) return '⚠️ Needs Attention';
  return '🔴 Critical';
}

const TIER_BADGE: Record<string, string> = {
  BRONZE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  SILVER: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  GOLD: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  PLATINUM: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
};

/* ──────────────────────────────────────────────────────────────────────────────
   FirmDashboard — multi-client overview for accountants / firm owners
   ──────────────────────────────────────────────────────────────────────────── */

function FirmDashboard({
  firmData,
  onViewClient,
  onInvite,
}: {
  firmData: FirmDashboardData;
  onViewClient: (client: FirmClient) => void;
  onInvite: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100">
              <span className="text-lg">🏢</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-700">{firmData.totalClients}</p>
              <p className="text-xs text-gray-500">Total Clients</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100">
              <span className="text-lg">⚠️</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{firmData.needingAttention}</p>
              <p className="text-xs text-gray-500">Need Attention</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-100">
              <span className="text-lg">🔍</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-700">{firmData.totalPendingReviews}</p>
              <p className="text-xs text-gray-500">Pending Reviews</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-100">
              <span className="text-lg">🧾</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{firmData.totalFailedEtims}</p>
              <p className="text-xs text-gray-500">Failed eTIMS</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Client list */}
      <Card>
        <div className="p-4 border-b border-kenya-green-100 dark:border-kenya-green-800 flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50">Client Overview</h3>
          <Button size="sm" variant="secondary" onClick={onInvite}>+ Invite Client</Button>
        </div>
        <CardContent className="p-0">
          {firmData.clients.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-gray-500 text-sm">No clients yet. Invite a client to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-kenya-green-100 dark:border-kenya-green-800 bg-kenya-green-50/50 dark:bg-kenya-green-900/30">
                    <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider">Client</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider hidden md:table-cell">Tier</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider hidden sm:table-cell">Role</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider">Health</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider hidden md:table-cell">Entries</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider hidden lg:table-cell">Reviews</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider hidden lg:table-cell">eTIMS</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {firmData.clients.map((client) => (
                    <tr key={client.id} className="border-b border-kenya-green-50 dark:border-kenya-green-900 last:border-0 hover:bg-kenya-green-50/50 dark:hover:bg-kenya-green-900/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-kenya-green-100 dark:bg-kenya-green-800 text-xs font-bold text-kenya-green-700 dark:text-kenya-green-300">
                            {client.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-kenya-green-900 dark:text-kenya-green-50 truncate max-w-[160px]">{client.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${TIER_BADGE[client.tier] || 'bg-gray-100 text-gray-600'}`}>
                          {client.tier || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4 hidden sm:table-cell">
                        <span className="text-xs text-gray-500 dark:text-gray-400">{client.role.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <HealthDot score={client.healthScore} size="md" />
                      </td>
                      <td className="py-3 px-4 text-center hidden md:table-cell">
                        <span className="text-xs text-gray-600 dark:text-gray-400">{client.totalEntries.toLocaleString()}</span>
                      </td>
                      <td className="py-3 px-4 text-center hidden lg:table-cell">
                        {client.pendingReviews > 0 ? (
                          <Badge variant="warning" size="sm">{client.pendingReviews}</Badge>
                        ) : (
                          <span className="text-xs text-gray-400">0</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center hidden lg:table-cell">
                        {client.failedEtims > 0 ? (
                          <Badge variant="error" size="sm">{client.failedEtims}</Badge>
                        ) : (
                          <span className="text-xs text-gray-400">0</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onViewClient(client)}
                        >
                          View →
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
   ClientDashboard — existing per-company view
   ──────────────────────────────────────────────────────────────────────────── */

function ClientDashboard({
  data,
  healthScore,
  wizardData,
  badges,
  analytics,
  companyName,
  onSwitchToFirm,
  isFirmUser,
}: {
  data: DashboardData;
  healthScore: { overallScore: number; pillars: Array<{ name: string; score: number; maxScore: number }> } | null;
  wizardData: { percentage: number; completedSteps: number; totalSteps: number; nextStep: { label: string } | null; isComplete: boolean } | null;
  badges: Array<{ id: string; name: string; icon: string; earned: boolean }>;
  analytics: AnalyticsData | null;
  companyName?: string;
  onSwitchToFirm?: () => void;
  isFirmUser: boolean;
}) {
  const navigate = useNavigate();
  const formatKES = (amount: number) => `KES ${amount.toLocaleString('en-KE')}`;
  const hasTransactions = data.totalEntries > 0;
  const earnedBadges = badges.filter(b => b.earned);
  const [activeTab, setActiveTab] = React.useState('activity');

  // Calculate income/expense totals from analytics
  const totalIncome = analytics?.monthly.reduce((s, m) => s + (m.income || 0), 0) || 0;
  const totalExpenses = analytics?.monthly.reduce((s, m) => s + (m.expense || 0), 0) || 0;
  const netProfit = totalIncome - totalExpenses;

  const tabs = [
    { id: 'activity', label: 'Activity' },
    { id: 'mpesa', label: 'M-Pesa' },
    { id: 'health', label: 'Health' },
    { id: 'month-end', label: 'Month-End' },
    { id: 'actions', label: 'Actions' },
  ];

  return (
    <>
      {/* ─── HEADER BAR ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-kenya-green-900 dark:text-kenya-green-50">Dashboard</h1>
            {companyName && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-kenya-amber-100 dark:bg-kenya-amber-900/30 text-xs font-medium text-kenya-amber-700 dark:text-kenya-amber-300">
                {companyName}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {hasTransactions
              ? `${data.totalEntries} entries recorded`
              : 'Start by importing your transactions'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isFirmUser && onSwitchToFirm && (
            <Button variant="ghost" size="sm" onClick={onSwitchToFirm}>
              ← Firm Overview
            </Button>
          )}
          {data?.xpScore && (
            <XPBar current={data.xpScore.score} max={data.xpScore.score + data.xpScore.xpToNextLevel} showLevel className="w-40 hidden sm:flex" />
          )}
          <Button variant="ghost" size="sm" onClick={() => navigate('/reports')}>📊 Reports</Button>
        </div>
      </div>

      {/* ─── NEW USER WELCOME ──────────────────────────────────────────── */}
      {!hasTransactions && (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-4xl mb-3" aria-hidden="true">👋</p>
            <h2 className="text-lg font-semibold text-kenya-green-900 dark:text-kenya-green-50 mb-2">Welcome to JengaBooks</h2>
            <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">
              Import your M-Pesa statement or record your first transaction to get started
            </p>
            <div className="flex justify-center gap-3 flex-wrap">
              <Button onClick={() => navigate('/mpesa')}>Import M-Pesa</Button>
            </div>
            {wizardData && !wizardData.isComplete && (
              <div className="mt-5 max-w-sm mx-auto">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-kenya-green-600">Getting Started</span>
                  <span className="text-xs font-bold text-kenya-green-600">{wizardData.percentage}%</span>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-kenya-green-500 rounded-full transition-all" style={{ width: `${wizardData.percentage}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-gray-400">
                  {wizardData.completedSteps} of {wizardData.totalSteps} steps
                  {wizardData.nextStep && <> · Next: <span className="font-medium text-kenya-green-600">{wizardData.nextStep.label}</span></>}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── TABS ──────────────────────────────────────────────────────── */}
      {hasTransactions && (
        <>
          {/* Tab bar */}
          <div className="flex gap-1 border-b border-kenya-green-100 dark:border-kenya-green-800 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`touch-target px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-kenya-green-500 text-kenya-green-700 dark:text-kenya-green-300'
                    : 'border-transparent text-gray-500 hover:text-kenya-green-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'activity' && (
            <div className="flex flex-col gap-5">
              {/* Snapshot cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-100">
                      <span className="text-lg" aria-hidden="true">💰</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg font-bold text-green-700">{formatKES(totalIncome)}</p>
                      <p className="text-xs text-gray-500">Total Income</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-100">
                      <span className="text-lg" aria-hidden="true">💸</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg font-bold text-red-600">{formatKES(totalExpenses)}</p>
                      <p className="text-xs text-gray-500">Total Expenses</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${netProfit >= 0 ? 'bg-blue-100' : 'bg-red-100'}`}>
                      <span className="text-lg" aria-hidden="true">{netProfit >= 0 ? '📈' : '📉'}</span>
                    </div>
                    <div className="min-w-0">
                      <p className={`text-lg font-bold ${netProfit >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{formatKES(Math.abs(netProfit))}</p>
                      <p className="text-xs text-gray-500">{netProfit >= 0 ? 'Net Profit' : 'Net Loss'}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Monthly Trend */}
              {analytics && analytics.monthly.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50 mb-4">Monthly Income vs Expenses</h3>
                    <div className="flex items-end gap-1.5 h-28" style={{ minHeight: '112px' }}>
                      {analytics.monthly.map((m) => {
                        const allValues = analytics.monthly.flatMap(x => [x.income || 0, x.expense || 0]);
                        const maxVal = Math.max(...allValues, 1);
                        const incomeH = ((m.income || 0) / maxVal) * 80;
                        const expenseH = ((m.expense || 0) / maxVal) * 80;
                        const monthNum = parseInt(m.month.slice(5), 10);
                        const label = MONTHS[monthNum - 1] || m.month.slice(5);
                        return (
                          <div key={m.month} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
                            <div className="w-full flex flex-col items-center justify-end" style={{ height: '80px' }}>
                              <div className="w-full bg-green-500 rounded-t" style={{ height: `${Math.max(incomeH, 1)}px` }} title={`Income: KES ${(m.income || 0).toLocaleString()}`} />
                              <div className="w-full bg-red-400 rounded-b" style={{ height: `${Math.max(expenseH, 1)}px` }} title={`Expenses: KES ${(m.expense || 0).toLocaleString()}`} />
                            </div>
                            <span className="text-[10px] text-gray-400 mt-1">{label}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-4 mt-2 text-[10px] text-gray-500">
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-green-500" /> Income</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-400" /> Expenses</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recent Activity */}
              <Card>
                <div className="p-4 border-b border-kenya-green-100 dark:border-kenya-green-800 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50">Recent Activity</h3>
                  {data.recentEntries.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => navigate('/ledger')}>View All →</Button>
                  )}
                </div>
                <CardContent className="p-0">
                  {data.recentEntries.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-gray-400 text-sm">No recent transactions</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-kenya-green-50 dark:divide-kenya-green-900">
                      {data.recentEntries.slice(0, 5).map((entry) => (
                        <div key={entry.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-kenya-green-50/50 dark:hover:bg-kenya-green-900/30">
                          <span className="text-xs text-gray-400 w-16 shrink-0">{new Date(entry.entryDate).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' })}</span>
                          <span className="text-sm text-kenya-green-900 dark:text-kenya-green-50 flex-1 truncate min-w-0">{entry.description}</span>
                          <span className={`text-sm font-mono font-medium shrink-0 ${entry.direction === 'DEBIT' ? 'text-red-600' : 'text-green-600'}`}>
                            {formatKES(entry.amount)}
                          </span>
                          <Badge variant={entry.direction === 'DEBIT' ? 'info' : 'success'} size="sm" className="shrink-0 hidden sm:inline-flex">{entry.account?.code}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'mpesa' && analytics && (analytics.mpesaSummary.paidIn30d > 0 || analytics.mpesaSummary.withdrawn30d > 0) && (
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50 mb-3">M-Pesa (30 days)</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600">Paid In</span>
                    <span className="font-mono text-green-600">{formatKES(analytics.mpesaSummary.paidIn30d)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-red-600">Withdrawn</span>
                    <span className="font-mono text-red-600">{formatKES(analytics.mpesaSummary.withdrawn30d)}</span>
                  </div>
                  <div className="border-t border-gray-100 dark:border-gray-700 pt-3 flex justify-between text-sm font-semibold">
                    <span>Net</span>
                    <span className={`font-mono ${analytics.mpesaSummary.paidIn30d - analytics.mpesaSummary.withdrawn30d >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatKES(analytics.mpesaSummary.paidIn30d - analytics.mpesaSummary.withdrawn30d)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'health' && (
            <div className="flex flex-col gap-5">
              {healthScore && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <HealthDot score={healthScore.overallScore} size="lg" showLabel />
                      <div>
                        <h3 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50">Business Health</h3>
                        <p className={`text-xs font-medium ${healthScore.overallScore >= 70 ? 'text-green-600' : healthScore.overallScore >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                          {healthScore.overallScore >= 70 ? 'Healthy' : healthScore.overallScore >= 40 ? 'Needs Attention' : 'Critical'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              {analytics && analytics.topExpenses.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50 mb-3">Top Expenses</h3>
                    <div className="space-y-2">
                      {analytics.topExpenses.map((e, i) => (
                        <div key={e.code || i} className="flex items-center justify-between">
                          <span className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-[200px]">{e.name || e.code}</span>
                          <span className="text-xs font-mono font-medium text-red-600">{formatKES(e.total || 0)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {activeTab === 'month-end' && wizardData && (
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50 mb-3">Month-End Progress</h3>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-kenya-green-600">{wizardData.percentage}%</span>
                  <span className="text-xs text-gray-500">{wizardData.completedSteps} of {wizardData.totalSteps} steps</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-kenya-green-500 rounded-full" style={{ width: `${wizardData.percentage}%` }} />
                </div>
                {wizardData.nextStep && (
                  <p className="mt-2 text-xs text-gray-500">
                    Next: <span className="font-medium text-kenya-green-600">{wizardData.nextStep.label}</span>
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'actions' && (
            <div className="flex flex-col gap-5">
              {data?.xpScore && (
                <Card>
                  <CardContent className="p-4">
                    <XPBar current={data.xpScore.score} max={data.xpScore.score + data.xpScore.xpToNextLevel} label={`Level ${data.xpScore.level}`} />
                    {earnedBadges.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {earnedBadges.map((badge) => (
                          <span key={badge.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-kenya-green-50 dark:bg-kenya-green-900/30 text-[10px] font-medium text-kenya-green-700 dark:text-kenya-green-300">
                            {badge.icon} {badge.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50 mb-3">Quick Links</h3>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/mpesa')}>M-Pesa</Button>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/ledger')}>Ledger</Button>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/reports')}>Reports</Button>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/etims')}>eTIMS</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
   Dashboard — top-level orchestrator: FirmDahboard vs ClientDashboard
   ──────────────────────────────────────────────────────────────────────────── */

export function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const switchCompany = useAuthStore((state) => state.switchCompany);
  const companyId = user?.companyId;
  const companyName = user?.companyName;
  const userRole = user?.role;
  const memberships = user?.memberships || [];

  const isFirmUser = userRole === 'FIRM_OWNER' || userRole === 'SUPER_ADMIN' || userRole === 'ACCOUNTANT';
  const hasMultipleCompanies = memberships.length > 1;

  // viewMode: 'firm' = firm overview, 'client' = per-company dashboard
  const [viewMode, setViewMode] = React.useState<ViewMode>(
    isFirmUser && hasMultipleCompanies ? 'firm' : 'client',
  );

  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [firmData, setFirmData] = React.useState<FirmDashboardData | null>(null);
  const [firmLoading, setFirmLoading] = React.useState(false);
  const [showIncomeForm, setShowIncomeForm] = React.useState(false);
  const [showExpenseForm, setShowExpenseForm] = React.useState(false);
  const [showNewEntryMenu, setShowNewEntryMenu] = React.useState(false);

  const [healthScore, setHealthScore] = React.useState<{ overallScore: number; pillars: Array<{ name: string; score: number; maxScore: number }> } | null>(null);
  const [wizardData, setWizardData] = React.useState<{ percentage: number; completedSteps: number; totalSteps: number; nextStep: { label: string } | null; isComplete: boolean } | null>(null);
  const [badges, setBadges] = React.useState<Array<{ id: string; name: string; icon: string; earned: boolean }>>([]);
  const [analytics, setAnalytics] = React.useState<AnalyticsData | null>(null);

  // ── Fetch firm overview data (for firm users) ────────────────────────
  React.useEffect(() => {
    if (!isFirmUser || viewMode !== 'firm') return;

    let cancelled = false;
    setFirmLoading(true);

    async function loadFirm() {
      try {
        const res = await api.get<FirmDashboardData>('/companies/firm/dashboard');
        if (!cancelled) setFirmData(res);
      } catch (e) {
        console.error('Failed to load firm dashboard:', e);
      } finally {
        if (!cancelled) setFirmLoading(false);
      }
    }
    loadFirm();
    return () => { cancelled = true; };
  }, [isFirmUser, viewMode]);

  // ── Fetch per-company data (for client view) ─────────────────────────
  React.useEffect(() => {
    if (!companyId || viewMode !== 'client') return;
    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        const summary = await api.get<any>('/dashboard/summary');

        if (cancelled) return;

        const newData: DashboardData = {
          totalEntries: summary.entries?.total || 0,
          recentEntries: summary.entries?.recent || [],
        };
        if (summary.gamification) {
          newData.xpScore = {
            score: summary.gamification.score,
            level: summary.gamification.level,
            xpToNextLevel: summary.gamification.xpToNextLevel,
          };
        }
        setData(newData);

        if (summary.healthScore) {
          setHealthScore(summary.healthScore);
        }

        if (summary.wizard) {
          setWizardData(summary.wizard);
        }

        if (summary.badges) {
          setBadges([
            ...(summary.badges.earned || []).map((b: any) => ({ ...b, earned: true })),
            ...(summary.badges.available || []),
          ]);
        }

        if (summary.analytics) {
          setAnalytics(summary.analytics);
        }
      } catch (e) {
        console.error('Failed to load dashboard:', e);
      } finally {
        if (!cancelled) {
          setData((prev) => prev || { totalEntries: 0, recentEntries: [] });
          setLoading(false);
        }
      }
    }
    load();

    return () => { cancelled = true; };
  }, [companyId, viewMode]); // Re-fetch when company changes OR when switching to client view

  const handleCreateSuccess = () => {
    setShowIncomeForm(false);
    setShowExpenseForm(false);
    setShowNewEntryMenu(false);
    queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
    api.get<any>('/ledger/entries?limit=5').then((entries) => {
      setData((prev) => prev ? { ...prev, totalEntries: entries?.total || 0, recentEntries: entries?.items?.slice(0, 5) || [] } : prev);
    }).catch(() => {});
  };

  const handleViewClient = async (client: FirmClient) => {
    // Switch to that company, then enter client view mode
    const success = await switchCompany(client.id);
    if (success) {
      setViewMode('client');
    }
  };

  const handleBackToFirm = () => {
    setViewMode('firm');
  };

  const handleInviteClient = () => {
    navigate('/team');
  };

  // ── Determine what to render ─────────────────────────────────────────
  // Show firm overview when:
  //   - user is a firm role AND has multiple memberships AND viewMode is 'firm'
  const showFirmView = isFirmUser && hasMultipleCompanies && viewMode === 'firm';

  // Loading state for firm overview
  if (showFirmView && firmLoading) return <DashboardSkeleton />;

  // Firm overview (with firm data available or error)
  if (showFirmView && firmData) {
    return (
      <div className="flex flex-col gap-5">
        <IncomeForm isOpen={showIncomeForm} onClose={() => { setShowIncomeForm(false); setShowNewEntryMenu(false); }} onSuccess={handleCreateSuccess} />
        <ExpenseForm isOpen={showExpenseForm} onClose={() => { setShowExpenseForm(false); setShowNewEntryMenu(false); }} onSuccess={handleCreateSuccess} />

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-kenya-green-900 dark:text-kenya-green-50">Firm Dashboard</h1>
              {user?.name && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-kenya-green-100 dark:bg-kenya-green-900/30 text-xs font-medium text-kenya-green-700 dark:text-kenya-green-300">
                  {user.name}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {firmData.totalClients} client{firmData.totalClients !== 1 ? 's' : ''} · {firmData.needingAttention} needing attention
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/reports')}>📊 Reports</Button>
            <Button size="sm" onClick={() => navigate('/team')}>👥 Manage Team</Button>
          </div>
        </div>

        <FirmDashboard
          firmData={firmData}
          onViewClient={handleViewClient}
          onInvite={handleInviteClient}
        />
      </div>
    );
  }

  // Loading state for client view
  if (viewMode === 'client' && loading) return <DashboardSkeleton />;
  if (viewMode === 'client' && !data) return <DashboardSkeleton />;

  // Per-company dashboard
  if (viewMode === 'client' && data) {
    return (
      <div className="flex flex-col gap-5">
        <IncomeForm isOpen={showIncomeForm} onClose={() => { setShowIncomeForm(false); setShowNewEntryMenu(false); }} onSuccess={handleCreateSuccess} />
        <ExpenseForm isOpen={showExpenseForm} onClose={() => { setShowExpenseForm(false); setShowNewEntryMenu(false); }} onSuccess={handleCreateSuccess} />

        <ClientDashboard
          data={data}
          healthScore={healthScore}
          wizardData={wizardData}
          badges={badges}
          analytics={analytics}
          companyName={companyName}
          onSwitchToFirm={isFirmUser && hasMultipleCompanies ? handleBackToFirm : undefined}
          isFirmUser={isFirmUser}
        />
      </div>
    );
  }

  // Fallback: single-company or no-membership user → show client dashboard directly
  if (!showFirmView && viewMode === 'client') {
    return (
      <div className="flex flex-col gap-5">
        <IncomeForm isOpen={showIncomeForm} onClose={() => { setShowIncomeForm(false); setShowNewEntryMenu(false); }} onSuccess={handleCreateSuccess} />
        <ExpenseForm isOpen={showExpenseForm} onClose={() => { setShowExpenseForm(false); setShowNewEntryMenu(false); }} onSuccess={handleCreateSuccess} />

        <ClientDashboard
          data={data || { totalEntries: 0, recentEntries: [] }}
          healthScore={healthScore}
          wizardData={wizardData}
          badges={badges}
          analytics={analytics}
          companyName={companyName}
          isFirmUser={isFirmUser}
        />
      </div>
    );
  }

  // Absolute fallback
  return <DashboardSkeleton />;
}
