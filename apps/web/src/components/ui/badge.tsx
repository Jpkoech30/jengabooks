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
        'inline-flex items-center rounded-full font-medium',
        {
          'bg-kenya-green-100 text-kenya-green-800 dark:bg-kenya-green-900 dark:text-kenya-green-200': variant === 'success',
          'bg-kenya-amber-100 text-kenya-amber-800 dark:bg-kenya-amber-900 dark:text-kenya-amber-200': variant === 'warning',
          'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200': variant === 'error',
          'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200': variant === 'info',
          'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200': variant === 'neutral',
        },
        {
          'h-6 px-2 text-xs': size === 'sm',
          'h-8 px-3 text-sm': size === 'md',
        },
        className,
      )}
    >
      {children}
    </span>
  );
}
