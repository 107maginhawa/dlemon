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
import {
  getDentitionType,
  getLayerLabel,
  getLayerCueSwatch,
  getToothFillColor,
  DEFAULT_VISIBLE_LAYERS,
} from '@/features/workspace/components/dental-chart.helpers';
import { findOpenVisit } from '@/features/workspace/lib/visit-status';
import type { ToothData, DentitionType, ChartLayer } from '@/features/workspace/components/dental-chart.helpers';
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
  /** Called when a tooth is selected on the active slide (opens the editable slideout) */
  onSelectTooth?: (toothNumber: number) => void;
  /** Called when a tooth is selected on a HISTORICAL (read-only) card — opens that
   *  tooth's read-only lifecycle ledger scoped to the card's visit. */
  onSelectToothHistory?: (toothNumber: number, visitId: string) => void;
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

// Change A: layer tabs lifted out of DentalChart into the card header (controls
// LEFT, context cluster RIGHT). Neutral chips — lemon stays reserved for
// interaction, never status. 'declined' only surfaces when refused work exists.
const LAYER_TAB_ORDER: ChartLayer[] = ['baseline', 'proposed', 'completed', 'declined'];

/** Change C: compact state key, relocated from inside the white chart to the card
 *  footer. Decodes the main fills + the Planned dotted edge. */
function ChartCompactLegend() {
  return (
    <div
      data-testid="chart-compact-legend"
      className="flex flex-nowrap items-center gap-x-3 text-[11px] text-muted-foreground"
    >
      {([
        { label: 'Caries', state: 'caries' as const },
        { label: 'Fractured', state: 'fractured' as const },
        { label: 'Filled', state: 'filled' as const },
        { label: 'Crown', state: 'crown' as const },
      ]).map(({ label, state }) => (
        <span key={state} className="flex items-center gap-1 whitespace-nowrap">
          <span
            className="w-3 h-3 rounded-sm inline-block flex-shrink-0 border border-black/15"
            style={{ backgroundColor: getToothFillColor(state) }}
          />
          {label}
        </span>
      ))}
      <span className="flex items-center gap-1 whitespace-nowrap">
        <span
          className="w-3 h-3 rounded-sm inline-block flex-shrink-0 border-2 border-dotted"
          style={{ borderColor: '#475569' }}
        />
        Planned
      </span>
      <span className="flex items-center gap-1 whitespace-nowrap">
        <span
          className="w-3 h-3 rounded-sm inline-block flex-shrink-0 border-2 border-solid"
          style={{ borderColor: '#059669' }}
        />
        Treated
      </span>
    </div>
  );
}

