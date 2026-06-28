/**
 * KpiRibbon -- thin "Today's numbers" strip (dashboard-home redesign).
 *
 * Glanceable, secondary metrics — never the headline. Shows collected (cents)
 * for financial roles, plus done / remaining appointment counts for everyone.
 * Collections are omitted entirely when showFinancials=false (no data path).
 */

import React from 'react';
import { formatDailyCollections } from './morning-briefing.helpers';

export interface KpiRibbonProps {
  showFinancials: boolean;
  dailyCollectionsCents: number | null;
  doneCount: number;
  remainingCount: number;
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
        {label}
      </span>
      <span className="text-lg font-bold tracking-tight tabular-nums leading-none">{value}</span>
    </div>
  );
}

export function KpiRibbon({
  showFinancials,
  dailyCollectionsCents,
  doneCount,
  remainingCount,
}: KpiRibbonProps) {
  return (
    <div
      className="bg-background rounded-2xl shadow-sm p-5 flex items-center gap-8 flex-wrap"
      data-testid="kpi-ribbon"
    >
      {showFinancials && (
        <Kpi label="Collected" value={formatDailyCollections(dailyCollectionsCents)} />
      )}
      <Kpi label="Done" value={doneCount} />
      <Kpi label="Remaining" value={remainingCount} />
    </div>
  );
}
