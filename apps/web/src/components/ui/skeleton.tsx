import { cn } from '../../lib/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'card' | 'table-row' | 'avatar' | 'chart';
}

/**
 * Skeleton loading placeholders with shimmer animation
 */
export function Skeleton({ className, variant = 'text' }: SkeletonProps) {
  const variantClasses = {
    text: 'h-4 w-full rounded',
    card: 'h-32 w-full rounded-xl',
    'table-row': 'h-12 w-full rounded',
    avatar: 'h-10 w-10 rounded-full',
    chart: 'h-48 w-full rounded-xl',
  };

  return (
    <div
      className={cn(
        'animate-pulse bg-kenya-green-100 dark:bg-kenya-green-800',
        variantClasses[variant],
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

/**
 * A full page skeleton layout matching the app's grid structure
 */
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} variant="card" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Skeleton variant="chart" />
        </div>
        <div className="flex flex-col gap-6">
          <Skeleton variant="card" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
      <Skeleton variant="card" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-10 w-full rounded-lg" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} variant="table-row" />
      ))}
    </div>
  );
}
