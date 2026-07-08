import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { DashboardSkeleton } from '../components/ui/skeleton';
import { EmptyState } from '../components/ui/empty-state';
import { XPBar } from '../components/ui/xp-bar';
import { api } from '../lib/api-client';
import { useAuthStore } from '../stores/auth-store';
import { formatKES } from '../lib/utils';

/* ──────────────────────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────────────────────── */

interface RecentEntry {
  id: string;
  description: string;
  amount: number;
  direction: string;
  entryDate: string;
  account: { code: string; name: string };
  aiConfidence?: number | null;
}

interface DashboardSummary {
  entries: {
    total: number;
    recent: RecentEntry[];
  };
  monthlySummary?: {
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
  };
  mpesaUncleaned?: number;
  gamification?: {
    score: number;
    level: number;
    xpToNextLevel: number;
  };
  healthScore?: {
    overallScore: number;
    pillars: Array<{ name: string; score: number; maxScore: number }>;
  };
  wizard?: {
    percentage: number;
    completedSteps: number;
    totalSteps: number;
    nextStep: { label: string } | null;
    isComplete: boolean;
  };
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

type ViewMode = 'firm' | 'client';

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

function HealthDot({ score, size = 'md' }: { score: number | null; size?: 'sm' | 'md' | 'lg' }) {
  const dotSizes = { sm: 'h-2.5 w-2.5', md: 'h-3.5 w-3.5', lg: 'h-5 w-5' };
  const color =
    score === null
      ? 'bg-gray-300 dark:bg-gray-600'
      : score >= 70
        ? 'bg-green-500'
        : score >= 40
          ? 'bg-amber-500'
          : 'bg-red-500';

  return (
    <span
      className={`inline-block rounded-full ${dotSizes[size]} ${color}`}
      title={score !== null ? `Health: ${score}/100` : 'No health data'}
      aria-label={`Health score: ${score ?? 'N/A'}`}
    />
  );
}

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
            <EmptyState
              icon="📋"
              title="No clients yet"
              description="Invite a client to get started."
              action={{ label: 'Invite Client', onClick: onInvite }}
            />
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
                        <Button size="sm" variant="ghost" onClick={() => onViewClient(client)}>
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
   ClientDashboard — single-scroll, single-company view
   ──────────────────────────────────────────────────────────────────────────── */

function ClientDashboard({
  summary,
  healthScore,
  wizardData,
  gamification,
  companyName,
  onSwitchToFirm,
  isFirmUser,
}: {
  summary: DashboardSummary;
  healthScore: { overallScore: number; pillars: Array<{ name: string; score: number; maxScore: number }> } | null;
  wizardData: { percentage: number; completedSteps: number; totalSteps: number; nextStep: { label: string } | null; isComplete: boolean } | null;
  gamification: { score: number; level: number; xpToNextLevel: number } | null;
  companyName?: string;
  onSwitchToFirm?: () => void;
  isFirmUser: boolean;
}) {
  const navigate = useNavigate();
  const hasTransactions = summary.entries.total > 0;
  const recentEntries = summary.entries.recent?.slice(0, 5) || [];

  // Compute KPI values from monthlySummary or fall back to entries count
  const totalIncome = summary.monthlySummary?.totalIncome ?? 0;
  const totalExpenses = summary.monthlySummary?.totalExpenses ?? 0;
  const netProfit = summary.monthlySummary?.netProfit ?? (totalIncome - totalExpenses);
  const mpesaUncleaned = summary.mpesaUncleaned ?? 0;

  const welcomeMessage = hasTransactions
    ? `Welcome back! Your business is ${healthScore && healthScore.overallScore >= 70 ? 'healthy' : healthScore && healthScore.overallScore >= 40 ? 'on track' : 'needing attention'}.`
    : 'Start by importing your transactions.';

  return (
    <div className="flex flex-col gap-5">
      {/* ─── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-kenya-green-900 dark:text-kenya-green-50">📊 Dashboard</h1>
            {companyName && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-kenya-amber-100 dark:bg-kenya-amber-900/30 text-xs font-medium text-kenya-amber-700 dark:text-kenya-amber-300">
                {companyName}
              </span>
            )}
            {/* Health badge */}
            {healthScore && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${healthColor(healthScore.overallScore)} bg-opacity-10`}>
                {healthLabel(healthScore.overallScore)}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {welcomeMessage}
            {hasTransactions && <> · {summary.entries.total.toLocaleString()} entries recorded</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isFirmUser && onSwitchToFirm && (
            <Button variant="ghost" size="sm" onClick={onSwitchToFirm}>
              ← Firm Overview
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => navigate('/ledger')}>
            📒 Ledger
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/reports')}>
            📊 Reports
          </Button>
        </div>
      </div>

      {/* ─── NEW USER WELCOME ─────────────────────────────────────────── */}
      {!hasTransactions && (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon="👋"
              title="Welcome to JengaBooks"
              description="Import your M-Pesa statement or record your first transaction to get started."
              action={{ label: 'Import M-Pesa', onClick: () => navigate('/mpesa') }}
              helpLink={{ label: 'Record your first transaction →', href: '/ledger' }}
            />
            {/* Getting Started wizard — always visible even for new users */}
            {wizardData && !wizardData.isComplete && (
              <div className="max-w-sm mx-auto mt-2">
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

      {/* ─── 4 KPI CARDS ───────────────────────────────────────────────── */}
      {hasTransactions && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Income */}
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-100">
                <span className="text-lg" aria-hidden="true">💰</span>
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-green-700">{formatKES(totalIncome)}</p>
                <p className="text-xs text-gray-500">Income</p>
              </div>
            </CardContent>
          </Card>

          {/* Expenses */}
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-100">
                <span className="text-lg" aria-hidden="true">💸</span>
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-red-600">{formatKES(totalExpenses)}</p>
                <p className="text-xs text-gray-500">Expenses</p>
              </div>
            </CardContent>
          </Card>

          {/* Net Profit */}
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

          {/* M-Pesa uncleaned alert */}
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${mpesaUncleaned > 0 ? 'bg-amber-100' : 'bg-green-100'}`}>
                <span className="text-lg" aria-hidden="true">{mpesaUncleaned > 0 ? '📱' : '✅'}</span>
              </div>
              <div className="min-w-0">
                {mpesaUncleaned > 0 ? (
                  <>
                    <p className="text-lg font-bold text-amber-600">{mpesaUncleaned}</p>
                    <p className="text-xs text-gray-500">
                      <button
                        onClick={() => navigate('/mpesa')}
                        className="hover:text-kenya-green-600 underline underline-offset-2"
                      >
                        M-Pesa to map
                      </button>
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-bold text-green-700">All mapped</p>
                    <p className="text-xs text-gray-500">M-Pesa ✓</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── MONTH-END PROGRESS ─────────────────────────────────────────── */}
      {hasTransactions && wizardData && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50">
                📋 Month-End Progress
              </h3>
              <span className="text-xs font-bold text-kenya-green-600">{wizardData.percentage}%</span>
            </div>
            <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-kenya-green-500 rounded-full transition-all duration-500"
                style={{ width: `${wizardData.percentage}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-gray-500">
                {wizardData.isComplete
                  ? 'All steps complete! 🎉'
                  : `${wizardData.completedSteps} of ${wizardData.totalSteps} steps`
                }
              </p>
              {wizardData.nextStep && !wizardData.isComplete && (
                <Button size="sm" variant="ghost" onClick={() => navigate('/workflow')}>
                  {wizardData.nextStep.label} →
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── RECENT ACTIVITY ───────────────────────────────────────────── */}
      <Card>
        <div className="p-4 border-b border-kenya-green-100 dark:border-kenya-green-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50">Recent Activity</h3>
          {hasTransactions && (
            <Button variant="ghost" size="sm" onClick={() => navigate('/ledger')}>
              View All →
            </Button>
          )}
        </div>
        <CardContent className="p-0">
          {!hasTransactions ? (
            <EmptyState
              icon="📋"
              title="No transactions yet"
              description="Import an M-Pesa statement or record your first transaction to see activity here."
              action={{ label: 'Import M-Pesa', onClick: () => navigate('/mpesa') }}
            />
          ) : recentEntries.length === 0 ? (
            <EmptyState
              icon="📭"
              title="No recent activity"
              description="Recent transactions will appear here once recorded."
            />
          ) : (
            <div className="divide-y divide-kenya-green-50 dark:divide-kenya-green-900">
              {recentEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-kenya-green-50/50 dark:hover:bg-kenya-green-900/30 transition-colors"
                >
                  <span className="text-xs text-gray-400 w-16 shrink-0">
                    {new Date(entry.entryDate).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' })}
                  </span>
                  <span className="text-sm text-kenya-green-900 dark:text-kenya-green-50 flex-1 truncate min-w-0">
                    {entry.description}
                  </span>
                  <span
                    className={`text-sm font-mono font-medium shrink-0 ${
                      entry.direction === 'DEBIT' ? 'text-red-600' : 'text-green-600'
                    }`}
                  >
                    {formatKES(entry.amount)}
                  </span>
                  <Badge
                    variant={entry.direction === 'DEBIT' ? 'info' : 'success'}
                    size="sm"
                    className="shrink-0 hidden sm:inline-flex"
                  >
                    {entry.account?.code}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── XP BAR (compact) — always visible if gamification data exists ── */}
      {gamification && (
        <XPBar
          current={gamification.score}
          max={gamification.score + gamification.xpToNextLevel}
          showLevel
          className="w-full"
        />
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
   Dashboard — top-level orchestrator: FirmDashboard vs ClientDashboard
   ──────────────────────────────────────────────────────────────────────────── */

export function Dashboard() {
  const navigate = useNavigate();
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

  const [summary, setSummary] = React.useState<DashboardSummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [firmData, setFirmData] = React.useState<FirmDashboardData | null>(null);
  const [firmLoading, setFirmLoading] = React.useState(false);

  // Derived state from summary — kept as separate state to match the API shape
  const [healthScore, setHealthScore] = React.useState<{ overallScore: number; pillars: Array<{ name: string; score: number; maxScore: number }> } | null>(null);
  const [wizardData, setWizardData] = React.useState<{ percentage: number; completedSteps: number; totalSteps: number; nextStep: { label: string } | null; isComplete: boolean } | null>(null);

  // ── Fetch firm overview data ──────────────────────────────────────
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

  // ── Fetch per-company data (single call to /dashboard/summary) ────
  React.useEffect(() => {
    if (!companyId || viewMode !== 'client') return;
    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        const res = await api.get<any>('/dashboard/summary');
        if (cancelled) return;

        const newSummary: DashboardSummary = {
          entries: {
            total: res.entries?.total || 0,
            recent: res.entries?.recent || [],
          },
          monthlySummary: res.monthlySummary,
          mpesaUncleaned: res.mpesaUncleaned ?? 0,
          gamification: res.gamification
            ? {
                score: res.gamification.score,
                level: res.gamification.level,
                xpToNextLevel: res.gamification.xpToNextLevel,
              }
            : undefined,
        };
        setSummary(newSummary);

        if (res.healthScore) setHealthScore(res.healthScore);
        if (res.wizard) setWizardData(res.wizard);
      } catch (e) {
        console.error('Failed to load dashboard:', e);
      } finally {
        if (!cancelled) {
          setSummary((prev) => prev || { entries: { total: 0, recent: [] } });
          setLoading(false);
        }
      }
    }
    load();

    return () => { cancelled = true; };
  }, [companyId, viewMode]);

  const handleViewClient = async (client: FirmClient) => {
    const success = await switchCompany(client.id);
    if (success) setViewMode('client');
  };

  const handleBackToFirm = () => {
    setViewMode('firm');
  };

  const handleInviteClient = () => {
    navigate('/team');
  };

  // ── Determine what to render ──────────────────────────────────────
  const showFirmView = isFirmUser && hasMultipleCompanies && viewMode === 'firm';

  // Loading state for firm overview
  if (showFirmView && firmLoading) return <DashboardSkeleton />;

  // Firm overview (with firm data available or error)
  if (showFirmView && firmData) {
    return (
      <div className="flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-kenya-green-900 dark:text-kenya-green-50">📊 Firm Dashboard</h1>
              {user?.name && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-kenya-green-100 dark:bg-kenya-green-900/30 text-xs font-medium text-kenya-green-700 dark:text-kenya-green-300">
                  {user.name}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
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
  if (viewMode === 'client' && !summary) return <DashboardSkeleton />;

  // Per-company dashboard
  if (viewMode === 'client' && summary) {
    return (
      <ClientDashboard
        summary={summary}
        healthScore={healthScore}
        wizardData={wizardData}
        gamification={summary.gamification ?? null}
        companyName={companyName}
        onSwitchToFirm={isFirmUser && hasMultipleCompanies ? handleBackToFirm : undefined}
        isFirmUser={isFirmUser}
      />
    );
  }

  // Fallback: single-company or no-membership user → show client dashboard directly
  if (!showFirmView && viewMode === 'client') {
    return (
      <ClientDashboard
        summary={summary || { entries: { total: 0, recent: [] } }}
        healthScore={healthScore}
        wizardData={wizardData}
        gamification={summary?.gamification ?? null}
        companyName={companyName}
        isFirmUser={isFirmUser}
      />
    );
  }

  // Absolute fallback
  return <DashboardSkeleton />;
}
