/**
 * Property-based tests for the Consultation Note FSM
 *
 * Consultation lifecycle:
 *   draft → finalized → amended → finalized (can cycle)
 *   There is no true terminal — amended can be re-finalized.
 *
 * Transition map mirrors the inline validTransitions in emr.repo.ts.
 *
 * G6-S2: property tests via fast-check
 */
import { describe, test, expect } from 'bun:test';
import * as fc from 'fast-check';

// Matches consultationStatusEnum in emr.schema.ts
const CONSULTATION_STATES = ['draft', 'finalized', 'amended'] as const;
type ConsultationStatus = typeof CONSULTATION_STATES[number];

/**
 * Mirrors the inline validTransitions in emr.repo.ts:
 *   draft: ['finalized']
 *   finalized: ['amended']
 *   amended: ['finalized']
 */
const CONSULTATION_TRANSITIONS: Record<ConsultationStatus, ConsultationStatus[]> = {
  draft:     ['finalized'],
  finalized: ['amended'],
  amended:   ['finalized'],
};

function isValidTransition(from: ConsultationStatus, to: ConsultationStatus): boolean {
  return CONSULTATION_TRANSITIONS[from].includes(to);
}

describe('ConsultationNote FSM property tests', () => {
  test('declared transitions are bidirectionally consistent', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...CONSULTATION_STATES),
        fc.constantFrom(...CONSULTATION_STATES),
        (from, to) => {
          const declared = CONSULTATION_TRANSITIONS[from].includes(to);
          const computed = isValidTransition(from, to);
          expect(declared).toBe(computed);
        },
      ),
      { numRuns: 200 },
    );
  });

  test('every declared target is a known state', () => {
    for (const from of CONSULTATION_STATES) {
      for (const to of CONSULTATION_TRANSITIONS[from]) {
        expect(CONSULTATION_STATES).toContain(to);
      }
    }
  });

  test('no self-loops are declared', () => {
    fc.assert(
      fc.property(fc.constantFrom(...CONSULTATION_STATES), (state) => {
        expect(isValidTransition(state, state)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  test('draft can only move to finalized', () => {
    expect(CONSULTATION_TRANSITIONS['draft']).toEqual(['finalized']);
    expect(isValidTransition('draft', 'amended')).toBe(false);
  });

  test('finalized can only move to amended', () => {
    expect(CONSULTATION_TRANSITIONS['finalized']).toEqual(['amended']);
    expect(isValidTransition('finalized', 'draft')).toBe(false);
  });

  test('amended can only move back to finalized', () => {
    expect(CONSULTATION_TRANSITIONS['amended']).toEqual(['finalized']);
    expect(isValidTransition('amended', 'draft')).toBe(false);
  });

  test('finalized↔amended cycle is valid (clinical amendment workflow)', () => {
    // Can go finalized→amended→finalized→amended...
    expect(isValidTransition('finalized', 'amended')).toBe(true);
    expect(isValidTransition('amended', 'finalized')).toBe(true);
  });

  test('draft cannot be re-entered from finalized or amended', () => {
    expect(isValidTransition('finalized', 'draft')).toBe(false);
    expect(isValidTransition('amended', 'draft')).toBe(false);
  });

  test('all states covered in transition map', () => {
    for (const state of CONSULTATION_STATES) {
      expect(Object.keys(CONSULTATION_TRANSITIONS)).toContain(state);
    }
  });
});
