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

interface DashboardData {
  totalEntries: number;
  totalDebits: number;
  totalCredits: number;
  balanced: boolean;
  recentEntries: Array<{ id: string; description: string; amount: number; direction: string; entryDate: string; account: { code: string; name: string }; aiConfidence?: number | null }>;
  xpScore?: { score: number; level: number; xpToNextLevel: number };
}

export function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [showIncomeForm, setShowIncomeForm] = React.useState(false);
  const [showExpenseForm, setShowExpenseForm] = React.useState(false);
  const [showNewEntryMenu, setShowNewEntryMenu] = React.useState(false);

  const [healthScore, setHealthScore] = React.useState<{ overallScore: number; pillars: Array<{ name: string; score: number; maxScore: number }> } | null>(null);
  const [wizardData, setWizardData] = React.useState<{ percentage: number; completedSteps: number; totalSteps: number; nextStep: { label: string } | null; isComplete: boolean } | null>(null);
  const [badges, setBadges] = React.useState<Array<{ id: string; name: string; icon: string; earned: boolean }>>([]);

  React.useEffect(() => {
    async function load() {
      try {
        const [trialBalance, entries, xp, hs, wizard, badgeData] = await Promise.all([
          api.get<any>('/ledger/trial-balance').catch(() => null),
          api.get<any>('/ledger/entries?limit=5').catch(() => null),
          api.get<any>('/gamification/profile').catch(() => null),
          api.get<any>('/health-score').catch(() => null),
          api.get<any>('/wizard/progress').catch(() => null),
          api.get<any>('/gamification/badges').catch(() => null),
        ]);

        const newData: DashboardData = {
          totalEntries: entries?.total || 0,
          totalDebits: trialBalance?.totalDebits || 0,
          totalCredits: trialBalance?.totalCredits || 0,
          balanced: trialBalance?.balanced || false,
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
      } catch (e) {
        console.error('Failed to load dashboard:', e);
      } finally {
        // Ensure data is never null when loading completes, so the UI doesn't crash
        setData((prev) => prev || { totalEntries: 0, totalDebits: 0, totalCredits: 0, balanced: false, recentEntries: [] });
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleCreateSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
    queryClient.invalidateQueries({ queryKey: ['trial-balance'] });
    queryClient.invalidateQueries({ queryKey: ['gamification'] });
    api.get<any>('/ledger/trial-balance').catch(() => null).then((tb) => {
      api.get<any>('/ledger/entries?limit=5').catch(() => null).then((entries) => {
        setData((prev) => prev ? {
          ...prev,
          totalEntries: entries?.total || 0,
          totalDebits: tb?.totalDebits || 0,
          totalCredits: tb?.totalCredits || 0,
          balanced: tb?.balanced || false,
          recentEntries: entries?.items?.slice(0, 5) || [],
        } : prev);
      });
    });
  };

  const formatKES = (amount: number) => `KES ${amount.toLocaleString('en-KE')}`;

  const renderConfidenceBadge = (confidence: number | null | undefined) => {
    if (confidence == null) return <span className="text-xs text-gray-400">—</span>;
    const tier = confidence >= 0.9 ? 'high' : confidence >= 0.7 ? 'medium' : 'low';
    const colors = {
      high: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      low: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    };
    const labels = { high: '✓ High', medium: '~ Med', low: '! Low' };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${colors[tier]}`}>
        {labels[tier]}
      </span>
    );
  };

  if (loading) return <DashboardSkeleton />;
  if (!data) return <DashboardSkeleton />; // Fallback if all API calls failed

  const earnedBadges = badges.filter(b => b.earned);

  return (
    <div className="flex flex-col gap-6">
      <IncomeForm isOpen={showIncomeForm} onClose={() => { setShowIncomeForm(false); setShowNewEntryMenu(false); }} onSuccess={handleCreateSuccess} />
      <ExpenseForm isOpen={showExpenseForm} onClose={() => { setShowExpenseForm(false); setShowNewEntryMenu(false); }} onSuccess={handleCreateSuccess} />

      {/* ─── HEADER + ACTIONS ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-kenya-green-900 dark:text-kenya-green-50">Dashboard</h1>
          <p className="text-sm text-gray-500">
            {data!.totalEntries > 0
              ? `${data!.totalEntries} entries · ${data!.balanced ? '✅ Balanced' : '⚠️ Unbalanced'}`
              : 'Start by recording your first transaction'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/ledger')}>📒 Ledger</Button>
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

      {/* ─── KPI CARDS ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-kenya-green-100">
            <span className="text-lg">📒</span>
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold">{data!.totalEntries.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Transactions</p>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-kenya-amber-100">
            <span className="text-lg">🧾</span>
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold text-kenya-amber-600">{formatKES(data!.totalDebits)}</p>
            <p className="text-xs text-gray-500">Debits</p>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-100">
            <span className="text-lg">✅</span>
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold text-green-700">{formatKES(data!.totalCredits)}</p>
            <p className="text-xs text-gray-500">Credits</p>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100">
            <span className="text-lg">⚖️</span>
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold text-blue-700">{data!.balanced ? 'Balanced' : 'Unbalanced'}</p>
            <p className="text-xs text-gray-500">Trial Balance</p>
          </div>
        </CardContent></Card>
      </div>

      {/* ─── NEW USER WIZARD ──────────────────────────────────────────── */}
      {wizardData && !wizardData.isComplete && (
        <div className="rounded-xl border border-kenya-green-100 p-4 bg-gradient-to-r from-kenya-green-50 to-white dark:from-kenya-green-900/20 dark:border-kenya-green-800">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">🚀 Getting Started</h3>
            <span className="text-sm font-bold text-kenya-green-600">{wizardData.percentage}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-kenya-green-500 rounded-full transition-all" style={{ width: `${wizardData.percentage}%` }} />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {wizardData.completedSteps} of {wizardData.totalSteps} steps
            {wizardData.nextStep && (
              <> · Next: <span className="font-medium text-kenya-green-600">{wizardData.nextStep.label}</span></>
            )}
          </p>
        </div>
      )}

      {/* ─── RECENT ACTIVITY ──────────────────────────────────────────── */}
      <Card>
        <div className="p-4 border-b border-kenya-green-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent Activity</h2>
          {data!.recentEntries.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => navigate('/ledger')}>View All →</Button>
          )}
        </div>
        <CardContent className="p-0">
          {data!.recentEntries.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-3xl mb-2">📒</p>
              <p className="text-gray-500 mb-3">No transactions yet</p>
              <div className="flex justify-center gap-2">
                <Button size="sm" onClick={() => setShowIncomeForm(true)}>Record Income</Button>
                <Button size="sm" variant="secondary" onClick={() => setShowExpenseForm(true)}>Record Expense</Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-kenya-green-50">
                    <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase">Date</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase">Description</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500 text-xs uppercase">Amount</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase">Account</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-500 text-xs uppercase">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.recentEntries.map((entry) => (
                    <tr key={entry.id} className="border-b border-kenya-green-50 last:border-0 hover:bg-kenya-green-50/50">
                      <td className="py-3 px-4 text-gray-600 whitespace-nowrap">{new Date(entry.entryDate).toLocaleDateString('en-KE')}</td>
                      <td className="py-3 px-4 max-w-[200px] truncate">{entry.description}</td>
                      <td className="py-3 px-4 text-right font-mono font-medium">{formatKES(entry.amount)}</td>
                      <td className="py-3 px-4">
                        <Badge variant={entry.direction === 'DEBIT' ? 'info' : 'success'} size="sm">{entry.account?.code}</Badge>
                      </td>
                      <td className="py-3 px-4 text-center">{renderConfidenceBadge(entry.aiConfidence)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── XP BAR ───────────────────────────────────────────────────── */}
      {data?.xpScore && (
        <XPBar current={data.xpScore.score} max={data.xpScore.score + data.xpScore.xpToNextLevel} label={`Level ${data.xpScore.level} Progress`} />
      )}

      {/* ─── INSIGHTS (Collapsible) ───────────────────────────────────── */}
      <details className="group">
        <summary className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-kenya-green-700 hover:text-kenya-green-900">
          <span>📊</span>
          <span>Insights & Progress</span>
          <span className="text-xs text-gray-400 ml-auto group-open:rotate-180 transition-transform">▾</span>
        </summary>
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Health Score */}
          {healthScore && (
            <div className="rounded-xl border border-kenya-green-100 p-4">
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 shrink-0">
                  <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#E5E7EB" strokeWidth="8" />
                    <circle cx="50" cy="50" r="40" fill="none"
                      stroke={healthScore.overallScore >= 70 ? '#0A5C36' : healthScore.overallScore >= 40 ? '#E8A317' : '#BB1E10'}
                      strokeWidth="8" strokeDasharray={`${2 * Math.PI * 40}`}
                      strokeDashoffset={`${2 * Math.PI * 40 * (1 - healthScore.overallScore / 100)}`}
                      strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold">{Math.round(healthScore.overallScore)}</span>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Business Health</h3>
                  <p className={`text-xs font-medium ${healthScore.overallScore >= 70 ? 'text-green-600' : healthScore.overallScore >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                    {healthScore.overallScore >= 70 ? '✅ Healthy' : healthScore.overallScore >= 40 ? '⚠️ Needs Attention' : '🔴 Critical'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Earned Badges */}
          {earnedBadges.length > 0 && (
            <div className="rounded-xl border border-kenya-green-100 p-4">
              <h3 className="text-sm font-semibold mb-2">🏅 Badges ({earnedBadges.length})</h3>
              <div className="flex flex-wrap gap-2">
                {earnedBadges.map((badge) => (
                  <span key={badge.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-kenya-green-50 text-xs font-medium text-kenya-green-700">
                    {badge.icon} {badge.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Quick Links */}
          <div className="rounded-xl border border-kenya-green-100 p-4">
            <h3 className="text-sm font-semibold mb-2">🔗 Quick Links</h3>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate('/accounts')}>📋 Chart of Accounts</Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/mpesa')}>📱 M-Pesa Import</Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/etims')}>🧾 eTIMS</Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/hitl')}>👤 HITL Hub</Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/team')}>👥 Team</Button>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
