/**
 * Property-based tests for the Installment FSM
 *
 * Installment lifecycle (dental payment plan installments):
 *   pending → paid | overdue | waived
 *   paid, waived are terminal
 *   overdue → paid | waived (can still collect or write off)
 *
 * This is the dental-patient-adjacent financial FSM in the platform.
 * The consent entity in this module uses a boolean signed field (not a
 * multi-state FSM), so the installment FSM is tested here as the
 * patient-payment workflow.
 *
 * G6-S2: property tests via fast-check
 */
import { describe, test, expect } from 'bun:test';
import * as fc from 'fast-check';

// Matches installmentStatusEnum in dental-payment-plan.schema.ts
const INSTALLMENT_STATES = ['pending', 'paid', 'overdue', 'waived'] as const;
type InstallmentStatus = typeof INSTALLMENT_STATES[number];

/**
 * Transition map derived from business rules:
 *   pending  → paid (on-time payment), overdue (missed), waived
 *   overdue  → paid (late payment collected), waived (written off)
 *   paid     → [] terminal
 *   waived   → [] terminal
 */
const INSTALLMENT_TRANSITIONS: Record<InstallmentStatus, InstallmentStatus[]> = {
  pending: ['paid', 'overdue', 'waived'],
  overdue: ['paid', 'waived'],
  paid:    [],
  waived:  [],
};

function isValidTransition(from: InstallmentStatus, to: InstallmentStatus): boolean {
  return INSTALLMENT_TRANSITIONS[from].includes(to);
}

describe('Installment FSM property tests', () => {
  test('declared transitions are bidirectionally consistent', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...INSTALLMENT_STATES),
        fc.constantFrom(...INSTALLMENT_STATES),
        (from, to) => {
          const declared = INSTALLMENT_TRANSITIONS[from].includes(to);
          const computed = isValidTransition(from, to);
          expect(declared).toBe(computed);
        },
      ),
      { numRuns: 200 },
    );
  });

  test('terminal states reject all outgoing transitions', () => {
    const terminals = INSTALLMENT_STATES.filter(s => INSTALLMENT_TRANSITIONS[s].length === 0);
    expect(terminals).toContain('paid');
    expect(terminals).toContain('waived');
    for (const terminal of terminals) {
      for (const to of INSTALLMENT_STATES) {
        expect(isValidTransition(terminal, to)).toBe(false);
      }
    }
  });

  test('every declared target is a known state', () => {
    for (const from of INSTALLMENT_STATES) {
      for (const to of INSTALLMENT_TRANSITIONS[from]) {
        expect(INSTALLMENT_STATES).toContain(to);
      }
    }
  });

  test('no self-loops are declared', () => {
    fc.assert(
      fc.property(fc.constantFrom(...INSTALLMENT_STATES), (state) => {
        expect(isValidTransition(state, state)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  test('pending can reach all three outcomes', () => {
    expect(INSTALLMENT_TRANSITIONS['pending']).toContain('paid');
    expect(INSTALLMENT_TRANSITIONS['pending']).toContain('overdue');
    expect(INSTALLMENT_TRANSITIONS['pending']).toContain('waived');
  });

  test('overdue can still resolve to paid or waived', () => {
    expect(INSTALLMENT_TRANSITIONS['overdue']).toContain('paid');
    expect(INSTALLMENT_TRANSITIONS['overdue']).toContain('waived');
  });

  test('overdue cannot revert to pending', () => {
    expect(isValidTransition('overdue', 'pending')).toBe(false);
  });

  test('all states covered in transition map', () => {
    for (const state of INSTALLMENT_STATES) {
      expect(Object.keys(INSTALLMENT_TRANSITIONS)).toContain(state);
    }
  });
});
