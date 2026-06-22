/**
 * PR-9b — Property + explicit per-edge legality tests for the claim-draft FSM.
 *
 * Claim-draft lifecycle:
 *   draft → ready → submitted → {accepted, rejected}
 *                                rejected → draft (re-edit & resubmit)
 *                                accepted = terminal
 *
 * We test the declared transition map (CLAIM_DRAFT_FSM) for structural
 * soundness, and add a NON-VACUOUS explicit per-edge enumeration so the
 * coverage matrix can see every legal/illegal edge literally asserted.
 * Modeled after dental-billing/claim.fsm.property.test.ts.
 */
import { describe, test, expect } from 'bun:test';
import * as fc from 'fast-check';
import {
  CLAIM_DRAFT_STATUSES,
  CLAIM_DRAFT_FSM,
  type ClaimDraftStatus,
} from './repos/claim-draft.schema';

function isValidTransition(from: ClaimDraftStatus, to: ClaimDraftStatus): boolean {
  return CLAIM_DRAFT_FSM[from].includes(to);
}

describe('Claim-draft FSM property tests', () => {
  test('declared transitions are self-consistent', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...CLAIM_DRAFT_STATUSES),
        fc.constantFrom(...CLAIM_DRAFT_STATUSES),
        (from, to) => {
          expect(CLAIM_DRAFT_FSM[from].includes(to)).toBe(isValidTransition(from, to));
        },
      ),
      { numRuns: 200 },
    );
  });

  test('terminal states reject all outgoing transitions', () => {
    const terminals = CLAIM_DRAFT_STATUSES.filter((s) => CLAIM_DRAFT_FSM[s].length === 0);
    expect(terminals).toContain('accepted');
    for (const terminal of terminals) {
      for (const to of CLAIM_DRAFT_STATUSES) {
        expect(isValidTransition(terminal, to)).toBe(false);
      }
    }
  });

  test('every declared target is a known state', () => {
    for (const from of CLAIM_DRAFT_STATUSES) {
      for (const to of CLAIM_DRAFT_FSM[from]) {
        expect(CLAIM_DRAFT_STATUSES).toContain(to);
      }
    }
  });

  test('no self-loops are declared', () => {
    fc.assert(
      fc.property(fc.constantFrom(...CLAIM_DRAFT_STATUSES), (state) => {
        expect(isValidTransition(state, state)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  test('all states covered in the transition map', () => {
    for (const state of CLAIM_DRAFT_STATUSES) {
      expect(Object.keys(CLAIM_DRAFT_FSM)).toContain(state);
    }
  });

  test('accepted is terminal (no outgoing edges)', () => {
    expect(CLAIM_DRAFT_FSM.accepted).toEqual([]);
  });

  test('rejected can be re-edited back to draft', () => {
    expect(CLAIM_DRAFT_FSM.rejected).toEqual(['draft']);
  });
});

describe('Claim-draft FSM — explicit per-edge legality (PR-9b)', () => {
  // ---- LEGAL edges (5): one `toContain` assertion each --------------------
  test('LEGAL: draft -> ready', () => {
    expect(CLAIM_DRAFT_FSM['draft']).toContain('ready');
  });
  test('LEGAL: ready -> submitted', () => {
    expect(CLAIM_DRAFT_FSM['ready']).toContain('submitted');
  });
  test('LEGAL: submitted -> accepted', () => {
    expect(CLAIM_DRAFT_FSM['submitted']).toContain('accepted');
  });
  test('LEGAL: submitted -> rejected', () => {
    expect(CLAIM_DRAFT_FSM['submitted']).toContain('rejected');
  });
  test('LEGAL: rejected -> draft', () => {
    expect(CLAIM_DRAFT_FSM['rejected']).toContain('draft');
  });

  // ---- ILLEGAL edges (15): one `isValidTransition(...).toBe(false)` each ---
  // from draft (3)
  test('ILLEGAL: draft -> submitted', () => {
    expect(isValidTransition('draft', 'submitted')).toBe(false);
  });
  test('ILLEGAL: draft -> accepted', () => {
    expect(isValidTransition('draft', 'accepted')).toBe(false);
  });
  test('ILLEGAL: draft -> rejected', () => {
    expect(isValidTransition('draft', 'rejected')).toBe(false);
  });

  // from ready (3)
  test('ILLEGAL: ready -> draft', () => {
    expect(isValidTransition('ready', 'draft')).toBe(false);
  });
  test('ILLEGAL: ready -> accepted', () => {
    expect(isValidTransition('ready', 'accepted')).toBe(false);
  });
  test('ILLEGAL: ready -> rejected', () => {
    expect(isValidTransition('ready', 'rejected')).toBe(false);
  });

  // from submitted (2)
  test('ILLEGAL: submitted -> draft', () => {
    expect(isValidTransition('submitted', 'draft')).toBe(false);
  });
  test('ILLEGAL: submitted -> ready', () => {
    expect(isValidTransition('submitted', 'ready')).toBe(false);
  });

  // from accepted (4) — terminal
  test('ILLEGAL: accepted -> draft', () => {
    expect(isValidTransition('accepted', 'draft')).toBe(false);
  });
  test('ILLEGAL: accepted -> ready', () => {
    expect(isValidTransition('accepted', 'ready')).toBe(false);
  });
  test('ILLEGAL: accepted -> submitted', () => {
    expect(isValidTransition('accepted', 'submitted')).toBe(false);
  });
  test('ILLEGAL: accepted -> rejected', () => {
    expect(isValidTransition('accepted', 'rejected')).toBe(false);
  });

  // from rejected (3)
  test('ILLEGAL: rejected -> ready', () => {
    expect(isValidTransition('rejected', 'ready')).toBe(false);
  });
  test('ILLEGAL: rejected -> submitted', () => {
    expect(isValidTransition('rejected', 'submitted')).toBe(false);
  });
  test('ILLEGAL: rejected -> accepted', () => {
    expect(isValidTransition('rejected', 'accepted')).toBe(false);
  });
});
