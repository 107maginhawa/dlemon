/**
 * dental-chart.helpers — exhaustive unit tests
 *
 * Covers:
 *  - isValidFdiNumber / isValidUniversalNumber
 *  - fdiToUniversal / universalToFdi — all 32 teeth
 *  - Round-trip identity
 *  - buildToothMap
 */
import { describe, test, expect } from 'bun:test';
import {
  TOOTH_NUMBERS,
  isValidFdiNumber,
  isValidUniversalNumber,
  fdiToUniversal,
  universalToFdi,
  buildToothMap,
  getToothFillColor,
  type ToothState,
} from './dental-chart.helpers';

// ─── isValidFdiNumber ──────────────────────────────────────────────────────

describe('isValidFdiNumber', () => {
  test('returns true for all 32 FDI numbers', () => {
    for (const n of TOOTH_NUMBERS) {
      expect(isValidFdiNumber(n)).toBe(true);
    }
  });

  test('returns false for common invalid inputs', () => {
    for (const bad of [0, 1, 9, 10, 19, 20, 29, 30, 39, 40, 49, 50, 99, -1]) {
      expect(isValidFdiNumber(bad)).toBe(false);
    }
  });

  test('boundaries: 11 and 48 are valid', () => {
    expect(isValidFdiNumber(11)).toBe(true);
    expect(isValidFdiNumber(48)).toBe(true);
  });
});

// ─── isValidUniversalNumber ────────────────────────────────────────────────

describe('isValidUniversalNumber', () => {
  test('returns true for 1–32', () => {
    for (let i = 1; i <= 32; i++) {
      expect(isValidUniversalNumber(i)).toBe(true);
    }
  });

  test('returns false for 0 and 33', () => {
    expect(isValidUniversalNumber(0)).toBe(false);
    expect(isValidUniversalNumber(33)).toBe(false);
  });

  test('returns false for non-integer', () => {
    expect(isValidUniversalNumber(1.5)).toBe(false);
  });
});

// ─── fdiToUniversal — all 32 mappings ─────────────────────────────────────

const EXPECTED_FDI_TO_UNIVERSAL: [number, number][] = [
  // Upper right
  [11, 8], [12, 7], [13, 6], [14, 5], [15, 4], [16, 3], [17, 2], [18, 1],
  // Upper left
  [21, 9], [22, 10], [23, 11], [24, 12], [25, 13], [26, 14], [27, 15], [28, 16],
  // Lower left
  [31, 24], [32, 23], [33, 22], [34, 21], [35, 20], [36, 19], [37, 18], [38, 17],
  // Lower right
  [41, 25], [42, 26], [43, 27], [44, 28], [45, 29], [46, 30], [47, 31], [48, 32],
];

describe('fdiToUniversal', () => {
  test.each(EXPECTED_FDI_TO_UNIVERSAL)('FDI %i → Universal %i', (fdi, uni) => {
    expect(fdiToUniversal(fdi)).toBe(uni);
  });

  test('returns NaN for invalid FDI number', () => {
    expect(fdiToUniversal(0)).toBeNaN();
    expect(fdiToUniversal(10)).toBeNaN();
    expect(fdiToUniversal(19)).toBeNaN();
    expect(fdiToUniversal(99)).toBeNaN();
  });

  test('all 32 valid FDI numbers produce valid Universal numbers (1–32)', () => {
    for (const fdi of TOOTH_NUMBERS) {
      const uni = fdiToUniversal(fdi);
      expect(isValidUniversalNumber(uni)).toBe(true);
    }
  });
});

// ─── universalToFdi — all 32 mappings ─────────────────────────────────────

describe('universalToFdi', () => {
  test.each(EXPECTED_FDI_TO_UNIVERSAL)('Universal %i → FDI %i (reverse)', (fdi, uni) => {
    expect(universalToFdi(uni)).toBe(fdi);
  });

  test('returns NaN for invalid Universal number', () => {
    expect(universalToFdi(0)).toBeNaN();
    expect(universalToFdi(33)).toBeNaN();
  });

  test('all 32 Universal numbers produce valid FDI numbers', () => {
    for (let uni = 1; uni <= 32; uni++) {
      const fdi = universalToFdi(uni);
      expect(isValidFdiNumber(fdi)).toBe(true);
    }
  });
});

