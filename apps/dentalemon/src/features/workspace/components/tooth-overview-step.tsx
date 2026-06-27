/**
 * ToothOverviewStep — Step 1 of the tooth slideout wizard
 *
 * Per-surface condition assignment: tap a surface to focus it, then pick a
 * condition from the grid. Each surface gets its own independent condition.
 *
 * Wireframe: docs/prd/context/wireframes/ws-tooth-slideout.html
 * Spec:      docs/superpowers/specs/2026-05-09-workspace-reconciliation-design.md §4.3
 */

import React from 'react';
import { getToothInfo, getToothFillColor, getToothHistoryEventBadge } from './dental-chart.helpers';
import type { ToothState } from './dental-chart.helpers';
import { UniversalToothFdi } from './dental/universal-tooth-fdi';
import type { SurfaceStatus } from './dental/types';
import { getSurfacesForTooth, isAnteriorTooth } from './five-surface-selector.helpers';
import type { ToothSurface } from './five-surface-selector.helpers';
import { useToothHistory } from '../hooks/use-tooth-history';
import type { ChartEntryClassification } from './dental-chart.helpers';
import { findingLabel } from './findings-vocabulary';
import type { ConditionCode } from '@monobase/sdk-ts/generated';
import { APP_LOCALE } from '@/constants/brand';

// Two-axis split of the odontogram `state`: `watchlist` is a disposition (State
// axis); every other clinical value (caries / fractured / …) is a Condition. This
// is presentational categorisation of the EXISTING state value — no new derivation.
const STATE_AXIS_VALUES = new Set<ToothState>(['watchlist']);

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const ENTRY_CLASSIFICATIONS: { value: ChartEntryClassification; label: string; ariaLabel: string; description: string }[] = [
  { value: 'existing',       label: 'Existing',        ariaLabel: 'Existing',        description: 'Pre-existing condition' },
  { value: 'existing_other', label: 'Existing (Other)', ariaLabel: 'Existing-Other', description: 'From another provider' },
  { value: 'treatment_plan', label: 'Treatment Plan',  ariaLabel: 'Treatment Plan',  description: 'Planned treatment' },
  { value: 'condition',      label: 'Condition',       ariaLabel: 'Condition',       description: 'New finding today' },
];

interface ToothOverviewStepProps {
  toothNumber: number;
  patientId: string;
  surfaceConditions: Record<string, ToothState>;
  focusedSurface: ToothSurface | null;
  onFocusSurface: (surface: ToothSurface) => void;
  onAssignCondition: (state: ToothState) => void;
  entryClassification?: ChartEntryClassification;
  onSelectEntryClassification: (c: ChartEntryClassification) => void;
}

const TOOTH_STATES = [
  { value: 'caries' as const, label: 'Caries' },
  { value: 'fractured' as const, label: 'Fracture' },
  { value: 'crown' as const, label: 'Crown' },
  { value: 'extracted' as const, label: 'Extract' },
  { value: 'filled' as const, label: 'Filling' },
  { value: 'missing' as const, label: 'Missing' },
  { value: 'implant' as const, label: 'Implant' },
  { value: 'watchlist' as const, label: 'Watchlist' },
  { value: 'healthy' as const, label: 'Healthy' },
] as const;

/**
 * Map ToothSurface names to the SVG surface IDs used after transformSvgIds().
 * - Upper teeth: lingual → palatal
 * - Anterior teeth: buccal → labial
 */
function toSvgSurfaceName(surface: ToothSurface, toothNumber: number): string {
  const isAnterior = isAnteriorTooth(toothNumber);
  const quadrant = Math.floor(toothNumber / 10);
  const isUpper = quadrant === 1 || quadrant === 2;

  if (surface === 'lingual' && isUpper) return 'palatal';
  if (surface === 'buccal' && isAnterior) return 'labial';
  return surface;
}

/**
 * Normalize SVG surface IDs to ToothSurface values.
 * palatal → lingual, labial → buccal, cervical* → skip
 */
function normalizeSurface(svgSurface: string): ToothSurface | null {
  if (svgSurface === 'palatal') return 'lingual';
  if (svgSurface === 'labial') return 'buccal';
  if (svgSurface.startsWith('cervical')) return null;
  const known: ToothSurface[] = ['mesial', 'distal', 'buccal', 'lingual', 'occlusal', 'incisal'];
  return known.includes(svgSurface as ToothSurface) ? (svgSurface as ToothSurface) : null;
}

