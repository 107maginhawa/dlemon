/**
 * Property-based tests for the Consultation Note FSM.
 *
 * MODULE_SPEC §8 (V-EMR-001 / V-EMR-C-001): the consultation lifecycle is
 *   draft → finalized   (**terminal**)
 * There is NO amend-after-finalize workflow. `finalized` and `amended` have no
 * outgoing transitions; `amended` is a reserved/unreachable enum value.
 *
 * This file exercises the REAL `validateStatusTransition` on
 * `ConsultationNoteRepository` (no DB needed — the method is pure) so the test is
 * coupled to production code, not a self-referential local copy. Previously this
 * file declared its own legacy transition map and asserted it against itself
 * (a tautology that affirmed the struck finalized↔amended cycle); it is now
 * rewritten to pin the spec-terminal machine.
 *
 * G6-S2: property tests via fast-check.
 */
import { describe, test, expect } from 'bun:test';
import * as fc from 'fast-check';
import { ConsultationNoteRepository } from './repos/emr.repo';
import type { ConsultationStatus } from './repos/emr.schema';

const CONSULTATION_STATES = ['draft', 'finalized', 'amended'] as const;

// The repo is constructed with a stub db/logger; validateStatusTransition never
// touches the db (it is a pure guard), so this is safe.
const repo = new ConsultationNoteRepository({} as any, undefined);

/**
 * Wrap the REAL guard as a boolean predicate: it throws on an invalid transition.
 */
function isValidTransition(from: ConsultationStatus, to: ConsultationStatus): boolean {
  try {
    (repo as any).validateStatusTransition(from, to);
    return true;
  } catch {
    return false;
  }
}

describe('ConsultationNote FSM property tests (real validateStatusTransition)', () => {
  test('draft → finalized is the ONLY allowed transition', () => {
    expect(isValidTransition('draft', 'finalized')).toBe(true);
    expect(isValidTransition('draft', 'amended')).toBe(false);
    expect(isValidTransition('draft', 'draft')).toBe(false);
  });

  test('finalized is terminal — no outgoing transitions', () => {
    for (const to of CONSULTATION_STATES) {
      expect(isValidTransition('finalized', to)).toBe(false);
    }
  });

  test('amended is terminal/unreachable — no outgoing transitions', () => {
    for (const to of CONSULTATION_STATES) {
      expect(isValidTransition('amended', to)).toBe(false);
    }
  });

  test('the struck finalized↔amended cycle is REJECTED', () => {
    // Regression guard for V-EMR-C-001: these must never be valid again.
    expect(isValidTransition('finalized', 'amended')).toBe(false);
    expect(isValidTransition('amended', 'finalized')).toBe(false);
  });

  test('no self-loops are valid', () => {
    fc.assert(
      fc.property(fc.constantFrom(...CONSULTATION_STATES), (state) => {
        expect(isValidTransition(state, state)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  test('property: the ONLY valid (from,to) pair is (draft,finalized)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...CONSULTATION_STATES),
        fc.constantFrom(...CONSULTATION_STATES),
        (from, to) => {
          const valid = isValidTransition(from, to);
          const expected = from === 'draft' && to === 'finalized';
          expect(valid).toBe(expected);
        },
      ),
      { numRuns: 200 },
    );
  });

  test('draft cannot be re-entered from any state', () => {
    for (const from of CONSULTATION_STATES) {
      expect(isValidTransition(from, 'draft')).toBe(false);
    }
  });
});
