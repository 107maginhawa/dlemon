/**
 * Tier 1 — auto-advance sequencer reducer tests (table-driven).
 *
 * The reducer is pure: (state, ParsedCommand) → { nextState, write, event }.
 * It REUSES buildPerioSequence from perio-types so voice and keyboard share the
 * same tooth/site order. Tests lock: depth write+advance, triple cadence, gm
 * (recession) write without advance, flags, grades, next/back/skip/missing/jump,
 * missing-tooth skipping, and confirm-gating of out-of-range/ambiguous commands.
 */

import { describe, test, expect } from 'bun:test';
import {
  initSequencerState,
  currentStep,
  advance,
  type SequencerState,
} from './perio-voice-sequencer';
import { buildPerioSequence } from '../perio-types';
import type { ParsedCommand } from './perio-voice-grammar';

function depthCmd(values: number[], extra: Partial<ParsedCommand> = {}): ParsedCommand {
  return { kind: 'depth', values, confidence: 1, ambiguous: false, ...extra } as ParsedCommand;
}
function navCmd(nav: string): ParsedCommand {
  return { kind: 'nav', nav, confidence: 1, ambiguous: false } as ParsedCommand;
}

describe('initSequencerState', () => {
  test('adult state starts at tooth 18 BM (reuses buildPerioSequence)', () => {
    const s = initSequencerState('adult');
    expect(s.steps).toEqual(buildPerioSequence('adult'));
    expect(currentStep(s)).toEqual({ tooth: 18, site: 'BM' });
  });

  test('primary state uses the 51–85 sequence', () => {
    const s = initSequencerState('primary');
    expect(s.steps).toEqual(buildPerioSequence('primary'));
    expect(currentStep(s)?.tooth).toBe(55);
  });
});

describe('advance — depth', () => {
  test('single depth writes depthBM on tooth 18 and advances to BC', () => {
    const s = initSequencerState('adult');
    const r = advance(s, depthCmd([3]));
    expect(r.event).toBe('applied');
    expect(r.write).toEqual({ toothNumber: 18, field: 'depthBM', value: 3 });
    expect(currentStep(r.nextState)).toEqual({ tooth: 18, site: 'BC' });
  });

  test('triple cadence "3 2 3" writes BM/BC/BD and lands on LM', () => {
    const s = initSequencerState('adult');
    const r = advance(s, depthCmd([3, 2, 3]));
    expect(r.writes).toEqual([
      { toothNumber: 18, field: 'depthBM', value: 3 },
      { toothNumber: 18, field: 'depthBC', value: 2 },
      { toothNumber: 18, field: 'depthBD', value: 3 },
    ]);
    expect(currentStep(r.nextState)).toEqual({ tooth: 18, site: 'LM' });
  });

  test('out-of-range depth does not write — needs-confirm', () => {
    const s = initSequencerState('adult');
    const r = advance(s, depthCmd([25], { outOfRange: true }));
    expect(r.event).toBe('needs-confirm');
    expect(r.write).toBeNull();
    expect(currentStep(r.nextState)).toEqual({ tooth: 18, site: 'BM' });
  });
});

describe('advance — recession / gingival margin (no auto-advance, never CAL)', () => {
  test('recession writes gm on the current site and keeps the cursor', () => {
    const s = initSequencerState('adult');
    const r = advance(s, { kind: 'recession', value: 2, confidence: 1, ambiguous: false });
    expect(r.write).toEqual({ toothNumber: 18, field: 'gmBM', value: 2 });
    expect(currentStep(r.nextState)).toEqual({ tooth: 18, site: 'BM' });
  });

  test('a write intent never targets a cal* field', () => {
    const s = initSequencerState('adult');
    const r = advance(s, { kind: 'recession', value: -1, confidence: 1, ambiguous: false });
    expect(r.write?.field.startsWith('cal')).toBe(false);
  });
});

describe('advance — flags', () => {
  test('bleeding writes bopBM=true on the current site', () => {
    const s = initSequencerState('adult');
    const r = advance(s, { kind: 'flag', flag: 'bleeding', confidence: 1, ambiguous: false });
    expect(r.write).toEqual({ toothNumber: 18, field: 'bopBM', value: true });
  });

  test('suppuration/plaque are per-tooth boolean writes', () => {
    const s = initSequencerState('adult');
    expect(advance(s, { kind: 'flag', flag: 'suppuration', confidence: 1, ambiguous: false }).write).toEqual({
      toothNumber: 18,
      field: 'suppuration',
      value: true,
    });
    expect(advance(s, { kind: 'flag', flag: 'plaque', confidence: 1, ambiguous: false }).write).toEqual({
      toothNumber: 18,
      field: 'plaque',
      value: true,
    });
  });
});

