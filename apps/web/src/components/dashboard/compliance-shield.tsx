import React from 'react';
import { clsx } from 'clsx';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';

type ComplianceLevel = 'good' | 'warning' | 'critical';

interface ComplianceShieldProps {
  level?: ComplianceLevel;
  score?: number;
  lastCheck?: string;
}

const shieldConfig: Record<ComplianceLevel, { color: string; bgClass: string; textClass: string; label: string }> = {
  good: {
    color: '#0A5C36',
    bgClass: 'bg-kenya-green-50 dark:bg-kenya-green-900/30',
    textClass: 'text-kenya-green-700 dark:text-kenya-green-300',
    label: 'Compliant',
  },
  warning: {
    color: '#E8A317',
    bgClass: 'bg-kenya-amber-50 dark:bg-kenya-amber-900/30',
    textClass: 'text-kenya-amber-700 dark:text-kenya-amber-300',
    label: 'Attention Needed',
  },
  critical: {
    color: '#BB1E10',
    bgClass: 'bg-red-50 dark:bg-red-900/30',
    textClass: 'text-red-700 dark:text-red-300',
    label: 'Non-Compliant',
  },
};

export function ComplianceShield({ level = 'good', score = 87, lastCheck = '2 mins ago' }: ComplianceShieldProps) {
  const config = shieldConfig[level];

  return (
    <Card>
      <CardHeader>
        <CardTitle>eTIMS Compliance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={clsx('flex flex-col items-center rounded-xl p-6 text-center', config.bgClass)}>
          {/* Shield SVG Icon */}
          <svg
            width="64"
            height="72"
            viewBox="0 0 64 72"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="mb-3"
          >
            <path
              d="M32 2L4 14V32C4 48.4 16.4 63.2 32 68C47.6 63.2 60 48.4 60 32V14L32 2Z"
              fill={config.color}
              fillOpacity="0.15"
              stroke={config.color}
              strokeWidth="2"
            />
            <path
              d="M24 36L30 42L42 28"
              stroke={config.color}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <p className={clsx('text-lg font-bold', config.textClass)}>
            {score}%
          </p>
          <p className={clsx('text-sm font-medium', config.textClass)}>
            {config.label}
          </p>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Last checked: {lastCheck}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-center text-sm">
          <div className="rounded-lg bg-kenya-green-50 p-3 dark:bg-kenya-green-900/30">
            <p className="text-lg font-bold text-kenya-green-700 dark:text-kenya-green-300">12</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Invoices</p>
          </div>
          <div className="rounded-lg bg-kenya-amber-50 p-3 dark:bg-kenya-amber-900/30">
            <p className="text-lg font-bold text-kenya-amber-700 dark:text-kenya-amber-300">3</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Pending</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
