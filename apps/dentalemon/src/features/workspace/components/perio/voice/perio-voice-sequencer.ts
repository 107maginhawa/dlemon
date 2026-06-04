/**
 * perio-voice-sequencer.ts — Phase A pure core #2.
 *
 * A finite-state auto-advance sequencer, independent of React, the speech engine,
 * and the network. It REUSES the existing keyboard sequence (`buildPerioSequence`
 * from perio-types) as its single source of truth for tooth/site order, so voice
 * and keyboard can never drift (plan 09 §3.3 "REUSE or be consistent with the
 * existing perio-types sequence logic").
 *
 * `advance(state, command) → { nextState, write, event }` is a pure reducer:
 * given a state and a parsed command (from perio-voice-grammar), it returns the
 * field+value to write and the next cursor position. Every sequencing rule is a
 * table-driven unit test (plan 09 §4 Tier 1).
 *
 * Field mapping per spoken value:
 *   - depth   → depth{site} on the current site
 *   - flag    → bop{site}/suppuration/plaque on the current tooth/site
 *   - recession → gm{site} (gingival margin feeds read-only CAL; CAL is NEVER written)
 *   - grade   → mobility/furcation (per-tooth, not per-site)
 *
 * Writes are emitted as intents; the React layer coalesces them per tooth and
 * flushes through the EXISTING usePerioChart upsert hook (one PUT per tooth).
 */

import {
  buildPerioSequence,
  depthField,
  bopField,
  gmField,
  type Dentition,
  type PerioSite,
  type PerioSequenceStep,
} from '../perio-types';
import type { ParsedCommand } from './perio-voice-grammar';

// ---------------------------------------------------------------------------
// Sequencer state.
// ---------------------------------------------------------------------------

export interface SequencerState {
  dentition: Dentition;
  /** The flat ordered step list (tooth × site), reused from perio-types. */
  steps: readonly PerioSequenceStep[];
  /** Index into `steps` — the current cursor. */
  stepIdx: number;
  /** Teeth marked missing (skipped by next/back). */
  missing: ReadonlySet<number>;
}

export function initSequencerState(dentition: Dentition = 'adult'): SequencerState {
  return {
    dentition,
    steps: buildPerioSequence(dentition),
    stepIdx: 0,
    missing: new Set(),
  };
}

export function currentStep(state: SequencerState): PerioSequenceStep | null {
  return state.steps[state.stepIdx] ?? null;
}

// ---------------------------------------------------------------------------
// Write intent + advance result.
// ---------------------------------------------------------------------------

/** A single field write the React layer applies + batches. value is never CAL. */
export interface WriteIntent {
  toothNumber: number;
  field: string; // e.g. 'depthBM', 'bopLC', 'gmBM', 'mobility', 'furcation', 'plaque', 'suppuration'
  value: number | boolean;
}

export type SequencerEvent =
  | 'applied' // value written + cursor advanced
  | 'advanced' // cursor moved with no write (skip / next / jump / back)
  | 'missing' // tooth marked missing, cursor jumped past it
  | 'needs-confirm' // out-of-range / ambiguous — caller routes to confirm UX, no write
  | 'ignored' // furcation on single-rooted, etc.
  | 'paused' // stop/pause command
  | 'noop'; // nothing applied

export interface AdvanceResult {
  nextState: SequencerState;
  write: WriteIntent | null;
  /** Multiple writes (depth triple cadence "3 2 3" → 3 depths across 3 sites). */
  writes?: WriteIntent[];
  event: SequencerEvent;
}

// ---------------------------------------------------------------------------
// Cursor helpers — skip missing teeth.
// ---------------------------------------------------------------------------

function nextNonMissingIdx(state: SequencerState, fromIdx: number): number {
  let idx = fromIdx;
  while (idx < state.steps.length) {
    const s = state.steps[idx];
    if (!s || !state.missing.has(s.tooth)) break;
    idx += 1;
  }
  return Math.min(idx, state.steps.length - 1);
}

function prevNonMissingIdx(state: SequencerState, fromIdx: number): number {
  let idx = fromIdx;
  while (idx >= 0) {
    const s = state.steps[idx];
    if (!s || !state.missing.has(s.tooth)) break;
    idx -= 1;
  }
  return Math.max(idx, 0);
}

function firstStepIdxOfTooth(state: SequencerState, tooth: number): number | null {
  const idx = state.steps.findIndex((s) => s.tooth === tooth);
  return idx < 0 ? null : idx;
}

function firstStepIdxAfterTooth(state: SequencerState, tooth: number): number | null {
  const lastOfTooth = state.steps.map((s) => s.tooth).lastIndexOf(tooth);
  if (lastOfTooth < 0 || lastOfTooth >= state.steps.length - 1) return null;
  return lastOfTooth + 1;
}

