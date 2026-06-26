/**
 * DentalChart — interactive SVG dental chart
 *
 * Renders 32 teeth with tooth numbers displayed in the notation selected in
 * branch settings (FDI / Universal / Palmer). Tooth identity (key, click
 * callbacks, API data) always uses the canonical FDI number — only the
 * visible label changes.
 *
 * P1-15: Layer toggle is multi-select (combinable), not mutually exclusive.
 * P1-17: Mixed dentition renders both erupted permanent + remaining primary teeth.
 *
 * Wireframe: docs/prd/context/wireframes/workspace-wireframe.html
 */

import React, { useState } from 'react';
import {
  TOOTH_NUMBERS,
  PEDIATRIC_TOOTH_NUMBERS,
  buildToothMap,
  getToothFillColor,
  getToothInfo,
  getToothDisplayLabel,
  isToothVisible,
  resolveToothLayer,
  getLayerOutline,
  getLayerCueSwatch,
  stateNeedsCvdMark,
  getLayerLabel,
  hasMultipleSurfaceConditions,
  DEFAULT_VISIBLE_LAYERS,
  getMixedDentitionTeeth,
} from './dental-chart.helpers';
import type { ToothData, ToothState, DentitionType, ChartLayer, ToothNotation } from './dental-chart.helpers';
import { UniversalToothFdi } from './dental/universal-tooth-fdi';
import { useOrgContextStore } from '@/stores/org-context.store';
import { useBranchSettings } from '@/features/settings/hooks/use-branch-settings';

export interface DentalChartProps {
  teeth: ToothData[];
  selectedTooth?: number | null;
  onSelectTooth?: (toothNumber: number) => void;
  /** Size of each tooth SVG. Use 'xs' inside carousel cards, 'sm' for standalone. Default: 'sm' */
  toothSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Show the full interactive color/filter legend below the chart. Default: true */
  showLegend?: boolean;
  /** P1-3: show a COMPACT, non-interactive state key (always-on inside carousel
   *  cards, where the full legend is hidden). Decodes the main fills + the
   *  Planned dotted edge so the chart is never an unlabeled wall of colour. */
  compactLegend?: boolean;
  /** Permanent (32-tooth adult), primary (20-tooth pediatric), or mixed (dual-arch). Default: 'permanent' */
  dentitionType?: DentitionType;
  /** Show the baseline/proposed/completed layer toggle. Default: true (gate to active card in carousels). */
  showLayerToggle?: boolean;
  /** Controlled visible-layer set. When provided it overrides the internal toggle
   *  state — used when the layer tabs are lifted into a parent (the carousel header
   *  hosts them so controls sit left of the date/status context cluster). */
  visibleLayers?: ReadonlySet<ChartLayer>;
  /** CHART-XV cumulative cross-visit sets (from the patient treatment-plan aggregate). */
  /** FDI numbers with a performed/verified treatment — drives the 'completed' layer (cumulative). */
  completedToothNumbers?: Set<number>;
  /** FDI numbers with a live planned treatment (diagnosed/planned) — drives the 'proposed' layer. */
  proposedToothNumbers?: Set<number>;
  /** FDI numbers whose recommended treatment the patient declined — drives the 'declined' layer. */
  declinedToothNumbers?: Set<number>;
  /** Subset of proposed teeth first proposed in a PRIOR visit — surfaced with a carried-over marker. */
  carriedOverToothNumbers?: Set<number>;
  /** P0-A: FDI numbers with an open offline sync conflict — marked so the clinician
   *  knows a rejected edit needs resolving (resolve via the conflict banner). */
  conflictedToothNumbers?: Set<number>;
  /** Cumulative-timeline: FDI numbers whose layer transitioned IN this visit — cued
   *  with a "changed this visit" marker so the card reads as a point in the story. */
  changedToothNumbers?: Set<number>;
  /** Cumulative-timeline: FDI numbers in a terminal state (missing/extracted) as-of
   *  this visit — painted by the fill, never given an actionable Planned/Treated ring. */
  terminalToothNumbers?: Set<number>;
  /** Fill mode: scale teeth to fill the chart's height (used by the carousel's
   *  active card) so the odontogram fits any card size — no dead space, no clip —
   *  instead of a fixed pixel tooth width that leaves the card half-empty. */
  fluid?: boolean;
}

