import React from 'react';
import { clsx } from 'clsx';
import { ChevronDown } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export function Select({
  label,
  error,
  options,
  placeholder = 'Select an option',
  className,
  id,
  value,
  ...props
}: SelectProps) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          value={value}
          className={clsx(
            'w-full px-4 py-3 rounded-lg border bg-white text-gray-900 appearance-none',
            'focus:outline-none focus:ring-2 transition-all duration-200',
            'dark:bg-surface-dark dark:text-gray-100',
            'disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60',
            'min-h-[48px] text-base pr-10',
            {
              'border-gray-300 focus:border-kenya-green-500 focus:ring-kenya-green-500 dark:border-gray-700 dark:focus:ring-kenya-green-400': !error,
              'border-red-500 focus:border-red-500 focus:ring-red-500': error,
            },
            className,
          )}
          aria-invalid={error ? 'true' : undefined}
          {...props}
        >
          <option value="" disabled>{placeholder}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          <ChevronDown className="h-4 w-4 text-gray-400 dark:text-gray-500" />
        </div>
      </div>
      {error && (
        <p className="mt-1.5 text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>
      )}
    </div>
  );
}
