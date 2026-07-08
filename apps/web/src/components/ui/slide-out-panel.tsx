import React, { useEffect, useRef, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { X } from 'lucide-react';

interface SlideOutPanelProps {
  /** Whether the panel is open */
  isOpen: boolean;
  /** Called when the panel should close (backdrop click, Escape, close button) */
  onClose: () => void;
  /** Panel heading text */
  title: string;
  /** Optional subtitle shown below the title */
  subtitle?: string;
  /** Body content */
  children: React.ReactNode;
  /** Optional sticky footer */
  footer?: React.ReactNode;
  /** Additional classes for the panel container */
  className?: string;
}

/**
 * SlideOutPanel — slides in from the right, overlays at 40% width on desktop / 100% on mobile.
 *
 * Features:
 * - Close on backdrop click
 * - Close on Escape key
 * - Focus trap inside panel
 * - 48px minimum touch targets
 * - CSS transition animation (translate-x)
 */
export function SlideOutPanel({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  className,
}: SlideOutPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<Element | null>(null);

  // Trap focus inside panel when open
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        const panel = panelRef.current;
        if (!panel) return;

        const focusableElements = panel.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusableElements.length === 0) return;

        const first = focusableElements[0]!;
        const last = focusableElements[focusableElements.length - 1]!;

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    },
    [onClose],
  );

  // Store previously focused element and restore on close
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement;
      // Focus the panel after transition completes
      const timer = setTimeout(() => {
        panelRef.current?.focus();
      }, 150);

      // Prevent body scroll while panel is open
      document.body.style.overflow = 'hidden';

      return () => {
        clearTimeout(timer);
        document.body.style.overflow = '';
        // Restore focus to the element that opened the panel
        (previousActiveElement.current as HTMLElement)?.focus?.();
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={cn(
          'relative flex w-full flex-col bg-white shadow-2xl dark:bg-kenya-surface-dark',
          'sm:w-[440px] lg:w-[480px]',
          'translate-x-0 animate-slide-in',
          'focus-visible:outline-none',
          className,
        )}
        style={{
          maxWidth: '100vw',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="min-w-0 flex-1 pr-4">
            <h2 className="truncate text-lg font-semibold text-kenya-green-900 dark:text-kenya-green-50">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="touch-target flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800"
            aria-label="Close panel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {children}
        </div>

        {/* Optional sticky footer */}
        {footer && (
          <div className="border-t border-gray-200 px-6 py-4 dark:border-gray-700">
            {footer}
          </div>
        )}
      </div>

      {/* Keyframe animation — injected once via style tag */}
      <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slide-in-right 0.25s ease-out;
        }
      `}</style>
    </div>
  );
}
