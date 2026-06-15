/**
 * fsm-matrix.test.ts — TDD for the FSM transition coverage matrix.
 *
 * Run from repo root:  bun test ./scripts/coverage/fsm-matrix.test.ts
 * (the leading ./ is required for Bun path filters). These are root-level tests:
 * they do NOT trip the api-ts db-guard preload, so no DATABASE_URL is needed.
 *
 * The matrix enumerates, per declared `*_TRANSITIONS` map, every (from → to) edge
 * across states×states. Declared pairs are LEGAL; the rest (minus self-loops) are
 * ILLEGAL. Each edge is then matched to a covering test by a documented proximity
 * heuristic. The high-value column is *uncovered ILLEGAL edges* — a state machine
 * whose rejection of a bad transition is never asserted.
 */

import { describe, expect, test } from 'bun:test';
import {
  parseTransitionMap,
  computeEdges,
  discoverFsms,
  edgeId,
  isEdgeCovered,
  type ParsedFsm,
} from './fsm-matrix';

// ─────────────────────────────────────────────────────────────────────────────
// (a) parseTransitionMap — read a `Record<S, S[]>` literal from source
// ─────────────────────────────────────────────────────────────────────────────

describe('parseTransitionMap', () => {
  test('parses a single-line + multiline Record literal', () => {
    const src = `
export const VALID_X = ['a', 'b', 'c'] as const;
export const X_TRANSITIONS: Record<XStatus, XStatus[]> = {
  a: ['b', 'c'],
  b: [],
  c: [], // terminal
};
`;
    const map = parseTransitionMap(src, 'X_TRANSITIONS');
    expect(map).toEqual({ a: ['b', 'c'], b: [], c: [] });
  });

  test('ignores // comments inside the map body and trailing commas', () => {
    const src = `
export const APPOINTMENT_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  scheduled: ['confirmed', 'checked_in', 'cancelled', 'no_show'],
  confirmed: ['checked_in', 'cancelled', 'no_show'],
  checked_in: ['completed', 'cancelled', 'no_show'],
  completed: [],
  cancelled: [],
  no_show: ['completed'],
};
`;
    const map = parseTransitionMap(src, 'APPOINTMENT_TRANSITIONS');
    expect(map['scheduled']).toEqual(['confirmed', 'checked_in', 'cancelled', 'no_show']);
    expect(map['no_show']).toEqual(['completed']);
    expect(map['completed']).toEqual([]);
    expect(Object.keys(map)).toHaveLength(6);
  });

  test('handles snake_case + multi-word states (no_show, in_fabrication, not_placed)', () => {
    const src = `
export const LAB_ORDER_TRANSITIONS: Record<LabOrderStatus, LabOrderStatus[]> = {
  ordered: ['in_fabrication', 'cancelled'],
  in_fabrication: ['delivered', 'cancelled'],
  delivered: ['fitted', 'cancelled'],
  fitted: [],
  cancelled: [],
};
`;
    const map = parseTransitionMap(src, 'LAB_ORDER_TRANSITIONS');
    expect(map['ordered']).toEqual(['in_fabrication', 'cancelled']);
    expect(map['in_fabrication']).toEqual(['delivered', 'cancelled']);
  });

  test('returns null when the constant is absent', () => {
    expect(parseTransitionMap('export const FOO = 1;', 'X_TRANSITIONS')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (b) computeEdges — legal + illegal enumeration (states² − self-loops)
// ─────────────────────────────────────────────────────────────────────────────

describe('computeEdges', () => {
  const legalMap = { a: ['b', 'c'], b: ['c'], c: [] };
  // states = a,b,c → 3×3 = 9; minus 3 self-loops = 6 candidate edges.
  // legal: a→b, a→c, b→c (3). illegal: a (none extra), b→a, c→a, c→b (3).

  test('enumerates every non-self pair exactly once', () => {
    const edges = computeEdges(legalMap);
    expect(edges).toHaveLength(6);
    // no self-loops
    expect(edges.some((e) => e.from === e.to)).toBe(false);
  });

  test('classifies declared pairs as legal and the rest as illegal', () => {
    const edges = computeEdges(legalMap);
    const legal = edges.filter((e) => e.legal);
    const illegal = edges.filter((e) => !e.legal);
    expect(legal.map((e) => `${e.from}->${e.to}`).sort()).toEqual(['a->b', 'a->c', 'b->c']);
    expect(illegal.map((e) => `${e.from}->${e.to}`).sort()).toEqual(['b->a', 'c->a', 'c->b']);
  });

  test('derives the state universe from union of keys and declared targets', () => {
    // 'd' only appears as a target, never as a key → must still be a state.
    const edges = computeEdges({ a: ['b', 'd'], b: [] });
    const states = new Set<string>();
    for (const e of edges) {
      states.add(e.from);
      states.add(e.to);
    }
    expect([...states].sort()).toEqual(['a', 'b', 'd']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (c) edgeId — stable allowlist/gap id
// ─────────────────────────────────────────────────────────────────────────────

describe('edgeId', () => {
  test('formats as <fsm>:<from>-><to>', () => {
    expect(edgeId('Visit', 'draft', 'active')).toBe('Visit:draft->active');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (d) isEdgeCovered — proximity heuristic over scanned test lines
// ─────────────────────────────────────────────────────────────────────────────

describe('isEdgeCovered', () => {
  // Synthetic "scanned file" — array of {line, text}. The heuristic looks for a
  // line where the from + to tokens co-occur within a small window of a matching
  // outcome token (legal → 2xx; illegal → 4xx).
  const fileLines = [
    { line: 10, text: "  test('PATCH diagnosed->performed (skip planned) -> 422', async () => {" },
    { line: 18, text: '    expect(res.status).toBe(422);' },
    { line: 30, text: "  test('PATCH diagnosed->planned (step 1) -> 200', async () => {" },
    { line: 38, text: '    expect(res.status).toBe(200);' },
    { line: 50, text: "  expect(isValidTransition('confirmed', 'completed')).toBe(false);" },
  ];

  test('an ILLEGAL edge with both states near a 4xx is covered', () => {
    const res = isEdgeCovered(
      { from: 'diagnosed', to: 'performed', legal: false },
      fileLines,
      4,
    );
    expect(res.covered).toBe(true);
    expect(res.evidenceLine).toBe(10);
  });

  test('a LEGAL edge with both states near a 2xx is covered', () => {
    const res = isEdgeCovered(
      { from: 'diagnosed', to: 'planned', legal: true },
      fileLines,
      4,
    );
    expect(res.covered).toBe(true);
    expect(res.evidenceLine).toBe(30);
  });

  test('an ILLEGAL edge proven via isValidTransition(...).toBe(false) on one line is covered', () => {
    const res = isEdgeCovered(
      { from: 'confirmed', to: 'completed', legal: false },
      fileLines,
      4,
    );
    expect(res.covered).toBe(true);
    expect(res.evidenceLine).toBe(50);
  });

  test('an edge whose states never co-occur near the right outcome is uncovered', () => {
    const res = isEdgeCovered(
      { from: 'planned', to: 'verified', legal: true },
      fileLines,
      4,
    );
    expect(res.covered).toBe(false);
    expect(res.evidenceLine).toBeUndefined();
  });

  test('a LEGAL edge near only a 4xx (wrong outcome) is NOT counted as covered', () => {
    // 'diagnosed'+'performed' co-occur only near a 422; as a *legal* edge that
    // proximity does not prove success → uncovered.
    const res = isEdgeCovered(
      { from: 'diagnosed', to: 'performed', legal: true },
      fileLines,
      4,
    );
    expect(res.covered).toBe(false);
  });

  // Structured-assertion precision: a `.toContain` / `isValidTransition` line
  // counts ONLY for the exact ordered pair it asserts.
  const structuredLines = [
    { line: 68, text: "    expect(APPOINTMENT_TRANSITIONS['scheduled']).toContain('confirmed');" },
    { line: 70, text: "    expect(APPOINTMENT_TRANSITIONS['scheduled']).toContain('cancelled');" },
    { line: 82, text: "    expect(isValidTransition('confirmed', 'completed')).toBe(false);" },
    { line: 86, text: "    expect(isValidTransition('no_show', 'completed')).toBe(true);" },
  ];

  test('a toContain line covers its exact legal membership edge', () => {
    const res = isEdgeCovered({ from: 'scheduled', to: 'confirmed', legal: true }, structuredLines);
    expect(res.covered).toBe(true);
    expect(res.evidenceLine).toBe(68);
  });

  test('a multi-target toContain block does NOT spuriously cover an unrelated edge', () => {
    // `scheduled→confirmed` and `scheduled→cancelled` lines both name `cancelled`
    // and (line 68) `confirmed`, but `cancelled→confirmed` is NOT asserted by any
    // single structured line → must be uncovered (the prior false-positive).
    const res = isEdgeCovered({ from: 'cancelled', to: 'confirmed', legal: false }, structuredLines);
    expect(res.covered).toBe(false);
  });

  test('isValidTransition(...).toBe(false) covers exactly that illegal edge', () => {
    const res = isEdgeCovered({ from: 'confirmed', to: 'completed', legal: false }, structuredLines);
    expect(res.covered).toBe(true);
    expect(res.evidenceLine).toBe(82);
  });

  test('isValidTransition(...).toBe(true) covers exactly that legal edge', () => {
    const res = isEdgeCovered({ from: 'no_show', to: 'completed', legal: true }, structuredLines);
    expect(res.covered).toBe(true);
    expect(res.evidenceLine).toBe(86);
  });

  test('a structured assertion does not cover the reverse-polarity edge', () => {
    // line 82 asserts confirmed→completed is *illegal*; it must not be read as
    // covering a (hypothetical) legal confirmed→completed edge.
    const res = isEdgeCovered({ from: 'confirmed', to: 'completed', legal: true }, structuredLines);
    expect(res.covered).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (e) discoverFsms — integration against the live repo
// ─────────────────────────────────────────────────────────────────────────────

describe('discoverFsms (live repo)', () => {
  let fsms: ParsedFsm[];

  test('finds every declared *_TRANSITIONS constant', () => {
    fsms = discoverFsms();
    const names = fsms.map((f) => f.constName).sort();
    expect(names).toEqual(
      [
        'APPOINTMENT_TRANSITIONS',
        'CEPH_LANDMARK_TRANSITIONS',
        'FINDING_TRANSITIONS',
        'LAB_ORDER_TRANSITIONS',
        'PAYMENT_PLAN_TRANSITIONS',
        'PRESCRIPTION_TRANSITIONS',
        'TREATMENT_TRANSITIONS',
        'VISIT_TRANSITIONS',
      ].sort(),
    );
  });

  test('every discovered FSM has a non-empty parsed transition map', () => {
    for (const f of discoverFsms()) {
      expect(Object.keys(f.legalMap).length).toBeGreaterThan(0);
    }
  });

  test('the Visit FSM parses to its known shape', () => {
    const visit = discoverFsms().find((f) => f.constName === 'VISIT_TRANSITIONS');
    expect(visit).toBeDefined();
    expect(visit!.legalMap['draft']).toEqual(['active']);
    expect(visit!.legalMap['active']).toEqual(['completed', 'discarded']);
    expect(visit!.legalMap['locked']).toEqual([]);
  });
});
