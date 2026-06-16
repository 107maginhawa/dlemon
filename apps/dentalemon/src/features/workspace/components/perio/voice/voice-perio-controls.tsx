/**
 * VoicePerioControls — Phase C UI (plan 09 §3.4–3.6).
 *
 * The voice surface that mounts above the plan-01 perio grid when the
 * `perio.voice_charting` flag is on AND the browser supports SpeechRecognition:
 *   - a mic toggle (lemon primary action),
 *   - an ALWAYS-VISIBLE mic-state indicator (color + icon + label — never
 *     color-only) for idle/listening/applied/paused/error,
 *   - a live transcript strip in an aria-live="polite" region announcing the
 *     last utterance + what field it wrote,
 *   - a confidence-gated confirmation prompt ("Did you say 3?") for
 *     low-confidence / out-of-range / ambiguous values.
 *
 * It is strictly additive: the keyboard/touch grid stays fully functional. This
 * component reads state from useVoicePerio and renders; it owns no perio logic.
 */

import React from 'react';
import { Mic, MicOff, Loader2, CheckCircle2, Pause, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MicState } from './speech-provider';
import type { PendingConfirm, TranscriptEntry } from '../../../hooks/use-voice-perio';

interface MicStateMeta {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  /** Semantic color classes (NOT lemon — lemon is reserved for primary actions). */
  className: string;
  animate?: boolean;
}

const MIC_STATE_META: Record<MicState, MicStateMeta> = {
  idle: { label: 'Mic off', Icon: MicOff, className: 'bg-muted text-muted-foreground' },
  listening: { label: 'Listening', Icon: Mic, className: 'bg-info/15 text-info', animate: true },
  applied: { label: 'Applied', Icon: CheckCircle2, className: 'bg-success/15 text-success' },
  paused: { label: 'Paused', Icon: Pause, className: 'bg-warning/20 text-warning' },
  error: { label: 'Not recognized', Icon: AlertTriangle, className: 'bg-destructive/15 text-destructive' },
};

export interface VoicePerioControlsProps {
  /** Whether the mic is currently engaged (controls the toggle pressed state). */
  active: boolean;
  micState: MicState;
  transcriptLog: readonly TranscriptEntry[];
  pending: PendingConfirm | null;
  onToggle: () => void;
  onConfirm: () => void;
  onDismiss: () => void;
}

export function VoicePerioControls({
  active,
  micState,
  transcriptLog,
  pending,
  onToggle,
  onConfirm,
  onDismiss,
}: VoicePerioControlsProps) {
  const meta = MIC_STATE_META[micState];
  const last = transcriptLog[0] ?? null;

  return (
    <section
      data-testid="voice-perio-controls"
      aria-label="Voice charting"
      className="flex flex-col gap-2 rounded-lg border border-border bg-card/50 p-3"
    >
      <div className="flex flex-wrap items-center gap-3">
        {/* Mic toggle — primary action uses the lemon token. */}
        <button
          type="button"
          data-testid="voice-mic-toggle"
          aria-pressed={active}
          aria-label={active ? 'Stop voice charting' : 'Start voice charting'}
          onClick={onToggle}
          className={cn(
            'flex min-h-[44px] items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold',
            'focus:outline-none focus:ring-2 focus:ring-lemon-focus',
            active
              ? 'bg-lemon text-lemon-foreground hover:bg-lemon-hover'
              : 'border border-border bg-background text-foreground hover:bg-muted',
          )}
        >
          {active ? <Mic className="h-4 w-4" aria-hidden="true" /> : <MicOff className="h-4 w-4" aria-hidden="true" />}
          {active ? 'Voice on' : 'Voice charting'}
        </button>

        {/* Always-visible mic-state indicator: color + icon + LABEL. */}
        <span
          data-testid="voice-mic-state"
          data-state={micState}
          role="status"
          className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
            meta.className,
          )}
        >
          <meta.Icon
            className={cn('h-3.5 w-3.5', meta.animate && 'motion-safe:animate-pulse')}
            aria-hidden="true"
          />
          {meta.label}
        </span>

        {active && (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 motion-safe:animate-spin" aria-hidden="true" />
            Mic is live — speak numbers and keywords only, never patient names.
          </span>
        )}
      </div>

      {/* Live transcript strip — aria-live so screen readers get the same echo. */}
      <div
        data-testid="voice-transcript"
        aria-live="polite"
        aria-atomic="true"
        className="min-h-[1.5rem] rounded-md bg-muted/40 px-2 py-1 text-xs tabular-nums text-foreground"
      >
        {last ? (
          <span>
            <span className="text-muted-foreground">“{last.transcript}”</span>
            {last.applied ? <span className="ml-2 font-semibold">→ {last.applied}</span> : null}
            {!last.applied && last.event === 'needs-confirm' ? (
              <span className="ml-2 text-warning">needs confirmation</span>
            ) : null}
            {!last.applied && last.event === 'noop' ? (
              <span className="ml-2 text-destructive">not recognized</span>
            ) : null}
          </span>
        ) : (
          <span className="text-muted-foreground">No speech yet.</span>
        )}
      </div>

      {/* Last-3-entries mini log for quick eyeball verification. */}
      {transcriptLog.length > 1 && (
        <ul className="flex flex-col gap-0.5 text-[11px] text-muted-foreground" data-testid="voice-recent-log">
          {transcriptLog.slice(1, 4).map((e, i) => (
            <li key={i}>
              “{e.transcript}” {e.applied ? `→ ${e.applied}` : `(${e.event})`}
            </li>
          ))}
        </ul>
      )}

      {/* Confidence-gated confirmation prompt. */}
      {pending && (
        <div
          data-testid="voice-pending-confirm"
          role="alertdialog"
          aria-label="Confirm spoken value"
          className="flex flex-wrap items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm"
        >
          <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
          <span className="font-medium text-foreground">{pending.prompt}</span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              data-testid="voice-confirm-yes"
              onClick={onConfirm}
              className="min-h-[44px] rounded-md bg-lemon px-3 py-1 text-xs font-semibold text-lemon-foreground hover:bg-lemon-hover"
            >
              Yes
            </button>
            <button
              type="button"
              data-testid="voice-confirm-no"
              onClick={onDismiss}
              className="min-h-[44px] rounded-md border border-border px-3 py-1 text-xs font-semibold hover:bg-muted"
            >
              No, repeat
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
