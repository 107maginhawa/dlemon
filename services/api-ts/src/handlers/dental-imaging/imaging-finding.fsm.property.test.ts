/**
 * Property-based tests for the ImagingFinding FSM
 *
 * Finding lifecycle:
 *   suspected → confirmed | monitoring | resolved
 *   confirmed → monitoring | resolved
 *   monitoring → confirmed | resolved  (can oscillate between confirmed/monitoring)
 *   resolved → [] (terminal — findings don't revert once resolved)
 *
 * Imports FINDING_TRANSITIONS from the schema.
 *
 * G6-S2: property tests via fast-check
 */
import { describe, test, expect } from 'bun:test';
import * as fc from 'fast-check';
import { FINDING_TRANSITIONS, type ImagingFindingStatus } from './repos/imaging_finding.schema';

const STATES: readonly ImagingFindingStatus[] = ['suspected', 'confirmed', 'monitoring', 'resolved'];

function isValidTransition(from: ImagingFindingStatus, to: ImagingFindingStatus): boolean {
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

  test('suspected can reach all other states', () => {
    expect(FINDING_TRANSITIONS['suspected']).toContain('confirmed');
    expect(FINDING_TRANSITIONS['suspected']).toContain('monitoring');
    expect(FINDING_TRANSITIONS['suspected']).toContain('resolved');
  });

  test('confirmed and monitoring can oscillate (confirmed↔monitoring allowed)', () => {
    expect(FINDING_TRANSITIONS['confirmed']).toContain('monitoring');
    expect(FINDING_TRANSITIONS['monitoring']).toContain('confirmed');
  });

  test('suspected cannot be re-entered from any state', () => {
    for (const from of STATES) {
      if (from !== 'suspected') {
        expect(isValidTransition(from, 'suspected')).toBe(false);
      }
    }
  });

  test('all states covered in transition map', () => {
    for (const state of STATES) {
      expect(Object.keys(FINDING_TRANSITIONS)).toContain(state);
    }
  });
});
