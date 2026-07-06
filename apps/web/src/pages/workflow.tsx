import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { api } from '../lib/api-client';

interface PhaseData {
  id: string;
  label: string;
  icon: string;
  status: 'complete' | 'in_progress' | 'pending';
  details: string;
  actionUrl: string | undefined;
}

interface WorkflowData {
  overallProgress: number;
  phases: PhaseData[];
  currentPhase: string | undefined;
}

const PHASE_ORDER = ['data-collection', 'categorization', 'reconciliation', 'adjustments', 'reporting'];

export function Workflow() {
  const navigate = useNavigate();
  const [data, setData] = React.useState<WorkflowData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function load() {
      try {
        // Fetch real data to determine workflow state
        const [entries, trialBalance, hitlItems, healthScore] = await Promise.all([
          api.get<any>('/ledger/entries?limit=1').catch(() => ({ total: 0 })),
          api.get<any>('/ledger/trial-balance').catch(() => null),
          api.get<any>('/hitl').catch(() => ({ items: [], total: 0 })),
          api.get<any>('/health-score').catch(() => null),
        ]);

        const hasEntries = entries.total > 0;
        const isBalanced = trialBalance?.balanced ?? false;
        const pendingHitl = (hitlItems as any)?.items?.filter((i: any) => i.status === 'PENDING').length || 0;

        const phases: PhaseData[] = [
          {
            id: 'data-collection',
            label: 'Data Collection',
            icon: '📤',
            status: hasEntries ? 'complete' : 'pending',
            details: hasEntries ? `${entries.total} entries imported` : 'Upload M-Pesa or bank statements',
            actionUrl: '/mpesa',
          },
          {
            id: 'categorization',
            label: 'Categorization',
            icon: '🏷️',
            status: hasEntries && isBalanced ? 'complete' : hasEntries ? 'in_progress' : 'pending',
            details: hasEntries ? (isBalanced ? 'All categorized ✓' : `${pendingHitl} items need review`) : 'Waiting for data',
            actionUrl: hasEntries ? '/ledger' : undefined,
          },
          {
            id: 'reconciliation',
            label: 'Reconciliation',
            icon: '🔄',
            status: isBalanced && pendingHitl === 0 ? 'complete' : isBalanced ? 'in_progress' : 'pending',
            details: pendingHitl === 0 ? 'All matched ✓' : `${pendingHitl} items to resolve`,
            actionUrl: '/hitl',
          },
          {
            id: 'adjustments',
            label: 'Month-End Close',
            icon: '🔒',
            status: isBalanced && pendingHitl === 0 && healthScore ? 'in_progress' : 'pending',
            details: healthScore ? 'Ready for lockdown' : 'Complete previous steps first',
            actionUrl: '/ledger',
          },
          {
            id: 'reporting',
            label: 'Reporting',
            icon: '📊',
            status: healthScore ? 'in_progress' : 'pending',
            details: 'Generate P&L, Balance Sheet, and Cash Flow',
            actionUrl: '/reports',
          },
        ];

        const completed = phases.filter(p => p.status === 'complete').length;
        setData({
          overallProgress: Math.round((completed / 5) * 100),
          phases,
          currentPhase: phases.find(p => p.status === 'in_progress' || p.status === 'pending')?.id,
        });
      } catch {
        // Fallback
        setData({
          overallProgress: 0,
          phases: PHASE_ORDER.map(id => ({
            id, label: id, icon: '📋', status: 'pending' as const,
          })),
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div className="flex justify-center py-12"><p className="text-gray-500">Loading workflow...</p></div>;
  }

  const statusColors = {
    complete: 'border-l-green-500 bg-green-50 dark:bg-green-900/20',
    in_progress: 'border-l-amber-500 bg-amber-50 dark:bg-amber-900/20',
    pending: 'border-l-gray-300 bg-gray-50 dark:bg-gray-800/30',
  };

  const statusIcons = {
    complete: '✅',
    in_progress: '⏳',
    pending: '⏸️',
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-kenya-green-900 dark:text-kenya-green-50">
            Monthly Workflow
          </h1>
          <p className="text-sm text-gray-500">Track your bookkeeping progress month by month</p>
        </div>
      </div>

      {/* Overall Progress */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50">
              Overall Progress
            </h2>
            <span className={`text-lg font-bold ${
              data!.overallProgress === 100 ? 'text-green-600' :
              data!.overallProgress > 0 ? 'text-amber-600' : 'text-gray-400'
            }`}>
              {data!.overallProgress}%
            </span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                data!.overallProgress === 100 ? 'bg-green-500' : 'bg-kenya-green-500'
              }`}
              style={{ width: `${data!.overallProgress}%` }}
            />
          </div>
          {data!.currentPhase && (
            <p className="text-xs text-gray-500 mt-2">
              Next: {data!.phases.find(p => p.id === data!.currentPhase)?.label}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Phase List */}
      <div className="flex flex-col gap-3">
        {data!.phases.map((phase) => (
          <div
            key={phase.id}
            className={`rounded-xl border border-l-4 p-4 transition-all ${statusColors[phase.status]} ${
              phase.actionUrl ? 'cursor-pointer hover:shadow-md' : ''
            }`}
            onClick={() => phase.actionUrl && navigate(phase.actionUrl)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{phase.icon}</span>
                <div>
                  <h3 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50">
                    {phase.label}
                  </h3>
                  {phase.details && (
                    <p className="text-xs text-gray-500 mt-0.5">{phase.details}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">{statusIcons[phase.status]}</span>
                {phase.actionUrl && (
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(phase.actionUrl!); }}>
                    View →
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
