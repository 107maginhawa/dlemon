/**
 * use-voice-perio.ts — Phase C orchestration hook.
 *
 * Wires a `SpeechProvider` → `parseUtterance` (pure) → `advance` sequencer (pure)
 * → batched per-tooth upsert through the EXISTING usePerioChart hook. Voice is
 * just another command source feeding the same sequencer + the same write path
 * the keyboard grid uses (plan 09 §3.3 / §3.4).
 *
 * Responsibilities (all UI-agnostic; the component renders the returned state):
 *   - own the sequencer state + cursor (bound to the grid's active cell),
 *   - own mic state + the live transcript strip text,
 *   - confidence-gate: low-confidence / out-of-range / ambiguous → a PENDING
 *     "did you say N?" state, NOT auto-written (§3.5),
 *   - coalesce writes per tooth (one PUT per tooth on "next tooth" / debounce),
 *   - auto-pause after N seconds of silence (privacy, §7 mode-confusion).
 *
 * CAL is never written — recession maps to gm* only; CAL is derived on read.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  advance,
  initSequencerState,
  currentStep,
  type SequencerState,
  type WriteIntent,
  type SequencerEvent,
} from '../components/perio/voice/perio-voice-sequencer';
import { parseUtterance, type ParsedCommand } from '../components/perio/voice/perio-voice-grammar';
import {
  PERIO_GRAMMAR_HINTS,
  type MicState,
  type SpeechProvider,
  type SpeechResult,
} from '../components/perio/voice/speech-provider';
import type { Dentition, PerioSite } from '../components/perio/perio-types';
import type { UpsertToothReadingRequest } from '@monobase/sdk-ts/generated';

/** Below this recognizer confidence, a value is routed to confirmation. */
export const VOICE_CONFIDENCE_THRESHOLD = 0.6;

/** Auto-pause the mic after this many ms of silence (privacy). */
export const VOICE_SILENCE_TIMEOUT_MS = 15_000;

export interface TranscriptEntry {
  /** What was heard. */
  transcript: string;
  /** Human description of the write, e.g. "18 BM → depth 3". */
  applied: string | null;
  event: SequencerEvent;
}

export interface PendingConfirm {
  /** The original transcript that triggered the prompt. */
  transcript: string;
  /** The command awaiting yes/no. */
  command: ParsedCommand;
  /** Human prompt, e.g. "Did you say 3?". */
  prompt: string;
}

export interface UseVoicePerioArgs {
  provider: SpeechProvider;
  dentition?: Dentition;
  /** Existing per-tooth upsert (usePerioChart.upsertReading). */
  upsertReading: (toothNumber: number, body: UpsertToothReadingRequest) => void;
  /** Disable all voice handling (feature flag off / read-only chart). */
  enabled?: boolean;
}

function describeWrite(w: WriteIntent): string {
  return `${w.toothNumber} ${w.field} → ${String(w.value)}`;
}

function promptFor(command: ParsedCommand): string {
  switch (command.kind) {
    case 'depth':
      return `Did you say depth ${command.values.join(' ')}?`;
    case 'recession':
      return Number.isNaN(command.value) ? 'Recession value not heard — repeat?' : `Did you say recession ${command.value}?`;
    case 'grade':
      return Number.isNaN(command.value)
        ? `${command.grade} value not heard — repeat?`
        : `Did you say ${command.grade} ${command.value}?`;
    default:
      return 'Could not confirm — repeat?';
  }
}

