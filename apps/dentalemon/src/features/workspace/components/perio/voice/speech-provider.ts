/**
 * speech-provider.ts — Phase B speech-engine abstraction (plan 09 §3.1).
 *
 * The recognition engine is hidden behind a `SpeechProvider` interface so the
 * parser/sequencer cores consume NORMALIZED transcript tokens, never raw engine
 * output. Swapping Web Speech → cloud STT → on-device later is a provider change
 * with zero change to the testable cores.
 *
 * Ships:
 *   - the `SpeechProvider` interface + `MicState` model,
 *   - `WebSpeechProvider` (browser-native SpeechRecognition adapter),
 *   - `FakeSpeechProvider` (deterministic, scripted — for unit + E2E tests),
 *   - `isSpeechRecognitionSupported()` capability detection.
 */

// ---------------------------------------------------------------------------
// Mic-state model — drives the always-visible color+icon+label indicator.
// NOT color-only: each state pairs with an icon + label in the UI layer.
// ---------------------------------------------------------------------------

export type MicState =
  | 'idle' // not listening (grey)
  | 'listening' // actively listening (info/blue, animated)
  | 'applied' // last utterance written (success/green flash)
  | 'paused' // explicitly paused / auto-paused on silence (warning/orange)
  | 'error'; // engine error / no-match (destructive/red)

export interface SpeechResult {
  transcript: string;
  /** 0..1; undefined when the engine does not report confidence. */
  confidence: number;
  /** false = interim hypothesis, true = finalized utterance. */
  isFinal: boolean;
}

export interface SpeechProvider {
  /** Begin listening. Idempotent. */
  startListening(): void;
  /** Stop listening. Idempotent. */
  stopListening(): void;
  /** Subscribe to recognition results. Returns an unsubscribe fn. */
  onResult(cb: (result: SpeechResult) => void): () => void;
  /** Subscribe to engine state changes. Returns an unsubscribe fn. */
  onStateChange(cb: (state: MicState) => void): () => void;
  /** Optional vocabulary/phrase hints to bias recognition (best-effort). */
  setGrammarHints?(phrases: readonly string[]): void;
}

/** Command grammar hint list passed to providers that support biasing (§3.1). */
export const PERIO_GRAMMAR_HINTS: readonly string[] = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
  'nineteen', 'twenty',
  'bleeding', 'pus', 'recession', 'mobility', 'furcation', 'grade', 'plaque',
  'next', 'back', 'skip', 'missing', 'tooth', 'stop', 'minus',
];

// ---------------------------------------------------------------------------
// Capability detection — Web Speech is solid on Chrome/Edge, partial on Safari.
// ---------------------------------------------------------------------------

interface SpeechWindow {
  SpeechRecognition?: unknown;
  webkitSpeechRecognition?: unknown;
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as SpeechWindow;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

// ---------------------------------------------------------------------------
// FakeSpeechProvider — deterministic, scripted. Drives parser→sequencer→write
// end to end in tests with no real engine (plan 09 §4 Tier 2 / Tier 4).
// ---------------------------------------------------------------------------

export class FakeSpeechProvider implements SpeechProvider {
  private resultCbs = new Set<(r: SpeechResult) => void>();
  private stateCbs = new Set<(s: MicState) => void>();
  private listening = false;
  hints: readonly string[] = [];

  startListening(): void {
    if (this.listening) return;
    this.listening = true;
    this.emitState('listening');
  }

  stopListening(): void {
    if (!this.listening) return;
    this.listening = false;
    this.emitState('idle');
  }

  onResult(cb: (r: SpeechResult) => void): () => void {
    this.resultCbs.add(cb);
    return () => this.resultCbs.delete(cb);
  }

  onStateChange(cb: (s: MicState) => void): () => void {
    this.stateCbs.add(cb);
    return () => this.stateCbs.delete(cb);
  }

  setGrammarHints(phrases: readonly string[]): void {
    this.hints = phrases;
  }

  // --- test driver API ---

  get isListening(): boolean {
    return this.listening;
  }

  /** Emit a scripted result to all subscribers. */
  emit(transcript: string, confidence = 1, isFinal = true): void {
    for (const cb of this.resultCbs) cb({ transcript, confidence, isFinal });
  }

  /** Push a mic-state change to subscribers (e.g. simulate an engine error). */
  emitState(state: MicState): void {
    for (const cb of this.stateCbs) cb(state);
  }
}

// ---------------------------------------------------------------------------
// WebSpeechProvider — browser-native SpeechRecognition adapter.
// Kept thin: it only translates engine events into SpeechResult/MicState. All
// perio logic lives in the pure cores.
// ---------------------------------------------------------------------------

interface MinimalRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

interface SpeechRecognitionResultEventLike {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string; confidence: number };
    length: number;
  }>;
}

export class WebSpeechProvider implements SpeechProvider {
  private recognition: MinimalRecognition | null = null;
  private resultCbs = new Set<(r: SpeechResult) => void>();
  private stateCbs = new Set<(s: MicState) => void>();
  private wantListening = false;

  constructor(lang = 'en-US') {
    if (!isSpeechRecognitionSupported()) return;
    const w = window as unknown as SpeechWindow;
    const Ctor = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as
      | (new () => MinimalRecognition)
      | undefined;
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.onstart = () => this.emitState('listening');
    r.onend = () => {
      // Chrome ends the session after silence; auto-restart while still wanted.
      if (this.wantListening) {
        try {
          r.start();
        } catch {
          this.emitState('paused');
        }
      } else {
        this.emitState('idle');
      }
    };
    r.onerror = (e) => {
      this.emitState(e?.error === 'no-speech' ? 'paused' : 'error');
    };
    r.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const res = event.results[i];
        if (!res) continue;
        const alt = res[0];
        for (const cb of this.resultCbs) {
          cb({ transcript: alt.transcript, confidence: alt.confidence ?? 1, isFinal: res.isFinal });
        }
      }
    };
    this.recognition = r;
  }

  startListening(): void {
    this.wantListening = true;
    if (!this.recognition) {
      this.emitState('error');
      return;
    }
    try {
      this.recognition.start();
    } catch {
      /* already started — ignore */
    }
  }

  stopListening(): void {
    this.wantListening = false;
    this.recognition?.stop();
    this.emitState('idle');
  }

  onResult(cb: (r: SpeechResult) => void): () => void {
    this.resultCbs.add(cb);
    return () => this.resultCbs.delete(cb);
  }

  onStateChange(cb: (s: MicState) => void): () => void {
    this.stateCbs.add(cb);
    return () => this.stateCbs.delete(cb);
  }

  private emitState(state: MicState): void {
    for (const cb of this.stateCbs) cb(state);
  }
}
