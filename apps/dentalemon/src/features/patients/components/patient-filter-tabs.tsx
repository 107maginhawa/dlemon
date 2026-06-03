/**
 * PatientFilterTabs
 *
 * Filter pill tabs: All | Active | Needs Follow-Up | Archived
 * Matches the wireframe's .tab-pill / .filter-bar pattern.
 *
 * Wireframe: docs/prd/context/wireframes/patient-list.html
 */
import React from 'react';

export type PatientFilter = 'all' | 'active' | 'needs-follow-up' | 'archived';

interface FilterCounts {
  all?: number;
  active?: number;
  'needs-follow-up'?: number;
  archived?: number;
}

interface PatientFilterTabsProps {
  activeFilter: PatientFilter;
  counts?: FilterCounts;
  onFilterChange: (filter: PatientFilter) => void;
}

const TABS: { id: PatientFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'needs-follow-up', label: 'Needs Follow-Up' },
  { id: 'archived', label: 'Archived' },
];

export function PatientFilterTabs({ activeFilter, counts, onFilterChange }: PatientFilterTabsProps) {
  return (
    <div role="tablist" aria-label="Patient filters" className="flex gap-1 flex-wrap">
      {TABS.map(({ id, label }) => {
        const isActive = activeFilter === id;
        const count = counts?.[id];

        return (
          <button
            key={id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onFilterChange(id)}
            className={[
              'flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              isActive
                ? 'bg-lemon text-lemon-foreground'
                : 'bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground',
            ].join(' ')}
          >
            {label}
            {count !== undefined && count > 0 && (
              <span className="text-xs opacity-70">{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
