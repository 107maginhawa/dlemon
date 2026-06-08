/**
 * Property-based tests for the LabOrder FSM
 *
 * Lab order lifecycle (forward-only):
 *   ordered → in_fabrication → delivered → fitted
 *   cancelled is reachable from ordered, in_fabrication, delivered
 *   fitted and cancelled are terminal
 *
 * NOTE: this file's name is historical — it exercises the LabOrder FSM, not the
 * prescription FSM. The prescription status FSM (pending → dispensed | cancelled,
 * both terminal) DOES exist (PRESCRIPTION_TRANSITIONS, added in EM-CLI-012) and is
 * covered by prescription.status.test.ts (incl. illegal-transition → 422 cases).
 *
 * Imports LAB_ORDER_TRANSITIONS from the schema.
 *
 * G6-S2: property tests via fast-check
 */
import { describe, test, expect } from 'bun:test';
import * as fc from 'fast-check';
import { LAB_ORDER_TRANSITIONS, VALID_LAB_ORDER_STATUSES, type LabOrderStatus } from './repos/lab-order.schema';

const STATES = VALID_LAB_ORDER_STATUSES;

function isValidTransition(from: LabOrderStatus, to: LabOrderStatus): boolean {
  return LAB_ORDER_TRANSITIONS[from].includes(to);
}

describe('LabOrder FSM property tests', () => {
  test('declared transitions are bidirectionally consistent', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...STATES),
        fc.constantFrom(...STATES),
        (from, to) => {
          const declared = LAB_ORDER_TRANSITIONS[from].includes(to);
          const computed = isValidTransition(from, to);
          expect(declared).toBe(computed);
        },
      ),
      { numRuns: 200 },
    );
  });

  test('terminal states reject all outgoing transitions', () => {
    const terminals = STATES.filter(s => LAB_ORDER_TRANSITIONS[s].length === 0);
    expect(terminals).toContain('fitted');
    expect(terminals).toContain('cancelled');
    for (const terminal of terminals) {
      for (const to of STATES) {
        expect(isValidTransition(terminal, to)).toBe(false);
      }
    }
  });

  test('every declared target is a known state', () => {
    for (const from of STATES) {
      for (const to of LAB_ORDER_TRANSITIONS[from]) {
        expect(STATES).toContain(to as LabOrderStatus);
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

  test('cancelled is reachable from all non-terminal states', () => {
    const nonTerminals: LabOrderStatus[] = ['ordered', 'in_fabrication', 'delivered'];
    for (const s of nonTerminals) {
      expect(LAB_ORDER_TRANSITIONS[s]).toContain('cancelled');
    }
  });

  test('forward-only: no backward transitions allowed', () => {
    // delivered cannot go back to in_fabrication or ordered
    expect(isValidTransition('delivered', 'in_fabrication')).toBe(false);
    expect(isValidTransition('delivered', 'ordered')).toBe(false);
    expect(isValidTransition('in_fabrication', 'ordered')).toBe(false);
    expect(isValidTransition('fitted', 'delivered')).toBe(false);
  });

  test('happy path: ordered → in_fabrication → delivered → fitted', () => {
    expect(isValidTransition('ordered', 'in_fabrication')).toBe(true);
    expect(isValidTransition('in_fabrication', 'delivered')).toBe(true);
    expect(isValidTransition('delivered', 'fitted')).toBe(true);
  });

  test('all states covered in transition map', () => {
    for (const state of STATES) {
      expect(Object.keys(LAB_ORDER_TRANSITIONS)).toContain(state);
    }
  });
});
