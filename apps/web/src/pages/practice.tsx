import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Table } from '../components/ui/table';
import { SlideOutPanel } from '../components/ui/slide-out-panel';
import { EmptyState } from '../components/ui/empty-state';
import { PageShell } from '../components/layout/page-shell';
import { PageState } from '../components/ui/page-state';
import { HealthDot } from '../components/dashboard/health-dot';
import { showToast } from '../stores/ui-store';
import { api } from '../lib/api-client';
import { cn } from '../lib/utils';
import { Download, Search, AlertTriangle, Flag, Calendar, ArrowRight, BarChart3 } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────

interface HealthFlag {
  id: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  category: string;
  since: string;
}

interface ClientTask {
  id: string;
  description: string;
  dueDate?: string | null;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  completed: boolean;
}

interface ClientPortfolioItem {
  id: string;
  name: string;
  entityType: string;
  healthScore: number | null;
  status: 'GREEN' | 'YELLOW' | 'RED' | 'NO_DATA';
  etimsCompliance: number | null;
  unreconciledCount: number;
  bankConnected: boolean;
  lastVatFiled: string | null;
  flags: HealthFlag[];
  nextTasks: ClientTask[];
}

interface PortfolioResponse {
  items: ClientPortfolioItem[];
  total: number;
  summary: {
    total: number;
    green: number;
    yellow: number;
    red: number;
    avgHealth: number;
  };
}

