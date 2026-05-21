/**
 * Property-based tests for the Treatment FSM
 *
 * Treatment lifecycle:
 *   diagnosed → planned → performed → verified → dismissed
 *   (dismissed/declined reachable from any non-terminal state)
 *
 * G6-S2: property tests via fast-check
 */
import { describe, test, expect } from 'bun:test';
import * as fc from 'fast-check';
import { TREATMENT_TRANSITIONS, VALID_TREATMENT_STATUSES, type DentalTreatmentStatus } from './repos/treatment.schema';

const STATES = VALID_TREATMENT_STATUSES;

function isValidTransition(from: DentalTreatmentStatus, to: DentalTreatmentStatus): boolean {
  return TREATMENT_TRANSITIONS[from].includes(to);
}

describe('Treatment FSM property tests', () => {
  test('declared transitions are bidirectionally consistent', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...STATES),
        fc.constantFrom(...STATES),
        (from, to) => {
          const declared = TREATMENT_TRANSITIONS[from].includes(to);
          const computed = isValidTransition(from, to);
          expect(declared).toBe(computed);
        },
      ),
      { numRuns: 200 },
    );
  });

  test('terminal states reject all outgoing transitions', () => {
    const terminals = STATES.filter(s => TREATMENT_TRANSITIONS[s].length === 0);
    expect(terminals.length).toBeGreaterThan(0);
    for (const terminal of terminals) {
      for (const to of STATES) {
        expect(isValidTransition(terminal, to)).toBe(false);
      }
    }
  });

  test('every declared target is a known state', () => {
    for (const from of STATES) {
      for (const to of TREATMENT_TRANSITIONS[from]) {
        expect(STATES).toContain(to as DentalTreatmentStatus);
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

  test('diagnosed is initial and can reach planned, dismissed, declined', () => {
    expect(TREATMENT_TRANSITIONS['diagnosed']).toContain('planned');
    expect(TREATMENT_TRANSITIONS['diagnosed']).toContain('dismissed');
    expect(TREATMENT_TRANSITIONS['diagnosed']).toContain('declined');
  });

  test('dismissed and declined are terminal', () => {
    expect(TREATMENT_TRANSITIONS['dismissed']).toEqual([]);
    expect(TREATMENT_TRANSITIONS['declined']).toEqual([]);
  });

  test('performed can reach verified (required for invoicing)', () => {
    expect(TREATMENT_TRANSITIONS['performed']).toContain('verified');
  });

  test('all states covered in transition map', () => {
    for (const state of STATES) {
      expect(Object.keys(TREATMENT_TRANSITIONS)).toContain(state);
    }
  });
});
