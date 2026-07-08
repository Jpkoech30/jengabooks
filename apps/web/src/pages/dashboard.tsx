import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { DashboardSkeleton } from '../components/ui/skeleton';
import { XPBar } from '../components/ui/xp-bar';
import { IncomeForm } from '../components/forms/income-form';
import { ExpenseForm } from '../components/forms/expense-form';
import { api } from '../lib/api-client';
import { useAuthStore } from '../stores/auth-store';

interface DashboardData {
  totalEntries: number;
  recentEntries: Array<{ id: string; description: string; amount: number; direction: string; entryDate: string; account: { code: string; name: string }; aiConfidence?: number | null }>;
  xpScore?: { score: number; level: number; xpToNextLevel: number };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const companyId = useAuthStore((state) => state.user?.companyId);
  const companyName = useAuthStore((state) => state.user?.companyName);

  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [showIncomeForm, setShowIncomeForm] = React.useState(false);
  const [showExpenseForm, setShowExpenseForm] = React.useState(false);
  const [showNewEntryMenu, setShowNewEntryMenu] = React.useState(false);

  const [healthScore, setHealthScore] = React.useState<{ overallScore: number; pillars: Array<{ name: string; score: number; maxScore: number }> } | null>(null);
  const [wizardData, setWizardData] = React.useState<{ percentage: number; completedSteps: number; totalSteps: number; nextStep: { label: string } | null; isComplete: boolean } | null>(null);
  const [badges, setBadges] = React.useState<Array<{ id: string; name: string; icon: string; earned: boolean }>>([]);
  const [analytics, setAnalytics] = React.useState<{
    monthly: Array<{ month: string; income: number; expense: number }>;
    topExpenses: Array<{ code: string; name: string; total: number }>;
    mpesaSummary: { paidIn30d: number; withdrawn30d: number };
  } | null>(null);

  // Re-fetch all data when companyId changes (user switches company)
  React.useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        const [entries, xp, hs, wizard, badgeData, analyticData] = await Promise.all([
          api.get<any>('/ledger/entries?limit=5').catch(() => null),
          api.get<any>('/gamification/profile').catch(() => null),
          api.get<any>('/health-score').catch(() => null),
          api.get<any>('/wizard/progress').catch(() => null),
          api.get<any>('/gamification/badges').catch(() => null),
          api.get<any>('/reports/analytics/dashboard').catch(() => null),
        ]);

        if (cancelled) return;