export function ToothOverviewStep({
  toothNumber,
  patientId,
  surfaceConditions,
  focusedSurface,
  onFocusSurface,
  onAssignCondition,
  entryClassification,
  onSelectEntryClassification,
}: ToothOverviewStepProps) {
  const { name, type } = getToothInfo(toothNumber);
  const surfaces = getSurfacesForTooth(toothNumber);
  const { history, isLoading, error } = useToothHistory({ patientId, toothNumber });

  // Build SurfaceStatus[] for the SVG diagram from surfaceConditions
  const surfacesStatus: SurfaceStatus[] = Object.entries(surfaceConditions).map(
    ([surface, condition]) => ({
      surface: toSvgSurfaceName(surface as ToothSurface, toothNumber),
      colorCoding: getToothFillColor(condition),
      statusDesc: condition,
      surfaceName: surface,
    })
  );

  function handleSvgClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as SVGElement;
    const id = target.id || target.getAttribute('data-surface') || '';
    const surfaceName = id.includes('_') ? id.split('_').slice(1).join('_') : id;
    if (!surfaceName) return;
    // Strip trailing digit suffixes from SVG IDs (e.g., "mesial3" → "mesial")
    const cleaned = surfaceName.replace(/\d+$/, '');
    const normalized = normalizeSurface(cleaned);
    if (normalized) onFocusSurface(normalized);
  }

  // Determine which condition is active in the picker (the focused surface's condition)
  const activeCondition = focusedSurface ? surfaceConditions[focusedSurface] : undefined;

  return (
    <div className="flex flex-col gap-4">
      {/* Interactive five-surface tooth diagram */}
      <div className="rounded-xl border border-border bg-secondary/30 p-4 flex flex-col gap-3">
        <div
          className="flex justify-center cursor-pointer"
          onClick={handleSvgClick}
          aria-label="Click tooth surfaces to select"
        >
          <UniversalToothFdi
            fdiToothNumber={toothNumber}
            variant="surfacemap"
            size="2xl"
            interactive={false}
            showLabel={false}
            surfacesStatus={surfacesStatus}
          />
        </div>

        {/* Surface pills with colored dots for assigned conditions */}
        <div className="flex flex-wrap justify-center gap-2">
          {surfaces.map((surface) => {
            const assignedCondition = surfaceConditions[surface];
            const isFocused = focusedSurface === surface;
            const dotColor = assignedCondition ? getToothFillColor(assignedCondition) : undefined;
            return (
              <button
                key={surface}
                type="button"
                data-testid={`surface-${surface}`}
                onClick={() => onFocusSurface(surface)}
                aria-pressed={isFocused}
                className={[
                  'px-3 py-1.5 rounded-full border text-sm font-medium capitalize transition-colors flex items-center gap-1.5',
                  isFocused
                    ? 'border-2 border-lemon bg-lemon/20 font-semibold ring-2 ring-lemon ring-offset-1'
                    : assignedCondition
                      ? 'border-border font-medium'
                      : 'border-border hover:bg-secondary',
                ].join(' ')}
              >
                {dotColor && (
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: dotColor }}
                  />
                )}
                {surface}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          {!focusedSurface
            ? 'Tap a surface, then pick a condition'
            : `Assigning condition to ${focusedSurface}`}
        </p>
      </div>

      {/* Condition picker — assigns to focused surface */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold">
          {focusedSurface
            ? `Condition for ${focusedSurface}`
            : 'Select a surface first'}
        </label>
        <div className="grid grid-cols-3 gap-2">
          {TOOTH_STATES.map(({ value, label }) => {
            const isActive = activeCondition === value;
            const dotColor = getToothFillColor(value);
            return (
              <button
                key={value}
                type="button"
                data-testid={`condition-${value}`}
                onClick={() => onAssignCondition(value)}
                disabled={!focusedSurface}
                className={[
                  'flex flex-col items-center gap-1.5 rounded-lg border py-3 min-h-[44px] text-xs font-medium transition-colors',
                  isActive
                    ? 'border-2 font-semibold'
                    : !focusedSurface
                      ? 'border-border opacity-40 cursor-not-allowed'
                      : 'border-border hover:bg-secondary',
                ].join(' ')}
                style={isActive ? {
                  borderColor: dotColor,
                  backgroundColor: `${dotColor}18`,
                } : undefined}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: dotColor }}
                />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Entry classification selector */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold">Entry Classification</label>
        <div className="grid grid-cols-2 gap-2">
          {ENTRY_CLASSIFICATIONS.map(({ value, label, ariaLabel, description }) => {
            const isActive = entryClassification === value;
            return (
              <button
                key={value}
                type="button"
                aria-label={ariaLabel}
                data-testid={`entry-classification-${value}`}
                onClick={() => onSelectEntryClassification(value)}
                className={[
                  'flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors',
                  isActive
                    ? 'border-2 border-lemon bg-lemon/20 font-semibold'
                    : 'border-border hover:bg-secondary',
                ].join(' ')}
              >
                <span className="text-xs font-semibold" aria-hidden="true">{label}</span>
                <span className="text-[10px] text-muted-foreground" aria-hidden="true">{description}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tooth identity */}
      <div className="rounded-xl border border-border bg-card p-3 flex items-center justify-between">
        <div>
          <span className="text-2xl font-bold text-foreground leading-none">{toothNumber}</span>
          <p className="text-xs text-muted-foreground mt-0.5">{name}</p>
        </div>
        <span className={[
          'text-xs font-medium px-2 py-0.5 rounded-full border',
          type === 'anterior'
            ? 'bg-blue-50 text-blue-700 border-blue-200'
            : 'bg-amber-50 text-amber-700 border-amber-200',
        ].join(' ')}>
          {type === 'anterior' ? 'Anterior' : 'Posterior'}
        </span>
      </div>

      {/* Treatment Breakdown — stacked card list (one card per visit-event).
          Phase 1: replaced the cramped 6-column table with iPad-friendly cards so
          the colgroup overlap / mid-word wrap is structurally gone. Condition and
          State are SEPARATE labeled fields per the two-axis model. */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-3 py-2 bg-secondary/30 border-b border-border">
          <h3 className="text-sm font-bold text-foreground">Treatment Breakdown</h3>
        </div>

        {isLoading && (
          <div className="p-3 flex flex-col gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-4 bg-muted rounded animate-pulse" />
            ))}
          </div>
        )}

        {error && !isLoading && (
          <div className="p-3 text-xs text-destructive">Could not load history.</div>
        )}

        {!isLoading && !error && history.length === 0 && (
          <div className="p-4 text-center">
            <p className="text-xs text-muted-foreground">No prior records for this tooth.</p>
          </div>
        )}

        {!isLoading && !error && history.length > 0 && (
          <div className="flex flex-col gap-2 p-2">
            {history.map((entry, idx) => {
              // Two-axis ledger: a finding event reads "Flagged"; a treatment event
              // reads its lifecycle status — so a finding-only row is never blank.
              const badge = getToothHistoryEventBadge({
                eventKind: (entry as { eventKind?: 'finding' | 'treatment' }).eventKind,
                treatmentStatus: entry.treatmentStatus,
              });
              const isStateAxis = STATE_AXIS_VALUES.has(entry.state);
              // Condition axis: prefer the curated finding vocab label, else the
              // odontogram state — but only when the state is itself a condition.
              const conditionLabel = entry.conditionCode
                ? findingLabel(entry.conditionCode as ConditionCode)
                : !isStateAxis
                  ? titleCase(entry.state)
                  : null;
              const stateLabel = isStateAxis ? titleCase(entry.state) : null;
              const surfaceInitials = entry.surfaces && entry.surfaces.length > 0
                ? entry.surfaces.map(s => s.charAt(0).toUpperCase()).join('')
                : null;
              const treatmentText = entry.treatmentDescription || entry.treatmentCdtCode || null;
              return (
                <div
                  key={`${entry.visitId}-${idx}`}
                  data-testid={`breakdown-card-${entry.visitId}-${idx}`}
                  className="rounded-lg border border-border bg-card p-3 flex flex-col gap-1.5"
                >
                  {/* Row 1: date left · status badge + price right */}
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {entry.visitDate
                        ? new Date(entry.visitDate).toLocaleDateString(APP_LOCALE, { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—'}
                      {surfaceInitials && (
                        <span className="ml-1.5 uppercase text-foreground/70">{surfaceInitials}</span>
                      )}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {badge && (
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${badge.className}`}>
                          {badge.label}
                        </span>
                      )}
                      {entry.treatmentPriceCents ? (
                        <span className="text-sm font-medium text-foreground tabular-nums">
                          ₱{(entry.treatmentPriceCents / 100).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Row 2: treatment description (omit the line when there is none) */}
                  {treatmentText && (
                    <p className="text-sm font-medium text-foreground break-words">{treatmentText}</p>
                  )}

                  {/* Row 3: two-axis labeled fields — Condition and State, "—" when absent */}
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                    <span className="text-muted-foreground">
                      <span className="font-semibold">Condition</span>
                      {': '}
                      <span className="text-foreground">{conditionLabel ?? '—'}</span>
                    </span>
                    <span className="text-muted-foreground">
                      <span className="font-semibold">State</span>
                      {': '}
                      <span className="text-foreground">{stateLabel ?? '—'}</span>
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Total footer — unchanged sum over treatmentPriceCents */}
            {history.some(e => e.treatmentPriceCents) && (
              <div className="mt-1 flex items-center justify-between rounded-lg bg-secondary/30 border border-border px-3 py-2">
                <span className="text-sm font-bold text-foreground">Total</span>
                <span className="text-sm font-bold text-foreground tabular-nums">
                  ₱{(history
                    .reduce((sum, e) => sum + (e.treatmentPriceCents || 0), 0) / 100)
                    .toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