/** Per-card component that fetches its own chart data */
function VisitChartCard({
  visit,
  isActive,
  isOpenVisit,
  showTime,
  patientId,
  patientDateOfBirth,
  onSelectTooth,
  onSelectToothHistory,
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
  /** Change B: this card shares a calendar day with another visit → show the time
   *  alongside the date to keep same-day encounters distinguishable. */
  showTime: boolean;
  /** P0-1: this card is the genuine open visit (living document) — owns the
   *  cumulative overlay + "Current — all visits" label regardless of centering. */
  isOpenVisit: boolean;
  patientId: string;
  patientDateOfBirth?: string | null;
  onSelectTooth?: (toothNumber: number) => void;
  onSelectToothHistory?: (toothNumber: number, visitId: string) => void;
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
      const chart = raw as {
        teeth?: ToothData[];
        layers?: { proposed: number[]; completed: number[]; declined: number[] };
        changedThisVisit?: number[];
        terminalTeeth?: number[];
      } | null;
      return {
        teeth: chart?.teeth ?? [],
        layers: chart?.layers,
        changedThisVisit: chart?.changedThisVisit,
        terminalTeeth: chart?.terminalTeeth,
      };
    },
  });
  const teeth = data?.teeth ?? [];
  // Cumulative as-of layer sets for HISTORICAL (non-open) snapshots. The open card
  // keeps the cumulative cross-visit sets passed via props (living-document
  // semantics; also handles the baseline-fallback path where the API omits layers).
  const perVisitLayers = data?.layers;
  const toSet = (xs?: number[]) => (xs && xs.length ? new Set(xs) : undefined);

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

  // Change A: layer-toggle state lifted here so the tabs can live in the header
  // (LEFT) beside the date/status context cluster (RIGHT). Only the open card's
  // tabs are interactive; historical snapshots render them static for height parity.
  const [visibleLayers, setVisibleLayers] = useState<Set<ChartLayer>>(
    () => new Set(DEFAULT_VISIBLE_LAYERS),
  );
  function toggleLayer(layer: ChartLayer) {
    setVisibleLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) {
        if (next.size === 1) return prev; // never empty the set
        next.delete(layer);
      } else {
        next.add(layer);
      }
      return next;
    });
  }
  const layerTabs = LAYER_TAB_ORDER.filter(
    (layer) => layer !== 'declined' || (declinedToothNumbers?.size ?? 0) > 0,
  );

  return (
    <div
      data-testid="visit-slide"
      data-active-card={isActive ? '1' : undefined}
      // Issue 3: make the active visit unmistakably primary — neighbors are dimmed
      // and flattened so they read as context, not competing focus.
      className={`h-full rounded-2xl border bg-card p-3 pt-4 flex flex-col gap-2 transition-all ${isActive ? 'border-lemon-hover border-2 shadow-card-active' : 'border-border opacity-55 shadow-[0_2px_8px_rgba(0,0,0,0.05)]'}`}
    >
      {/* Change A: ONE header row, identical HEIGHT on every card. LEFT = layer
          tabs, rendered ONLY on the open/living chart (historical visits are
          read-only photos, no tabs). The row keeps the open card's height on every
          card (min-h-[44px] + an empty left slot on snapshots) so the chart's top
          edge never jumps when paging. RIGHT = context cluster (scope + date +
          status), right-aligned, with the date the dominant element. */}
      <div className="flex min-h-[44px] items-center justify-between gap-2 px-0.5">
        {isOpenVisit ? (
          <div
            data-testid="chart-layer-toggle"
            role="group"
            // Change C: cumulative cue. The Existing / Planned / Treated layers are
            // status-filtered views across ALL visits (see lib/chart-layers.ts), not
            // this visit alone — so Treated/Planned aren't misread as current-visit
            // only. Communicated without restyling the tabs or adding status hues:
            // the visible "Current — all visits" scope label sits in the same row, and
            // the group carries the scope in its aria-label + a reinforcing tooltip.
            aria-label="Chart layers across all visits — toggle to show or hide"
            title="These layers (Existing · Planned · Treated) span all visits, not just this one"
            className="flex shrink-0 items-center gap-1"
          >
            {layerTabs.map((layer) => {
              const layerActive = visibleLayers.has(layer);
              const cue = getLayerCueSwatch(layer);
              return (
                <button
                  key={layer}
                  type="button"
                  data-testid={`chart-layer-${layer}`}
                  aria-pressed={layerActive}
                  onClick={() => toggleLayer(layer)}
                  className={[
                    'min-h-[44px] inline-flex items-center gap-1.5 rounded-md px-2 text-xs font-medium border transition-colors',
                    // Item 4: ON = filled chip, OFF = outline; the cue swatch carries
                    // the layer identity so the filter doubles as the legend.
                    layerActive
                      ? 'bg-foreground/10 text-foreground border-foreground/30'
                      : 'bg-transparent text-muted-foreground border-border hover:bg-muted/50',
                  ].join(' ')}
                >
                  <span
                    aria-hidden
                    className={`w-2.5 h-2.5 rounded-sm shrink-0 ${cue.className} ${layerActive ? '' : 'opacity-50'}`}
                    style={cue.borderColor ? { borderColor: cue.borderColor } : undefined}
                  />
                  {getLayerLabel(layer)}
                </button>
              );
            })}
          </div>
        ) : (
          // Read-only snapshot: static layer key so users can interpret the
          // snapshot's colors. Height is pinned via min-h-[44px] on the
          // container row (set above on the flex wrapper) so the chart's top
          // edge never jumps when paging between open and historical cards.
          <div
            data-testid="chart-layer-key"
            aria-label="Chart layer key for this visit snapshot"
            className="flex shrink-0 items-center gap-1"
          >
            {LAYER_TAB_ORDER
              .filter(
                (layer) =>
                  layer !== 'declined' ||
                  (perVisitLayers?.declined?.length ?? 0) > 0,
              )
              .map((layer) => {
                const cue = getLayerCueSwatch(layer);
                return (
                  <span
                    key={layer}
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground border border-transparent"
                  >
                    <span
                      aria-hidden
                      className={`w-2.5 h-2.5 rounded-sm shrink-0 ${cue.className}`}
                      style={cue.borderColor ? { borderColor: cue.borderColor } : undefined}
                    />
                    {getLayerLabel(layer)}
                  </span>
                );
              })}
          </div>
        )}
        <div className="flex min-w-0 items-center justify-end gap-2">
          <span
            data-testid="chart-scope-label"
            className="truncate text-[10px] font-medium text-muted-foreground"
          >
            {isOpenVisit ? 'Current — all visits' : 'Visit snapshot'}
          </span>
          <span className="whitespace-nowrap text-sm font-semibold text-foreground">
            {formatDate(visit.activatedAt ?? visit.createdAt)}
            {/* Change B: a visit = an encounter; same-day encounters are legitimate
                (no day-grouping). When two or more cards fall on the SAME calendar
                day, append the time so they stay distinguishable. The date stays the
                dominant element — the time is a smaller, muted suffix. */}
            {showTime && (
              <span className="ml-1 text-[11px] font-medium text-muted-foreground">
                · {formatTime(visit.activatedAt ?? visit.createdAt)}
              </span>
            )}
          </span>
          <span
            data-testid="visit-status-badge"
            className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-semibold capitalize ${
              visit.status === 'active'
                ? 'bg-status-done text-status-done-foreground'
                : visit.status === 'completed'
                ? 'bg-blue-100 text-blue-700'
                : visit.status === 'locked'
                ? 'bg-purple-100 text-purple-700'
                : 'bg-status-planned text-status-planned-foreground'
            }`}
          >
            {visit.status}
          </span>
        </div>
      </div>
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
            // Active card fills its (clamped) height so the odontogram scales to
            // the card instead of sitting small with dead space below.
            fluid={isActive}
            // Every card's teeth are selectable. Routing keys on EDITABILITY, not
            // centering: an editable (active/draft) visit opens the editable slideout;
            // any non-editable card (completed/locked — even when centered) opens that
            // tooth's read-only ledger scoped to this visit.
            onSelectTooth={
              isEditable
                ? onSelectTooth
                : onSelectToothHistory
                  ? (toothNumber) => onSelectToothHistory(toothNumber, visit.id)
                  : undefined
            }
            // The carousel slide height is clamped (min(46vh,420px)); 'md' teeth
            // were sized for the old fixed 560px card and overflowed/clipped under
            // the clamp. 'sm' lets the full odontogram (crown + root + surfaces)
            // fit the clamped height — scale the teeth with the card, don't crop.
            toothSize={isActive ? 'sm' : 'xs'}
            showLegend={false}
            // Change C: the compact legend now lives in the card footer (rendered by
            // the carousel), not inside the white chart. DentalChart keeps the
            // compactLegend capability for other consumers; here it stays off.
            compactLegend={false}
            // Change A: tabs are lifted to the header; the in-chart toggle is off.
            // The open card's header tabs drive DentalChart via the controlled
            // visibleLayers prop. Historical cards stay uncontrolled (all layers).
            showLayerToggle={false}
            visibleLayers={isOpenVisit ? visibleLayers : undefined}
            // P0-1: cumulative cross-visit layers + layer toggle apply only to the
            // OPEN card (the living document), bound by visit identity — NOT by which
            // card is centered. Historical cards render their per-visit snapshot layers
            // sourced from chart.layers returned by the API.
            completedToothNumbers={isOpenVisit ? completedToothNumbers : toSet(perVisitLayers?.completed)}
            proposedToothNumbers={isOpenVisit ? proposedToothNumbers : toSet(perVisitLayers?.proposed)}
            declinedToothNumbers={isOpenVisit ? declinedToothNumbers : toSet(perVisitLayers?.declined)}
            carriedOverToothNumbers={isOpenVisit ? carriedOverToothNumbers : undefined}
            conflictedToothNumbers={isOpenVisit ? conflictedToothNumbers : undefined}
            // Cumulative-timeline cues (every card): teeth that transitioned IN this
            // visit, and terminal (missing/extracted) teeth — both sourced from the
            // visit's own as-of chart response.
            changedToothNumbers={toSet(data?.changedThisVisit)}
            terminalToothNumbers={toSet(data?.terminalTeeth)}
            dentitionType={dentitionType}
          />
        )}
      </div>
      {/* Change C: footer strip — compact legend bottom-LEFT (active card only, so
          exactly one in the DOM), Lock affordance right. The active card always
          renders this row to carry the legend; non-active cards only when a lock
          control applies. */}
      {(isActive || visit.status === 'completed' || visit.status === 'locked') && (
        <div className="flex items-center justify-between gap-3 mt-1 min-h-[20px]">
          {isActive ? <ChartCompactLegend /> : <span />}
          <div className="flex items-center justify-end">
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
          </div>
        </div>
      )}
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

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
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
  onSelectToothHistory,
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

  // Change B: which cards share a calendar day. Key on the rendered date string so
  // the disambiguation triggers exactly when two labels would otherwise read identical.
  const dateCounts = new Map<string, number>();
  for (const v of sorted) {
    const key = formatDate(v.activatedAt ?? v.createdAt);
    dateCounts.set(key, (dateCounts.get(key) ?? 0) + 1);
  }

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
        // Issue 3: bullets were tiny and unlabeled. Give each a per-visit aria-label
        // (date + status) and a larger, tappable hit target so the row reads — and
        // operates — as a real timeline.
        pagination={{
          clickable: true,
          renderBullet: (index: number, className: string) => {
            const v = sorted[index];
            const label = v
              ? `Visit ${index + 1} of ${sorted.length}: ${formatDate(v.activatedAt ?? v.createdAt)}, ${v.status}`
              : `Visit ${index + 1}`;
            return `<span class="${className}" role="button" tabindex="0" aria-label="${label}" title="${label}" style="width:11px;height:11px;margin:0 5px;"></span>`;
          },
        }}
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
                showTime={(dateCounts.get(formatDate(visit.activatedAt ?? visit.createdAt)) ?? 0) > 1}
                patientId={patientId}
                patientDateOfBirth={patientDateOfBirth}
                onSelectTooth={onSelectTooth}
                onSelectToothHistory={onSelectToothHistory}
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
          carousel, shown when the most-recent card is centered (no next card peeks
          on the right). Off the last card it's hidden — the sticky context strip
          carries Start-new-visit / the open-visit blocker in every state.
          ZERO-VISIT patients have no card to sit beside, so the affordance is
          centered instead (a brand-new patient must still be able to start their
          first visit — regression guard, journey J21).
          ENABLED → full-opacity lemon CTA. DISABLED (one-active-visit rule: an open
          visit exists, 409 ACTIVE_VISIT_EXISTS) → a distinct-but-legible muted
          button with the reason rendered ON-SURFACE (touch has no hover). */}
      {(onLastCard || sorted.length === 0) && (
        <div
          data-testid="new-visit-gutter"
          // With visits: span the exact right gutter (viewport minus the centered
          // card) and center the CTA in it. With NO visits: there's no card, so
          // center the CTA in the empty carousel row instead of a side strip.
          style={sorted.length === 0 ? undefined : { width: 'calc((100% - min(75%, 920px)) / 2)' }}
          className={
            sorted.length === 0
              ? 'flex items-center justify-center py-8'
              : 'absolute right-0 top-0 bottom-0 z-10 flex items-center justify-center px-2'
          }
        >
          <div className="flex w-full max-w-[9rem] flex-col items-center gap-1">
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
        </div>
      )}
    </div>
  );
}