describe('advance — grades', () => {
  test('mobility writes the per-tooth grade', () => {
    const s = initSequencerState('adult');
    const r = advance(s, { kind: 'grade', grade: 'mobility', value: 2, confidence: 1, ambiguous: false });
    expect(r.write).toEqual({ toothNumber: 18, field: 'mobility', value: 2 });
  });

  test('ignored furcation (single-rooted) emits the ignored event with no write', () => {
    const s = initSequencerState('adult');
    const r = advance(s, { kind: 'grade', grade: 'furcation', value: 2, confidence: 1, ambiguous: false, ignored: true });
    expect(r.event).toBe('ignored');
    expect(r.write).toBeNull();
  });
});

describe('advance — navigation', () => {
  test('next moves to the first site of the following tooth (18 → 17 BM)', () => {
    const s = initSequencerState('adult');
    const r = advance(s, navCmd('next'));
    expect(r.event).toBe('advanced');
    expect(currentStep(r.nextState)).toEqual({ tooth: 17, site: 'BM' });
  });

  test('skip advances one site, leaving the current null', () => {
    const s = initSequencerState('adult');
    const r = advance(s, navCmd('skip'));
    expect(currentStep(r.nextState)).toEqual({ tooth: 18, site: 'BC' });
    expect(r.write).toBeNull();
  });

  test('back across a tooth boundary: 17 BM → 18 LD', () => {
    const seq = buildPerioSequence('adult');
    const idx = seq.findIndex((s) => s.tooth === 17 && s.site === 'BM');
    const s: SequencerState = { ...initSequencerState('adult'), stepIdx: idx };
    const r = advance(s, navCmd('back'));
    expect(currentStep(r.nextState)).toEqual({ tooth: 18, site: 'LD' });
  });

  test('missing marks the tooth and jumps past it; back then skips it', () => {
    // Start on tooth 17 so the missing tooth (17) sits between 18 and 16.
    const seq = buildPerioSequence('adult');
    const start = seq.findIndex((st) => st.tooth === 17 && st.site === 'BM');
    const s: SequencerState = { ...initSequencerState('adult'), stepIdx: start };
    const r = advance(s, navCmd('missing'));
    expect(r.event).toBe('missing');
    expect(r.nextState.missing.has(17)).toBe(true);
    expect(currentStep(r.nextState)).toEqual({ tooth: 16, site: 'BM' });
    // back from 16 must NOT land on the missing tooth 17 — it skips to 18.
    const back = advance(r.nextState, navCmd('back'));
    expect(back.nextState.missing.has(currentStep(back.nextState)!.tooth)).toBe(false);
    expect(currentStep(back.nextState)?.tooth).toBe(18);
  });

  test('stop emits the paused event', () => {
    const s = initSequencerState('adult');
    expect(advance(s, navCmd('stop')).event).toBe('paused');
  });

  test('jump-to-tooth moves the cursor to that tooth first site', () => {
    const s = initSequencerState('adult');
    const r = advance(s, { kind: 'jump', tooth: 26, confidence: 1, ambiguous: false });
    expect(currentStep(r.nextState)).toEqual({ tooth: 26, site: 'BM' });
  });

  test('jump to a non-existent tooth is a noop', () => {
    const s = initSequencerState('adult');
    const r = advance(s, { kind: 'jump', tooth: 99, confidence: 1, ambiguous: false });
    expect(r.event).toBe('noop');
    expect(currentStep(r.nextState)).toEqual({ tooth: 18, site: 'BM' });
  });
});

describe('advance — confirm gating', () => {
  test('ambiguous recession is needs-confirm with no write', () => {
    const s = initSequencerState('adult');
    const r = advance(s, { kind: 'recession', value: NaN, confidence: 1, ambiguous: true });
    expect(r.event).toBe('needs-confirm');
    expect(r.write).toBeNull();
  });

  test('ambiguous grade is needs-confirm with no write', () => {
    const s = initSequencerState('adult');
    const r = advance(s, { kind: 'grade', grade: 'mobility', value: NaN, confidence: 1, ambiguous: true });
    expect(r.event).toBe('needs-confirm');
    expect(r.write).toBeNull();
  });
});
