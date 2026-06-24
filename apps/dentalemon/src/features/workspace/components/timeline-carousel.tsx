/**
 * TimelineCarousel — Swiper EffectCoverflow visit history browser
 *
 * Visits are sorted chronologically (oldest → newest). The most-recent visit
 * is the initialSlide (last index). Selecting a slide calls onSelectVisit.
 *
 * P1-14: Compare affordance — when 2+ visits exist, a Compare button opens a
 * focused overlay that diffs the active visit's chart against a chosen prior
 * snapshot. The diff is client-side (computeChartDiff). Cover Flow stays for
 * browsing; compare is a focused overlay. Honors prefers-reduced-motion.
 *
 * Wireframe: docs/prd/context/wireframes/workspace-wireframe.html
 */

import React, { useState, useRef, useEffect } from 'react';
import { Lock } from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCoverflow, Pagination, Keyboard } from 'swiper/modules';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@monobase/ui';
import { getDentalChartOptions } from '@monobase/sdk-ts/generated/react-query';
import 'swiper/css';
import 'swiper/css/effect-coverflow';
import 'swiper/css/pagination';
import { useUpdateVisit } from '@/features/workspace/hooks/use-update-visit';
import { useInitializeDentition } from '@/features/workspace/hooks/use-initialize-dentition';
import { getDentitionType } from '@/features/workspace/components/dental-chart.helpers';
import { findOpenVisit } from '@/features/workspace/lib/visit-status';
import type { ToothData, DentitionType } from '@/features/workspace/components/dental-chart.helpers';
import { DentalChart } from '@/features/workspace/components/dental-chart';
import { ChartCompareOverlay } from '@/features/workspace/components/chart-compare-overlay';

export interface VisitCard {
  id: string;
  status: 'draft' | 'active' | 'completed' | 'locked' | 'discarded';
  createdAt: string;
  chiefComplaint?: string;
  activatedAt?: string;
  completedAt?: string;
}

export interface TimelineCarouselProps {
  visits: VisitCard[];
  patientId: string;
  currentVisitId?: string;
  onSelectVisit: (visitId: string) => void;
  onNewVisit: () => void;
  /**
   * When set, the New Visit affordance is DISABLED and shows this hint — the
   * patient already has an open (active/draft) visit, so starting another is
   * forbidden by the one-active-visit rule. Resume/continue the open visit instead.
   */
  newVisitDisabledHint?: string;
  /** Called when a tooth is selected on the active slide */
  onSelectTooth?: (toothNumber: number) => void;
  /** When true, narrows the carousel to make room for the slideout panel */
  panelOpen?: boolean;
  /** Patient date of birth (ISO date string) — used to select dentition type */
  patientDateOfBirth?: string | null;
  /** P0-1: id of the genuine OPEN visit (status active|draft) — the living
   *  document that owns the cumulative cross-visit overlay + "Current — all
   *  visits" label. Bound here, NOT to whichever card is centered, so centering a
   *  historical card never relabels it "Current" (provenance falsification).
   *  Falls back to findOpenVisit(visits) when omitted. */
  openVisitId?: string;
  /** CHART-XV cumulative cross-visit layer sets — applied to the OPEN card only
   *  (the living document); historical cards stay per-visit snapshots. */
  completedToothNumbers?: Set<number>;
  proposedToothNumbers?: Set<number>;
  declinedToothNumbers?: Set<number>;
  carriedOverToothNumbers?: Set<number>;
  /** P0-A: FDI numbers with an open offline conflict — marked on the active chart. */
  conflictedToothNumbers?: Set<number>;
  /** Item 3: Compare is controlled by the consolidated context strip. When the
   *  strip's Compare button is clicked the route flips this; the carousel still
   *  owns the overlay (it has the fetched active-card teeth + reference options).
   *  When omitted, the carousel falls back to its own internal compare button. */
  compareOpen?: boolean;
  onCompareOpenChange?: (open: boolean) => void;
}

