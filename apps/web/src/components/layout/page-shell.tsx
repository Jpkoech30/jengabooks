import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageShellProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function PageShell({
  title,
  subtitle,
  breadcrumbs,
  actions,
  children,
  className,
}: PageShellProps) {
  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
          {breadcrumbs.map((crumb, i) => {
            const isLast = i === breadcrumbs.length - 1;
            return (
              <React.Fragment key={crumb.label}>
                {i > 0 && (
                  <span className="text-gray-300 dark:text-gray-600" aria-hidden="true">
                    /
                  </span>
                )}
                {crumb.href && !isLast ? (
                  <Link
                    to={crumb.href}
                    className="text-gray-500 hover:text-kenya-green-600 dark:text-gray-400 dark:hover:text-kenya-green-400 transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    className={cn(
                      isLast
                        ? 'font-medium text-kenya-green-900 dark:text-kenya-green-50'
                        : 'text-gray-500 dark:text-gray-400',
                    )}
                    aria-current={isLast ? 'page' : undefined}
                  >
                    {crumb.label}
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-kenya-green-900 dark:text-kenya-green-50 truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-3 shrink-0">
            {actions}
          </div>
        )}
      </div>

      {/* Content */}
      {children}
    </div>
  );
}
