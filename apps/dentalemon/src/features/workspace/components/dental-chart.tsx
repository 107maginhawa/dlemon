/**
 * DentalChart — interactive SVG dental chart
 *
 * Renders 32 teeth in FDI notation as clickable SVG elements.
 * Each tooth is color-coded by its state.
 *
 * Wireframe: docs/prd/context/wireframes/workspace-wireframe.html
 */

import React, { useState } from 'react';
import { TOOTH_NUMBERS, PEDIATRIC_TOOTH_NUMBERS, buildToothMap, getToothFillColor, getToothInfo } from './dental-chart.helpers';
import type { ToothData, ToothState, DentitionType } from './dental-chart.helpers';
import { UniversalToothFdi } from './dental/universal-tooth-fdi';

export interface DentalChartProps {
  teeth: ToothData[];
  selectedTooth?: number | null;
  onSelectTooth?: (toothNumber: number) => void;
  /** Size of each tooth SVG. Use 'xs' inside carousel cards, 'sm' for standalone. Default: 'sm' */
  toothSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Show the color legend below the chart. Default: true */
  showLegend?: boolean;
  /** Permanent (32-tooth adult) or primary (20-tooth pediatric). Default: 'permanent' */
  dentitionType?: DentitionType;
}

export function DentalChart({ teeth, selectedTooth, onSelectTooth, toothSize = 'sm', showLegend = true, dentitionType = 'permanent' }: DentalChartProps) {
  const toothMap = buildToothMap(teeth);
  const [filterStates, setFilterStates] = useState<Set<ToothState>>(new Set());

  function toggleFilter(state: ToothState) {
    setFilterStates(prev => {
      const next = new Set(prev);
      if (next.has(state)) next.delete(state);
      else next.add(state);
      return next;
    });
  }

  // Split into 4 quadrants for rendering — permanent (8 per quadrant) or primary (5 per quadrant)
  const isPrimary = dentitionType === 'primary';
  const upperRight = isPrimary
    ? PEDIATRIC_TOOTH_NUMBERS.filter(n => n >= 51 && n <= 55).reverse() // 55 → 51
    : TOOTH_NUMBERS.filter(n => n >= 11 && n <= 18).reverse();           // 18 → 11
  const upperLeft = isPrimary
    ? PEDIATRIC_TOOTH_NUMBERS.filter(n => n >= 61 && n <= 65)            // 61 → 65
    : TOOTH_NUMBERS.filter(n => n >= 21 && n <= 28);                     // 21 → 28
  const lowerLeft = isPrimary
    ? PEDIATRIC_TOOTH_NUMBERS.filter(n => n >= 71 && n <= 75)            // 71 → 75
    : TOOTH_NUMBERS.filter(n => n >= 31 && n <= 38);                     // 31 → 38
  const lowerRight = isPrimary
    ? PEDIATRIC_TOOTH_NUMBERS.filter(n => n >= 81 && n <= 85).reverse()  // 85 → 81
    : TOOTH_NUMBERS.filter(n => n >= 41 && n <= 48).reverse();           // 48 → 41

  function renderTooth(toothNumber: number, isLastInQuadrant = false) {
    const state = toothMap.get(toothNumber) ?? 'healthy' as ToothState;
    const isSelected = selectedTooth === toothNumber;
    const { name } = getToothInfo(toothNumber);
    const isDimmed = filterStates.size > 0 && !filterStates.has(state);

    return (
      <button
        key={toothNumber}
        type="button"
        data-testid={`tooth-${toothNumber}`}
        onClick={() => onSelectTooth?.(toothNumber)}
        title={`Tooth ${toothNumber} — ${name} (${state})`}
        style={{ flex: '1 1 0', minWidth: 0, overflow: 'hidden', opacity: isDimmed ? 0.15 : 1, transition: 'opacity 200ms' }}
        className={[
          'flex flex-col items-center rounded p-0.5 cursor-pointer transition-colors duration-150',
          !isLastInQuadrant ? 'border-r border-border/20' : '',
          isSelected ? 'bg-primary/10 ring-2 ring-primary/50' : 'hover:bg-muted/50',
        ].join(' ')}
        aria-label={`Tooth ${toothNumber}: ${name}, ${state}`}
        aria-pressed={isSelected}
      >
        <UniversalToothFdi
          fdiToothNumber={toothNumber}
          fillColor={getToothFillColor(state) || undefined}
          size={toothSize}
          interactive={false}
          showLabel={true}
        />
      </button>
    );
  }

  return (
    <div
      data-testid="dental-chart"
      className="h-full flex flex-col rounded-md overflow-hidden border border-border/50 bg-muted/30"
    >
      {/* Upper arch */}
      <div
        className="flex flex-1 min-h-0"
        style={{ borderBottom: '2px dashed var(--border, #e5e7eb)' }}
      >
        {upperRight.map((n, i) => renderTooth(n, i === upperRight.length - 1))}
        <div style={{ width: 1, flexShrink: 0, borderRight: '1px dashed var(--border, #e5e7eb)' }} />
        {upperLeft.map((n, i) => renderTooth(n, i === upperLeft.length - 1))}
      </div>

      {/* Lower arch */}
      <div className="flex flex-1 min-h-0">
        {lowerRight.map((n, i) => renderTooth(n, i === lowerRight.length - 1))}
        <div style={{ width: 1, flexShrink: 0, borderRight: '1px dashed var(--border, #e5e7eb)' }} />
        {lowerLeft.map((n, i) => renderTooth(n, i === lowerLeft.length - 1))}
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="flex flex-wrap gap-3 px-3 py-2 text-xs text-muted-foreground border-t border-border/30 bg-background/50">
          {([
            { label: 'Healthy',   state: 'healthy' as const },
            { label: 'Caries',    state: 'caries' as const },
            { label: 'Fractured', state: 'fractured' as const },
            { label: 'Filled',    state: 'filled' as const },
            { label: 'Crown',     state: 'crown' as const },
            { label: 'Missing',   state: 'missing' as const, bordered: true },
            { label: 'Extracted', state: 'extracted' as const },
          ]).map(({ label, state, bordered }) => {
            const isActive = filterStates.has(state);
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggleFilter(state)}
                title={isActive ? `Remove ${label} filter` : `Filter to ${label} teeth`}
                className={[
                  'flex items-center gap-1 rounded px-1 py-0.5 transition-colors',
                  isActive ? 'ring-1 ring-current bg-muted font-semibold' : 'hover:bg-muted/50',
                ].join(' ')}
                aria-pressed={isActive}
              >
                <span
                  className={`w-3 h-3 rounded-sm inline-block flex-shrink-0${bordered ? ' border border-dashed border-gray-400' : ''}`}
                  style={{ backgroundColor: getToothFillColor(state) }}
                />
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
