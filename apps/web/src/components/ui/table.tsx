import React from 'react';
import { clsx } from 'clsx';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  onRowClick?: (item: T) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  error?: string;
  rowKey: (item: T) => string;
}

export function Table<T extends Record<string, any>>({
  columns, data, sortKey, sortDir, onSort, onRowClick,
  isLoading, emptyMessage = 'No data found', error, rowKey,
}: TableProps<T>) {
  if (error) {
    return (
      <div className="w-full rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 p-8 text-center">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-4">
            {columns.map((col) => (
              <div key={col.key} className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse flex-1" />
            ))}
          </div>
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-4 px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
            {columns.map((col) => (
              <div key={col.key} className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse flex-1" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark p-12 text-center">
        <p className="text-3xl mb-2">📄</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={clsx(
                  'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400',
                  col.sortable && 'cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none',
                  col.className,
                )}
                onClick={() => col.sortable && onSort?.(col.key)}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {col.sortable && (
                    sortKey === col.key ? (
                      sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronsUpDown className="h-3 w-3 text-gray-300 dark:text-gray-600" />
                    )
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr
              key={rowKey(item)}
              onClick={() => onRowClick?.(item)}
              className={clsx(
                'border-b border-gray-200 dark:border-gray-700 last:border-0',
                'hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors duration-150',
                onRowClick && 'cursor-pointer',
              )}
            >
              {columns.map((col) => (
                <td key={col.key} className={clsx('px-4 py-3 text-sm text-gray-900 dark:text-gray-100', col.className)}>
                  {col.render ? col.render(item) : item[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