        const newData: DashboardData = {
          totalEntries: entries?.total || 0,
          recentEntries: entries?.items?.slice(0, 5) || [],
        };
        if (xp) {
          newData.xpScore = { score: xp.score, level: xp.level, xpToNextLevel: xp.xpToNextLevel };
        }
        setData(newData);
        if (hs) setHealthScore(hs);
        if (wizard) setWizardData(wizard);
        if (badgeData) {
          setBadges([
            ...(badgeData.earned || []).map((b: any) => ({ ...b, earned: true })),
            ...(badgeData.available || []),
          ]);
        }
        if (analyticData) setAnalytics(analyticData);
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
  }, [companyId]); // key: re-fetch when company changes

  const handleCreateSuccess = () => {
    // Close forms and trigger a fresh data load
    setShowIncomeForm(false);
    setShowExpenseForm(false);
    setShowNewEntryMenu(false);
    // Trigger Effect re-run by using a refresh counter or just re-fetch directly
    queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
    // Re-fetch dashboard data for current company
    api.get<any>('/ledger/entries?limit=5').then((entries) => {
      setData((prev) => prev ? { ...prev, totalEntries: entries?.total || 0, recentEntries: entries?.items?.slice(0, 5) || [] } : prev);
    }).catch(() => {});
  };

  const formatKES = (amount: number) => `KES ${amount.toLocaleString('en-KE')}`;
  const hasTransactions = data && data.totalEntries > 0;
  const earnedBadges = badges.filter(b => b.earned);

  // Calculate income/expense totals from analytics
  const totalIncome = analytics?.monthly.reduce((s, m) => s + (m.income || 0), 0) || 0;
  const totalExpenses = analytics?.monthly.reduce((s, m) => s + (m.expense || 0), 0) || 0;
  const netProfit = totalIncome - totalExpenses;

  if (loading) return <DashboardSkeleton />;
  if (!data) return <DashboardSkeleton />;

  return (
    <div className="flex flex-col gap-5">
      <IncomeForm isOpen={showIncomeForm} onClose={() => { setShowIncomeForm(false); setShowNewEntryMenu(false); }} onSuccess={handleCreateSuccess} />
      <ExpenseForm isOpen={showExpenseForm} onClose={() => { setShowExpenseForm(false); setShowNewEntryMenu(false); }} onSuccess={handleCreateSuccess} />

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
          {data?.xpScore && (
            <XPBar current={data.xpScore.score} max={data.xpScore.score + data.xpScore.xpToNextLevel} showLevel className="w-40 hidden sm:flex" />
          )}
          <Button variant="ghost" size="sm" onClick={() => navigate('/reports')}>📊 Reports</Button>
          <div className="relative">
            <Button size="sm" onClick={() => setShowNewEntryMenu(!showNewEntryMenu)}>
              + New Entry
            </Button>
            {showNewEntryMenu && (
              <div className="absolute right-0 top-full mt-2 z-50 w-48 rounded-xl border bg-white shadow-lg dark:bg-kenya-surface-dark overflow-hidden">
                <button onClick={() => { setShowIncomeForm(true); setShowNewEntryMenu(false); }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm hover:bg-kenya-green-50">
                  <span>💰</span><span className="font-medium">Record Income</span>
                </button>
                <button onClick={() => { setShowExpenseForm(true); setShowNewEntryMenu(false); }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm hover:bg-kenya-green-50">
                  <span>💳</span><span className="font-medium">Record Expense</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── NEW USER WELCOME ──────────────────────────────────────────── */}
      {!hasTransactions && (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-4xl mb-3">👋</p>
            <h2 className="text-lg font-semibold text-kenya-green-900 dark:text-kenya-green-50 mb-2">Welcome to JengaBooks</h2>
            <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">
              Import your M-Pesa statement or record your first transaction to get started
            </p>
            <div className="flex justify-center gap-3 flex-wrap">
              <Button onClick={() => navigate('/mpesa')}>📱 Import M-Pesa</Button>
              <Button variant="secondary" onClick={() => setShowIncomeForm(true)}>💰 Record Income</Button>
            </div>
            {wizardData && !wizardData.isComplete && (
              <div className="mt-5 max-w-sm mx-auto">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-kenya-green-600">🚀 Getting Started</span>
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

      {/* ─── BUSINESS SNAPSHOT ──────────────────────────────────────────── */}
      {hasTransactions && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-100">
                <span className="text-lg">💰</span>
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
                <span className="text-lg">💸</span>
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
                <span className="text-lg">{netProfit >= 0 ? '📈' : '📉'}</span>
              </div>
              <div className="min-w-0">
                <p className={`text-lg font-bold ${netProfit >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{formatKES(Math.abs(netProfit))}</p>
                <p className="text-xs text-gray-500">{netProfit >= 0 ? 'Net Profit' : 'Net Loss'}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── ANALYTICS + RECENT ACTIVITY ────────────────────────────────── */}
      {hasTransactions && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Main analytics column */}
          <div className="lg:col-span-2 flex flex-col gap-5">

            {/* Monthly Trend */}
            {analytics && analytics.monthly.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50 mb-4">📈 Monthly Income vs Expenses</h3>
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

            {/* Recent Activity (compact) */}
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

          {/* Sidebar column */}
          <div className="flex flex-col gap-5">

            {/* Business Health */}
            {healthScore && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="relative w-14 h-14 shrink-0">
                      <svg className="w-14 h-14 transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" fill="none" stroke="#E5E7EB" strokeWidth="8" />
                        <circle cx="50" cy="50" r="40" fill="none"
                          stroke={healthScore.overallScore >= 70 ? '#0A5C36' : healthScore.overallScore >= 40 ? '#E8A317' : '#BB1E10'}
                          strokeWidth="8" strokeDasharray={`${2 * Math.PI * 40}`}
                          strokeDashoffset={`${2 * Math.PI * 40 * (1 - healthScore.overallScore / 100)}`}
                          strokeLinecap="round" />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-bold">{Math.round(healthScore.overallScore)}</span>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50">Health Score</h3>
                      <p className={`text-xs font-medium ${healthScore.overallScore >= 70 ? 'text-green-600' : healthScore.overallScore >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                        {healthScore.overallScore >= 70 ? '✅ Healthy' : healthScore.overallScore >= 40 ? '⚠️ Needs Attention' : '🔴 Critical'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Top Expenses */}
            {analytics && analytics.topExpenses.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50 mb-3">🔥 Top Expenses</h3>
                  <div className="space-y-2">
                    {analytics.topExpenses.map((e, i) => (
                      <div key={e.code || i} className="flex items-center justify-between">
                        <span className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-[140px]">{e.name || e.code}</span>
                        <span className="text-xs font-mono font-medium text-red-600">KES {(e.total || 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* M-Pesa 30-day Summary */}
            {analytics && (analytics.mpesaSummary.paidIn30d > 0 || analytics.mpesaSummary.withdrawn30d > 0) && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50 mb-3">📱 M-Pesa (30 days)</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-green-600">💰 Paid In</span>
                      <span className="font-mono text-green-600">KES {(analytics.mpesaSummary.paidIn30d || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-red-600">💸 Withdrawn</span>
                      <span className="font-mono text-red-600">KES {(analytics.mpesaSummary.withdrawn30d || 0).toLocaleString()}</span>
                    </div>
                    <div className="border-t border-gray-100 dark:border-gray-700 pt-2 flex justify-between text-xs font-semibold">
                      <span>Net</span>
                      <span className={`font-mono ${analytics.mpesaSummary.paidIn30d - analytics.mpesaSummary.withdrawn30d >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        KES {(analytics.mpesaSummary.paidIn30d - analytics.mpesaSummary.withdrawn30d).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* XP & Badges */}
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

            {/* Quick Links */}
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50 mb-3">🔗 Quick Links</h3>
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" size="sm" onClick={() => navigate('/mpesa')}>📱 M-Pesa</Button>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/ledger')}>📒 Ledger</Button>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/reports')}>📊 Reports</Button>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/etims')}>🧾 eTIMS</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
