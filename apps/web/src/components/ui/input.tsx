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
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={clsx(
          'w-full px-4 py-3 rounded-lg border bg-white text-gray-900 placeholder-gray-400',
          'focus:outline-none focus:ring-2 transition-all duration-200',
          'dark:bg-surface-dark dark:text-gray-100 dark:placeholder-gray-500',
          'disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60',
          'min-h-[48px] text-base',
          {
            'border-gray-300 focus:border-kenya-green-500 focus:ring-kenya-green-500 dark:border-gray-700 dark:focus:ring-kenya-green-400': !error,
            'border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-400': error,
          },
          className,
        )}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="mt-1.5 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p id={`${inputId}-helper`} className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
          {helperText}
        </p>
      )}
    </div>
  );
}
