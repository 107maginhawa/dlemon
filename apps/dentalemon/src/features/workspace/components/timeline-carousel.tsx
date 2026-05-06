/**
 * TimelineCarousel — 3D perspective visit history browser
 *
 * Shows a centered 3-card layout:
 *   LEFT FLANKING — perspective(800px) rotateY(6deg) scale(0.82), opacity 0.4
 *   FOCAL CARD    — full size, gold ring, 16×4 tooth mini-grid with real tooth data
 *   RIGHT / "+"   — dashed border "New Visit" card, opacity 0.2
 *
 * Clicking a tooth pip in the focal card calls onSelectTooth(toothNumber).
 *
 * Wireframe: docs/prd/context/wireframes/workspace-wireframe.html
 */

import React, { useState } from 'react';
import type { ToothData } from '@/features/workspace/components/dental-chart.helpers';
import { BRAND_GOLD } from '@/constants/brand';

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
  /** Tooth data from useDentalChart — used on focal card only */
  teeth?: ToothData[];
  /** Called when a tooth pip is clicked on the focal card */
  onSelectTooth?: (toothNumber: number) => void;
}

// Universal tooth numbering 1-32
// Row 0: upper right  1-8 (left to right display = 8..1 but store as 1..8)
// Row 1: upper left   9-16
// Row 2: lower left   17-24
// Row 3: lower right  25-32
// We render as two arches: upper (1-16), lower (17-32), each 16 cells wide
// Display: upper = [8,7,6,5,4,3,2,1, 9,10,11,12,13,14,15,16]
//          lower = [25,26,27,28,29,30,31,32, 17,18,19,20,21,22,23,24]

const UPPER_ROW = [8,7,6,5,4,3,2,1, 9,10,11,12,13,14,15,16];
const LOWER_ROW = [25,26,27,28,29,30,31,32, 17,18,19,20,21,22,23,24];
const MIDLINE_IDX = 7; // after index 7, cross midline

type ToothState = ToothData['state'];

