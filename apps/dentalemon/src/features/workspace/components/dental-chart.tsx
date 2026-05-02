/**
 * DentalChart — interactive SVG dental chart
 *
 * Renders 32 teeth in FDI notation as clickable SVG elements.
 * Each tooth is color-coded by its state.
 *
 * Wireframe: docs/prd/context/wireframes/workspace-wireframe.html
 */

import React from 'react';
import { TOOTH_NUMBERS, buildToothMap, getToothColorClass } from './dental-chart.helpers';
import type { ToothData } from './dental-chart.helpers';

export interface DentalChartProps {
  teeth: ToothData[];
  selectedTooth?: number | null;
  onSelectTooth?: (toothNumber: number) => void;
}

export function DentalChart({ teeth, selectedTooth, onSelectTooth }: DentalChartProps) {
  const toothMap = buildToothMap(teeth);

  // Split into 4 quadrants for rendering
  const upperRight = TOOTH_NUMBERS.filter(n => n >= 11 && n <= 18).reverse(); // 18 → 11
  const upperLeft  = TOOTH_NUMBERS.filter(n => n >= 21 && n <= 28); // 21 → 28
  const lowerLeft  = TOOTH_NUMBERS.filter(n => n >= 31 && n <= 38); // 31 → 38
  const lowerRight = TOOTH_NUMBERS.filter(n => n >= 41 && n <= 48).reverse(); // 48 → 41

  function renderTooth(toothNumber: number) {
    const state = toothMap.get(toothNumber) ?? 'healthy';
    const colorClass = getToothColorClass(state);
    const isSelected = selectedTooth === toothNumber;

    return (
      <button
        key={toothNumber}
        type="button"
        data-testid={`tooth-${toothNumber}`}
        onClick={() => onSelectTooth?.(toothNumber)}
        className={[
          'flex flex-col items-center gap-0.5 rounded p-1 transition-all cursor-pointer',
          'hover:ring-2 hover:ring-primary/50',
          isSelected ? 'ring-2 ring-primary bg-primary/10' : '',
          colorClass,
        ].join(' ')}
        aria-label={`Tooth ${toothNumber}: ${state}`}
        aria-pressed={isSelected}
      >
        <svg
          viewBox="0 0 24 28"
          className="w-6 h-7"
          aria-hidden="true"
        >
          <rect
            x="2" y="2" width="20" height="24" rx="4"
            className="stroke-current stroke-1"
            fill="currentColor"
            fillOpacity={0.3}
          />
        </svg>
        <span className="text-[9px] font-medium leading-none">{toothNumber}</span>
      </button>
    );
  }

  return (
    <div data-testid="dental-chart" className="flex flex-col gap-2 p-4">
      {/* Upper arch */}
      <div className="flex justify-center gap-0.5">
        {upperRight.map(renderTooth)}
        <div className="w-px bg-border mx-1" />
        {upperLeft.map(renderTooth)}
      </div>

      <div className="h-px bg-border" />

      {/* Lower arch */}
      <div className="flex justify-center gap-0.5">
        {lowerRight.map(renderTooth)}
        <div className="w-px bg-border mx-1" />
        {lowerLeft.map(renderTooth)}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
        {[
          { state: 'healthy', label: 'Healthy', cls: 'bg-green-100' },
          { state: 'caries', label: 'Caries', cls: 'bg-red-200' },
          { state: 'fractured', label: 'Fractured', cls: 'bg-orange-200' },
          { state: 'filled', label: 'Filled', cls: 'bg-teal-300' },
          { state: 'crown', label: 'Crown', cls: 'bg-[#FFE97D]' },
          { state: 'missing', label: 'Missing', cls: 'bg-gray-100 border border-dashed border-gray-400' },
        ].map(({ label, cls }) => (
          <span key={label} className="flex items-center gap-1">
            <span className={`w-3 h-3 rounded-sm ${cls}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
