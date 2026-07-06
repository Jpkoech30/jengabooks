import React, { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { Search, ChevronDown, X } from 'lucide-react';

interface SearchableOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  label?: string;
  options: SearchableOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
  error?: string;
  disabled?: boolean;
}

export function SearchableSelect({
  label, options, value, onChange, placeholder = 'Search...',
  loading, error, disabled,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = options.find((o) => o.value === value);

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setIsOpen(false);
    if (e.key === 'Enter' && filtered.length === 1 && filtered[0]) {
      onChange(filtered[0].value);
      setIsOpen(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => { if (!disabled) setIsOpen(!isOpen); }}
          disabled={disabled}
          className={clsx(
            'w-full flex items-center gap-2 px-4 py-3 rounded-lg border bg-white text-left text-base',
            'focus:outline-none focus:ring-2 focus:ring-kenya-green-500 transition-all duration-200',
            'dark:bg-surface-dark dark:text-gray-100 min-h-[48px]',
            'disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60',
            error ? 'border-kenya-red-500' : 'border-gray-300 dark:border-gray-700',
          )}
        >
          <Search className="h-4 w-4 text-gray-400 shrink-0" />
          <span className={clsx('flex-1', !selected && 'text-gray-400')}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown className={clsx('h-4 w-4 text-gray-400 transition-transform', isOpen && 'rotate-180')} />
        </button>

        {isOpen && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark shadow-lg">
            <div className="p-2 border-b border-gray-100 dark:border-gray-800">
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type to search..."
                className="w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-1 focus:ring-kenya-green-500"
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-sm text-gray-400">Loading...</div>
              ) : filtered.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-400">No results found</div>
              ) : (
                filtered.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { onChange(opt.value); setIsOpen(false); setSearch(''); }}
                    className={clsx(
                      'w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors',
                      opt.value === value && 'bg-kenya-green-50 dark:bg-kenya-green-900/20 font-medium text-kenya-green-700 dark:text-kenya-green-300',
                    )}
                  >
                    {opt.value === value && <span className="text-kenya-green-500">✓</span>}
                    <span className={opt.value === value ? '' : 'pl-5'}>{opt.label}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
      {error && <p className="mt-1.5 text-sm text-kenya-red-500" role="alert">{error}</p>}
    </div>
  );
}
