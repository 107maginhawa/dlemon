/**
 * PerioChartOverlay — full-screen perio exam surface.
 *
 * A role="dialog" aria-modal panel (perio needs near-full-screen real estate,
 * not a bottom sheet). Owns open/close + a11y (useSheetA11y), the bootstrap
 * state machine, the red-line threshold control, the summary strip, the grid,
 * and the completion flow with AAP risk-factor inputs.
 *
 * Bootstrap states:
 *   - loading          → spinner copy
 *   - error            → retry message
 *   - no chart (404)   → empty state + "Start perio exam"
 *   - draft            → editable grid + Complete
 *   - completed/locked → read-only grid + Stage/Grade/Extent chips
 */

import React, { useMemo, useRef, useState } from 'react';
import { X, Activity } from 'lucide-react';
import { useSheetA11y } from '@/hooks/use-sheet-a11y';
import { cn } from '@/lib/utils';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { usePerioChart } from '../../hooks/use-perio-chart';
import { useVoicePerio } from '../../hooks/use-voice-perio';
import { PerioChartGrid } from './perio-chart-grid';
import { PerioComparison } from './perio-comparison';
import { PerioSummaryBar } from './perio-summary-bar';
import { PerioClassificationPanel } from './perio-classification-panel';
import { VoicePerioControls } from './voice/voice-perio-controls';
import { WebSpeechProvider, isSpeechRecognitionSupported, type SpeechProvider } from './voice/speech-provider';
import { DEFAULT_DEPTH_THRESHOLD, countOverThreshold, computeLivePerioSummary } from './perio-types';
import type { CompletePerioChartRequest } from '@monobase/sdk-ts/generated';

export interface PerioChartOverlayProps {
  patientId: string;
  visitId: string;
  open: boolean;
  onClose: () => void;
  /**
   * Test/E2E seam: inject a SpeechProvider (e.g. FakeSpeechProvider). In
   * production a WebSpeechProvider is created lazily when voice is engaged.
   */
  speechProvider?: SpeechProvider;
  /** Force the voice flag on (tests/E2E). Defaults to the feature-flag value. */
  voiceEnabled?: boolean;
}

const MIN_ADULT_READINGS = 16;

/** Stable no-op provider so useVoicePerio's hook order never changes. */
const NOOP_PROVIDER: SpeechProvider = {
  startListening() {},
  stopListening() {},
  onResult() {
    return () => {};
  },
  onStateChange() {
    return () => {};
  },
};

