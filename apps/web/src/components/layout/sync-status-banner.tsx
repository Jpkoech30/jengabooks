import React from 'react';
import { clsx } from 'clsx';

type SyncStatus = 'live' | 'syncing' | 'offline';

interface SyncStatusBannerProps {
  status?: SyncStatus;
  lastSynced?: string;
}

const statusConfig: Record<SyncStatus, { label: string; bgClass: string; dotClass: string }> = {
  live: {
    label: 'Live',
    bgClass: 'bg-kenya-green-500',
    dotClass: 'bg-green-300',
  },
  syncing: {
    label: 'Syncing...',
    bgClass: 'bg-kenya-amber-500',
    dotClass: 'bg-amber-200',
  },
  offline: {
    label: 'Offline',
    bgClass: 'bg-kenya-red',
    dotClass: 'bg-red-300',
  },
};

export function SyncStatusBanner({ status = 'live', lastSynced }: SyncStatusBannerProps) {
  const config = statusConfig[status];

  return (
    <div className={clsx('flex items-center justify-between px-6 py-1.5 text-xs font-medium text-white', config.bgClass)}>
      <div className="flex items-center gap-2">
        <span className={clsx('h-2 w-2 rounded-full', config.dotClass)} />
        <span>{config.label}</span>
      </div>
      {lastSynced && (
        <span className="opacity-80">
          Last synced: {lastSynced}
        </span>
      )}
      {!lastSynced && status === 'live' && (
        <span className="opacity-80">
          All systems operational
        </span>
      )}
      {status === 'syncing' && (
        <span className="opacity-80 animate-pulse">
          Pulling latest changes...
        </span>
      )}
    </div>
  );
}