/** Per-card component that fetches its own chart data */
function VisitChartCard({
  visit,
  isActive,
  isOpenVisit,
  patientId,
  patientDateOfBirth,
  onSelectTooth,
  onLockVisit,
  lockPending,
  dentitionType,
  completedToothNumbers,
  proposedToothNumbers,
  declinedToothNumbers,
  carriedOverToothNumbers,
  conflictedToothNumbers,
  onTeethLoaded,
}: {
  visit: VisitCard;
  isActive: boolean;
  /** P0-1: this card is the genuine open visit (living document) — owns the
   *  cumulative overlay + "Current — all visits" label regardless of centering. */
  isOpenVisit: boolean;
  patientId: string;
  patientDateOfBirth?: string | null;
  onSelectTooth?: (toothNumber: number) => void;
  onLockVisit?: (visitId: string) => void;
  lockPending?: boolean;
  dentitionType: DentitionType;
  completedToothNumbers?: Set<number>;
  proposedToothNumbers?: Set<number>;
  declinedToothNumbers?: Set<number>;
  carriedOverToothNumbers?: Set<number>;
  conflictedToothNumbers?: Set<number>;
  /** Called with the fetched tooth data when the active card loads (for compare diff). */
  onTeethLoaded?: (teeth: ToothData[]) => void;
}) {
  const { data, isLoading, isError, refetch } = useQuery({
    ...getDentalChartOptions({ path: { visitId: visit.id } }),
    select: (raw) => {
      const chart = raw as { teeth?: ToothData[] } | null;
      return chart?.teeth ?? [];
    },
  });
  const teeth = data ?? [];

  // Notify parent when active card loads teeth (for compare diff)
  useEffect(() => {
    if (isActive && !isLoading && !isError && onTeethLoaded) {
      onTeethLoaded(teeth);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, isLoading, isError, teeth.length]);

  const initDentition = useInitializeDentition();
  // TR-P1-07: a fresh, editable visit with no charted teeth can auto-populate its
  // dentition from the patient's DOB (deciduous / mixed / permanent picked by age).
  const isEditable = visit.status === 'active' || visit.status === 'draft';
  const canInitDentition = isActive && isEditable && !!patientDateOfBirth && teeth.length === 0;

  return (
    <div
      data-testid="visit-slide"
      data-active-card={isActive ? '1' : undefined}
      className={`h-full rounded-2xl border bg-card p-3 pt-4 flex flex-col gap-2 transition-shadow ${isActive ? 'border-lemon-hover border-2 shadow-[0_8px_40px_rgba(0,0,0,0.10),0_2px_6px_rgba(0,0,0,0.04)]' : 'border-border shadow-[0_4px_24px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)]'}`}
    >
      {isActive && <div data-accent-bar className="h-1 rounded-full bg-lemon" />}
      {/* CHART-XV: name the scope so the cumulative active chart isn't misread as
          data loss vs the per-visit historical snapshots. */}
      <span
        data-testid="chart-scope-label"
        className="text-[10px] font-medium text-muted-foreground px-0.5"
      >
        {isOpenVisit ? 'Current — all visits' : 'Visit snapshot'}
      </span>
      <div className="overflow-x-auto flex-1 min-h-0">
        {isLoading ? (
          <div data-testid="visit-chart-loading" className="flex flex-col gap-2 p-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : isError && !canInitDentition ? (
          // A brand-new editable visit has no chart row yet → GET chart 404s. That
          // is an EMPTY chart, not a failure: when this visit can initialize its
          // dentition (active + editable + DOB known + no teeth), fall through to the
          // Initialize-Dentition empty state below instead of dead-ending on an error.
          <div
            data-testid="visit-chart-error"
            className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center"
          >
            <p className="text-sm text-destructive">Failed to load chart.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : canInitDentition ? (
          <div
            data-testid="dentition-empty-state"
            className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center"
          >
            <p className="text-sm text-muted-foreground">No dental chart yet for this visit.</p>
            <button
              type="button"
              data-testid="init-dentition-btn"
              disabled={initDentition.isPending}
              onClick={() =>
                initDentition.mutate({
                  patientId,
                  visitId: visit.id,
                  dateOfBirth: patientDateOfBirth as string,
                })
              }
              className="h-9 px-4 rounded-lg border-2 border-lemon-hover bg-lemon/40 text-sm font-semibold text-foreground hover:bg-lemon/70 transition-colors disabled:opacity-50"
            >
              {initDentition.isPending ? 'Initializing…' : 'Initialize Dentition'}
            </button>
          </div>
        ) : (
          <DentalChart
            teeth={teeth}
            onSelectTooth={isActive ? onSelectTooth : undefined}
            // The carousel slide height is clamped (min(46vh,420px)); 'md' teeth
            // were sized for the old fixed 560px card and overflowed/clipped under
            // the clamp. 'sm' lets the full odontogram (crown + root + surfaces)
            // fit the clamped height — scale the teeth with the card, don't crop.
            toothSize={isActive ? 'sm' : 'xs'}
            showLegend={false}
            // P1-3: the open card (the working chart, rendered at 'md') gets the
            // compact always-on state key; small historical 'xs' cards stay clean.
            compactLegend={isOpenVisit}
            showLayerToggle={isOpenVisit}
            // P0-1: cumulative cross-visit layers + layer toggle apply only to the
            // OPEN card (the living document), bound by visit identity — NOT by which
            // card is centered. Historical cards remain honest per-visit snapshots.
            completedToothNumbers={isOpenVisit ? completedToothNumbers : undefined}
            proposedToothNumbers={isOpenVisit ? proposedToothNumbers : undefined}
            declinedToothNumbers={isOpenVisit ? declinedToothNumbers : undefined}
            carriedOverToothNumbers={isOpenVisit ? carriedOverToothNumbers : undefined}
            conflictedToothNumbers={isOpenVisit ? conflictedToothNumbers : undefined}
            dentitionType={dentitionType}
          />
        )}
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-muted-foreground">{formatDate(visit.activatedAt ?? visit.createdAt)}</span>
        <div className="flex items-center gap-1.5">
          {visit.status === 'completed' && onLockVisit && (
            <button
              type="button"
              disabled={lockPending}
              onClick={() => {
                if (window.confirm('Lock this visit? Locked visits cannot be edited.')) {
                  onLockVisit(visit.id);
                }
              }}
              className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors disabled:opacity-50"
            >
              <Lock className="inline size-3 mr-1" />Lock Visit
            </button>
          )}
          {visit.status === 'locked' && (
            <Lock className="size-3 text-muted-foreground" aria-label="Visit locked" />
          )}
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold capitalize ${
              visit.status === 'active'
                ? 'bg-green-100 text-green-700'
                : visit.status === 'completed'
                ? 'bg-blue-100 text-blue-700'
                : visit.status === 'locked'
                ? 'bg-purple-100 text-purple-700'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {visit.status}
          </span>
        </div>
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function TimelineCarousel({
  visits,
  patientId,
  currentVisitId,
  onSelectVisit,
  onNewVisit,
  newVisitDisabledHint,
  onSelectTooth,
  panelOpen = false,
  patientDateOfBirth = null,
  openVisitId,
  completedToothNumbers,
  proposedToothNumbers,
  declinedToothNumbers,
  carriedOverToothNumbers,
  conflictedToothNumbers,
  compareOpen: compareOpenProp,
  onCompareOpenChange,
}: TimelineCarouselProps) {
  const lockMutation = useUpdateVisit(patientId);
  const dentitionType = getDentitionType(patientDateOfBirth);
  // P0-1: the cumulative scope binds to the genuine OPEN visit (single source of
  // truth: findOpenVisit, same predicate the route uses), never to the centered
  // card. The route passes openVisitId authoritatively; fall back when omitted.
  const resolvedOpenVisitId = openVisitId ?? findOpenVisit(visits)?.id;
  // Sort oldest → newest so initialSlide = last index = most recent
  const sorted = [...visits].sort(
    (a, b) =>
      new Date(a.activatedAt ?? a.createdAt).getTime() -
      new Date(b.activatedAt ?? b.createdAt).getTime(),
  );

  const initialSlide = Math.max(0, sorted.length - 1);
  const [activeIndex, setActiveIndex] = useState(initialSlide);
  const swiperRef = useRef<{ slideTo: (index: number) => void } | null>(null);

  // P1-14: compare state. Controlled by the context strip when onCompareOpenChange
  // is supplied (Item 3); otherwise the carousel manages it internally.
  const isCompareControlled = onCompareOpenChange !== undefined;
  const [compareOpenInternal, setCompareOpenInternal] = useState(false);
  const compareOpen = isCompareControlled ? !!compareOpenProp : compareOpenInternal;
  const setCompareOpen = (open: boolean) => {
    if (isCompareControlled) onCompareOpenChange!(open);
    else setCompareOpenInternal(open);
  };
  const [activeTeeth, setActiveTeeth] = useState<import('./dental-chart.helpers').ToothData[]>([]);

  // WR-02: when the selected visit changes (e.g. a freshly-created visit becomes
  // current), focus its card. Swiper only honors initialSlide on mount, so sync
  // imperatively here.
  useEffect(() => {
    if (!currentVisitId) return;
    const idx = sorted.findIndex((v) => v.id === currentVisitId);
    if (idx >= 0 && idx !== activeIndex) {
      setActiveIndex(idx);
      swiperRef.current?.slideTo(idx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVisitId, sorted.length]);

  function handleSlideChange(swiper: { activeIndex: number }) {
    const idx = swiper.activeIndex;
    setActiveIndex(idx);
    const visit = sorted[idx];
    // Only notify the parent when the visit actually changed, to avoid feedback
    // loops with the currentVisitId-driven sync effect above.
    if (visit && visit.id !== currentVisitId) onSelectVisit(visit.id);
    // Close compare overlay when slide changes (P1-14)
    setCompareOpen(false);
  }

  // Build reference options: all visits except the currently active one
  const activeVisit = sorted[activeIndex];
  const referenceOptions = sorted
    .filter((v) => v.id !== activeVisit?.id)
    .map((v) => ({
      id: v.id,
      label: formatDate(v.activatedAt ?? v.createdAt),
    }));

  // New Visit shows only when the most-recent card is centered — i.e. there is no
  // newer card peeking on the right, so the empty right gutter is free to host it.
  // Off the last card it's hidden; the sticky context strip carries Start-new-visit
  // / the open-visit blocker in every state, so reachability is never lost.
  const onLastCard = sorted.length > 0 && activeIndex === sorted.length - 1;

  return (
    <div
      data-testid="timeline-carousel"
      className="flex flex-col gap-2 py-2 transition-all duration-300 relative"
      style={{ width: panelOpen ? 'calc(100% - 340px)' : '100%' }}
    >
      {/* P1-14: Compare button — only shown when 2+ visits exist AND compare is
          not controlled by the context strip (Item 3: the strip hosts the trigger). */}
      {sorted.length >= 2 && !isCompareControlled && (
        <div className="flex justify-end px-4">
          <button
            type="button"
            data-testid="compare-btn"
            onClick={() => setCompareOpen(true)}
            aria-label="Compare visit charts"
            className="h-7 px-3 rounded-lg border border-lemon-hover bg-lemon/20 text-xs font-medium text-lemon-foreground hover:bg-lemon/40 transition-colors"
          >
            Compare
          </button>
        </div>
      )}

      {/* Compare overlay (P1-14) — positioned over the carousel */}
      {compareOpen && (
        <div className="absolute inset-0 z-10 px-4 pb-4">
          <ChartCompareOverlay
            focusTeeth={activeTeeth}
            referenceOptions={referenceOptions}
            onClose={() => setCompareOpen(false)}
          />
        </div>
      )}

      <Swiper
        modules={[EffectCoverflow, Pagination, Keyboard]}
        effect="coverflow"
        grabCursor
        centeredSlides
        slidesPerView="auto"
        observer
        observeParents
        initialSlide={initialSlide}
        onSwiper={(s: { slideTo: (index: number) => void }) => { swiperRef.current = s; }}
        onSlideChange={handleSlideChange}
        coverflowEffect={{ rotate: 35, stretch: 0, depth: 200, modifier: 1, scale: 0.72, slideShadows: false }}
        pagination={{ clickable: true }}
        keyboard={{ enabled: true }}
        className="dental-swiper"
      >
        {sorted.map((visit, idx) => {
          const isActive = idx === activeIndex;
          return (
            <SwiperSlide key={visit.id}>
              <VisitChartCard
                visit={visit}
                isActive={isActive}
                isOpenVisit={visit.id === resolvedOpenVisitId}
                patientId={patientId}
                patientDateOfBirth={patientDateOfBirth}
                onSelectTooth={onSelectTooth}
                onLockVisit={(visitId) =>
                  lockMutation.mutate({ path: { visitId }, body: { status: 'locked' } })
                }
                lockPending={lockMutation.isPending}
                dentitionType={dentitionType}
                completedToothNumbers={completedToothNumbers}
                proposedToothNumbers={proposedToothNumbers}
                declinedToothNumbers={declinedToothNumbers}
                carriedOverToothNumbers={carriedOverToothNumbers}
                conflictedToothNumbers={conflictedToothNumbers}
                onTeethLoaded={isActive ? setActiveTeeth : undefined}
              />
            </SwiperSlide>
          );
        })}
      </Swiper>

      {/* Item 5 (refined): New Visit lives in the empty RIGHT GUTTER beside the
          carousel, shown ONLY when the most-recent card is centered (no next card
          peeks on the right). Off the last card it's hidden — the sticky context
          strip carries Start-new-visit / the open-visit blocker in every state, so
          nothing is lost and the centered-below row is reclaimed.
          ENABLED → full-opacity lemon CTA. DISABLED (one-active-visit rule: an open
          visit exists, 409 ACTIVE_VISIT_EXISTS) → a distinct-but-legible muted
          button with the reason rendered ON-SURFACE (touch has no hover). */}
      {onLastCard && (
        <div
          data-testid="new-visit-gutter"
          className="absolute right-1 top-1/2 z-10 flex w-28 -translate-y-1/2 flex-col items-center gap-1"
        >
          <button
            type="button"
            data-testid="new-visit-btn"
            onClick={onNewVisit}
            disabled={!!newVisitDisabledHint}
            aria-disabled={!!newVisitDisabledHint}
            className={
              newVisitDisabledHint
                ? 'inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-muted px-4 py-2.5 text-sm font-semibold text-muted-foreground cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                : 'inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-lemon px-4 py-2.5 text-sm font-semibold text-lemon-foreground hover:bg-lemon-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors'
            }
            aria-label="Start new visit"
          >
            {newVisitDisabledHint ? (
              <Lock className="h-4 w-4" aria-hidden />
            ) : (
              <span className="text-lg leading-none">+</span>
            )}
            New Visit
          </button>
          {newVisitDisabledHint && (
            <span
              data-testid="new-visit-disabled-hint"
              className="text-center text-xs leading-tight text-muted-foreground"
            >
              {newVisitDisabledHint}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