export function PerioChartOverlay({
  patientId,
  visitId,
  open,
  onClose,
  speechProvider,
  voiceEnabled,
}: PerioChartOverlayProps) {
  useSheetA11y({ open, onClose });

  const {
    chart,
    readings,
    isLoading,
    isError,
    startChart,
    upsertReading,
    completeChart,
    completion,
    completionError,
    isStarting,
    isCompleting,
  } = usePerioChart({ patientId, visitId, enabled: open });

  const [threshold, setThreshold] = useState(DEFAULT_DEPTH_THRESHOLD);
  const [riskFactors, setRiskFactors] = useState<CompletePerioChartRequest>({});
  // Multi-exam comparison: toggle between this visit's chart and the patient's
  // longitudinal perio history (read-only trend across past completed exams).
  const [view, setView] = useState<'current' | 'history'>('current');

  const status = chart?.status ?? null;
  const readOnly = status === 'completed' || status === 'locked';

  // --- Voice charting (P2-4) — additive, behind the feature flag + capability
  // detection. Hidden entirely where unsupported (Safari/iPad) → keyboard only.
  // E2E seam: a scripted provider may be injected on `window.__perioVoiceProvider`
  // (never set in production) so the Playwright suite drives voice deterministically.
  const injected =
    speechProvider ??
    (typeof window !== 'undefined'
      ? (window as unknown as { __perioVoiceProvider?: SpeechProvider }).__perioVoiceProvider
      : undefined);
  const flagOn = voiceEnabled ?? (Boolean(injected) || isFeatureEnabled('perio.voice_charting'));
  const supported = Boolean(injected) || isSpeechRecognitionSupported();
  const voiceAvailable = flagOn && supported && !readOnly && Boolean(chart);

  const providerRef = useRef<SpeechProvider | null>(injected ?? null);
  if (voiceAvailable && !providerRef.current) {
    providerRef.current = new WebSpeechProvider();
  }
  const provider = providerRef.current;

  const [voiceActive, setVoiceActive] = useState(false);
  const voice = useVoicePerio({
    // A no-op provider keeps hook order stable when voice is unavailable.
    provider: provider ?? NOOP_PROVIDER,
    dentition: 'adult',
    upsertReading,
    enabled: voiceAvailable,
  });

  function toggleVoice() {
    if (!voiceAvailable) return;
    if (voiceActive) {
      voice.stop();
      setVoiceActive(false);
    } else {
      voice.start();
      setVoiceActive(true);
    }
  }
  const readingCount = readings.length;
  const overThresholdCount = useMemo(() => countOverThreshold(readings, threshold), [readings, threshold]);
  // In draft the backend hasn't computed the summary yet. Rather than show "–" next to
  // a live over-threshold count (incoherent mixed sources), compute BOP%/mean/deep live
  // from the same readings with the same formula — the preview equals the finalized
  // numbers. Once completed/locked we use the canonical persisted summary.
  const liveSummary = useMemo(() => computeLivePerioSummary(readings), [readings]);
  const isDraft = status === 'draft';

  // Stage/Grade/Extent: from the completion response, else from a chart that is
  // already completed (re-opened). The persisted chart does not carry stage, so
  // we only show chips from the completion response within the session.
  const stage = completion?.stage;
  const grade = completion?.grade;
  const extent = completion?.extent;

  const canComplete = !readOnly && readingCount >= MIN_ADULT_READINGS && !isCompleting;

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Periodontal chart"
      data-testid="perio-overlay"
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Periodontal chart</h2>
          {status && (
            <span
              data-testid="perio-status-badge"
              className={cn(
                'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                status === 'draft' && 'bg-yellow-100 text-yellow-800',
                status === 'completed' && 'bg-green-100 text-green-800',
                status === 'locked' && 'bg-gray-100 text-gray-500',
              )}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Current exam ↔ multi-exam history toggle */}
          <div className="flex items-center rounded-lg border border-border p-0.5" role="tablist" aria-label="Perio view">
            {(['current', 'history'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                data-testid={`perio-view-${v}`}
                onClick={() => setView(v)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  view === v ? 'bg-lemon text-lemon-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {v === 'current' ? 'Current exam' : 'History'}
              </button>
            ))}
          </div>
          {view === 'current' && chart && (
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              Threshold
              <select
                aria-label="Red-line depth threshold"
                data-testid="perio-threshold-select"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="h-8 rounded-md border border-border bg-background px-1 text-sm"
              >
                {[4, 5, 6, 7].map((t) => (
                  <option key={t} value={t}>
                    ≥{t}mm
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close perio chart"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-4">
        {view === 'history' ? (
          <PerioComparison patientId={patientId} enabled={open} />
        ) : isLoading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Loading perio chart…</p>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Activity className="h-8 w-8 text-destructive/50" />
            <p className="text-sm text-destructive">Couldn’t load the perio chart. Please try again.</p>
          </div>
        ) : !chart ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Activity className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No perio exam for this visit yet.</p>
            <button
              type="button"
              data-testid="perio-start-btn"
              disabled={isStarting}
              onClick={startChart}
              className="min-h-[44px] rounded-lg bg-lemon px-5 py-2 text-sm font-semibold text-lemon-foreground hover:bg-lemon-hover disabled:opacity-50"
            >
              {isStarting ? 'Starting…' : 'Start perio exam'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <PerioSummaryBar
              bopPercent={isDraft ? liveSummary.bopPercent : chart.summaryBopPercent}
              meanDepth={isDraft ? liveSummary.meanDepth : chart.summaryMeanDepth}
              deepPocketCount={isDraft ? liveSummary.deepPocketCount : chart.summaryDeepPocketCount}
              overThresholdCount={overThresholdCount}
              stage={stage}
              grade={grade}
              extent={extent}
            />

            {/* Keyboard legend */}
            <p className="text-[11px] text-muted-foreground">
              Digits set depth · cells auto-advance · click a dot to toggle bleeding · over-threshold
              depths show in red.
            </p>

            {voiceAvailable && (
              <VoicePerioControls
                active={voiceActive}
                micState={voice.micState}
                transcriptLog={voice.transcriptLog}
                pending={voice.pending}
                onToggle={toggleVoice}
                onConfirm={voice.confirmPending}
                onDismiss={voice.dismissPending}
              />
            )}

            <PerioChartGrid
              readings={readings}
              threshold={threshold}
              readOnly={readOnly}
              onPatchTooth={(toothNumber, patch) => upsertReading(toothNumber, patch)}
              activeCell={
                voiceActive && voice.cursorTooth != null && voice.cursorSite != null
                  ? { tooth: voice.cursorTooth, site: voice.cursorSite }
                  : null
              }
            />

            {!readOnly && (
              <>
                <PerioClassificationPanel value={riskFactors} disabled={isCompleting} onChange={setRiskFactors} />

                {completionError && (
                  <p data-testid="perio-completion-error" className="text-sm text-destructive">
                    {completionError.message}
                  </p>
                )}

                <div className="flex items-center justify-end gap-3">
                  <span className="text-xs text-muted-foreground">
                    {readingCount}/{MIN_ADULT_READINGS} teeth charted
                  </span>
                  <button
                    type="button"
                    data-testid="perio-complete-btn"
                    disabled={!canComplete}
                    onClick={() => completeChart(riskFactors)}
                    className="min-h-[44px] rounded-lg bg-lemon px-5 py-2 text-sm font-semibold text-lemon-foreground hover:bg-lemon-hover disabled:opacity-50"
                  >
                    {isCompleting ? 'Completing…' : 'Complete exam'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
