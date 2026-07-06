import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

const buttonVariants = {
  primary: 'bg-kenya-green-500 text-white shadow-sm hover:bg-kenya-green-600 focus:ring-kenya-green-500 dark:bg-kenya-green-600 dark:hover:bg-kenya-green-700',
  secondary: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 focus:ring-kenya-green-500 dark:border-gray-600 dark:bg-surface-dark dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:border-gray-500',
  destructive: 'bg-kenya-red text-white shadow-sm hover:bg-red-700 focus:ring-kenya-red-500',
  ghost: 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 focus:ring-kenya-green-500 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100',
  outline: 'border border-kenya-green-200 text-kenya-green-700 hover:bg-kenya-green-50 focus:ring-kenya-green-500 dark:border-kenya-green-700 dark:text-kenya-green-300 dark:hover:bg-kenya-green-900/20',
};

const buttonSizes = {
  sm: 'h-9 px-3 text-sm rounded-lg min-w-[80px]',
  md: 'h-12 px-6 text-sm rounded-lg min-w-[120px]',
  lg: 'h-14 px-8 text-base rounded-lg min-w-[160px]',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'touch-target inline-flex items-center justify-center font-semibold transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-60',
        'active:scale-95',
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-5 w-5 animate-spin border-2 border-white border-t-transparent rounded-full" aria-hidden="true" />
      ) : leftIcon ? (
        <span className="mr-2" aria-hidden="true">{leftIcon}</span>
      ) : null}
      {children}
      {rightIcon && !isLoading && (
        <span className="ml-2" aria-hidden="true">{rightIcon}</span>
      )}
    </button>
  );
}
