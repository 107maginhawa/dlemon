/**
 * TimelineCarousel — visit history browser
 *
 * Shows a horizontal scroll of visit cards, newest first.
 * The focused card shows full details; flanking cards are smaller.
 * "+" card creates a new visit.
 *
 * Wireframe: docs/prd/context/wireframes/workspace-wireframe.html
 */

import React, { useState } from 'react';

export interface VisitCard {
  id: string;
  status: 'draft' | 'active' | 'completed' | 'locked';
  createdAt: string;
  chiefComplaint?: string;
  activatedAt?: string;
  completedAt?: string;
}

export interface TimelineCarouselProps {
  visits: VisitCard[];
  currentVisitId?: string;
  onSelectVisit: (visitId: string) => void;
  onNewVisit: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  locked: 'bg-purple-100 text-purple-700',
};

export function TimelineCarousel({ visits, currentVisitId, onSelectVisit, onNewVisit }: TimelineCarouselProps) {
  const [focusIdx, setFocusIdx] = useState(0);

  // Most recent first
  const sorted = [...visits].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return (
    <div data-testid="timeline-carousel" className="flex items-center gap-2 overflow-x-auto py-2 px-4 scrollbar-none">
      {/* New visit card */}
      <button
        type="button"
        data-testid="new-visit-btn"
        onClick={onNewVisit}
        className="flex-shrink-0 w-20 h-24 rounded-xl border-2 border-dashed border-primary/40 flex flex-col items-center justify-center gap-1 hover:border-primary hover:bg-primary/5 transition-colors"
        aria-label="Start new visit"
      >
        <span className="text-2xl text-primary/60">+</span>
        <span className="text-xs text-primary/60 font-medium">New</span>
      </button>

      {/* Visit cards */}
      {sorted.map((visit, idx) => {
        const isFocused = focusIdx === idx || visit.id === currentVisitId;
        return (
          <button
            key={visit.id}
            type="button"
            data-testid={`visit-card-${visit.id}`}
            onClick={() => {
              setFocusIdx(idx);
              onSelectVisit(visit.id);
            }}
            className={[
              'flex-shrink-0 rounded-xl border bg-card text-left transition-all duration-200 flex flex-col gap-1',
              isFocused
                ? 'w-48 h-28 p-3 shadow-md ring-2 ring-primary/40'
                : 'w-32 h-24 p-2 opacity-70 hover:opacity-90',
            ].join(' ')}
            aria-pressed={isFocused}
            aria-label={`Visit on ${formatDate(visit.createdAt)}`}
          >
            <span className="text-xs font-semibold truncate">
              {formatDate(visit.createdAt)}
            </span>
            <span className={[
              'text-xs px-1.5 py-0.5 rounded-full w-fit font-medium capitalize',
              STATUS_COLORS[visit.status] ?? 'bg-gray-100 text-gray-500',
            ].join(' ')}>
              {visit.status}
            </span>
            {isFocused && visit.chiefComplaint && (
              <span className="text-xs text-muted-foreground line-clamp-2 mt-1">
                {visit.chiefComplaint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
