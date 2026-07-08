import { cn } from '../../lib/utils';

interface HealthDotProps {
  score: number | null;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'h-2.5 w-2.5',
  md: 'h-3.5 w-3.5',
  lg: 'h-5 w-5',
};

function healthColor(score: number | null): string {
  if (score === null) return 'bg-gray-300 dark:bg-gray-600';
  if (score >= 70) return 'bg-green-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-red-500';
}

function healthLabel(score: number | null): string {
  if (score === null) return 'No data';
  if (score >= 70) return 'Healthy';
  if (score >= 40) return 'Needs Attention';
  return 'Critical';
}

/**
 * Colored dot indicator replacing expensive inline SVG gauges.
 * 🟢 >= 70  🟡 >= 40  🔴 < 40  ⚪ null
 */
export function HealthDot({ score, size = 'md', showLabel = false, className }: HealthDotProps) {
  return (
    <span
      className={cn('inline-flex items-center gap-1.5', className)}
      title={score !== null ? `${healthLabel(score)} (${Math.round(score)}%)` : healthLabel(score)}
    >
      <span
        className={cn(
          'inline-block rounded-full shrink-0',
          sizeClasses[size],
          healthColor(score),
        )}
        aria-hidden="true"
      />
      {showLabel && score !== null && (
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
          {Math.round(score)}%
        </span>
      )}
      {showLabel && score === null && (
        <span className="text-xs text-gray-400">—</span>
      )}
    </span>
  );
}
