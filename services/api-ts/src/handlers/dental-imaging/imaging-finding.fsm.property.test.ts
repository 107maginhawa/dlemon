/**
 * Property-based tests for the ImagingFinding FSM (V-IMG-007)
 *
 * SM-01 (spec §8 / §11):
 *   draft     → confirmed | resolved
 *   confirmed → resolved
 *   resolved  → [] (terminal — findings don't revert once resolved)
 *
 * `draft` is the initial state; there is no back-edge into `draft`
 * (reverting confirmed → draft is rejected, satisfying AC-IMG-002).
 *
 * Imports FINDING_TRANSITIONS from the schema.
 *
 * G6-S2: property tests via fast-check
 */
import { describe, test, expect } from 'bun:test';
import * as fc from 'fast-check';
import { FINDING_TRANSITIONS, type FindingStatus } from './repos/imaging_finding.schema';

const STATES: readonly FindingStatus[] = ['draft', 'confirmed', 'resolved'];

function isValidTransition(from: FindingStatus, to: FindingStatus): boolean {
  return FINDING_TRANSITIONS[from].includes(to);
}

describe('ImagingFinding FSM property tests', () => {
  test('declared transitions are bidirectionally consistent', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...STATES),
        fc.constantFrom(...STATES),
        (from, to) => {
          const declared = FINDING_TRANSITIONS[from].includes(to);
          const computed = isValidTransition(from, to);
          expect(declared).toBe(computed);
        },
      ),
      { numRuns: 200 },
    );
  });

  test('terminal state resolved rejects all outgoing transitions', () => {
    expect(FINDING_TRANSITIONS['resolved']).toEqual([]);
    for (const to of STATES) {
      expect(isValidTransition('resolved', to)).toBe(false);
    }
  });

  test('every declared target is a known state', () => {
    for (const from of STATES) {
      for (const to of FINDING_TRANSITIONS[from]) {
        expect(STATES).toContain(to);
      }
    }
  });

  test('no self-loops are declared', () => {
    fc.assert(
      fc.property(fc.constantFrom(...STATES), (state) => {
        expect(isValidTransition(state, state)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  test('draft can reach confirmed and resolved (SM-01)', () => {
    expect(FINDING_TRANSITIONS['draft']).toContain('confirmed');
    expect(FINDING_TRANSITIONS['draft']).toContain('resolved');
  });

  test('confirmed advances only to resolved (no back-edge to draft — AC-IMG-002)', () => {
    expect(FINDING_TRANSITIONS['confirmed']).toEqual(['resolved']);
    expect(isValidTransition('confirmed', 'draft')).toBe(false);
  });

  test('draft cannot be re-entered from any state', () => {
    for (const from of STATES) {
      if (from !== 'draft') {
        expect(isValidTransition(from, 'draft')).toBe(false);
      }
    }
  });

  test('all states covered in transition map', () => {
    for (const state of STATES) {
      expect(Object.keys(FINDING_TRANSITIONS)).toContain(state);
    }
  });
});
