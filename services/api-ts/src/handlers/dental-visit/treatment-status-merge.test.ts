/**
 * treatment-status-merge.test.ts — SL-09 / CAND-A18 (P1 data-loss)
 *
 * The HTTP PATCH path already enforces forward-only transitions (TREATMENT_
 * TRANSITIONS). But the offline sync-apply path (cadence, row-level LWW) bypasses
 * that guard: a stale offline status (e.g. a device that never saw the treatment
 * reach `performed`) can clobber the newer status by arrival order — regressing
 * performed→planned (CAND-A18, P1 data-loss).
 *
 * SL-09 is the canonical pure primitive the sync apply must use: monotonic merge
 * along the treatment FSM — the status that is FURTHER along the lifecycle wins; a
 * terminal decision (dismissed/declined) is never undone by a stale progression op.
 *
 * RED-proof: mergeTreatmentStatus does not exist yet (feature missing).
 */

import { describe, test, expect } from 'bun:test';
import { mergeTreatmentStatus } from './repos/treatment.schema';

describe('SL-09 / CAND-A18 — monotonic treatment-status merge', () => {
  test('never regresses along the FSM: performed wins over a stale planned', () => {
    expect(mergeTreatmentStatus('performed', 'planned')).toBe('performed');
    expect(mergeTreatmentStatus('planned', 'diagnosed')).toBe('planned');
    expect(mergeTreatmentStatus('verified', 'performed')).toBe('verified');
    expect(mergeTreatmentStatus('verified', 'diagnosed')).toBe('verified');
  });

  test('a genuinely newer (further-along) status applies', () => {
    expect(mergeTreatmentStatus('planned', 'performed')).toBe('performed');
    expect(mergeTreatmentStatus('diagnosed', 'planned')).toBe('planned');
    expect(mergeTreatmentStatus('performed', 'verified')).toBe('verified');
  });

  test('a terminal decision is not undone by a stale progression op', () => {
    expect(mergeTreatmentStatus('dismissed', 'planned')).toBe('dismissed');
    expect(mergeTreatmentStatus('declined', 'diagnosed')).toBe('declined');
    expect(mergeTreatmentStatus('verified', 'dismissed')).toBe('dismissed'); // verified→dismissed is a valid forward sink
  });

  test('a stale op cannot resurrect a terminal treatment', () => {
    expect(mergeTreatmentStatus('dismissed', 'performed')).toBe('dismissed');
    expect(mergeTreatmentStatus('declined', 'planned')).toBe('declined');
  });

  test('same status is idempotent', () => {
    expect(mergeTreatmentStatus('performed', 'performed')).toBe('performed');
    expect(mergeTreatmentStatus('diagnosed', 'diagnosed')).toBe('diagnosed');
  });
});
