/**
 * Property-based tests for the PaymentPlan FSM
 *
 * Plan lifecycle:
 *   on_track ⟷ behind  → completed | defaulted
 *   completed and defaulted are terminal
 *
 * Imports PAYMENT_PLAN_TRANSITIONS from the repo (exported constant).
 *
 * G6-S2: property tests via fast-check
 */
import { describe, test, expect } from 'bun:test';
import * as fc from 'fast-check';
import { PAYMENT_PLAN_TRANSITIONS } from './repos/dental-payment-plan.repo';
import type { DentalPaymentPlan } from './repos/dental-payment-plan.schema';

type PlanStatus = DentalPaymentPlan['status'];

const PLAN_STATES: readonly PlanStatus[] = ['on_track', 'behind', 'completed', 'defaulted'];

function isValidTransition(from: PlanStatus, to: PlanStatus): boolean {
  return PAYMENT_PLAN_TRANSITIONS[from].includes(to);
}

describe('PaymentPlan FSM property tests', () => {
  test('declared transitions are bidirectionally consistent', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...PLAN_STATES),
        fc.constantFrom(...PLAN_STATES),
        (from, to) => {
          const declared = PAYMENT_PLAN_TRANSITIONS[from].includes(to);
          const computed = isValidTransition(from, to);
          expect(declared).toBe(computed);
        },
      ),
      { numRuns: 200 },
    );
  });

  test('terminal states reject all outgoing transitions', () => {
    const terminals = PLAN_STATES.filter(s => PAYMENT_PLAN_TRANSITIONS[s].length === 0);
    expect(terminals).toContain('completed');
    expect(terminals).toContain('defaulted');
    for (const terminal of terminals) {
      for (const to of PLAN_STATES) {
        expect(isValidTransition(terminal, to)).toBe(false);
      }
    }
  });

  test('every declared target is a known state', () => {
    for (const from of PLAN_STATES) {
      for (const to of PAYMENT_PLAN_TRANSITIONS[from]) {
        expect(PLAN_STATES).toContain(to);
      }
    }
  });

  test('no self-loops are declared', () => {
    fc.assert(
      fc.property(fc.constantFrom(...PLAN_STATES), (state) => {
        expect(isValidTransition(state, state)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  test('on_track and behind are reversible (non-directional between each other)', () => {
    expect(PAYMENT_PLAN_TRANSITIONS['on_track']).toContain('behind');
    expect(PAYMENT_PLAN_TRANSITIONS['behind']).toContain('on_track');
  });

  test('both non-terminal states can reach completed and defaulted', () => {
    for (const s of ['on_track', 'behind'] as PlanStatus[]) {
      expect(PAYMENT_PLAN_TRANSITIONS[s]).toContain('completed');
      expect(PAYMENT_PLAN_TRANSITIONS[s]).toContain('defaulted');
    }
  });

  test('all states covered in transition map', () => {
    for (const state of PLAN_STATES) {
      expect(Object.keys(PAYMENT_PLAN_TRANSITIONS)).toContain(state);
    }
  });
});
