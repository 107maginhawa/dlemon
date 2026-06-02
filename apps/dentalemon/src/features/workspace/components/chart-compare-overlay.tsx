/**
 * ChartCompareOverlay — P1-14 odontogram diff/compare
 *
 * Allows a clinician to pin a prior visit and see per-tooth CHANGES vs the
 * focal (active) visit. The diff is purely client-side (computeChartDiff).
 *
 * Design decisions:
 *  - Keeps Cover Flow for browsing; compare is a focused overlay above the carousel.
 *  - Reference chart is fetched via the same getDentalChartOptions query used by
 *    VisitChartCard — no backend changes needed.
 *  - Honors prefers-reduced-motion: when reduced motion is preferred, the overlay
 *    renders without animated transitions and falls back to a list diff summary.
 *  - Color coding: added (new/worsened) = warm lemon accent; resolved = green tint.
 *  - WCAG 2.2 AA: the overlay is a role="dialog" with focus management (close btn).
 */

import React, { useEffect, useRef, useReducer } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDentalChartOptions } from '@monobase/sdk-ts/generated/react-query';
import { computeChartDiff } from './dental-chart.helpers';
import type { ToothData } from './dental-chart.helpers';
import { X } from 'lucide-react';

export interface CompareVisitOption {
  id: string;
  label: string; // formatted date label
}

export interface ChartCompareOverlayProps {
  /** The focal visit's chart data (already fetched by the active card). */
  focusTeeth: ToothData[];
  /** Visits available as reference (all except the current focal visit). */
  referenceOptions: CompareVisitOption[];
  /** Called when the overlay should close. */
  onClose: () => void;
}

/**
 * Detect prefers-reduced-motion. Returns true when the user has requested
 * reduced motion (disables animated transitions).
 */
function usePrefersReducedMotion(): boolean {
  const [reduced, toggle] = useReducer(
    (_: boolean, e: MediaQueryListEvent) => e.matches,
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    mql.addEventListener('change', toggle);
    return () => mql.removeEventListener('change', toggle);
  }, []);

  return reduced;
}

export function ChartCompareOverlay({
  focusTeeth,
  referenceOptions,
  onClose,
}: ChartCompareOverlayProps) {
  const reducedMotion = usePrefersReducedMotion();
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Auto-select the first reference option
  const [selectedRefId, setSelectedRefId] = React.useState<string>(
    referenceOptions[0]?.id ?? '',
  );

  // Fetch the reference visit's chart
  const { data: refData, isLoading: refLoading } = useQuery({
    ...getDentalChartOptions({ path: { visitId: selectedRefId } }),
    enabled: !!selectedRefId,
    select: (raw) => {
      const chart = raw as { teeth?: ToothData[] } | null;
      return chart?.teeth ?? [];
    },
  });

  const refTeeth = refData ?? [];

  // Compute the diff between reference (base) and focus (current)
  const diff = computeChartDiff(refTeeth, focusTeeth);

  // Focus the close button on mount (a11y)
  useEffect(() => {
    closeBtnRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const transitionClass = reducedMotion
    ? ''
    : 'animate-in fade-in-0 slide-in-from-bottom-2 duration-200';

  return (
    <div
      data-testid="compare-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Compare dental charts across visits"
      className={[
        'absolute inset-0 z-20 flex flex-col bg-background/95 backdrop-blur-sm rounded-2xl overflow-hidden border border-lemon/60 shadow-xl',
        transitionClass,
      ].join(' ')}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-background/80">
        <h2 className="text-sm font-semibold text-foreground">Compare Visits</h2>
        <button
          ref={closeBtnRef}
          type="button"
          data-testid="compare-close-btn"
          onClick={onClose}
          aria-label="Close compare overlay"
          className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      {/* Reference visit picker */}
      <div
        data-testid="compare-reference-picker"
        className="flex items-center gap-2 px-4 py-2 border-b border-border/20 bg-background/60"
      >
        <label htmlFor="compare-ref-select" className="text-xs text-muted-foreground whitespace-nowrap">
          Compare against:
        </label>
        <select
          id="compare-ref-select"
          value={selectedRefId}
          onChange={e => setSelectedRefId(e.target.value)}
          className="flex-1 text-xs rounded-md border border-border bg-background px-2 py-1 focus:outline-none focus:ring-2 focus:ring-lemon"
          aria-label="Select reference visit"
        >
          {referenceOptions.map(opt => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Diff summary (P1-14) */}
      <div
        data-testid="compare-diff-summary"
        className="flex gap-4 px-4 py-3 border-b border-border/20 bg-background/40"
        aria-live="polite"
        aria-label="Chart comparison summary"
      >
        {refLoading ? (
          <span className="text-xs text-muted-foreground animate-pulse">Loading reference chart…</span>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full bg-lemon border border-lemon-hover flex-shrink-0"
                aria-hidden="true"
              />
              <span className="text-xs font-medium text-foreground">
                {diff.added.length} new / worsened
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full bg-green-400 flex-shrink-0"
                aria-hidden="true"
              />
              <span className="text-xs font-medium text-foreground">
                {diff.resolved.length} resolved / treated
              </span>
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-xs text-muted-foreground">
                {diff.unchanged.length} unchanged
              </span>
            </div>
          </>
        )}
      </div>

      {/* Per-tooth delta list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1" role="list" aria-label="Changed teeth">
        {refLoading ? (
          <div className="flex flex-col gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-7 bg-muted/50 rounded animate-pulse" />
            ))}
          </div>
        ) : diff.added.length === 0 && diff.resolved.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            No changes detected between these two visits.
          </p>
        ) : (
          <>
            {diff.added.map(entry => (
              <div
                key={`added-${entry.toothNumber}`}
                role="listitem"
                data-testid={`diff-added-${entry.toothNumber}`}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-lemon/20 border border-lemon/40"
              >
                <span className="inline-block w-2 h-2 rounded-full bg-lemon flex-shrink-0" aria-hidden="true" />
                <span className="text-xs font-medium text-foreground">Tooth {entry.toothNumber}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {entry.baseState ?? '—'} → {entry.focusState ?? '—'}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-lemon text-lemon-foreground font-semibold uppercase tracking-wide">
                  new
                </span>
              </div>
            ))}
            {diff.resolved.map(entry => (
              <div
                key={`resolved-${entry.toothNumber}`}
                role="listitem"
                data-testid={`diff-resolved-${entry.toothNumber}`}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-green-50 border border-green-200"
              >
                <span className="inline-block w-2 h-2 rounded-full bg-green-400 flex-shrink-0" aria-hidden="true" />
                <span className="text-xs font-medium text-foreground line-through text-muted-foreground">
                  Tooth {entry.toothNumber}
                </span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {entry.baseState ?? '—'} → {entry.focusState ?? '—'}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold uppercase tracking-wide">
                  treated
                </span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Footer: reduced-motion notice */}
      {reducedMotion && (
        <div className="px-4 py-2 border-t border-border/20 bg-background/60">
          <p className="text-[10px] text-muted-foreground text-center">
            Animations disabled (reduced motion preference)
          </p>
        </div>
      )}
    </div>
  );
}
