/**
 * PerioClassificationPanel — optional risk-factor inputs for AAP/EFP grading.
 *
 * Surfaces the optional risk-factor body passed to completePerioChart so grade
 * modifiers apply (smoking cig/day, diabetes + HbA1c, age, %bone-loss). Carries
 * the "assisted, clinician-confirmed" disclaimer required for a computed
 * classification. Risk-factor prefill from medical history is a follow-up.
 */

import React from 'react';
import type { CompletePerioChartRequest } from '@monobase/sdk-ts/generated';

export interface PerioClassificationPanelProps {
  value: CompletePerioChartRequest;
  disabled?: boolean;
  onChange: (next: CompletePerioChartRequest) => void;
}

function numberOrUndefined(raw: string): number | undefined {
  if (raw.trim() === '') return undefined;
  const n = Number(raw);
  return Number.isNaN(n) ? undefined : n;
}

export function PerioClassificationPanel({ value, disabled = false, onChange }: PerioClassificationPanelProps) {
  function patch(p: Partial<CompletePerioChartRequest>) {
    onChange({ ...value, ...p });
  }

  return (
    <div
      data-testid="perio-classification-panel"
      className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-4"
    >
      <div>
        <h3 className="text-sm font-semibold">Risk factors (optional)</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          AAP/EFP staging &amp; grading is assisted — confirm clinically before recording.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Age (years)
          <input
            type="number"
            min={0}
            disabled={disabled}
            value={value.ageYears ?? ''}
            onChange={(e) => patch({ ageYears: numberOrUndefined(e.target.value) })}
            className="h-11 rounded-md border border-border bg-background px-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Cigarettes / day
          <input
            type="number"
            min={0}
            disabled={disabled}
            value={value.cigarettesPerDay ?? ''}
            onChange={(e) => patch({ cigarettesPerDay: numberOrUndefined(e.target.value) })}
            className="h-11 rounded-md border border-border bg-background px-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          HbA1c (%)
          <input
            type="number"
            min={0}
            step="0.1"
            disabled={disabled}
            value={value.hba1cPercent ?? ''}
            onChange={(e) => patch({ hba1cPercent: numberOrUndefined(e.target.value) })}
            className="h-11 rounded-md border border-border bg-background px-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Bone loss at worst site (%)
          <input
            type="number"
            min={0}
            max={100}
            disabled={disabled}
            value={value.bonelossPercent ?? ''}
            onChange={(e) => patch({ bonelossPercent: numberOrUndefined(e.target.value) })}
            className="h-11 rounded-md border border-border bg-background px-2 text-sm"
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          disabled={disabled}
          checked={Boolean(value.hasDiabetes)}
          onChange={(e) => patch({ hasDiabetes: e.target.checked })}
          className="h-4 w-4"
        />
        Diabetes
      </label>
    </div>
  );
}
