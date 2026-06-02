/**
 * P1-26 — Property-based tests for the insurance-claim FSM.
 *
 * Claim lifecycle (PH HMO):
 *   draft → ready → submitted → under_review → approved → partially_paid → paid
 *                               ↘ denied (→ appealed → submitted | → written_off)
 *
 * We test the declared transition map (INSURANCE_CLAIM_FSM) for structural
 * soundness. Model after invoice.fsm.property.test.ts.
 */
import { describe, test, expect } from 'bun:test';
import * as fc from 'fast-check';
import {
  INSURANCE_CLAIM_STATUSES,
  INSURANCE_CLAIM_FSM,
  type InsuranceClaimStatus,
} from './repos/dental-insurance-claim.schema';

function isValidTransition(from: InsuranceClaimStatus, to: InsuranceClaimStatus): boolean {
  return INSURANCE_CLAIM_FSM[from].includes(to);
}

describe('Insurance-claim FSM property tests', () => {
  test('declared transitions are self-consistent', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...INSURANCE_CLAIM_STATUSES),
        fc.constantFrom(...INSURANCE_CLAIM_STATUSES),
        (from, to) => {
          expect(INSURANCE_CLAIM_FSM[from].includes(to)).toBe(isValidTransition(from, to));
        },
      ),
      { numRuns: 300 },
    );
  });

  test('terminal states reject all outgoing transitions', () => {
    const terminals = INSURANCE_CLAIM_STATUSES.filter((s) => INSURANCE_CLAIM_FSM[s].length === 0);
    expect(terminals).toContain('paid');
    expect(terminals).toContain('written_off');
    for (const terminal of terminals) {
      for (const to of INSURANCE_CLAIM_STATUSES) {
        expect(isValidTransition(terminal, to)).toBe(false);
      }
    }
  });

  test('every declared target is a known state', () => {
    for (const from of INSURANCE_CLAIM_STATUSES) {
      for (const to of INSURANCE_CLAIM_FSM[from]) {
        expect(INSURANCE_CLAIM_STATUSES).toContain(to);
      }
    }
  });

  test('no self-loops are declared', () => {
    fc.assert(
      fc.property(fc.constantFrom(...INSURANCE_CLAIM_STATUSES), (state) => {
        expect(isValidTransition(state, state)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  test('all states covered in the transition map', () => {
    for (const state of INSURANCE_CLAIM_STATUSES) {
      expect(Object.keys(INSURANCE_CLAIM_FSM)).toContain(state);
    }
  });

  test('draft can only move to ready', () => {
    expect(INSURANCE_CLAIM_FSM.draft).toEqual(['ready']);
  });

  test('paid is reachable from approved and partially_paid', () => {
    expect(INSURANCE_CLAIM_FSM.approved).toContain('paid');
    expect(INSURANCE_CLAIM_FSM.partially_paid).toContain('paid');
  });

  test('denied can be appealed or written off', () => {
    expect(INSURANCE_CLAIM_FSM.denied).toEqual(['appealed', 'written_off']);
  });

  test('an appeal re-enters the submitted state (resubmission)', () => {
    expect(INSURANCE_CLAIM_FSM.appealed).toContain('submitted');
  });

  test('paid is unreachable directly from submitted (must pass through review/approval)', () => {
    expect(isValidTransition('submitted', 'paid')).toBe(false);
    expect(isValidTransition('submitted', 'partially_paid')).toBe(false);
  });
});