// ─── Round-trip identity ───────────────────────────────────────────────────

describe('round-trip identity', () => {
  test('fdiToUniversal → universalToFdi returns original FDI number (all 32)', () => {
    for (const fdi of TOOTH_NUMBERS) {
      expect(universalToFdi(fdiToUniversal(fdi))).toBe(fdi);
    }
  });

  test('universalToFdi → fdiToUniversal returns original Universal number (all 32)', () => {
    for (let uni = 1; uni <= 32; uni++) {
      expect(fdiToUniversal(universalToFdi(uni))).toBe(uni);
    }
  });
});

// ─── buildToothMap ─────────────────────────────────────────────────────────

describe('buildToothMap', () => {
  test('builds a map from tooth array', () => {
    const map = buildToothMap([
      { toothNumber: 11, state: 'healthy' },
      { toothNumber: 21, state: 'caries' },
    ]);
    expect(map.get(11)).toBe('healthy');
    expect(map.get(21)).toBe('caries');
  });

  test('later entry overwrites earlier for same toothNumber', () => {
    const map = buildToothMap([
      { toothNumber: 11, state: 'healthy' },
      { toothNumber: 11, state: 'caries' },
    ]);
    expect(map.get(11)).toBe('caries');
  });

  test('empty array returns empty map', () => {
    expect(buildToothMap([])).toEqual(new Map());
  });

  test('all 32 teeth can be stored and retrieved', () => {
    const teeth = TOOTH_NUMBERS.map((n) => ({ toothNumber: n, state: 'healthy' as const }));
    const map = buildToothMap(teeth);
    expect(map.size).toBe(32);
    for (const n of TOOTH_NUMBERS) {
      expect(map.get(n)).toBe('healthy');
    }
  });
});

// ─── getToothInfo ──────────────────────────────────────────────────────────

import { getToothInfo } from './dental-chart.helpers';

describe('getToothInfo', () => {
  test('upper right central incisor (FDI 11)', () => {
    const info = getToothInfo(11);
    expect(info.name).toBe('Upper Right Central Incisor');
    expect(info.type).toBe('anterior');
  });

  test('upper left canine (FDI 23)', () => {
    const info = getToothInfo(23);
    expect(info.name).toBe('Upper Left Canine');
    expect(info.type).toBe('anterior');
  });

  test('lower left first molar (FDI 36)', () => {
    const info = getToothInfo(36);
    expect(info.name).toBe('Lower Left First Molar');
    expect(info.type).toBe('posterior');
  });

  test('lower right third molar (FDI 48)', () => {
    const info = getToothInfo(48);
    expect(info.name).toBe('Lower Right Third Molar');
    expect(info.type).toBe('posterior');
  });

  test('all 8 positions of upper right quadrant', () => {
    const expected = [
      'Central Incisor', 'Lateral Incisor', 'Canine',
      'First Premolar', 'Second Premolar', 'First Molar', 'Second Molar', 'Third Molar',
    ];
    for (let pos = 1; pos <= 8; pos++) {
      expect(getToothInfo(10 + pos).name).toBe(`Upper Right ${expected[pos - 1]}`);
    }
  });

  test('anterior teeth are positions 1-3 across all quadrants', () => {
    const anteriorFdi = [11, 12, 13, 21, 22, 23, 31, 32, 33, 41, 42, 43];
    for (const fdi of anteriorFdi) {
      expect(getToothInfo(fdi).type).toBe('anterior');
    }
  });

  test('posterior teeth are positions 4-8 across all quadrants', () => {
    const posteriorFdi = [14, 15, 16, 17, 18, 24, 25, 26, 27, 28, 34, 35, 36, 37, 38, 44, 45, 46, 47, 48];
    for (const fdi of posteriorFdi) {
      expect(getToothInfo(fdi).type).toBe('posterior');
    }
  });

  test('invalid FDI returns unknown', () => {
    const info = getToothInfo(99);
    expect(info.name).toBe('Tooth 99');
    expect(info.type).toBe('posterior');
  });
});

// ─── getDentitionType (AC-DENT-01, P2-002) ────────────────────────────────

import { getDentitionType } from './dental-chart.helpers';

