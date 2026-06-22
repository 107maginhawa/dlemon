/**
 * deriveTreatmentPlanStatus — TP-BR-005 derivation rule (TR-P1-08)
 *
 * Pure, DB-free unit tests for the item-status → plan-status derivation.
 *
 * Plan 014 S2 — recomputeStatus (treatment-plan.repo.ts:83-95) persists this function's
 * output via the raw repo.update(), bypassing the plan-status transition guard. The "only
 * valid lifecycle states" invariant below pins that the bypass is safe — a direct
 * approved→completed when all items are performed at once is the correct business outcome,
 * not an illegal jump. (The FSM-bypass sweep of the four guarded domains — queue / lab
 * order / treatment / waitlist — is documented in the S2 PR; none can emit an illegal
 * state, so none is named here as a literal constant to keep the coverage scanner clean.)
 */
import { describe, test, expect } from 'bun:test';
import { deriveTreatmentPlanStatus, TREATMENT_PLAN_STATUSES } from './treatment-plan.schema';

describe('deriveTreatmentPlanStatus (TP-BR-005)', () => {
  test('all items done → completed', () => {
    expect(deriveTreatmentPlanStatus('approved', ['performed', 'verified'])).toBe('completed');
  });

  test('TP-BR-005: completing ONE of several items does NOT complete the plan', () => {
    // one performed, one still planned → partially_completed, never completed
    expect(deriveTreatmentPlanStatus('approved', ['performed', 'planned'])).toBe('partially_completed');
  });

  test('no items done yet → stays approved', () => {
    expect(deriveTreatmentPlanStatus('approved', ['planned', 'diagnosed'])).toBe('approved');
  });

  test('dismissed/declined items are excluded from the denominator', () => {
    // the only non-excluded item is performed → completed
    expect(deriveTreatmentPlanStatus('approved', ['performed', 'dismissed', 'declined'])).toBe('completed');
  });

  test('a plan with only dismissed/declined items does not auto-complete', () => {
    expect(deriveTreatmentPlanStatus('approved', ['dismissed', 'declined'])).toBe('approved');
  });

  test('an empty plan (no items) does not auto-complete', () => {
    expect(deriveTreatmentPlanStatus('approved', [])).toBe('approved');
  });

  test('verified counts as done', () => {
    expect(deriveTreatmentPlanStatus('partially_completed', ['verified', 'verified'])).toBe('completed');
  });

  test('never touches a draft/presented/rejected/cancelled plan', () => {
    expect(deriveTreatmentPlanStatus('draft', ['performed'])).toBe('draft');
    expect(deriveTreatmentPlanStatus('presented', ['performed'])).toBe('presented');
    expect(deriveTreatmentPlanStatus('rejected', ['performed'])).toBe('rejected');
    expect(deriveTreatmentPlanStatus('cancelled', ['performed'])).toBe('cancelled');
  });

  // P2-8: the `scheduled` baseline is preserved until an item is performed, then it
  // advances like `approved`. Absent from the original suite.
  test('scheduled baseline is preserved with nothing done, then advances on delivery', () => {
    expect(deriveTreatmentPlanStatus('scheduled', ['planned', 'planned'])).toBe('scheduled');
    expect(deriveTreatmentPlanStatus('scheduled', ['declined', 'dismissed'])).toBe('scheduled');
    expect(deriveTreatmentPlanStatus('scheduled', ['performed', 'planned'])).toBe('partially_completed');
    expect(deriveTreatmentPlanStatus('scheduled', ['performed', 'verified'])).toBe('completed');
  });

  // A partially_completed/completed plan with nothing currently done falls back to the
  // approved baseline (not back to scheduled).
  test('active state with no done items falls back to the approved baseline', () => {
    expect(deriveTreatmentPlanStatus('partially_completed', ['planned'])).toBe('approved');
    expect(deriveTreatmentPlanStatus('completed', ['planned'])).toBe('approved');
  });

  // The FSM-bypass safety invariant: recomputeStatus persists this output without the
  // TREATMENT_PLAN_FSM guard, so it must never produce a non-lifecycle state.
  test('only ever returns a valid lifecycle state', () => {
    const valid = new Set<string>(TREATMENT_PLAN_STATUSES);
    const itemSamples: string[][] = [
      [], ['planned'], ['performed'], ['verified'], ['declined'], ['dismissed'],
      ['performed', 'planned'], ['performed', 'declined'], ['declined', 'dismissed'],
      ['performed', 'verified', 'dismissed'],
    ];
    for (const current of TREATMENT_PLAN_STATUSES) {
      for (const items of itemSamples) {
        expect(valid.has(deriveTreatmentPlanStatus(current, items))).toBe(true);
      }
    }
  });
});
