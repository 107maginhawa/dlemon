/**
 * MoneyPanel -- "money & momentum" for the owner-dentist Home.
 *
 * Two things an owner opens the app for: how are we doing (collected
 * month-to-date — the motivating number) and what's slipping (overdue balances,
 * with names + amounts, one tap to act). Replaces the old vanity KPI ribbon
 * (today-only ₱0.00 / Done 0 / Remaining 0). Financial roles only — the parent
 * omits it entirely otherwise.
 */

import React from 'react';
import { formatCents } from './morning-briefing.helpers';

export interface MoneyPanelOverdue {
  id: string;
  patientId: string;
  patientName?: string;
  balanceCents: number;
}

export interface MoneyPanelProps {
  monthCollectedCents: number | null;
  overdue: MoneyPanelOverdue[];
  onViewBilling: () => void;
  onSelectOverdue?: (inv: MoneyPanelOverdue) => void;
}

export function MoneyPanel({
  monthCollectedCents,
  overdue,
  onViewBilling,
  onSelectOverdue,
}: MoneyPanelProps) {
  const overdueTotal = overdue.reduce((sum, o) => sum + o.balanceCents, 0);
  const top = [...overdue].sort((a, b) => b.balanceCents - a.balanceCents).slice(0, 3);
  const monthLabel = new Date().toLocaleDateString('en-US', { month: 'long' });

  return (
    <div className="bg-background rounded-2xl shadow-sm p-5 flex flex-col gap-4" data-testid="money-panel">
      {/* Momentum — collected month-to-date */}
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
          Collected in {monthLabel}
        </span>
        <span
          className="text-2xl font-bold tracking-tight tabular-nums leading-none"
          data-testid="money-collected"
        >
          {monthCollectedCents == null ? '₱—' : formatCents(monthCollectedCents)}
        </span>
      </div>

      <div className="h-px bg-border" />

      {/* What's slipping — overdue balances with names */}
      {overdue.length === 0 ? (
        <p className="text-sm text-muted-foreground">No overdue balances — you&rsquo;re all caught up.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={onViewBilling}
            data-testid="money-overdue-summary"
            className="flex items-baseline justify-between gap-3 text-left -mx-2 px-2 py-1 rounded-lg hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
          >
            <span className="text-sm font-semibold text-destructive-emphasis tabular-nums">
              {formatCents(overdueTotal)} overdue
            </span>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {overdue.length} patient{overdue.length !== 1 ? 's' : ''} &rsaquo;
            </span>
          </button>

          <div className="flex flex-col">
            {top.map((o) => (
              <button
                key={o.id}
                type="button"
                data-testid={`money-overdue-${o.id}`}
                onClick={() => (onSelectOverdue ? onSelectOverdue(o) : onViewBilling())}
                className="flex items-center justify-between gap-3 py-1.5 text-left -mx-2 px-2 rounded-lg hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
              >
                <span className="text-sm truncate min-w-0">{o.patientName ?? o.patientId}</span>
                <span className="text-sm tabular-nums text-destructive-emphasis whitespace-nowrap">
                  {formatCents(o.balanceCents)}
                </span>
              </button>
            ))}
            {overdue.length > top.length && (
              <button
                type="button"
                onClick={onViewBilling}
                className="text-xs text-muted-foreground hover:underline py-1 text-left -mx-2 px-2"
              >
                +{overdue.length - top.length} more
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
