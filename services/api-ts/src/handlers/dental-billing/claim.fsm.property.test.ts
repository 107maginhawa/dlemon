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

describe('Insurance-claim FSM — explicit per-edge legality (PR-9b)', () => {
  test('every declared (legal) edge is present in the map', () => {
    expect(INSURANCE_CLAIM_FSM['draft']).toContain('ready');
    expect(INSURANCE_CLAIM_FSM['ready']).toContain('submitted');
    expect(INSURANCE_CLAIM_FSM['submitted']).toContain('under_review');
    expect(INSURANCE_CLAIM_FSM['submitted']).toContain('approved');
    expect(INSURANCE_CLAIM_FSM['submitted']).toContain('denied');
    expect(INSURANCE_CLAIM_FSM['under_review']).toContain('approved');
    expect(INSURANCE_CLAIM_FSM['under_review']).toContain('denied');
    expect(INSURANCE_CLAIM_FSM['approved']).toContain('partially_paid');
    expect(INSURANCE_CLAIM_FSM['approved']).toContain('paid');
    expect(INSURANCE_CLAIM_FSM['approved']).toContain('denied');
    expect(INSURANCE_CLAIM_FSM['partially_paid']).toContain('paid');
    expect(INSURANCE_CLAIM_FSM['partially_paid']).toContain('denied');
    expect(INSURANCE_CLAIM_FSM['denied']).toContain('appealed');
    expect(INSURANCE_CLAIM_FSM['denied']).toContain('written_off');
    expect(INSURANCE_CLAIM_FSM['appealed']).toContain('submitted');
    expect(INSURANCE_CLAIM_FSM['appealed']).toContain('written_off');
  });

  test('every undeclared (illegal) edge is rejected', () => {
    expect(isValidTransition('draft', 'submitted')).toBe(false);
    expect(isValidTransition('draft', 'under_review')).toBe(false);
    expect(isValidTransition('draft', 'approved')).toBe(false);
    expect(isValidTransition('draft', 'partially_paid')).toBe(false);
    expect(isValidTransition('draft', 'paid')).toBe(false);
    expect(isValidTransition('draft', 'denied')).toBe(false);
    expect(isValidTransition('draft', 'appealed')).toBe(false);
    expect(isValidTransition('draft', 'written_off')).toBe(false);
    expect(isValidTransition('ready', 'draft')).toBe(false);
    expect(isValidTransition('ready', 'under_review')).toBe(false);
    expect(isValidTransition('ready', 'approved')).toBe(false);
    expect(isValidTransition('ready', 'partially_paid')).toBe(false);
    expect(isValidTransition('ready', 'paid')).toBe(false);
    expect(isValidTransition('ready', 'denied')).toBe(false);
    expect(isValidTransition('ready', 'appealed')).toBe(false);
    expect(isValidTransition('ready', 'written_off')).toBe(false);
    expect(isValidTransition('submitted', 'draft')).toBe(false);
    expect(isValidTransition('submitted', 'ready')).toBe(false);
    expect(isValidTransition('submitted', 'partially_paid')).toBe(false);
    expect(isValidTransition('submitted', 'paid')).toBe(false);
    expect(isValidTransition('submitted', 'appealed')).toBe(false);
    expect(isValidTransition('submitted', 'written_off')).toBe(false);
    expect(isValidTransition('under_review', 'draft')).toBe(false);
    expect(isValidTransition('under_review', 'ready')).toBe(false);
    expect(isValidTransition('under_review', 'submitted')).toBe(false);
    expect(isValidTransition('under_review', 'partially_paid')).toBe(false);
    expect(isValidTransition('under_review', 'paid')).toBe(false);
    expect(isValidTransition('under_review', 'appealed')).toBe(false);
    expect(isValidTransition('under_review', 'written_off')).toBe(false);
    expect(isValidTransition('approved', 'draft')).toBe(false);
    expect(isValidTransition('approved', 'ready')).toBe(false);
    expect(isValidTransition('approved', 'submitted')).toBe(false);
    expect(isValidTransition('approved', 'under_review')).toBe(false);
    expect(isValidTransition('approved', 'appealed')).toBe(false);
    expect(isValidTransition('approved', 'written_off')).toBe(false);
    expect(isValidTransition('partially_paid', 'draft')).toBe(false);
    expect(isValidTransition('partially_paid', 'ready')).toBe(false);
    expect(isValidTransition('partially_paid', 'submitted')).toBe(false);
    expect(isValidTransition('partially_paid', 'under_review')).toBe(false);
    expect(isValidTransition('partially_paid', 'approved')).toBe(false);
    expect(isValidTransition('partially_paid', 'appealed')).toBe(false);
    expect(isValidTransition('partially_paid', 'written_off')).toBe(false);
    expect(isValidTransition('paid', 'draft')).toBe(false);
    expect(isValidTransition('paid', 'ready')).toBe(false);
    expect(isValidTransition('paid', 'submitted')).toBe(false);
    expect(isValidTransition('paid', 'under_review')).toBe(false);
    expect(isValidTransition('paid', 'approved')).toBe(false);
    expect(isValidTransition('paid', 'partially_paid')).toBe(false);
    expect(isValidTransition('paid', 'denied')).toBe(false);
    expect(isValidTransition('paid', 'appealed')).toBe(false);
    expect(isValidTransition('paid', 'written_off')).toBe(false);
    expect(isValidTransition('denied', 'draft')).toBe(false);
    expect(isValidTransition('denied', 'ready')).toBe(false);
    expect(isValidTransition('denied', 'submitted')).toBe(false);
    expect(isValidTransition('denied', 'under_review')).toBe(false);
    expect(isValidTransition('denied', 'approved')).toBe(false);
    expect(isValidTransition('denied', 'partially_paid')).toBe(false);
    expect(isValidTransition('denied', 'paid')).toBe(false);
    expect(isValidTransition('appealed', 'draft')).toBe(false);
    expect(isValidTransition('appealed', 'ready')).toBe(false);
    expect(isValidTransition('appealed', 'under_review')).toBe(false);
    expect(isValidTransition('appealed', 'approved')).toBe(false);
    expect(isValidTransition('appealed', 'partially_paid')).toBe(false);
    expect(isValidTransition('appealed', 'paid')).toBe(false);
    expect(isValidTransition('appealed', 'denied')).toBe(false);
    expect(isValidTransition('written_off', 'draft')).toBe(false);
    expect(isValidTransition('written_off', 'ready')).toBe(false);
    expect(isValidTransition('written_off', 'submitted')).toBe(false);
    expect(isValidTransition('written_off', 'under_review')).toBe(false);
    expect(isValidTransition('written_off', 'approved')).toBe(false);
    expect(isValidTransition('written_off', 'partially_paid')).toBe(false);
    expect(isValidTransition('written_off', 'paid')).toBe(false);
    expect(isValidTransition('written_off', 'denied')).toBe(false);
    expect(isValidTransition('written_off', 'appealed')).toBe(false);
  });
});