describe('getDentitionType (P2-002)', () => {
  function dobYearsAgo(years: number): string {
    const d = new Date();
    d.setFullYear(d.getFullYear() - years);
    return d.toISOString().slice(0, 10);
  }

  test('returns "primary" for a 6-year-old (age < 12)', () => {
    expect(getDentitionType(dobYearsAgo(6))).toBe('primary');
  });

  test('returns "primary" for an 11-year-old (age < 12)', () => {
    expect(getDentitionType(dobYearsAgo(11))).toBe('primary');
  });

  test('returns "permanent" for a 12-year-old (age === 12)', () => {
    expect(getDentitionType(dobYearsAgo(12))).toBe('permanent');
  });

  test('returns "permanent" for a 13-year-old (age > 12)', () => {
    expect(getDentitionType(dobYearsAgo(13))).toBe('permanent');
  });

  test('returns "permanent" for null DOB (defaults to adult)', () => {
    expect(getDentitionType(null)).toBe('permanent');
  });

  test('returns "permanent" for adult (35 years)', () => {
    expect(getDentitionType(dobYearsAgo(35))).toBe('permanent');
  });
});

// ─── fdiPrimaryToUniversal (P2-002) ───────────────────────────────────────

import { fdiPrimaryToUniversal, PEDIATRIC_TOOTH_NUMBERS } from './dental-chart.helpers';

describe('fdiPrimaryToUniversal (P2-002)', () => {
  test('maps all 20 primary FDI numbers to unique Universal positions 1–20', () => {
    const universalNums = PEDIATRIC_TOOTH_NUMBERS.map(fdiPrimaryToUniversal);
    const unique = new Set(universalNums);
    expect(universalNums.every(n => n >= 1 && n <= 20)).toBe(true);
    expect(unique.size).toBe(20);
  });

  test('FDI 51 (upper-right central) maps to Universal 5', () => {
    expect(fdiPrimaryToUniversal(51)).toBe(5);
  });

  test('FDI 55 (upper-right molar) maps to Universal 1', () => {
    expect(fdiPrimaryToUniversal(55)).toBe(1);
  });

  test('FDI 61 (upper-left central) maps to Universal 6', () => {
    expect(fdiPrimaryToUniversal(61)).toBe(6);
  });

  test('FDI 65 (upper-left molar) maps to Universal 10', () => {
    expect(fdiPrimaryToUniversal(65)).toBe(10);
  });

  test('FDI 71 (lower-left central) maps to Universal 11', () => {
    expect(fdiPrimaryToUniversal(71)).toBe(11);
  });

  test('FDI 81 (lower-right central) maps to Universal 20', () => {
    expect(fdiPrimaryToUniversal(81)).toBe(20);
  });

  test('returns NaN for a permanent FDI number', () => {
    expect(fdiPrimaryToUniversal(11)).toBeNaN();
  });
});

// ─── getToothFillColor ─────────────────────────────────────────────────────

