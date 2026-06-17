/**
 * Property-based tests for the Visit FSM
 *
 * Visit lifecycle:
 *   draft → active → completed → locked
 *                → discarded (empty visit auto-discard, BR-005)
 *
 * G6-S2: property tests via fast-check
 */
import { describe, test, expect } from 'bun:test';
import * as fc from 'fast-check';
import { VISIT_TRANSITIONS, VALID_VISIT_STATUSES, type DentalVisitStatus } from './repos/visit.schema';

const STATES = VALID_VISIT_STATUSES;

function isValidTransition(from: DentalVisitStatus, to: DentalVisitStatus): boolean {
  return (VISIT_TRANSITIONS[from] ?? []).includes(to);
}

describe('Visit FSM property tests', () => {
  test('declared transitions are bidirectionally consistent', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...STATES),
        fc.constantFrom(...STATES),
        (from, to) => {
          const declared = (VISIT_TRANSITIONS[from] ?? []).includes(to);
          const computed = isValidTransition(from, to);
          expect(declared).toBe(computed);
        },
      ),
      { numRuns: 200 },
    );
  });

  test('terminal states reject all outgoing transitions', () => {
    const terminals = STATES.filter(s => (VISIT_TRANSITIONS[s] ?? []).length === 0);
    expect(terminals.length).toBeGreaterThan(0);
    for (const terminal of terminals) {
      for (const to of STATES) {
        expect(isValidTransition(terminal, to)).toBe(false);
      }
    }
  });

  test('every declared target is a known state', () => {
    for (const from of STATES) {
      for (const to of VISIT_TRANSITIONS[from] ?? []) {
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

  test('draft is the initial state and has at least one outgoing edge', () => {
    expect((VISIT_TRANSITIONS['draft'] ?? []).length).toBeGreaterThan(0);
  });

  test('locked and discarded are terminal', () => {
    expect(VISIT_TRANSITIONS['locked']).toEqual([]);
    expect(VISIT_TRANSITIONS['discarded']).toEqual([]);
  });

  test('all states are covered in transition map', () => {
    for (const state of STATES) {
      expect(Object.keys(VISIT_TRANSITIONS)).toContain(state);
    }
  });
});

describe('illegal Visit transitions are rejected (FSM coverage)', () => {
  test('active -> locked is not a legal transition', () => {
    expect(isValidTransition('active', 'locked')).toBe(false);
  });
  test('completed -> draft is not a legal transition', () => {
    expect(isValidTransition('completed', 'draft')).toBe(false);
  });
  test('discarded -> draft is not a legal transition', () => {
    expect(isValidTransition('discarded', 'draft')).toBe(false);
  });
  test('discarded -> locked is not a legal transition', () => {
    expect(isValidTransition('discarded', 'locked')).toBe(false);
  });
  test('draft -> completed is not a legal transition', () => {
    expect(isValidTransition('draft', 'completed')).toBe(false);
  });
  test('draft -> discarded is not a legal transition', () => {
    expect(isValidTransition('draft', 'discarded')).toBe(false);
  });
  test('draft -> locked is not a legal transition', () => {
    expect(isValidTransition('draft', 'locked')).toBe(false);
  });
  test('locked -> active is not a legal transition', () => {
    expect(isValidTransition('locked', 'active')).toBe(false);
  });
  test('locked -> discarded is not a legal transition', () => {
    expect(isValidTransition('locked', 'discarded')).toBe(false);
  });
  test('locked -> draft is not a legal transition', () => {
    expect(isValidTransition('locked', 'draft')).toBe(false);
  });
});
