import React, { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';

interface Activity {
  id: string;
  agent: string;
  action: string;
  status: 'pending' | 'success' | 'error';
  timestamp: Date;
}

const agentIcons: Record<string, string> = {
  'Reconciliation': '🔄',
  'Fraud Detection': '🔍',
  'Compliance': '🛡️',
  'Advisory': '💡',
  'HITL Resolution': '🤝',
};

const initialActivities: Activity[] = [
  { id: '1', agent: 'Reconciliation', action: 'Matched 24 of 27 transactions', status: 'success', timestamp: new Date(Date.now() - 1000 * 30) },
  { id: '2', agent: 'Fraud Detection', action: 'Flagged 2 suspicious payments', status: 'error', timestamp: new Date(Date.now() - 1000 * 60) },
  { id: '3', agent: 'Compliance', action: 'eTIMS validation passed for 15 invoices', status: 'success', timestamp: new Date(Date.now() - 1000 * 120) },
  { id: '4', agent: 'Advisory', action: 'Cash flow alert: 90-day projection', status: 'success', timestamp: new Date(Date.now() - 1000 * 180) },
  { id: '5', agent: 'HITL Resolution', action: 'Reviewing reconciliation discrepancy', status: 'pending', timestamp: new Date(Date.now() - 1000 * 240) },
];

export function AiActivityFeed() {
  const [activities, setActivities] = useState<Activity[]>(initialActivities);

  useEffect(() => {
    // Simulate WebSocket updates
    const interval = setInterval(() => {
      const newActivity: Activity = {
        id: Date.now().toString(),
        agent: ['Reconciliation', 'Fraud Detection', 'Compliance', 'Advisory'][Math.floor(Math.random() * 4)],
        action: [
          'Processing batch reconciliation...',
          'Analyzing transaction patterns...',
          'Validating eTIMS compliance...',
          'Generating financial insights...',
        ][Math.floor(Math.random() * 4)],
        status: ['pending', 'success', 'error'][Math.floor(Math.random() * 3)] as Activity['status'],
        timestamp: new Date(),
      };
      setActivities((prev) => [newActivity, ...prev].slice(0, 20));
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  const timeAgo = (date: Date): string => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Activity Feed</CardTitle>
        <span className="flex h-6 items-center rounded-full bg-kenya-green-100 px-2 text-xs font-medium text-kenya-green-700 dark:bg-kenya-green-900 dark:text-kenya-green-300">
          Live
        </span>
      </CardHeader>
      <CardContent>
        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
            >
              <span className="text-lg mt-0.5" aria-hidden="true">
                {agentIcons[activity.agent] || '🤖'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-kenya-green-900 dark:text-kenya-green-50">
                    {activity.agent}
                  </span>
                  <span className={clsx('h-2 w-2 rounded-full shrink-0', {
                    'bg-kenya-amber-500 animate-pulse': activity.status === 'pending',
                    'bg-kenya-green-500': activity.status === 'success',
                    'bg-kenya-red': activity.status === 'error',
                  })} />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                  {activity.action}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {timeAgo(activity.timestamp)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
