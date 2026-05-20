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
