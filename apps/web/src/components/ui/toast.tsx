import React, { useEffect, useState } from 'react';
import { clsx } from 'clsx';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  variant?: ToastVariant;
  title: string;
  message?: string | undefined;
  duration?: number;
  onClose: () => void;
}

const variantStyles: Record<ToastVariant, string> = {
  success: 'border-l-4 border-kenya-green-500 bg-kenya-green-50 dark:bg-kenya-green-900/30',
  error: 'border-l-4 border-kenya-red bg-red-50 dark:bg-red-900/30',
  warning: 'border-l-4 border-kenya-amber-500 bg-kenya-amber-50 dark:bg-kenya-amber-900/30',
  info: 'border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/30',
};

const iconMap: Record<ToastVariant, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

export function Toast({ variant = 'info', title, message, duration = 5000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));

    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  return (
    <div
      role="alert"
      className={clsx(
        'touch-target flex items-start gap-3 rounded-lg p-4 shadow-lg transition-all duration-200',
        variantStyles[variant],
        {
          'translate-x-0 opacity-100': isVisible && !isExiting,
          'translate-x-full opacity-0': !isVisible || isExiting,
        },
      )}
    >
      <span className="mt-0.5 text-lg" aria-hidden="true">
        {iconMap[variant]}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-kenya-green-900 dark:text-kenya-green-50">
          {title}
        </p>
        {message && (
          <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">
            {message}
          </p>
        )}
      </div>
      <button
        onClick={handleClose}
        className="touch-target flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
        aria-label="Close notification"
      >
        ✕
      </button>
    </div>
  );
}

// Toast container for stacking notifications
interface ToastContainerProps {
  children: React.ReactNode;
}

export function ToastContainer({ children }: ToastContainerProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {children}
    </div>
  );
}
