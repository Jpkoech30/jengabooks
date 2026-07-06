import React from 'react';
import { clsx } from 'clsx';

interface ToggleProps {
  label?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
}

export function Toggle({ label, checked, onChange, disabled, id }: ToggleProps) {
  const toggleId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <label
      htmlFor={toggleId}
      className={clsx(
        'inline-flex items-center gap-3 cursor-pointer',
        disabled && 'opacity-60 cursor-not-allowed',
      )}
    >
      <button
        id={toggleId}
        role="switch"
        type="button"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={clsx(
          'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full',
          'border-2 border-transparent transition-colors duration-200 ease-in-out',
          'focus:outline-none focus:ring-2 focus:ring-kenya-green-500 focus:ring-offset-2',
          checked ? 'bg-kenya-green-500' : 'bg-gray-300 dark:bg-gray-600',
        )}
      >
        <span
          className={clsx(
            'pointer-events-none inline-block h-5 w-5 transform rounded-full',
            'bg-white shadow ring-0 transition duration-200 ease-in-out',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
      {label && (
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 select-none">
          {label}
        </span>
      )}
    </label>
  );
}
