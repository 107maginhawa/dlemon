/**
 * Tier 1 — value-bounds parity tests (plan 09 §4).
 *
 * The voice parser MUST accept EXACTLY the value ranges the backend validators
 * accept, so a high-confidence in-range voice value can never produce a body the
 * API rejects with 422.
 *
 * The backend validators live in a sibling workspace
 * (services/api-ts/src/handlers/dental-perio/utils/perio-validation.ts) and use a
 * server-only path alias, so we cannot import them here directly. Instead we
 * re-encode the backend's exact numeric contract as the source of truth and
 * (a) assert the parser constants match it and (b) drive the parser across the
 * boundary so an out-of-range value is flagged, never silently accepted.
 *
 * Backend contract (verbatim from perio-validation.ts):
 *   - assertValidDepths:         integer 0..20
 *   - recession bound:           integer -5..20
 *   - assertValidGingivalMargins:integer -5..20
 *   - assertValidGrades:         integer 0..3  (mobility, furcation)
 */

import { describe, test, expect } from 'bun:test';
import {
  parseUtterance,
  isDepthInRange,
  isMarginInRange,
  isGradeInRange,
  VOICE_DEPTH_MIN,
  VOICE_DEPTH_MAX,
  VOICE_MARGIN_MIN,
  VOICE_MARGIN_MAX,
  VOICE_GRADE_MIN,
  VOICE_GRADE_MAX,
} from './perio-voice-grammar';

// --- Backend source-of-truth contract (must match perio-validation.ts) -------
const BACKEND = {
  depth: { min: 0, max: 20 },
  margin: { min: -5, max: 20 }, // recession + gingival margin
  grade: { min: 0, max: 3 }, // mobility + furcation
} as const;

// Faithful re-implementations of the backend predicates (perio-validation.ts).
function backendAcceptsDepth(v: number): boolean {
  return Number.isInteger(v) && v >= BACKEND.depth.min && v <= BACKEND.depth.max;
}
function backendAcceptsMargin(v: number): boolean {
  return Number.isInteger(v) && v >= BACKEND.margin.min && v <= BACKEND.margin.max;
}
function backendAcceptsGrade(v: number): boolean {
  return Number.isInteger(v) && v >= BACKEND.grade.min && v <= BACKEND.grade.max;
}

describe('parser constants equal the backend numeric contract', () => {
  test('depth bounds match assertValidDepths (0..20)', () => {
    expect([VOICE_DEPTH_MIN, VOICE_DEPTH_MAX]).toEqual([BACKEND.depth.min, BACKEND.depth.max]);
  });
  test('margin bounds match recession / assertValidGingivalMargins (-5..20)', () => {
    expect([VOICE_MARGIN_MIN, VOICE_MARGIN_MAX]).toEqual([BACKEND.margin.min, BACKEND.margin.max]);
  });
  test('grade bounds match assertValidGrades (0..3)', () => {
    expect([VOICE_GRADE_MIN, VOICE_GRADE_MAX]).toEqual([BACKEND.grade.min, BACKEND.grade.max]);
  });
});

describe('range predicates agree with the backend at every integer in a wide sweep', () => {
  test('depth predicate parity (-3..25)', () => {
    for (let v = -3; v <= 25; v += 1) {
      expect(isDepthInRange(v)).toBe(backendAcceptsDepth(v));
    }
  });
  test('margin predicate parity (-8..25)', () => {
    for (let v = -8; v <= 25; v += 1) {
      expect(isMarginInRange(v)).toBe(backendAcceptsMargin(v));
    }
  });
  test('grade predicate parity (-2..6)', () => {
    for (let v = -2; v <= 6; v += 1) {
      expect(isGradeInRange(v)).toBe(backendAcceptsGrade(v));
    }
  });
  test('non-integers are rejected like the backend', () => {
    expect(isDepthInRange(3.5)).toBe(false);
    expect(isMarginInRange(-1.5)).toBe(false);
    expect(isGradeInRange(2.5)).toBe(false);
  });
});

describe('parseUtterance never emits an accepted command outside backend bounds', () => {
  test('in-range depths (0..20) parse clean; >20 is flagged out-of-range', () => {
    for (let v = BACKEND.depth.min; v <= BACKEND.depth.max; v += 1) {
      const c = parseUtterance(String(v)).find((x) => x.kind === 'depth');
      expect(c?.kind === 'depth' && c.outOfRange).toBeFalsy();
    }
    const over = parseUtterance('21').find((x) => x.kind === 'depth');
    expect(over?.kind === 'depth' && over.outOfRange).toBe(true);
  });

  test('grade >3 is flagged out-of-range (so it never reaches the API)', () => {
    const c = parseUtterance('mobility four')[0];
    expect(c.kind === 'grade' && c.outOfRange).toBe(true);
  });

  test('recession below -5 is flagged out-of-range', () => {
    const c = parseUtterance('minus six').find((x) => x.kind === 'recession');
    expect(c?.kind === 'recession' && c.outOfRange).toBe(true);
  });
});