// ---------------------------------------------------------------------------
// Field builders for the current site.
// ---------------------------------------------------------------------------

function depthWrite(tooth: number, site: PerioSite, value: number): WriteIntent {
  return { toothNumber: tooth, field: depthField(site), value };
}
function gmWrite(tooth: number, site: PerioSite, value: number): WriteIntent {
  return { toothNumber: tooth, field: gmField(site), value };
}
function flagWrite(
  tooth: number,
  site: PerioSite,
  flag: 'bleeding' | 'suppuration' | 'plaque',
): WriteIntent {
  if (flag === 'bleeding') return { toothNumber: tooth, field: bopField(site), value: true };
  return { toothNumber: tooth, field: flag, value: true };
}

// ---------------------------------------------------------------------------
// advance — the pure reducer.
// ---------------------------------------------------------------------------

export function advance(state: SequencerState, command: ParsedCommand): AdvanceResult {
  const step = currentStep(state);
  if (!step) {
    return { nextState: state, write: null, event: 'noop' };
  }

  switch (command.kind) {
    case 'depth': {
      if (command.ambiguous || command.outOfRange) {
        return { nextState: state, write: null, event: 'needs-confirm' };
      }
      // Triple cadence: place each depth into consecutive sites starting here.
      const writes: WriteIntent[] = [];
      let idx = state.stepIdx;
      for (const value of command.values) {
        const s = state.steps[idx];
        if (!s) break;
        writes.push(depthWrite(s.tooth, s.site, value));
        idx = nextNonMissingIdx(state, idx + 1);
        if (idx >= state.steps.length - 1 && writes.length === command.values.length) break;
      }
      const nextState = { ...state, stepIdx: idx };
      return {
        nextState,
        write: writes[0] ?? null,
        writes,
        event: writes.length ? 'applied' : 'noop',
      };
    }

    case 'recession': {
      if (command.ambiguous || command.outOfRange || Number.isNaN(command.value)) {
        return { nextState: state, write: null, event: 'needs-confirm' };
      }
      // Gingival margin on the CURRENT site (feeds read-only CAL). Does not advance
      // the cursor on its own — recession is a refinement of the current site.
      return {
        nextState: state,
        write: gmWrite(step.tooth, step.site, command.value),
        event: 'applied',
      };
    }

    case 'flag': {
      return {
        nextState: state,
        write: flagWrite(step.tooth, step.site, command.flag),
        event: 'applied',
      };
    }

    case 'grade': {
      if (command.ignored) {
        return { nextState: state, write: null, event: 'ignored' };
      }
      if (command.ambiguous || command.outOfRange || Number.isNaN(command.value)) {
        return { nextState: state, write: null, event: 'needs-confirm' };
      }
      return {
        nextState: state,
        write: { toothNumber: step.tooth, field: command.grade, value: command.value },
        event: 'applied',
      };
    }

    case 'nav': {
      switch (command.nav) {
        case 'next': {
          const after = firstStepIdxAfterTooth(state, step.tooth);
          if (after === null) return { nextState: state, write: null, event: 'noop' };
          const idx = nextNonMissingIdx(state, after);
          return { nextState: { ...state, stepIdx: idx }, write: null, event: 'advanced' };
        }
        case 'skip': {
          const idx = nextNonMissingIdx(state, Math.min(state.stepIdx + 1, state.steps.length - 1));
          return { nextState: { ...state, stepIdx: idx }, write: null, event: 'advanced' };
        }
        case 'back': {
          const idx = prevNonMissingIdx(state, Math.max(state.stepIdx - 1, 0));
          return { nextState: { ...state, stepIdx: idx }, write: null, event: 'advanced' };
        }
        case 'missing': {
          const missing = new Set(state.missing);
          missing.add(step.tooth);
          const after = firstStepIdxAfterTooth(state, step.tooth);
          const idx = after === null ? state.stepIdx : nextNonMissingIdx({ ...state, missing }, after);
          return {
            nextState: { ...state, missing, stepIdx: idx },
            write: null,
            event: 'missing',
          };
        }
        case 'redo':
        case 'correct': {
          // Stay on current site so the re-spoken value overwrites it.
          return { nextState: state, write: null, event: 'advanced' };
        }
        case 'stop': {
          return { nextState: state, write: null, event: 'paused' };
        }
        default:
          return { nextState: state, write: null, event: 'noop' };
      }
    }

    case 'jump': {
      const idx = firstStepIdxOfTooth(state, command.tooth);
      if (idx === null) return { nextState: state, write: null, event: 'noop' };
      return { nextState: { ...state, stepIdx: idx }, write: null, event: 'advanced' };
    }

    default:
      return { nextState: state, write: null, event: 'noop' };
  }
}
