import React from 'react';
import { clsx } from 'clsx';

interface BadgeProps {
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  size?: 'sm' | 'md';
  className?: string;
  children: React.ReactNode;
}

export function Badge({ variant = 'neutral', size = 'md', className, children }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium',
        {
          'bg-green-100 text-emerald-600 dark:bg-green-900/30 dark:text-emerald-400': variant === 'success',
          'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400': variant === 'warning',
          'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400': variant === 'error',
          'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400': variant === 'info',
          'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400': variant === 'neutral',
        },
        {
          'px-2 py-0.5': size === 'sm',
          'px-3 py-1': size === 'md',
        },
        className,
      )}
    >
      {children}
    </span>
  );
}
