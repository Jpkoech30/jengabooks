import React from 'react';
import { clsx } from 'clsx';

interface XPBarProps {
  current: number;
  max: number;
  label?: string;
  showLevel?: boolean;
  className?: string;
}

export function XPBar({ current, max, label, showLevel = true, className }: XPBarProps) {
  const percentage = Math.min(Math.round((current / max) * 100), 100);
  const level = Math.floor(current / 1000) + 1;
  const xpInLevel = current % 1000;
  const xpToNextLevel = 1000;

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
            className="xp-bar-gradient h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${(xpInLevel / xpToNextLevel) * 100}%`,
              '--xp-target': `${(xpInLevel / xpToNextLevel) * 100}%`,
            } as React.CSSProperties}
          />
        </div>
        <span className="text-xs font-medium text-kenya-green-700 dark:text-kenya-green-300 min-w-[4rem] text-right">
          {xpInLevel}/{xpToNextLevel} XP
        </span>
      </div>
    </div>
  );
}