describe('getToothFillColor', () => {
  test('returns empty string for healthy (no fill — preserves SVG strokes)', () => {
    expect(getToothFillColor('healthy')).toBe('');
  });

  test('returns hex string for caries', () => {
    expect(getToothFillColor('caries')).toBe('#FF3B30');
  });

  test('returns hex string for crown', () => {
    expect(getToothFillColor('crown')).toBe('#FFD60A');
  });

  test('returns #ffffff for unknown state', () => {
    expect(getToothFillColor('unknown_state' as any)).toBe('#ffffff');
  });

  test('covers all 9 ToothState values — returns string (empty or hex)', () => {
    const states: ToothState[] = ['healthy', 'caries', 'fractured', 'filled', 'crown', 'missing', 'implant', 'extracted', 'watchlist'];
    for (const s of states) {
      const color = getToothFillColor(s);
      // healthy returns '' (no fill); all others return a hex color
      expect(typeof color).toBe('string');
      if (s !== 'healthy') {
        expect(color).toMatch(/^#[0-9a-fA-F]{3,8}$/);
      }
    }
  });
});

// ─── getToothDisplayLabel / fdiToPalmer (QW-5 notation toggle) ────────────

import { getToothDisplayLabel, fdiToPalmer } from './dental-chart.helpers';

describe('fdiToPalmer', () => {
  test('FDI 11 (UR central) → "1|"', () => {
    expect(fdiToPalmer(11)).toBe('1|');
  });

  test('FDI 18 (UR wisdom) → "8|"', () => {
    expect(fdiToPalmer(18)).toBe('8|');
  });

  test('FDI 21 (UL central) → "|1"', () => {
    expect(fdiToPalmer(21)).toBe('|1');
  });

  test('FDI 28 (UL wisdom) → "|8"', () => {
    expect(fdiToPalmer(28)).toBe('|8');
  });

  test('FDI 31 (LL central) → "|1"', () => {
    expect(fdiToPalmer(31)).toBe('|1');
  });

  test('FDI 38 (LL wisdom) → "|8"', () => {
    expect(fdiToPalmer(38)).toBe('|8');
  });

  test('FDI 41 (LR central) → "1|"', () => {
    expect(fdiToPalmer(41)).toBe('1|');
  });

  test('FDI 48 (LR wisdom) → "8|"', () => {
    expect(fdiToPalmer(48)).toBe('8|');
  });

  test('all 32 FDI numbers return a non-empty string', () => {
    for (const n of TOOTH_NUMBERS) {
      const label = fdiToPalmer(n);
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    }
  });

  test('returns empty string for invalid FDI number', () => {
    expect(fdiToPalmer(99)).toBe('');
  });
});

describe('getToothDisplayLabel (QW-5 notation toggle)', () => {
  test('FDI notation: returns FDI number as string for tooth 11', () => {
    expect(getToothDisplayLabel(11, 'FDI')).toBe('11');
  });

  test('FDI notation: returns FDI number as string for all permanent teeth', () => {
    for (const n of TOOTH_NUMBERS) {
      expect(getToothDisplayLabel(n, 'FDI')).toBe(String(n));
    }
  });

  test('Universal notation: FDI 11 (UR central) → "8"', () => {
    expect(getToothDisplayLabel(11, 'Universal')).toBe('8');
  });

  test('Universal notation: FDI 18 (UR wisdom) → "1"', () => {
    expect(getToothDisplayLabel(18, 'Universal')).toBe('1');
  });

  test('Universal notation: FDI 21 (UL central) → "9"', () => {
    expect(getToothDisplayLabel(21, 'Universal')).toBe('9');
  });

  test('Universal notation: FDI 48 (LR wisdom) → "32"', () => {
    expect(getToothDisplayLabel(48, 'Universal')).toBe('32');
  });

  test('Universal notation: all 32 FDI numbers produce valid Universal labels 1–32', () => {
    for (const n of TOOTH_NUMBERS) {
      const label = getToothDisplayLabel(n, 'Universal');
      const num = Number(label);
      expect(num >= 1 && num <= 32).toBe(true);
    }
  });

  test('Palmer notation: FDI 11 returns a non-empty string', () => {
    const label = getToothDisplayLabel(11, 'Palmer');
    expect(typeof label).toBe('string');
    expect(label.length).toBeGreaterThan(0);
  });

  test('Palmer notation: FDI 21 produces a different label from FDI 11 (different quadrant)', () => {
    expect(getToothDisplayLabel(11, 'Palmer')).not.toBe(getToothDisplayLabel(21, 'Palmer'));
  });

  test('unknown notation falls back to FDI string', () => {
    expect(getToothDisplayLabel(11, 'unknown' as any)).toBe('11');
  });

  test('primary tooth FDI 51 with FDI notation returns "51"', () => {
    expect(getToothDisplayLabel(51, 'FDI')).toBe('51');
  });

  test('primary tooth FDI 51 with Universal notation returns "5"', () => {
    expect(getToothDisplayLabel(51, 'Universal')).toBe('5');
  });
});

// ─── getToothLayer (CR-03 chart layer separation) ─────────────────────────

import { getToothLayer } from './dental-chart.helpers';

describe('getToothLayer (CR-03)', () => {
  test('existing → baseline', () => {
    expect(getToothLayer('existing')).toBe('baseline');
  });

  test('existing_other → baseline', () => {
    expect(getToothLayer('existing_other')).toBe('baseline');
  });

  test('treatment_plan → proposed', () => {
    expect(getToothLayer('treatment_plan')).toBe('proposed');
  });

  test('condition → proposed', () => {
    expect(getToothLayer('condition')).toBe('proposed');
  });

  test('undefined (unclassified/legacy) → baseline', () => {
    expect(getToothLayer(undefined)).toBe('baseline');
  });
});
