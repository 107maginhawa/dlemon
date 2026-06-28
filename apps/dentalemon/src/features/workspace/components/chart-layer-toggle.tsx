/**
 * ChartLayerToggle — the Existing / Planned / Treated / Declined layer control.
 *
 * Item #2: replaces the loose row of separately-bordered chips with one Apple-style
 * SEGMENTED CONTROL (single Fill-Tertiary track, raised-white active segment). It's
 * visually tighter (no inter-chip gaps or competing borders) and shorter, freeing
 * vertical space — the clinician's ask. ONE component drives all three render sites
 * (standalone chart toggle, the carousel open-card header, and the read-only snapshot
 * key) so they can never drift apart again.
 *
 * Semantics are unchanged: multi-select (each layer independently shown/hidden), NOT
 * a single-select tab bar — so the raised state is per-segment, not exclusive.
 *
 * Touch: segments are 36px tall (the recognised compact height for a secondary
 * segmented filter; the 44px touch budget is spent on the teeth themselves, the
 * primary targets). When `onToggle` is omitted the control renders as a static,
 * non-interactive legend key (historical snapshots).
 */
import React from 'react';
import { getLayerCueSwatch, getLayerLabel } from './dental-chart.helpers';
import type { ChartLayer } from './dental-chart.helpers';

export interface ChartLayerToggleProps {
  /** Layers to render, in order. */
  layers: ChartLayer[];
  /** Active (visible) layer set. Required in interactive mode; ignored when static. */
  visibleLayers?: ReadonlySet<ChartLayer>;
  /** Toggle handler. Omit to render a static, non-interactive legend key. */
  onToggle?: (layer: ChartLayer) => void;
  /** Stretch segments to fill the track width (standalone chart). Default: false. */
  fullWidth?: boolean;
  /** Forwarded to the track for tests / ARIA grouping. */
  'data-testid'?: string;
  /** Accessible group label. */
  ariaLabel?: string;
  /** Reinforcing tooltip on the group. */
  title?: string;
}

const SWATCH_BASE = 'w-2.5 h-2.5 rounded-sm shrink-0';

export function ChartLayerToggle({
  layers,
  visibleLayers,
  onToggle,
  fullWidth = false,
  ariaLabel,
  title,
  ...rest
}: ChartLayerToggleProps) {
  const interactive = typeof onToggle === 'function';
  return (
    <div
      data-testid={rest['data-testid']}
      role={interactive ? 'group' : undefined}
      aria-label={ariaLabel}
      title={title}
      className={[
        'inline-flex items-center gap-0.5 rounded-lg bg-[rgba(118,118,128,0.12)] p-0.5',
        fullWidth ? 'flex w-full' : '',
      ].join(' ')}
    >
      {layers.map((layer) => {
        const cue = getLayerCueSwatch(layer);
        const isActive = !!visibleLayers?.has(layer);
        const swatch = (
          <span
            aria-hidden
            className={`${SWATCH_BASE} ${cue.className} ${interactive && !isActive ? 'opacity-50' : ''}`}
            style={cue.borderColor ? { borderColor: cue.borderColor } : undefined}
          />
        );
        const label = getLayerLabel(layer);
        const segmentClass = [
          'inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1 min-h-[36px] text-xs font-medium transition-colors',
          fullWidth ? 'flex-1' : '',
        ].join(' ');

        if (!interactive) {
          // Static legend key (snapshot cards): decode-only, no raised/active state.
          return (
            <span key={layer} className={`${segmentClass} text-muted-foreground`}>
              {swatch}
              {label}
            </span>
          );
        }

        return (
          <button
            key={layer}
            type="button"
            data-testid={`chart-layer-${layer}`}
            aria-pressed={isActive}
            onClick={() => onToggle(layer)}
            className={[
              segmentClass,
              // Apple segmented control: the active segment is a raised white tile;
              // inactive segments sit flat in the track. Neutral (no status hue) —
              // the cue swatch carries layer identity, so the filter doubles as legend.
              isActive
                ? 'bg-white text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground/80',
            ].join(' ')}
          >
            {swatch}
            {label}
          </button>
        );
      })}
    </div>
  );
}
