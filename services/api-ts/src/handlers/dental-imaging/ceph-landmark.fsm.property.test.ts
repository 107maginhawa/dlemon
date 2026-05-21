/**
 * Property-based tests for the CephLandmark FSM
 *
 * Landmark lifecycle (one-directional, D-C):
 *   placed → confirmed → locked
 *   locked is terminal — coordinates are immutable once locked
 *
 * Imports CEPH_LANDMARK_TRANSITIONS from the schema.
 *
 * G6-S2: property tests via fast-check
 */
import { describe, test, expect } from 'bun:test';
import * as fc from 'fast-check';
import { CEPH_LANDMARK_TRANSITIONS, type CephLandmarkStatus } from './repos/imaging_ceph.schema';

const STATES: readonly CephLandmarkStatus[] = ['placed', 'confirmed', 'locked'];

function isValidTransition(from: CephLandmarkStatus, to: CephLandmarkStatus): boolean {
  return CEPH_LANDMARK_TRANSITIONS[from].includes(to);
}

describe('CephLandmark FSM property tests', () => {
  test('declared transitions are bidirectionally consistent', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...STATES),
        fc.constantFrom(...STATES),
        (from, to) => {
          const declared = CEPH_LANDMARK_TRANSITIONS[from].includes(to);
          const computed = isValidTransition(from, to);
          expect(declared).toBe(computed);
        },
      ),
      { numRuns: 200 },
    );
  });

  test('terminal state locked rejects all outgoing transitions', () => {
    expect(CEPH_LANDMARK_TRANSITIONS['locked']).toEqual([]);
    for (const to of STATES) {
      expect(isValidTransition('locked', to)).toBe(false);
    }
  });

  test('every declared target is a known state', () => {
    for (const from of STATES) {
      for (const to of CEPH_LANDMARK_TRANSITIONS[from]) {
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

  test('strict linear chain: placed→confirmed→locked only', () => {
    expect(CEPH_LANDMARK_TRANSITIONS['placed']).toEqual(['confirmed']);
    expect(CEPH_LANDMARK_TRANSITIONS['confirmed']).toEqual(['locked']);
    expect(CEPH_LANDMARK_TRANSITIONS['locked']).toEqual([]);
  });

  test('no backward transitions allowed', () => {
    // confirmed cannot go back to placed; locked cannot go back to confirmed or placed
    expect(isValidTransition('confirmed', 'placed')).toBe(false);
    expect(isValidTransition('locked', 'confirmed')).toBe(false);
    expect(isValidTransition('locked', 'placed')).toBe(false);
  });

  test('all states covered in transition map', () => {
    for (const state of STATES) {
      expect(Object.keys(CEPH_LANDMARK_TRANSITIONS)).toContain(state);
    }
  });
});
