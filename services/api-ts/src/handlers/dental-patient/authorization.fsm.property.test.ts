/**
 * P1-26 — Property-based tests for the coverage-authorization (LOA) FSM.
 *
 *   requested → approved | denied
 *   approved  → partial  | expired
 *   partial   → expired
 *   denied, expired : terminal
 *
 * Model after invoice.fsm.property.test.ts.
 */
import { describe, test, expect } from 'bun:test';
import * as fc from 'fast-check';
import {
  COVERAGE_AUTH_STATUSES,
  COVERAGE_AUTH_FSM,
  type CoverageAuthStatus,
} from './repos/coverage-authorization.schema';

function isValidTransition(from: CoverageAuthStatus, to: CoverageAuthStatus): boolean {
  return COVERAGE_AUTH_FSM[from].includes(to);
}

describe('Coverage-authorization FSM property tests', () => {
  test('declared transitions are self-consistent', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...COVERAGE_AUTH_STATUSES),
        fc.constantFrom(...COVERAGE_AUTH_STATUSES),
        (from, to) => {
          expect(COVERAGE_AUTH_FSM[from].includes(to)).toBe(isValidTransition(from, to));
        },
      ),
      { numRuns: 200 },
    );
  });

  test('terminal states reject all outgoing transitions', () => {
    const terminals = COVERAGE_AUTH_STATUSES.filter((s) => COVERAGE_AUTH_FSM[s].length === 0);
    expect(terminals).toContain('denied');
    expect(terminals).toContain('expired');
    for (const terminal of terminals) {
      for (const to of COVERAGE_AUTH_STATUSES) {
        expect(isValidTransition(terminal, to)).toBe(false);
      }
    }
  });

  test('every declared target is a known state', () => {
    for (const from of COVERAGE_AUTH_STATUSES) {
      for (const to of COVERAGE_AUTH_FSM[from]) {
        expect(COVERAGE_AUTH_STATUSES).toContain(to);
      }
    }
  });

  test('no self-loops are declared', () => {
    fc.assert(
      fc.property(fc.constantFrom(...COVERAGE_AUTH_STATUSES), (state) => {
        expect(isValidTransition(state, state)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  test('requested branches to approved or denied only', () => {
    expect(COVERAGE_AUTH_FSM.requested).toEqual(['approved', 'denied']);
  });

  test('approved can become partial or expire', () => {
    expect(COVERAGE_AUTH_FSM.approved).toEqual(['partial', 'expired']);
  });

  test('all states covered in the transition map', () => {
    for (const state of COVERAGE_AUTH_STATUSES) {
      expect(Object.keys(COVERAGE_AUTH_FSM)).toContain(state);
    }
  });
});

describe('COVERAGE_AUTH_FSM — explicit per-edge legality (PR-9b)', () => {
  // 5 legal edges — one literal toContain assertion each.
  test('requested -> approved is legal', () => {
    expect(COVERAGE_AUTH_FSM['requested']).toContain('approved');
  });
  test('requested -> denied is legal', () => {
    expect(COVERAGE_AUTH_FSM['requested']).toContain('denied');
  });
  test('approved -> partial is legal', () => {
    expect(COVERAGE_AUTH_FSM['approved']).toContain('partial');
  });
  test('approved -> expired is legal', () => {
    expect(COVERAGE_AUTH_FSM['approved']).toContain('expired');
  });
  test('partial -> expired is legal', () => {
    expect(COVERAGE_AUTH_FSM['partial']).toContain('expired');
  });

  // 15 illegal edges — every ordered (from,to) pair, from != to, not declared.
  test('requested -> partial is not a legal transition', () => {
    expect(isValidTransition('requested', 'partial')).toBe(false);
  });
  test('requested -> expired is not a legal transition', () => {
    expect(isValidTransition('requested', 'expired')).toBe(false);
  });
  test('approved -> requested is not a legal transition', () => {
    expect(isValidTransition('approved', 'requested')).toBe(false);
  });
  test('approved -> denied is not a legal transition', () => {
    expect(isValidTransition('approved', 'denied')).toBe(false);
  });
  test('partial -> requested is not a legal transition', () => {
    expect(isValidTransition('partial', 'requested')).toBe(false);
  });
  test('partial -> approved is not a legal transition', () => {
    expect(isValidTransition('partial', 'approved')).toBe(false);
  });
  test('partial -> denied is not a legal transition', () => {
    expect(isValidTransition('partial', 'denied')).toBe(false);
  });
  test('denied -> requested is not a legal transition', () => {
    expect(isValidTransition('denied', 'requested')).toBe(false);
  });
  test('denied -> approved is not a legal transition', () => {
    expect(isValidTransition('denied', 'approved')).toBe(false);
  });
  test('denied -> partial is not a legal transition', () => {
    expect(isValidTransition('denied', 'partial')).toBe(false);
  });
  test('denied -> expired is not a legal transition', () => {
    expect(isValidTransition('denied', 'expired')).toBe(false);
  });
  test('expired -> requested is not a legal transition', () => {
    expect(isValidTransition('expired', 'requested')).toBe(false);
  });
  test('expired -> approved is not a legal transition', () => {
    expect(isValidTransition('expired', 'approved')).toBe(false);
  });
  test('expired -> partial is not a legal transition', () => {
    expect(isValidTransition('expired', 'partial')).toBe(false);
  });
  test('expired -> denied is not a legal transition', () => {
    expect(isValidTransition('expired', 'denied')).toBe(false);
  });
});
