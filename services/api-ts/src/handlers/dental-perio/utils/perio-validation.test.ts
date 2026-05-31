/**
 * perio-validation unit tests — BR-P03 / BR-P04 charting-integrity guards
 *
 * These assertion helpers are defense-in-depth: the generated request validator
 * already bounds depth (0-20) and recession (-5-20), so a >20 depth is rejected
 * with 400 before the handler runs. assertValidDepths is therefore only
 * exercisable as a unit test — but it must still be pinned: it is the BR-P03
 * invariant and a regression (e.g. someone loosening the zod bound) would ship
 * silently if nothing tests the guard itself.
 *
 * assertValidToothNumber (BR-P04) IS reachable at the HTTP layer because the FDI
 * quadrant gaps (19, 29, …, 56) fall inside the validator's numeric [11,85]
 * range; that path is also covered end-to-end in dental-perio-coverage.test.ts.
 */

import { describe, test, expect } from 'bun:test';
import { assertValidDepths, assertValidToothNumber, isValidFdiToothNumber } from './perio-validation';

function codeOf(fn: () => void): string | undefined {
  try {
    fn();
  } catch (e) {
    return (e as any).code;
  }
  return undefined;
}

describe('assertValidDepths — BR-P03 / AC-P04 (INVALID_DEPTH)', () => {
  test('rejects a probing depth above 20mm', () => {
    expect(codeOf(() => assertValidDepths({ depthBM: 21 }))).toBe('INVALID_DEPTH');
  });

  test('rejects a negative probing depth', () => {
    expect(codeOf(() => assertValidDepths({ depthLD: -1 }))).toBe('INVALID_DEPTH');
  });

  test('rejects a non-integer depth', () => {
    expect(codeOf(() => assertValidDepths({ depthBC: 3.5 }))).toBe('INVALID_DEPTH');
  });

  test('rejects recession below the -5mm floor', () => {
    expect(codeOf(() => assertValidDepths({ recession: -6 }))).toBe('INVALID_DEPTH');
  });

  test('rejects recession above 20mm', () => {
    expect(codeOf(() => assertValidDepths({ recession: 21 }))).toBe('INVALID_DEPTH');
  });

  test('accepts in-range depths + recession at the boundaries', () => {
    expect(() => assertValidDepths({ depthBM: 0, depthLD: 20, recession: -5 })).not.toThrow();
  });

  test('ignores undefined/null fields', () => {
    expect(() => assertValidDepths({ depthBM: undefined, recession: null })).not.toThrow();
  });
});

describe('assertValidToothNumber — BR-P04 / AC-P05 (INVALID_TOOTH_NUMBER)', () => {
  test('rejects a number in the gap between adult quadrants (19)', () => {
    expect(codeOf(() => assertValidToothNumber(19))).toBe('INVALID_TOOTH_NUMBER');
  });

  test('rejects 29 / 56 (quadrant gaps)', () => {
    expect(codeOf(() => assertValidToothNumber(29))).toBe('INVALID_TOOTH_NUMBER');
    expect(codeOf(() => assertValidToothNumber(56))).toBe('INVALID_TOOTH_NUMBER');
  });

  test('accepts valid adult + primary FDI numbers', () => {
    for (const n of [11, 18, 21, 28, 31, 38, 41, 48, 51, 55, 61, 85]) {
      expect(() => assertValidToothNumber(n)).not.toThrow();
      expect(isValidFdiToothNumber(n)).toBe(true);
    }
  });
});
