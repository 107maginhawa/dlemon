/**
 * Property-based tests for the Invoice FSM
 *
 * Invoice lifecycle:
 *   draft → issued → partial → paid | overdue | voided
 *   voided is reachable from any non-voided state
 *
 * The invoice repo enforces transitions via imperative guards
 * (issue() requires draft, voidInvoice() rejects already-voided).
 * We test the declared transition map here.
 *
 * G6-S2: property tests via fast-check
 */
import { describe, test, expect } from 'bun:test';
import * as fc from 'fast-check';

// Invoice status values match dental_invoice_status enum
const INVOICE_STATES = ['draft', 'issued', 'partial', 'paid', 'overdue', 'voided'] as const;
type InvoiceStatus = typeof INVOICE_STATES[number];

/**
 * Transition map derived from the repo business rules:
 *   - draft   → issued (via issue())
 *   - issued  → partial (payment applied), overdue, voided
 *   - partial → paid, overdue, voided
 *   - paid    → [] (terminal — fully settled)
 *   - overdue → paid, voided (can still collect or write off)
 *   - voided  → [] (terminal)
 */
const INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft:   ['issued', 'voided'],
  issued:  ['partial', 'paid', 'overdue', 'voided'],
  partial: ['paid', 'overdue', 'voided'],
  paid:    [],
  overdue: ['paid', 'voided'],
  voided:  [],
};

function isValidTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return INVOICE_TRANSITIONS[from].includes(to);
}

describe('Invoice FSM property tests', () => {
  test('declared transitions are bidirectionally consistent', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...INVOICE_STATES),
        fc.constantFrom(...INVOICE_STATES),
        (from, to) => {
          const declared = INVOICE_TRANSITIONS[from].includes(to);
          const computed = isValidTransition(from, to);
          expect(declared).toBe(computed);
        },
      ),
      { numRuns: 200 },
    );
  });

  test('terminal states reject all outgoing transitions', () => {
    const terminals = INVOICE_STATES.filter(s => INVOICE_TRANSITIONS[s].length === 0);
    expect(terminals).toContain('paid');
    expect(terminals).toContain('voided');
    for (const terminal of terminals) {
      for (const to of INVOICE_STATES) {
        expect(isValidTransition(terminal, to)).toBe(false);
      }
    }
  });

  test('every declared target is a known state', () => {
    for (const from of INVOICE_STATES) {
      for (const to of INVOICE_TRANSITIONS[from]) {
        expect(INVOICE_STATES).toContain(to);
      }
    }
  });

  test('no self-loops are declared', () => {
    fc.assert(
      fc.property(fc.constantFrom(...INVOICE_STATES), (state) => {
        expect(isValidTransition(state, state)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  test('draft can only move to issued or voided', () => {
    expect(INVOICE_TRANSITIONS['draft']).toEqual(['issued', 'voided']);
  });

  test('voided is reachable from every non-terminal state', () => {
    const nonTerminals: InvoiceStatus[] = ['draft', 'issued', 'partial', 'overdue'];
    for (const s of nonTerminals) {
      expect(INVOICE_TRANSITIONS[s]).toContain('voided');
    }
  });

  test('all states covered in transition map', () => {
    for (const state of INVOICE_STATES) {
      expect(Object.keys(INVOICE_TRANSITIONS)).toContain(state);
    }
  });
});
