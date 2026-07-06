import React from 'react';
import { clsx } from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function Input({ label, error, helperText, className, id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-kenya-green-900 dark:text-kenya-green-50">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={clsx(
          'touch-target h-12 rounded-lg border px-4 text-base transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kenya-green-500',
          'placeholder:text-gray-400 dark:placeholder:text-gray-500',
          {
            'border-kenya-green-200 bg-white dark:border-kenya-green-700 dark:bg-kenya-surface-dark': !error,
            'border-kenya-red bg-red-50 dark:bg-red-900/20': error,
          },
          className,
        )}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-sm text-kenya-red" role="alert">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p id={`${inputId}-helper`} className="text-sm text-gray-500 dark:text-gray-400">
          {helperText}
        </p>
      )}
    </div>
  );
}
