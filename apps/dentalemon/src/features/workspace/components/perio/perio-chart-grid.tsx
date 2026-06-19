/**
 * PerioChartGrid — the full-mouth chart matrix.
 *
 * Two arches (maxillary then mandibular), each a horizontal row of tooth columns
 * in the standard probing order. Owns the auto-advance sequence: cell refs are
 * registered per (tooth, site) so a single-digit depth or Tab moves focus to the
 * next site in `buildPerioSequence` order. Pure-ish — readings + patch handler in,
 * no data fetching.
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { PerioToothColumn } from './perio-tooth-column';
import {
  ADULT_FDI_TEETH,
  PRIMARY_FDI_TEETH,
  buildPerioSequence,
  nextStepIndex,
  type Dentition,
  type PerioSite,
} from './perio-types';
import type { PerioToothReading, UpsertToothReadingRequest } from '@monobase/sdk-ts/generated';

export interface PerioChartGridProps {
  readings: readonly PerioToothReading[];
  threshold: number;
  readOnly?: boolean;
  dentition?: Dentition;
  onPatchTooth: (toothNumber: number, patch: UpsertToothReadingRequest) => void;
  /**
   * Optional externally-driven active cell (voice cursor). When set, the matching
   * depth cell is highlighted and focused — the SAME active-cell affordance the
   * keyboard path uses, so voice and keyboard share one cursor (plan 09 §3.4).
   */
  activeCell?: { tooth: number; site: PerioSite } | null;
}

function cellKey(tooth: number, site: PerioSite) {
  return `${tooth}:${site}`;
}

export function PerioChartGrid({
  readings,
  threshold,
  readOnly = false,
  dentition = 'adult',
  onPatchTooth,
  activeCell = null,
}: PerioChartGridProps) {
  const cellRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const sequence = useMemo(() => buildPerioSequence(dentition), [dentition]);

  // Voice cursor: focus the matching depth cell whenever the external active
  // cell changes (binds the voice sequencer to the same focusable cells the
  // keyboard path drives — no parallel cursor).
  useEffect(() => {
    if (!activeCell) return;
    const el = cellRefs.current.get(cellKey(activeCell.tooth, activeCell.site));
    el?.focus();
    el?.select?.();
  }, [activeCell]);

  const teeth = dentition === 'primary' ? PRIMARY_FDI_TEETH : ADULT_FDI_TEETH;
  const half = teeth.length / 2;
  const maxillary = teeth.slice(0, half);
  const mandibular = teeth.slice(half);

  const readingByTooth = useMemo(() => {
    const map = new Map<number, PerioToothReading>();
    for (const r of readings) map.set(r.toothNumber, r);
    return map;
  }, [readings]);

  const registerCellRef = useCallback((tooth: number, site: PerioSite, el: HTMLInputElement | null) => {
    if (el) cellRefs.current.set(cellKey(tooth, site), el);
    else cellRefs.current.delete(cellKey(tooth, site));
  }, []);

  const advance = useCallback(
    (tooth: number, site: PerioSite) => {
      const idx = nextStepIndex(sequence, { tooth, site });
      if (idx === null) return;
      const next = sequence[idx];
      if (!next) return;
      const el = cellRefs.current.get(cellKey(next.tooth, next.site));
      el?.focus();
      el?.select?.();
    },
    [sequence],
  );

  function renderArch(arch: readonly number[], label: string) {
    return (
      <div className="flex flex-col gap-1">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
        {/* Horizontal scroll affordance for narrow viewports (iPad): a thin scrollbar
            plus a subtle right-edge fade hinting there is more chart off-screen. */}
        <div className="relative">
          <div className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:thin]">
            {arch.map((tooth) => (
              <PerioToothColumn
                key={tooth}
                tooth={tooth}
                reading={readingByTooth.get(tooth)}
                threshold={threshold}
                readOnly={readOnly}
                onPatch={(patch) => onPatchTooth(tooth, patch)}
                onAdvance={advance}
                registerCellRef={registerCellRef}
                activeSite={activeCell?.tooth === tooth ? activeCell.site : null}
              />
            ))}
          </div>
          {/* Right-edge scroll-shadow: hints the matrix scrolls horizontally. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-background to-transparent"
          />
        </div>
      </div>
    );
  }

  return (
    <div data-testid="perio-grid" className="flex flex-col gap-3">
      {renderArch(maxillary, 'Maxillary')}
      {renderArch(mandibular, 'Mandibular')}
    </div>
  );
}
