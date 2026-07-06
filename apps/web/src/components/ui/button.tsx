import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

const buttonVariants = {
  default: 'bg-kenya-green-500 text-white hover:bg-kenya-green-600 shadow-sm',
  secondary: 'bg-kenya-amber-500 text-black hover:bg-kenya-amber-600 shadow-sm',
  destructive: 'bg-kenya-red text-white hover:bg-red-700 shadow-sm',
  ghost: 'hover:bg-kenya-green-50 dark:hover:bg-kenya-green-900 text-kenya-green-700 dark:text-kenya-green-300',
  outline: 'border border-kenya-green-200 hover:bg-kenya-green-50 dark:border-kenya-green-700',
};

const buttonSizes = {
  sm: 'h-9 px-3 text-sm rounded-lg',
  md: 'h-12 px-5 text-base rounded-xl',
  lg: 'h-14 px-8 text-lg rounded-xl',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Button({
  variant = 'default',
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
        'touch-target inline-flex items-center justify-center font-medium transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kenya-green-500 focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
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