interface ClientDetailResponse {
  id: string;
  name: string;
  entityType: string;
  healthScore: number | null;
  healthPillars: Array<{
    name: string;
    weight: number;
    score: number;
    maxScore: number;
    details: string;
  }>;
  flags: HealthFlag[];
  nextTasks: ClientTask[];
  etimsCompliance: number | null;
  bankConnected: boolean;
  lastVatFiled: string | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

type HealthStatus = 'GREEN' | 'YELLOW' | 'RED' | 'NO_DATA';

function getHealthStatus(score: number | null): HealthStatus {
  if (score === null) return 'NO_DATA';
  if (score >= 70) return 'GREEN';
  if (score >= 40) return 'YELLOW';
  return 'RED';
}

function statusBadgeVariant(status: HealthStatus): 'success' | 'warning' | 'error' | 'neutral' {
  switch (status) {
    case 'GREEN': return 'success';
    case 'YELLOW': return 'warning';
    case 'RED': return 'error';
    case 'NO_DATA': return 'neutral';
  }
}

function severityBadgeVariant(severity: HealthFlag['severity']): 'error' | 'warning' | 'info' {
  switch (severity) {
    case 'HIGH': return 'error';
    case 'MEDIUM': return 'warning';
    case 'LOW': return 'info';
  }
}

function formatFilterDate(date: string | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Export portfolio data as CSV and trigger browser download */
function exportCSV(items: ClientPortfolioItem[]) {
  const headers = [
    'Client Name',
    'Entity Type',
    'Health Score',
    'Status',
    'eTIMS Compliance',
    'Unreconciled Txns',
    'Bank Connected',
    'Last VAT Filed',
    'Active Flags',
  ];

  const rows = items.map((item) => [
    `"${item.name}"`,
    `"${item.entityType}"`,
    item.healthScore != null ? Math.round(item.healthScore).toString() : '—',
    item.status,
    item.etimsCompliance != null ? `${Math.round(item.etimsCompliance)}%` : '—',
    item.unreconciledCount.toString(),
    item.bankConnected ? 'Yes' : 'No',
    item.lastVatFiled ? formatFilterDate(item.lastVatFiled) : '—',
    item.flags.length.toString(),
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `practice-portfolio-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast('success', 'Export started', 'Portfolio data has been downloaded as CSV');
}

// ─── Sub-component: KPI Summary Cards ──────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: string;
  color: string;
}

function KpiCard({ label, value, icon, color }: KpiCardProps) {
  return (
    <Card className="flex-1 min-w-[140px]">
      <CardContent className="py-4 text-center">
        <p className={`text-3xl font-bold ${color}`}>{value}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          <span aria-hidden="true" className="mr-1">{icon}</span>
          {label}
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Sub-component: Status Filter Tabs ─────────────────────────────────────

interface StatusTab {
  key: string;
  label: string;
  count?: number;
}

function StatusFilterTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: StatusTab[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={active === tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            'whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            active === tab.key
              ? 'bg-kenya-green-500 text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700',
          )}
        >
          {tab.label}
          {tab.count != null && (
            <span
              className={cn(
                'ml-1.5 inline-flex items-center justify-center min-w-[20px] h-5 rounded-full px-1.5 text-xs font-semibold',
                active === tab.key
                  ? 'bg-white/20 text-white'
                  : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
              )}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Sub-component: Health Score Breakdown ─────────────────────────────────

function HealthBreakdownBar({
  label,
  score,
  maxScore,
}: {
  label: string;
  score: number;
  maxScore: number;
}) {
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const barColor =
    percentage >= 70
      ? 'bg-green-500'
      : percentage >= 40
        ? 'bg-amber-500'
        : 'bg-red-500';

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
          {Math.round(score)}/{Math.round(maxScore)}
        </span>
      </div>
      <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', barColor)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// ─── Main Page Component ───────────────────────────────────────────────────

export function PracticeHub() {
  const navigate = useNavigate();

  // Data state
  const [items, setItems] = React.useState<ClientPortfolioItem[]>([]);
  const [summary, setSummary] = React.useState<PortfolioResponse['summary'] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = React.useState<string>('ALL');
  const [searchQuery, setSearchQuery] = React.useState('');

  // Sort
  const [sortKey, setSortKey] = React.useState<string>('name');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');

  // Detail slide-out
  const [selectedClientId, setSelectedClientId] = React.useState<string | null>(null);
  const [clientDetail, setClientDetail] = React.useState<ClientDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);

  // ── Load portfolio ──────────────────────────────────────────────────────

  const loadPortfolio = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<PortfolioResponse>('/practice/portfolio');
      setItems(data.items);
      setSummary(data.summary);
    } catch (e: any) {
      console.error('Failed to load portfolio:', e);
      setError(e?.response?.data?.message || 'Failed to load portfolio data');
      showToast('error', 'Failed to load portfolio', 'Please try again');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadPortfolio();
  }, [loadPortfolio]);

  // ── Load client detail ──────────────────────────────────────────────────

  const loadClientDetail = React.useCallback(async (clientId: string) => {
    setDetailLoading(true);
    setClientDetail(null);
    try {
      const data = await api.get<ClientDetailResponse>(`/practice/portfolio/${clientId}`);
      setClientDetail(data);
    } catch (e: any) {
      console.error('Failed to load client detail:', e);
      showToast('error', 'Failed to load client details', 'Please try again');
      setSelectedClientId(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleRowClick = React.useCallback((item: ClientPortfolioItem) => {
    setSelectedClientId(item.id);
    loadClientDetail(item.id);
  }, [loadClientDetail]);

  // ── Sorting ─────────────────────────────────────────────────────────────

  const handleSort = React.useCallback((key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }, [sortKey]);

  // ── Filtered + sorted data ──────────────────────────────────────────────

  const filteredItems = React.useMemo(() => {
    let result = [...items];

    // Status filter
    if (statusFilter !== 'ALL') {
      result = result.filter((item) => item.status === statusFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((item) => item.name.toLowerCase().includes(q));
    }

    // Sort
    result.sort((a, b) => {
      let aVal: unknown;
      let bVal: unknown;

      switch (sortKey) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'healthScore':
          aVal = a.healthScore ?? -1;
          bVal = b.healthScore ?? -1;
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        case 'etimsCompliance':
          aVal = a.etimsCompliance ?? -1;
          bVal = b.etimsCompliance ?? -1;
          break;
        case 'unreconciledCount':
          aVal = a.unreconciledCount;
          bVal = b.unreconciledCount;
          break;
        case 'bankConnected':
          aVal = a.bankConnected ? 1 : 0;
          bVal = b.bankConnected ? 1 : 0;
          break;
        case 'lastVatFiled':
          aVal = a.lastVatFiled ? new Date(a.lastVatFiled).getTime() : 0;
          bVal = b.lastVatFiled ? new Date(b.lastVatFiled).getTime() : 0;
          break;
        default:
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
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
  }, [items, statusFilter, searchQuery, sortKey, sortDir]);

  // ── Tab counts ──────────────────────────────────────────────────────────

  const tabCounts = React.useMemo(() => {
    const counts: Record<string, number> = { ALL: items.length };
    for (const s of ['GREEN', 'YELLOW', 'RED'] as const) {
      counts[s] = items.filter((i) => i.status === s).length;
    }
    return counts;
  }, [items]);

  // ── Render: Loading state ───────────────────────────────────────────────

  if (loading) {
    return (
      <PageShell title="Practice Hub" subtitle="Client portfolio health overview">
        <PageState state="loading" skeletonRows={5}>
          <></>
        </PageState>
      </PageShell>
    );
  }

  // ── Render: Error state ─────────────────────────────────────────────────

  if (error) {
    return (
      <PageShell title="Practice Hub" subtitle="Client portfolio health overview">
        <PageState
          state="error"
          error={error}
          onRetry={loadPortfolio}
        >
          <></>
        </PageState>
      </PageShell>
    );
  }

  // ── Render: Empty state ─────────────────────────────────────────────────

  if (!loading && items.length === 0) {
    return (
      <PageShell title="Practice Hub" subtitle="Client portfolio health overview">
        <EmptyState
          icon="👥"
          title="No clients yet"
          description="Invite your first client to start tracking their financial health."
          action={{ label: 'Invite Clients', onClick: () => navigate('/team') }}
          helpLink={{ label: 'Learn more about Practice Hub', href: '/help/practice' }}
        />
      </PageShell>
    );
  }

  // ── Render: Data ────────────────────────────────────────────────────────

  return (
    <PageShell
      title="Practice Hub"
      subtitle="Client portfolio health overview"
      actions={
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<Download className="h-4 w-4" />}
          onClick={() => exportCSV(items)}
          disabled={items.length === 0}
        >
          Export CSV
        </Button>
      }
    >
      {/* ── KPI Summary Cards ──────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <KpiCard
          label="Total Clients"
          value={summary?.total ?? items.length}
          icon="📊"
          color="text-kenya-green-900 dark:text-kenya-green-50"
        />
        <KpiCard
          label="Healthy"
          value={summary?.green ?? items.filter((i) => i.status === 'GREEN').length}
          icon="🟢"
          color="text-green-600 dark:text-green-400"
        />
        <KpiCard
          label="Needs Attention"
          value={summary?.yellow ?? items.filter((i) => i.status === 'YELLOW').length}
          icon="🟡"
          color="text-amber-600 dark:text-amber-400"
        />
        <KpiCard
          label="Critical"
          value={summary?.red ?? items.filter((i) => i.status === 'RED').length}
          icon="🔴"
          color="text-red-600 dark:text-red-400"
        />
        <KpiCard
          label="Avg Health"
          value={summary?.avgHealth != null ? `${Math.round(summary.avgHealth)}%` : '—'}
          icon="💚"
          color={
            (summary?.avgHealth ?? 0) >= 70
              ? 'text-green-600 dark:text-green-400'
              : (summary?.avgHealth ?? 0) >= 40
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-red-600 dark:text-red-400'
          }
        />
      </div>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <StatusFilterTabs
          tabs={[
            { key: 'ALL', label: 'All', count: tabCounts.ALL },
            { key: 'GREEN', label: '🟢 Green', count: tabCounts.GREEN },
            { key: 'YELLOW', label: '🟡 Yellow', count: tabCounts.YELLOW },
            { key: 'RED', label: '🔴 Red', count: tabCounts.RED },
          ]}
          active={statusFilter}
          onChange={setStatusFilter}
        />

        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" aria-hidden="true" />
          <Input
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            aria-label="Search clients"
          />
        </div>
      </div>

      {/* ── Count indicator ─────────────────────────────────────────────── */}
      <p className="text-xs text-gray-400">
        {filteredItems.length} client{filteredItems.length !== 1 ? 's' : ''} displayed
      </p>

      {/* ── Sortable Table ──────────────────────────────────────────────── */}
      <Table
        columns={[
          {
            key: 'name',
            label: 'Client',
            sortable: true,
            render: (item: ClientPortfolioItem) => (
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {item.name}
              </span>
            ),
          },
          {
            key: 'status',
            label: 'Status',
            sortable: true,
            render: (item: ClientPortfolioItem) => {
              const hasFlags = item.flags.length > 0;
              return (
                <div className="flex items-center gap-2">
                  <HealthDot score={item.healthScore} size="md" showLabel />
                  {hasFlags && (
                    <span
                      className="text-sm"
                      title={`${item.flags.length} active flag${item.flags.length !== 1 ? 's' : ''}`}
                      aria-label={`${item.flags.length} active flags`}
                    >
                      {item.status === 'RED' ? '🔴' : '🟡'}
                    </span>
                  )}
                </div>
              );
            },
          },
          {
            key: 'healthScore',
            label: 'Health',
            sortable: true,
            render: (item: ClientPortfolioItem) => {
              if (item.healthScore == null) {
                return <span className="text-xs text-gray-400">—</span>;
              }
              const color =
                item.healthScore >= 70
                  ? 'bg-green-500'
                  : item.healthScore >= 40
                    ? 'bg-amber-500'
                    : 'bg-red-500';
              return (
                <div className="flex items-center gap-2 min-w-[100px]">
                  <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', color)}
                      style={{ width: `${Math.round(item.healthScore)}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-8 text-right">
                    {Math.round(item.healthScore)}%
                  </span>
                </div>
              );
            },
          },
          {
            key: 'etimsCompliance',
            label: 'eTIMS',
            sortable: true,
            render: (item: ClientPortfolioItem) => {
              if (item.etimsCompliance == null) {
                return <span className="text-xs text-gray-400">—</span>;
              }
              return (
                <span
                  className={cn(
                    'text-xs font-semibold',
                    item.etimsCompliance >= 70
                      ? 'text-green-600 dark:text-green-400'
                      : item.etimsCompliance >= 40
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-red-600 dark:text-red-400',
                  )}
                >
                  {Math.round(item.etimsCompliance)}%
                </span>
              );
            },
          },
          {
            key: 'unreconciledCount',
            label: 'Unrec.',
            sortable: true,
            className: 'text-center',
            render: (item: ClientPortfolioItem) => (
              <span
                className={cn(
                  'text-sm font-medium',
                  item.unreconciledCount > 10
                    ? 'text-red-600 dark:text-red-400'
                    : item.unreconciledCount > 0
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-green-600 dark:text-green-400',
                )}
              >
                {item.unreconciledCount}
              </span>
            ),
          },
          {
            key: 'bankConnected',
            label: 'Bank',
            sortable: true,
            className: 'text-center',
            render: (item: ClientPortfolioItem) => (
              <span className="text-lg" aria-label={item.bankConnected ? 'Bank connected' : 'Bank not connected'}>
                {item.bankConnected ? '✅' : '❌'}
              </span>
            ),
          },
          {
            key: 'lastVatFiled',
            label: 'VAT',
            sortable: true,
            render: (item: ClientPortfolioItem) => (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatFilterDate(item.lastVatFiled)}
              </span>
            ),
          },
          {
            key: 'action',
            label: 'Action',
            sortable: false,
            className: 'text-right',
            render: (_item: ClientPortfolioItem) => (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-kenya-green-600 dark:text-kenya-green-400">
                View <ArrowRight className="h-3 w-3" />
              </span>
            ),
          },
        ]}
        data={filteredItems}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        onRowClick={handleRowClick}
        rowKey={(item: ClientPortfolioItem) => item.id}
        emptyMessage="No clients match the current filters"
      />

      {/* ── Client Detail Slide-Out Panel ──────────────────────────────── */}
      <SlideOutPanel
        isOpen={selectedClientId !== null}
        onClose={() => {
          setSelectedClientId(null);
          setClientDetail(null);
        }}
        title={clientDetail?.name ?? 'Client Details'}
        subtitle={clientDetail ? clientDetail.entityType : undefined}
        footer={
          clientDetail ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  className="flex-1"
                  leftIcon={<BarChart3 className="h-4 w-4" />}
                  onClick={() => {
                    navigate(`/dashboard?clientId=${clientDetail.id}`);
                    setSelectedClientId(null);
                    setClientDetail(null);
                  }}
                >
                  View Dashboard
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  leftIcon={<Flag className="h-4 w-4" />}
                  onClick={() => {
                    navigate(`/etims?clientId=${clientDetail.id}`);
                    setSelectedClientId(null);
                    setClientDetail(null);
                  }}
                >
                  View eTIMS
                </Button>
              </div>
            </div>
          ) : null
        }
      >
        {detailLoading ? (
          <div className="flex flex-col gap-4 py-8">
            <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-20 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-4" />
            <div className="h-20 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        ) : clientDetail ? (
          <div className="flex flex-col gap-6">
            {/* Health Score Overview */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50">
                  Health Score
                </h4>
                <span
                  className={cn(
                    'text-2xl font-bold',
                    (clientDetail.healthScore ?? 0) >= 70
                      ? 'text-green-600 dark:text-green-400'
                      : (clientDetail.healthScore ?? 0) >= 40
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-red-600 dark:text-red-400',
                  )}
                >
                  {clientDetail.healthScore != null ? `${Math.round(clientDetail.healthScore)}%` : '—'}
                </span>
              </div>

              {/* Health breakdown bars */}
              {clientDetail.healthPillars.length > 0 && (
                <div className="flex flex-col gap-3">
                  {clientDetail.healthPillars.map((pillar) => (
                    <HealthBreakdownBar
                      key={pillar.name}
                      label={pillar.name}
                      score={pillar.score}
                      maxScore={pillar.maxScore}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Flags List */}
            {clientDetail.flags.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50 mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
                  Flags ({clientDetail.flags.length})
                </h4>
                <div className="flex flex-col gap-2">
                  {clientDetail.flags.map((flag) => (
                    <div
                      key={flag.id}
                      className="rounded-lg border border-gray-200 dark:border-gray-700 p-3"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <Badge variant={severityBadgeVariant(flag.severity)} size="sm">
                          {flag.severity}
                        </Badge>
                        <span className="text-xs text-gray-400 shrink-0">
                          <Calendar className="h-3 w-3 inline mr-0.5" aria-hidden="true" />
                          {formatFilterDate(flag.since)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                        {flag.message}
                      </p>
                      {flag.category && (
                        <span className="text-xs text-gray-400 mt-1 block">
                          {flag.category.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {clientDetail.flags.length === 0 && (
              <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-4 text-center">
                <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                  ✅ No active flags — all clear
                </p>
              </div>
            )}

            {/* Next Tasks */}
            {clientDetail.nextTasks.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50 mb-2">
                  Next Tasks
                </h4>
                <div className="flex flex-col gap-2">
                  {clientDetail.nextTasks.map((task) => (
                    <div
                      key={task.id}
                      className={cn(
                        'flex items-start gap-3 rounded-lg border p-3',
                        task.completed
                          ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-900/10'
                          : 'border-gray-200 dark:border-gray-700',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 h-4 w-4 rounded-full border-2 shrink-0',
                          task.completed
                            ? 'bg-green-500 border-green-500'
                            : task.priority === 'HIGH'
                              ? 'border-red-400'
                              : task.priority === 'MEDIUM'
                                ? 'border-amber-400'
                                : 'border-gray-400',
                        )}
                        aria-hidden="true"
                      >
                        {task.completed && (
                          <span className="flex items-center justify-center text-[10px] text-white">✓</span>
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            'text-sm',
                            task.completed
                              ? 'text-gray-400 line-through'
                              : 'text-gray-700 dark:text-gray-300',
                          )}
                        >
                          {task.description}
                        </p>
                        {task.dueDate && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            Due {formatFilterDate(task.dueDate)}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant={
                          task.priority === 'HIGH'
                            ? 'error'
                            : task.priority === 'MEDIUM'
                              ? 'warning'
                              : 'info'
                        }
                        size="sm"
                      >
                        {task.priority}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {clientDetail.nextTasks.length === 0 && (
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No pending tasks
                </p>
              </div>
            )}
          </div>
        ) : null}
      </SlideOutPanel>
    </PageShell>
  );
}
