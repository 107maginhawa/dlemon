/**
 * MetricCard -- reusable dashboard metric card
 *
 * Displays a title, large value, optional trend pill, subtitle, and children.
 * Follows the Dentalemon card design: rounded-2xl, shadow-sm, bg-background.
 */

import React from 'react';

export interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: string;
  action?: { label: string; onClick: () => void };
  children?: React.ReactNode;
  accentColor?: 'lemon' | 'red' | 'green' | 'amber';
}

const ACCENT_VALUE_CLASS: Record<string, string> = {
  lemon: 'text-[#4A4018]',
  red: 'text-red-500',
  green: 'text-green-600',
  amber: 'text-amber-600',
};

function getTrendClass(trend: string): string {
  if (trend.startsWith('+')) return 'bg-green-100 text-green-700';
  if (trend.startsWith('-')) return 'bg-red-100 text-red-700';
  return 'bg-gray-100 text-gray-500';
}

export function MetricCard({
  title,
  value,
  subtitle,
  trend,
  action,
  children,
  accentColor,
}: MetricCardProps) {
  const valueClass = accentColor ? ACCENT_VALUE_CLASS[accentColor] : 'text-foreground';

  return (
    <div className="bg-background rounded-2xl shadow-sm p-5 flex flex-col gap-1">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
          {title}
        </span>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="text-xs font-medium text-[#4A4018] hover:underline"
          >
            {action.label}
          </button>
        )}
      </div>

      {/* Value row */}
      <div className="flex items-end gap-2">
        <span className={`text-3xl font-bold tracking-tight tabular-nums leading-none ${valueClass}`}>
          {value}
        </span>
        {trend && (
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-semibold tabular-nums mb-1 ${getTrendClass(trend)}`}
          >
            {trend}
          </span>
        )}
      </div>

      {/* Subtitle */}
      {subtitle && (
        <p className="text-[13px] text-muted-foreground mt-1">{subtitle}</p>
      )}

      {/* Children slot for extra content */}
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}
