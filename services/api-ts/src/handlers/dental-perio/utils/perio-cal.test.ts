/**
 * perio-cal unit tests — P1-5 Clinical Attachment Level computation.
 *
 * Pins the recession-aware CAL formula across all three GM/CEJ cases described
 * in docs/reviews/research/perio.md §"Clinical Attachment Level":
 *   1. gingival margin AT CEJ (GM = 0)    → CAL = PD
 *   2. recession (GM apical, positive)    → CAL = PD + GM
 *   3. coronal-to-CEJ (GM coronal, negative) → CAL = PD − |GM| = PD + GM
 */

import { describe, test, expect } from 'bun:test';
import { computeSiteCal, computeReadingCal, maxReadingCal } from './perio-cal';

describe('computeSiteCal — three GM/CEJ cases', () => {
  test('case 1 — gingival margin AT CEJ: CAL = PD', () => {
    expect(computeSiteCal(5, 0)).toBe(5);
    expect(computeSiteCal(3, 0)).toBe(3);
  });

  test('case 2 — recession (margin apical to CEJ): CAL = PD + recession', () => {
    // PD 4mm + 2mm recession = 6mm attachment loss
    expect(computeSiteCal(4, 2)).toBe(6);
    // PD 6mm + 3mm recession = 9mm
    expect(computeSiteCal(6, 3)).toBe(9);
  });

  test('case 3 — coronal to CEJ (margin above CEJ): CAL = PD − |offset|', () => {
    // PD 5mm with margin 2mm coronal → 5 − 2 = 3mm true attachment loss
    expect(computeSiteCal(5, -2)).toBe(3);
    // PD 4mm with margin 1mm coronal → 3mm
    expect(computeSiteCal(4, -1)).toBe(3);
  });

  test('case 3 edge — coronal margin deeper than pocket clamps CAL at 0', () => {
    expect(computeSiteCal(2, -3)).toBe(0);
  });

  test('returns null when probing depth is missing', () => {
    expect(computeSiteCal(null, 2)).toBeNull();
    expect(computeSiteCal(undefined, 2)).toBeNull();
  });

  test('returns null when gingival margin is missing', () => {
    expect(computeSiteCal(5, null)).toBeNull();
    expect(computeSiteCal(5, undefined)).toBeNull();
  });
});

describe('computeReadingCal — per-site map', () => {
  test('computes all six sites independently across the three cases', () => {
    const cal = computeReadingCal({
      depthBM: 4, gmBM: 2, // recession → 6
      depthBC: 3, gmBC: 0, // at CEJ → 3
      depthBD: 5, gmBD: -2, // coronal → 3
      depthLM: 6, gmLM: 1, // recession → 7
      depthLC: undefined, gmLC: 2, // missing PD → null
      depthLD: 4, gmLD: undefined, // missing GM → null
    });
    expect(cal).toEqual({
      calBM: 6,
      calBC: 3,
      calBD: 3,
      calLM: 7,
      calLC: null,
      calLD: null,
    });
  });
});

describe('maxReadingCal — worst-site CAL', () => {
  test('returns the maximum computed CAL across sites', () => {
    expect(
      maxReadingCal({ depthBM: 4, gmBM: 2, depthBC: 3, gmBC: 0, depthLM: 6, gmLM: 1 }),
    ).toBe(7);
  });

  test('returns null when no site has both PD and GM', () => {
    expect(maxReadingCal({ depthBM: 4 })).toBeNull();
    expect(maxReadingCal({})).toBeNull();
  });
});
