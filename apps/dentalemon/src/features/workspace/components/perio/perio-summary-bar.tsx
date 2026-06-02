/**
 * PerioSummaryBar — headline perio metrics.
 *
 * BOP% with its FE-bucketed label (Healthy/Localized/Generalized), mean depth,
 * deep-pocket count, the live red (out-of-threshold) site count, and — once the
 * chart is completed — Stage / Grade / Extent chips. The raw stats come from the
 * persisted chart summary or the completion response; bucketing is FE-only.
 */

import React from 'react';
import { bopBucket, BOP_BUCKET_LABEL } from './perio-types';

export interface PerioSummaryBarProps {
  bopPercent?: number | null;
  meanDepth?: number | null;
  deepPocketCount?: number | null;
  /** Live count of probing sites at/above the red-line threshold. */
  overThresholdCount: number;
  stage?: 'I' | 'II' | 'III' | 'IV';
  grade?: 'A' | 'B' | 'C';
  extent?: 'localized' | 'generalized' | 'molar_incisor';
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

const EXTENT_LABEL: Record<NonNullable<PerioSummaryBarProps['extent']>, string> = {
  localized: 'Localized',
  generalized: 'Generalized',
  molar_incisor: 'Molar/Incisor',
};

export function PerioSummaryBar({
  bopPercent,
  meanDepth,
  deepPocketCount,
  overThresholdCount,
  stage,
  grade,
  extent,
}: PerioSummaryBarProps) {
  const hasBop = typeof bopPercent === 'number';
  const bucket = hasBop ? bopBucket(bopPercent) : null;

  return (
    <div
      data-testid="perio-summary-bar"
      className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-border bg-muted/30 px-4 py-3"
    >
      <Metric
        label="BOP"
        value={
          hasBop ? (
            <span>
              {bopPercent.toFixed(0)}%{' '}
              <span className="text-xs font-medium text-muted-foreground">
                · {bucket ? BOP_BUCKET_LABEL[bucket] : ''}
              </span>
            </span>
          ) : (
            '–'
          )
        }
      />
      <Metric label="Mean depth" value={typeof meanDepth === 'number' ? `${meanDepth.toFixed(1)} mm` : '–'} />
      <Metric label="Deep pockets" value={typeof deepPocketCount === 'number' ? deepPocketCount : '–'} />
      <Metric
        label="Over threshold"
        value={<span data-testid="perio-over-threshold-count">{overThresholdCount}</span>}
      />

      {(stage || grade || extent) && (
        <div className="flex items-center gap-2" data-testid="perio-classification-chips">
          {stage && (
            <span className="rounded-full bg-foreground/90 px-2 py-0.5 text-[11px] font-semibold text-background">
              Stage {stage}
            </span>
          )}
          {grade && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground">
              Grade {grade}
            </span>
          )}
          {extent && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground">
              {EXTENT_LABEL[extent]}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
