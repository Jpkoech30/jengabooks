import React from 'react';
import { Button } from './button';
import { Skeleton, TableSkeleton } from './skeleton';
import { EmptyState } from './empty-state';
import { cn } from '../../lib/utils';

type PageStateVariant = 'loading' | 'error' | 'empty' | 'ready';

interface PageStateProps {
  state: PageStateVariant;
  /** Number of skeleton rows (loading only) */
  skeletonRows?: number;
  /** Error message (error only) */
  error?: string;
  /** Retry callback (error only) */
  onRetry?: () => void;
  /** Empty state icon */
  icon?: string;
  /** Empty state title */
  title?: string;
  /** Empty state description */
  description?: string;
  /** Empty state action button */
  action?: { label: string; onClick: () => void };
  /** Content to render when state is 'ready' */
  children: React.ReactNode;
  className?: string;
}

/**
 * Unified page state wrapper that handles loading, error, empty, and ready states.
 * Replaces ad-hoc `<p>Loading...</p>` and raw empty state divs across all pages.
 */
export function PageState({
  state,
  skeletonRows = 5,
  error,
  onRetry,
  icon,
  title,
  description,
  action,
  children,
  className,
}: PageStateProps) {
  if (state === 'loading') {
    return (
      <div className={cn('py-4', className)} role="status" aria-label="Loading">
        <TableSkeleton rows={skeletonRows} />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)} role="alert">
        <p className="text-3xl mb-3" aria-hidden="true">⚠️</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-md">
          {error || 'Something went wrong. Please try again.'}
        </p>
        {onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Try Again
          </Button>
        )}
      </div>
    );
  }

  if (state === 'empty') {
    return (
      <div className={cn('py-4', className)}>
        <EmptyState
          icon={icon || '📋'}
          title={title || 'No data found'}
          description={description || 'There are no items to display.'}
          action={action}
        />
      </div>
    );
  }

  // state === 'ready'
  return <>{children}</>;
}