export function useVoicePerio({
  provider,
  dentition = 'adult',
  upsertReading,
  enabled = true,
}: UseVoicePerioArgs) {
  const [seqState, setSeqState] = useState<SequencerState>(() => initSequencerState(dentition));
  const [micState, setMicState] = useState<MicState>('idle');
  const [transcriptLog, setTranscriptLog] = useState<TranscriptEntry[]>([]);
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  // Per-tooth write coalescing buffer: tooth → merged patch.
  const buffer = useRef<Map<number, UpsertToothReadingRequest>>(new Map());
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cursor = useMemo(() => currentStep(seqState), [seqState]);

  // Flush all buffered per-tooth patches through the existing upsert hook.
  const flushBuffer = useCallback(() => {
    for (const [tooth, patch] of buffer.current.entries()) {
      if (Object.keys(patch).length > 0) upsertReading(tooth, patch);
    }
    buffer.current.clear();
  }, [upsertReading]);

  // Buffer a write intent; flush the PREVIOUS tooth when we move to a new one.
  const applyWrite = useCallback(
    (w: WriteIntent) => {
      const existing = buffer.current.get(w.toothNumber) ?? {};
      buffer.current.set(w.toothNumber, { ...existing, [w.field]: w.value } as UpsertToothReadingRequest);
    },
    [],
  );

  const resetSilenceTimer = useCallback(() => {
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    silenceTimer.current = setTimeout(() => {
      provider.stopListening();
      setMicState('paused');
    }, VOICE_SILENCE_TIMEOUT_MS);
  }, [provider]);

  // --- result handling -----------------------------------------------------

  const handleResult = useCallback(
    (result: SpeechResult) => {
      if (!enabled) return;
      resetSilenceTimer();
      if (!result.isFinal) return; // only act on finalized utterances

      const step = currentStep(seqState);
      const commands = parseUtterance(result.transcript, {
        confidence: result.confidence,
        currentTooth: step?.tooth,
      });

      if (commands.length === 0) {
        setMicState('error');
        setTranscriptLog((log) =>
          [{ transcript: result.transcript, applied: null, event: 'noop' as SequencerEvent }, ...log].slice(0, 5),
        );
        return;
      }

      let state = seqState;
      const newEntries: TranscriptEntry[] = [];
      let sawConfirm = false;
      let sawPause = false;

      for (const command of commands) {
        const lowConfidence =
          typeof command.confidence === 'number' && command.confidence < VOICE_CONFIDENCE_THRESHOLD;

        // Route low-confidence/out-of-range/ambiguous numeric commands to confirm.
        const isNumeric = command.kind === 'depth' || command.kind === 'recession' || command.kind === 'grade';
        if (isNumeric && (lowConfidence || ('outOfRange' in command && command.outOfRange) || command.ambiguous)) {
          setPending({ transcript: result.transcript, command, prompt: promptFor(command) });
          newEntries.unshift({ transcript: result.transcript, applied: null, event: 'needs-confirm' });
          sawConfirm = true;
          break;
        }

        const res = advance(state, command);
        state = res.nextState;
        const writes = res.writes ?? (res.write ? [res.write] : []);
        for (const w of writes) applyWrite(w);

        if (res.event === 'advanced' || res.event === 'missing' || command.kind === 'nav' || command.kind === 'jump') {
          // Moving teeth — flush the per-tooth buffer (one PUT per tooth).
          flushBuffer();
        }
        if (res.event === 'paused') {
          provider.stopListening();
          setMicState('paused');
          sawPause = true;
        }

        newEntries.unshift({
          transcript: result.transcript,
          applied: writes.length ? writes.map(describeWrite).join(', ') : null,
          event: res.event,
        });
      }

      setSeqState(state);
      if (!sawConfirm && !sawPause) setMicState('applied');
      setTranscriptLog((log) => [...newEntries, ...log].slice(0, 5));
    },
    [enabled, seqState, resetSilenceTimer, applyWrite, flushBuffer, provider],
  );

  // --- confirmation actions ------------------------------------------------

  const confirmPending = useCallback(() => {
    if (!pending) return;
    const res = advance(seqState, pending.command);
    const writes = res.writes ?? (res.write ? [res.write] : []);
    // On explicit confirm we accept even an out-of-range repeat is NOT auto-fixed;
    // confirm only applies in-range commands (writes is empty for needs-confirm).
    for (const w of writes) applyWrite(w);
    setSeqState(res.nextState);
    setPending(null);
    setMicState('applied');
  }, [pending, seqState, applyWrite]);

  const dismissPending = useCallback(() => {
    setPending(null);
    setMicState('listening');
  }, []);

  // --- mic toggle ----------------------------------------------------------

  const start = useCallback(() => {
    provider.setGrammarHints?.(PERIO_GRAMMAR_HINTS);
    provider.startListening();
    resetSilenceTimer();
  }, [provider, resetSilenceTimer]);

  const stop = useCallback(() => {
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    flushBuffer();
    provider.stopListening();
  }, [provider, flushBuffer]);

  // --- provider subscription -----------------------------------------------

  useEffect(() => {
    if (!enabled) return;
    const offResult = provider.onResult(handleResult);
    const offState = provider.onStateChange(setMicState);
    return () => {
      offResult();
      offState();
    };
  }, [provider, enabled, handleResult]);

  useEffect(() => {
    return () => {
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
    };
  }, []);

  return {
    micState,
    /** The current grid cell the cursor is on (tooth + site), for highlight binding. */
    cursorTooth: cursor?.tooth ?? null,
    cursorSite: (cursor?.site ?? null) as PerioSite | null,
    transcriptLog,
    pending,
    start,
    stop,
    confirmPending,
    dismissPending,
    /** Force-flush buffered writes (e.g. before completing the chart). */
    flush: flushBuffer,
  };
}
