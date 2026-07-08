import React from 'react';
import { clsx } from 'clsx';

type XPBarVariant = 'default' | 'compact' | 'inline';

interface XPBarProps {
  current: number;
  max: number;
  label?: string;
  showLevel?: boolean;
  className?: string;
  variant?: XPBarVariant;
}

export function XPBar({
  current,
  max,
  label,
  showLevel = true,
  className,
  variant = 'default',
}: XPBarProps) {
  // Edge case: inline variant with no gamification data → render nothing
  if (variant === 'inline' && current <= 0) {
    return null;
  }

  const level = Math.floor(current / 1000) + 1;
  const xpInLevel = current % 1000;
  const xpToNextLevel = 1000;
  const percentage = Math.min(Math.round((xpInLevel / xpToNextLevel) * 100), 100);

  // ── Inline variant: level number only, tooltip on hover ─────────────
  if (variant === 'inline') {
    return (
      <div className={clsx('group relative inline-flex items-center', className)}>
        <span className="text-xs font-bold text-kenya-amber-500 cursor-help">
          Lv.{level}
        </span>
        {/* Tooltip */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
          {xpInLevel}/{xpToNextLevel} XP
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
        </div>
      </div>
    );
  }

  // ── Compact variant: level number + thin bar (4px), no XP text ─────
  if (variant === 'compact') {
    return (
      <div className={clsx('flex flex-col gap-0.5', className)}>
        {label && (
          <span className="text-xs font-medium text-kenya-green-700 dark:text-kenya-green-300">
            {label}
          </span>
        )}
        <div className="flex items-center gap-2">
          {showLevel && (
            <span className="text-xs font-bold text-kenya-amber-500 min-w-[2rem]">
              Lv.{level}
            </span>
          )}
          <div className="flex-1 h-1 rounded-full bg-kenya-green-100 dark:bg-kenya-green-900 overflow-hidden">
            <div
              className="bg-gradient-to-r from-kenya-green-500 to-kenya-amber-500 h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Default variant: full XP bar (original behavior) ───────────────
  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      {label && (
        <span className="text-xs font-medium text-kenya-green-700 dark:text-kenya-green-300">
          {label}
        </span>
      )}
      <div className="flex items-center gap-2">
        {showLevel && (
          <span className="text-xs font-bold text-kenya-amber-500 min-w-[2rem]">
            Lv.{level}
          </span>
        )}
        <div className="flex-1 h-3 rounded-full bg-kenya-green-100 dark:bg-kenya-green-900 overflow-hidden">
          <div
            className="bg-gradient-to-r from-kenya-green-500 to-kenya-amber-500 h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-xs font-medium text-kenya-green-700 dark:text-kenya-green-300 min-w-[4rem] text-right">
          {xpInLevel}/{xpToNextLevel} XP
        </span>
      </div>
    </div>
  );
}
