/**
 * Tier 2 — provider-adapter end-to-end (fake provider → hook → write intents).
 *
 * Drives a deterministic FakeSpeechProvider through useVoicePerio and asserts it
 * runs parser → sequencer → batched per-tooth upsert with no real engine. Covers
 * interim-vs-final handling, confidence gating, the pending-confirm state, the
 * per-tooth write-coalescing (one upsert per tooth on "next"), and that CAL is
 * never written.
 */

import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useVoicePerio } from './use-voice-perio';
import { FakeSpeechProvider } from '../components/perio/voice/speech-provider';

afterEach(cleanup);

interface UpsertCall {
  tooth: number;
  body: Record<string, unknown>;
}

function setup() {
  const provider = new FakeSpeechProvider();
  const calls: UpsertCall[] = [];
  const upsertReading = mock((tooth: number, body: Record<string, unknown>) => {
    calls.push({ tooth, body });
  });
  const { result } = renderHook(() =>
    useVoicePerio({ provider, upsertReading: upsertReading as never, dentition: 'adult' }),
  );
  return { provider, calls, result };
}

describe('useVoicePerio — provider wiring', () => {
  test('start/stop toggle the fake provider listening state', () => {
    const { provider, result } = setup();
    act(() => result.current.start());
    expect(provider.isListening).toBe(true);
    act(() => result.current.stop());
    expect(provider.isListening).toBe(false);
  });

  test('cursor begins on tooth 18 BM', () => {
    const { result } = setup();
    expect(result.current.cursorTooth).toBe(18);
    expect(result.current.cursorSite).toBe('BM');
  });

  test('interim results are ignored; only final results act', () => {
    const { provider, calls, result } = setup();
    act(() => result.current.start());
    act(() => provider.emit('three', 1, false)); // interim
    expect(calls.length).toBe(0);
    expect(result.current.cursorSite).toBe('BM');
  });
});

describe('useVoicePerio — depth entry + advance', () => {
  test('a final depth advances the cursor and the transcript log records it', () => {
    const { provider, result } = setup();
    act(() => result.current.start());
    act(() => provider.emit('three', 1, true));
    expect(result.current.cursorSite).toBe('BC'); // advanced from BM
    expect(result.current.micState).toBe('applied');
    expect(result.current.transcriptLog[0].applied).toContain('depthBM');
  });

  test('triple cadence "3 2 3" fills BM/BC/BD and lands on LM', () => {
    const { provider, result } = setup();
    act(() => result.current.start());
    act(() => provider.emit('three two three', 1, true));
    expect(result.current.cursorSite).toBe('LM');
    expect(result.current.transcriptLog[0].applied).toContain('depthBD');
  });
});

describe('useVoicePerio — confidence gating + confirm', () => {
  test('low-confidence depth is NOT written — enters pending confirm', () => {
    const { provider, calls, result } = setup();
    act(() => result.current.start());
    act(() => provider.emit('three', 0.3, true)); // below 0.6 threshold
    expect(result.current.pending).not.toBeNull();
    expect(result.current.pending?.prompt).toMatch(/did you say/i);
    expect(calls.length).toBe(0); // nothing flushed
    expect(result.current.cursorSite).toBe('BM'); // cursor did not move
  });

  test('out-of-range depth (25) routes to confirm, not written', () => {
    const { provider, result } = setup();
    act(() => result.current.start());
    act(() => provider.emit('25', 1, true));
    expect(result.current.pending).not.toBeNull();
  });

  test('confirming a pending in-range value applies it', () => {
    const { provider, result } = setup();
    act(() => result.current.start());
    act(() => provider.emit('three', 0.3, true)); // low confidence → pending
    act(() => result.current.confirmPending());
    expect(result.current.pending).toBeNull();
    expect(result.current.cursorSite).toBe('BC'); // applied + advanced
  });

  test('dismissing a pending value clears it and resumes listening', () => {
    const { provider, result } = setup();
    act(() => result.current.start());
    act(() => provider.emit('three', 0.3, true));
    act(() => result.current.dismissPending());
    expect(result.current.pending).toBeNull();
    expect(result.current.micState).toBe('listening');
  });
});

describe('useVoicePerio — per-tooth write coalescing', () => {
  test('one upsert per tooth: BM/BC/BD/LM/LC/LD then "next" flushes a single PUT', () => {
    const { provider, calls, result } = setup();
    act(() => result.current.start());
    // walk all six sites of tooth 18
    act(() => provider.emit('three two three', 1, true)); // BM BC BD
    act(() => provider.emit('two two two', 1, true)); // LM LC LD
    expect(calls.length).toBe(0); // still buffered (same tooth)
    act(() => provider.emit('next tooth', 1, true)); // flush tooth 18
    expect(calls.length).toBe(1);
    expect(calls[0].tooth).toBe(18);
    // all six depth fields coalesced into one body
    expect(Object.keys(calls[0].body).sort()).toEqual(
      ['depthBC', 'depthBD', 'depthBM', 'depthLC', 'depthLD', 'depthLM'].sort(),
    );
  });

  test('a write intent never targets a cal* field (CAL is read-only)', () => {
    const { provider, calls, result } = setup();
    act(() => result.current.start());
    act(() => provider.emit('recession two', 1, true)); // gm write
    act(() => provider.emit('next tooth', 1, true)); // flush
    expect(calls.length).toBe(1);
    expect(Object.keys(calls[0].body).some((k) => k.startsWith('cal'))).toBe(false);
    expect(Object.keys(calls[0].body)).toContain('gmBM');
  });
});

describe('useVoicePerio — mic state + no-match', () => {
  test('an unrecognized utterance flips mic state to error', () => {
    const { provider, result } = setup();
    act(() => result.current.start());
    act(() => provider.emit('the quick brown fox', 1, true));
    expect(result.current.micState).toBe('error');
  });

  test('"stop" pauses the provider', () => {
    const { provider, result } = setup();
    act(() => result.current.start());
    act(() => provider.emit('stop', 1, true));
    expect(result.current.micState).toBe('paused');
    expect(provider.isListening).toBe(false);
  });
});