function toothCellColor(state?: ToothState): string {
  if (!state) return 'bg-gray-100';
  switch (state) {
    case 'healthy':    return 'bg-gray-100';
    case 'caries':     return 'bg-red-400';
    case 'fractured':  return 'bg-orange-400';
    case 'filled':     return 'bg-teal-400';
    case 'crown':      return 'bg-yellow-300';
    case 'missing':    return 'bg-gray-50 opacity-30';
    case 'implant':    return 'bg-blue-300';
    case 'extracted':  return 'bg-gray-300';
    case 'watchlist':  return 'bg-amber-200';
    default:           return 'bg-gray-100';
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** 16-wide × 2-row tooth mini-grid */
function ToothMiniGrid({
  teeth,
  onSelectTooth,
  interactive,
}: {
  teeth: ToothData[];
  onSelectTooth?: (n: number) => void;
  interactive: boolean;
}) {
  const toothMap = new Map(teeth.map((t) => [t.toothNumber, t]));

  function renderRow(numbers: number[]) {
    return (
      <div className="flex gap-px">
        {numbers.map((num, colIdx) => {
          const tooth = toothMap.get(num);
          const colorClass = toothCellColor(tooth?.state);
          const hasMidlineGap = colIdx === MIDLINE_IDX;
          return (
            <React.Fragment key={num}>
              {hasMidlineGap && <div className="w-1 shrink-0" />}
              {interactive ? (
                <button
                  type="button"
                  aria-label={`Tooth ${num}${tooth?.state ? ` (${tooth.state})` : ''}`}
                  onClick={() => onSelectTooth?.(num)}
                  className={`w-[18px] h-[18px] rounded-sm shrink-0 hover:ring-2 hover:ring-offset-0 hover:ring-black/20 transition-all ${colorClass}`}
                  title={`Tooth ${num}`}
                />
              ) : (
                <div className={`w-[18px] h-[18px] rounded-sm shrink-0 ${colorClass}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 py-2">
      {/* Upper arch */}
      {renderRow(UPPER_ROW)}
      {/* 2px midline gap */}
      <div className="h-1" />
      {/* Lower arch */}
      {renderRow(LOWER_ROW)}
    </div>
  );
}

/** Placeholder grid — gray cells, no interaction */
function PlaceholderGrid() {
  const empty: ToothData[] = [];
  return <ToothMiniGrid teeth={empty} interactive={false} />;
}

export function TimelineCarousel({
  visits,
  currentVisitId,
  onSelectVisit,
  onNewVisit,
  teeth = [],
  onSelectTooth,
}: TimelineCarouselProps) {
  const [focusIdx, setFocusIdx] = useState(0);

  // Most recent first
  const sorted = [...visits].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Sync focusIdx when currentVisitId changes
  const currentIdx = sorted.findIndex((v) => v.id === currentVisitId);
  const effectiveFocusIdx =
    currentIdx >= 0 ? currentIdx : Math.min(focusIdx, sorted.length - 1);

  const prevVisit = sorted[effectiveFocusIdx - 1] ?? null;
  const focalVisit = sorted[effectiveFocusIdx] ?? null;

  function handleSelectVisit(visit: VisitCard, idx: number) {
    setFocusIdx(idx);
    onSelectVisit(visit.id);
  }

  return (
    <div
      data-testid="timeline-carousel"
      className="flex items-center justify-center py-4 px-6 gap-6 overflow-hidden transition-all duration-300"
      style={{ minHeight: '160px' }}
    >
      {/* LEFT FLANKING CARD */}
      {prevVisit && (
        <button
          type="button"
          aria-label={`Visit on ${formatDate(prevVisit.createdAt)}`}
          onClick={() => handleSelectVisit(prevVisit, effectiveFocusIdx - 1)}
          className="flex-shrink-0 rounded-xl border bg-card p-3 text-left transition-all duration-300"
          style={{
            width: '300px',
            transform: 'perspective(800px) rotateY(6deg) scale(0.82)',
            opacity: 0.4,
          }}
        >
          <span className="block text-xs font-semibold mb-2">
            {formatDate(prevVisit.createdAt)}
          </span>
          <PlaceholderGrid />
        </button>
      )}

      {/* FOCAL CARD */}
      {focalVisit ? (
        <div
          className="flex-shrink-0 rounded-xl border bg-card p-4 flex flex-col gap-2 shadow-xl transition-all duration-300"
          style={{
            width: '520px',
            boxShadow: `0 0 0 2px ${BRAND_GOLD}, 0 8px 32px rgba(0,0,0,0.12)`,
          }}
        >
          <ToothMiniGrid
            teeth={teeth}
            onSelectTooth={onSelectTooth}
            interactive={!!onSelectTooth}
          />
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-muted-foreground">
              {formatDate(focalVisit.createdAt)}
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold capitalize ${
                focalVisit.status === 'active'
                  ? 'bg-green-100 text-green-700'
                  : focalVisit.status === 'completed'
                  ? 'bg-blue-100 text-blue-700'
                  : focalVisit.status === 'locked'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {focalVisit.status}
            </span>
          </div>
          {focalVisit.chiefComplaint && (
            <p className="text-xs text-muted-foreground line-clamp-1">
              {focalVisit.chiefComplaint}
            </p>
          )}
        </div>
      ) : (
        /* Empty state — no visits yet */
        <div
          className="flex-shrink-0 rounded-xl border-2 border-dashed border-muted-foreground/30 p-4 flex items-center justify-center"
          style={{ width: '520px', minHeight: '120px' }}
        >
          <p className="text-sm text-muted-foreground">No visits recorded.</p>
        </div>
      )}

      {/* "+" NEW VISIT CARD */}
      <button
        type="button"
        data-testid="new-visit-btn"
        onClick={onNewVisit}
        className="flex-shrink-0 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-all duration-300"
        style={{
          width: '120px',
          minHeight: '100px',
          opacity: 0.2,
        }}
        aria-label="Start new visit"
      >
        <span className="text-3xl text-muted-foreground leading-none">+</span>
        <span className="text-xs text-muted-foreground font-medium">New Visit</span>
      </button>
    </div>
  );
}
