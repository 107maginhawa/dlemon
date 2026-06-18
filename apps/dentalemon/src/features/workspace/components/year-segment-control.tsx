/**
 * YearSegmentControl — Apple-style segmented year filter
 *
 * Props:
 *   years: string[]         — derived from visit dates, prepend "All"
 *   selectedYear: string    — currently active pill
 *   onSelect: (y) => void   — called on pill click
 *
 * Wireframe: docs/prd/context/wireframes/workspace-wireframe.html
 */

import React from 'react';

interface YearSegmentControlProps {
  years: string[];
  selectedYear: string;
  onSelect: (year: string) => void;
}

export function YearSegmentControl({ years, selectedYear, onSelect }: YearSegmentControlProps) {
  if (years.length <= 1) return null;

  return (
    <div
      className="inline-flex items-center gap-1.5 p-2.5 rounded-full bg-muted"
      role="group"
      aria-label="Filter visits by year"
    >
      {years.map((year) => {
        const isActive = year === selectedYear;
        return (
          <button
            key={year}
            type="button"
            onClick={() => onSelect(year)}
            className={[
              'px-3 py-2.5 min-h-[44px] rounded-full text-sm font-medium transition-all duration-150',
              isActive
                ? 'bg-white shadow text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
            aria-pressed={isActive}
          >
            {year}
          </button>
        );
      })}
    </div>
  );
}
