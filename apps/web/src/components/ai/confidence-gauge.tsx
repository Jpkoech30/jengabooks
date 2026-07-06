import React from 'react';
import { clsx } from 'clsx';

interface ConfidenceGaugeProps {
  value: number; // 0-100
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function getThresholdColor(value: number): string {
  if (value >= 80) return 'text-kenya-green-500';
  if (value >= 50) return 'text-kenya-amber-500';
  return 'text-kenya-red';
}

function getThresholdBg(value: number): string {
  if (value >= 80) return 'stroke-kenya-green-500';
  if (value >= 50) return 'stroke-kenya-amber-500';
  return 'stroke-kenya-red';
}

export function ConfidenceGauge({ value, label, size = 'md', className }: ConfidenceGaugeProps) {
  const clampedValue = Math.min(Math.max(value, 0), 100);
  const circumference = 2 * Math.PI * 40; // radius = 40
  const offset = circumference - (clampedValue / 100) * circumference;

  const dimensions = {
    sm: { width: 80, height: 80, strokeWidth: 6, textSize: 'text-sm' },
    md: { width: 120, height: 120, strokeWidth: 8, textSize: 'text-lg' },
    lg: { width: 160, height: 160, strokeWidth: 10, textSize: 'text-2xl' },
  };

  const dim = dimensions[size];

  return (
    <div className={clsx('flex flex-col items-center gap-2', className)}>
      <svg width={dim.width} height={dim.height} viewBox="0 0 100 100">
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="currentColor"
          strokeWidth={dim.strokeWidth}
          className="text-gray-200 dark:text-gray-700"
        />
        {/* Value arc */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="currentColor"
          strokeWidth={dim.strokeWidth}
          strokeLinecap="round"
          className={clsx('transition-all duration-1000 ease-out', getThresholdBg(clampedValue))}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
        />
        {/* Center text */}
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="central"
          className={clsx('font-bold fill-current', getThresholdColor(clampedValue), dim.textSize)}
        >
          {clampedValue}%
        </text>
      </svg>
      {label && (
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {label}
        </span>
      )}
    </div>
  );
}