/**
 * P1-2: the status tabs are demoted to NEUTRAL show/hide filters (no hue) and
 * renamed via getLayerLabel (Existing / Planned / Treated / Declined). Colour
 * now lives only in the always-on state legend + the tooth fills, not the chips —
 * this is the core of the lemon de-overload (the proposed chip was lemon). Lemon
 * is reserved for interaction (selection ring, CTA), never status.
 */
const LAYER_FILTER_ORDER: ChartLayer[] = ['baseline', 'proposed', 'completed', 'declined'];

export function DentalChart({
  teeth,
  selectedTooth,
  onSelectTooth,
  toothSize = 'sm',
  showLegend = true,
  compactLegend = false,
  dentitionType = 'permanent',
  showLayerToggle = true,
  completedToothNumbers,
  proposedToothNumbers,
  declinedToothNumbers,
  carriedOverToothNumbers,
  conflictedToothNumbers,
  changedToothNumbers,
  terminalToothNumbers,
  fluid = false,
  visibleLayers: visibleLayersProp,
}: DentalChartProps) {
  // ── Notation preference (QW-5) ───────────────────────────────────────────
  // Read from branch settings so the chart respects the locale/notation toggle
  // saved in Settings → Locale. Falls back to FDI when settings are loading or
  // not yet configured. Tooth identity stays FDI throughout — only labels change.
  const branchId = useOrgContextStore((s) => s.branchId);
  const { settings } = useBranchSettings(branchId);
  const notation: ToothNotation =
    (settings?.toothNotation as ToothNotation | undefined) ?? 'FDI';

  const toothMap = buildToothMap(teeth);
  // Per-tooth entryClassification lookup for layer resolution (CR-03).
  const toothByNumber = new Map<number, ToothData>(teeth.map((t) => [t.toothNumber, t]));
  const [filterStates, setFilterStates] = useState<Set<ToothState>>(new Set());

  // P1-15: multi-select layers (Set<ChartLayer>) instead of single activeLayer.
  // Default shows all three layers simultaneously. When the parent supplies a
  // controlled set (visibleLayersProp), it wins — the lifted carousel tabs drive it.
  const [internalVisibleLayers, setVisibleLayers] = useState<Set<ChartLayer>>(
    new Set(DEFAULT_VISIBLE_LAYERS),
  );
  const visibleLayers = visibleLayersProp ?? internalVisibleLayers;

  /** Toggle a layer on/off. Never empties the set — if the last layer is clicked, keep it. */
  function toggleLayer(layer: ChartLayer) {
    setVisibleLayers(prev => {
      const next = new Set(prev);
      if (next.has(layer)) {
        // Prevent deselecting the last visible layer
        if (next.size === 1) return prev;
        next.delete(layer);
      } else {
        next.add(layer);
      }
      return next;
    });
  }

  /**
   * Effective layer for a tooth, from CUMULATIVE cross-visit treatment status
   * (CHART-XV). Precedence completed > proposed > declined > entryClassification.
   */
  function toothLayerFor(toothNumber: number): ChartLayer {
    return resolveToothLayer(toothNumber, toothByNumber.get(toothNumber)?.entryClassification, {
      completed: completedToothNumbers,
      proposed: proposedToothNumbers,
      declined: declinedToothNumbers,
    });
  }

  function toggleFilter(state: ToothState) {
    setFilterStates(prev => {
      const next = new Set(prev);
      if (next.has(state)) next.delete(state);
      else next.add(state);
      return next;
    });
  }

  // ── P1-17: Mixed dentition arch layout ──────────────────────────────────
  // Mixed dentition shows a combined set of primary + erupted permanent teeth.
  // We render two rows: a "permanent" row for the standard 8-position arch, and
  // a "primary" row in the canine/molar region where primary teeth persist.
  //
  // For simplicity and clarity, mixed dentition uses the getMixedDentitionTeeth()
  // set and renders primary teeth (51-85) interleaved with permanent (11-48) in
  // the standard arch grid — primary teeth are rendered at slightly smaller size
  // with a visual indicator so clinicians can distinguish them at a glance.

  const isMixed = dentitionType === 'mixed';
  const isPrimary = dentitionType === 'primary';

  // Determine the tooth number sets for each quadrant
  let upperRight: number[];
  let upperLeft: number[];
  let lowerLeft: number[];
  let lowerRight: number[];

  if (isPrimary) {
    upperRight = PEDIATRIC_TOOTH_NUMBERS.filter(n => n >= 51 && n <= 55).reverse(); // 55 → 51
    upperLeft  = PEDIATRIC_TOOTH_NUMBERS.filter(n => n >= 61 && n <= 65);            // 61 → 65
    lowerLeft  = PEDIATRIC_TOOTH_NUMBERS.filter(n => n >= 71 && n <= 75);            // 71 → 75
    lowerRight = PEDIATRIC_TOOTH_NUMBERS.filter(n => n >= 81 && n <= 85).reverse();  // 85 → 81
  } else if (isMixed) {
    // Mixed: use the full mixed set split by quadrant.
    // Primary teeth (51-85) and permanent teeth (11-48) are in the same set;
    // render each quadrant in anatomical order (midline outward).
    const mixedSet = getMixedDentitionTeeth();
    // Upper right: permanent 11-12 + primary 53-55 in anatomical order (midline→distal)
    const urPermanent = mixedSet.filter(n => n >= 11 && n <= 18).reverse(); // 1x: 11→18
    const urPrimary = mixedSet.filter(n => n >= 51 && n <= 55).reverse();   // 5x: 55→51
    upperRight = [...urPermanent, ...urPrimary.filter(n => !urPermanent.some(p => p % 10 === n % 10))];

    // Build each quadrant independently for cleaner split
    const allMixedPermanentUR = mixedSet.filter(n => n >= 11 && n <= 18);
    const allMixedPrimaryUR   = mixedSet.filter(n => n >= 51 && n <= 55);
    const allMixedPermanentUL = mixedSet.filter(n => n >= 21 && n <= 28);
    const allMixedPrimaryUL   = mixedSet.filter(n => n >= 61 && n <= 65);
    const allMixedPermanentLL = mixedSet.filter(n => n >= 31 && n <= 38);
    const allMixedPrimaryLL   = mixedSet.filter(n => n >= 71 && n <= 75);
    const allMixedPermanentLR = mixedSet.filter(n => n >= 41 && n <= 48);
    const allMixedPrimaryLR   = mixedSet.filter(n => n >= 81 && n <= 85);

    // Anatomical layout: permanent midline teeth first, then primary distal teeth
    upperRight = [...allMixedPermanentUR.reverse(), ...allMixedPrimaryUR.reverse()];
    upperLeft  = [...allMixedPermanentUL, ...allMixedPrimaryUL];
    lowerLeft  = [...allMixedPermanentLL, ...allMixedPrimaryLL];
    lowerRight = [...allMixedPermanentLR.reverse(), ...allMixedPrimaryLR.reverse()];
  } else {
    // Permanent (default)
    upperRight = TOOTH_NUMBERS.filter(n => n >= 11 && n <= 18).reverse(); // 18 → 11
    upperLeft  = TOOTH_NUMBERS.filter(n => n >= 21 && n <= 28);           // 21 → 28
    lowerLeft  = TOOTH_NUMBERS.filter(n => n >= 31 && n <= 38);           // 31 → 38
    lowerRight = TOOTH_NUMBERS.filter(n => n >= 41 && n <= 48).reverse(); // 48 → 41
  }

  function renderTooth(toothNumber: number, isLastInQuadrant = false) {
    const state = toothMap.get(toothNumber) ?? 'healthy' as ToothState;
    const isSelected = selectedTooth === toothNumber;
    const { name } = getToothInfo(toothNumber);
    const toothLayer = toothLayerFor(toothNumber);
    // P1-15: dim when the tooth's layer is not in the visible set
    const isLayerHidden = !isToothVisible(toothLayer, visibleLayers);
    const isFilterDimmed = filterStates.size > 0 && !filterStates.has(state);
    const isDimmed = isFilterDimmed || isLayerHidden;
    // Proposed work stays visually distinct (dotted outline) when its layer is visible — CHART-BR-006.
    const isProposedOnLayer = toothLayer === 'proposed' && !isLayerHidden;
    // CHART-XV: a proposed tooth first proposed in a PRIOR visit — surface it with
    // an amber dotted ring so aging pending work stands out from today's proposals.
    const isCarriedOver = isProposedOnLayer && !!carriedOverToothNumbers?.has(toothNumber);
    // CHART-XV: declined = refused recommendation — desaturated gray diagonal hatch
    // (a stroke/pattern, never a 4th saturated fill; the double-slash stays reserved
    // for extraction). Encodes state on a non-color channel for grayscale legibility.
    const isDeclinedOnLayer = toothLayer === 'declined' && !isLayerHidden;
    // P1-1: the layer is encoded on a NEUTRAL edge (lemon reserved for
    // interaction). Only apply the edge when the layer is actually visible.
    const outlineFor = isLayerHidden
      ? undefined
      : getLayerOutline(toothLayer, { carriedOver: isCarriedOver });
    // P0-A: this tooth has an open offline conflict (a rejected stale write).
    const isConflicted = !!conflictedToothNumbers?.has(toothNumber);
    // Cumulative-timeline: this tooth's layer transitioned IN this visit — cue it so
    // the card reads as a point in the story (a ✦ glyph: a SHAPE, CVD-safe, never
    // colour-only). Terminal teeth (missing/extracted) are flagged for the title/data.
    const isChanged = !isDimmed && !!changedToothNumbers?.has(toothNumber);
    const isTerminal = !!terminalToothNumbers?.has(toothNumber);
    // Item 5 / Option B: this tooth carries ≥2 distinct surface conditions, so
    // the single dominant fill can't tell the whole story. Flag it with a
    // corner pip → "open for detail" (the slideout renders the per-surface map).
    const isMultiSurface =
      !isDimmed && hasMultipleSurfaceConditions(toothByNumber.get(toothNumber)?.surfaceConditionMap);
    // Display label for the current notation preference (QW-5).
    const displayLabel = getToothDisplayLabel(toothNumber, notation);
    // Primary teeth in mixed dentition rendered at smaller size for visual distinction
    const isPrimaryTooth = toothNumber >= 51 && toothNumber <= 85;
    const effectiveSize = isMixed && isPrimaryTooth ? 'xs' : toothSize;

    return (
      <button
        key={toothNumber}
        type="button"
        data-testid={`tooth-${toothNumber}`}
        data-tooth-layer={toothLayer}
        data-tooth-label={displayLabel}
        data-tooth-primary={isPrimaryTooth ? '1' : undefined}
        data-carried-over={isCarriedOver ? '1' : undefined}
        data-conflicted={isConflicted ? '1' : undefined}
        data-changed={isChanged ? '1' : undefined}
        data-terminal={isTerminal ? '1' : undefined}
        onClick={() => onSelectTooth?.(toothNumber)}
        title={`Tooth ${displayLabel} — ${name} (${state}, ${toothLayer}${isCarriedOver ? ', carried over from a prior visit' : ''}${isConflicted ? ' — unsynced edit needs review' : ''}${isChanged ? ' — changed this visit' : ''}${isTerminal ? ' — terminal (no further treatment)' : ''})`}
        style={{
          flex: '1 1 0',
          minWidth: 0,
          overflow: 'hidden',
          opacity: isDimmed ? 0.2 : 1,
          transition: 'opacity 200ms',
          outline: outlineFor,
          outlineOffset: '-2px',
          // Declined: diagonal hatch texture (non-color channel), gray.
          backgroundImage: isDeclinedOnLayer
            ? 'repeating-linear-gradient(45deg, rgba(156,163,175,0.35) 0, rgba(156,163,175,0.35) 2px, transparent 2px, transparent 5px)'
            : undefined,
        }}
        className={[
          'relative flex flex-col items-center rounded p-0.5 cursor-pointer transition-colors duration-150',
          !isLastInQuadrant ? 'border-r border-slate-200' : '',
          isSelected ? 'bg-primary/10 ring-2 ring-primary/50' : 'hover:bg-muted/50',
        ].join(' ')}
        aria-label={`Tooth ${displayLabel}: ${name}, ${state}, ${toothLayer}`}
        aria-pressed={isSelected}
      >
        <UniversalToothFdi
          fdiToothNumber={toothNumber}
          label={displayLabel}
          fillColor={getToothFillColor(state) || undefined}
          size={effectiveSize}
          fill={fluid}
          interactive={false}
          showLabel={true}
        />
        {/* P1-3: CVD redundancy — caries (dot) and fractured (slash) get a
            non-colour mark so they stay distinguishable in grayscale / under
            protanopia, where caries-red and fractured-orange collapse together. */}
        {stateNeedsCvdMark(state) && !isDimmed && (
          state === 'caries' ? (
            <span
              data-testid={`tooth-cvd-mark-${toothNumber}`}
              data-cvd-mark="caries"
              aria-hidden="true"
              className="absolute bottom-0.5 right-0.5 h-1 w-1 rounded-full bg-gray-900"
            />
          ) : (
            <span
              data-testid={`tooth-cvd-mark-${toothNumber}`}
              data-cvd-mark="fractured"
              aria-hidden="true"
              className="absolute bottom-0.5 right-0.5 h-1.5 w-px rotate-45 bg-gray-900"
            />
          )
        )}
        {isMultiSurface && (
          <span
            data-testid={`tooth-multisurface-${toothNumber}`}
            data-multisurface="1"
            aria-label="Multiple surface conditions — open for detail"
            title="Multiple surface conditions — open for detail"
            className="absolute top-0 left-0 h-2 w-2 rounded-full border border-white bg-slate-700"
          />
        )}
        {isConflicted && (
          <span
            data-testid={`tooth-conflict-${toothNumber}`}
            aria-label="Unsynced edit needs review"
            className="absolute top-0 right-0 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-amber-500 text-[7px] font-bold text-white"
          >
            !
          </span>
        )}
        {isChanged && (
          <span
            data-testid={`tooth-changed-${toothNumber}`}
            data-changed-cue="1"
            aria-label="Changed this visit"
            title="Changed this visit"
            // ✦ is a SHAPE cue (not colour-only) so it survives grayscale / CVD; the
            // slate hue keeps lemon reserved for interaction.
            className="pointer-events-none absolute -top-1 -left-1 text-[0.5rem] leading-none text-slate-700"
          >
            ✦
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      data-testid="dental-chart"
      data-dentition={dentitionType}
      className="h-full flex flex-col rounded-md overflow-hidden border border-border bg-white"
    >
      {/* P1-15: Multi-select layer chips — baseline / proposed / completed */}
      {showLayerToggle && (
        <div
          data-testid="chart-layer-toggle"
          role="group"
          aria-label="Chart layers — toggle to show or hide"
          className="flex gap-1.5 px-2 py-1.5 border-b border-border/60 bg-muted/40"
        >
          {LAYER_FILTER_ORDER
            // CHART-XV: only surface the Declined chip when refused work exists —
            // it's an uncommon state, so it stays out of the way until relevant.
            .filter((layer) => layer !== 'declined' || (declinedToothNumbers?.size ?? 0) > 0)
            .map((layer) => {
            const isActive = visibleLayers.has(layer);
            const cue = getLayerCueSwatch(layer);
            return (
              <button
                key={layer}
                type="button"
                data-testid={`chart-layer-${layer}`}
                onClick={() => toggleLayer(layer)}
                aria-pressed={isActive}
                className={[
                  'flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium border transition-colors',
                  // Item 4: ON = filled chip, OFF = outline. Neutral fill (no status
                  // hue; lemon reserved for interaction) — the per-chip cue swatch
                  // carries the layer identity, so the filter doubles as the legend.
                  isActive
                    ? 'bg-foreground/10 text-foreground border-foreground/30'
                    : 'bg-transparent text-muted-foreground border-border hover:bg-muted/50',
                ].join(' ')}
              >
                <span
                  aria-hidden
                  className={`w-2.5 h-2.5 rounded-sm shrink-0 ${cue.className} ${isActive ? '' : 'opacity-50'}`}
                  style={cue.borderColor ? { borderColor: cue.borderColor } : undefined}
                />
                {getLayerLabel(layer)}
              </button>
            );
          })}
        </div>
      )}

      {/* Mixed dentition label banner (P1-17) */}
      {isMixed && (
        <div
          data-testid="mixed-dentition-banner"
          className="px-2 py-0.5 text-[10px] text-muted-foreground bg-muted/40 border-b border-border/50 text-center"
          aria-label="Mixed dentition: primary and permanent teeth shown together"
        >
          Mixed dentition — primary (smaller) + permanent teeth
        </div>
      )}

      {/* Upper arch */}
      <div className="flex flex-1 min-h-0">
        {upperRight.map((n, i) => renderTooth(n, i === upperRight.length - 1))}
        <div style={{ width: 1, flexShrink: 0, borderRight: '1px dashed #cbd5e1' }} />
        {upperLeft.map((n, i) => renderTooth(n, i === upperLeft.length - 1))}
      </div>

      {/* Arch midline — standalone (was a borderBottom glued to the upper arch,
          which pulled the lower numbers visually tighter to their teeth). As its
          own element between two equal flex-1 arches it keeps the number↔tooth
          spacing symmetric across arches. Darkened for the white surface. */}
      <div aria-hidden className="mx-1 border-t-2 border-dashed border-slate-300" />

      {/* Lower arch */}
      <div className="flex flex-1 min-h-0">
        {lowerRight.map((n, i) => renderTooth(n, i === lowerRight.length - 1))}
        <div style={{ width: 1, flexShrink: 0, borderRight: '1px dashed #cbd5e1' }} />
        {lowerLeft.map((n, i) => renderTooth(n, i === lowerLeft.length - 1))}
      </div>

      {/* P1-3: compact always-on state key — used in carousel cards where the full
          interactive legend is hidden, so the working chart is never an unlabeled
          wall of colour. Non-interactive; decodes the main fills + the Planned edge. */}
      {compactLegend && !showLegend && (
        <div
          data-testid="chart-compact-legend"
          className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 text-xs text-muted-foreground border-t border-border/60 bg-muted/40"
        >
          {([
            { label: 'Caries',    state: 'caries' as const },
            { label: 'Fractured', state: 'fractured' as const },
            { label: 'Filled',    state: 'filled' as const },
            { label: 'Crown',     state: 'crown' as const },
          ]).map(({ label, state }) => (
            <span key={state} className="flex items-center gap-1">
              <span
                className="w-3 h-3 rounded-sm inline-block flex-shrink-0 border border-black/15"
                style={{ backgroundColor: getToothFillColor(state) }}
              />
              {label}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span
              className="w-3 h-3 rounded-sm inline-block flex-shrink-0 border-2 border-dotted"
              style={{ borderColor: '#475569' }}
            />
            Planned
          </span>
          <span className="flex items-center gap-1">
            <span
              className="w-3 h-3 rounded-sm inline-block flex-shrink-0 border-2 border-solid"
              style={{ borderColor: '#059669' }}
            />
            Treated
          </span>
        </div>
      )}

      {/* Legend */}
      {showLegend && (
        <div className="flex flex-wrap gap-3 px-3 py-2 text-xs text-muted-foreground border-t border-border/60 bg-muted/40">
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
                  className={`w-3 h-3 rounded-sm inline-block flex-shrink-0 ${bordered ? 'border border-dashed border-gray-400' : 'border border-black/15'}`}
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
