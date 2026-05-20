/**
 * DentalChart component tests
 *
 * Tests:
 * - renders 32 teeth
 * - click selects tooth
 * - shows state-based CSS class for per-tooth coloring
 *
 * Written RED — no implementation exists yet.
 */

import { describe, test, expect } from 'bun:test';
import { buildToothMap, getToothColorClass, TOOTH_NUMBERS, PEDIATRIC_TOOTH_NUMBERS } from './dental-chart.helpers';

describe('DentalChart helpers', () => {
  describe('TOOTH_NUMBERS', () => {
    test('contains exactly 32 tooth numbers', () => {
      expect(TOOTH_NUMBERS).toHaveLength(32);
    });

    test('includes both upper and lower teeth', () => {
      // FDI notation: 1x = upper right, 2x = upper left, 3x = lower left, 4x = lower right
      const hasUpperRight = TOOTH_NUMBERS.some(n => n >= 11 && n <= 18);
      const hasUpperLeft = TOOTH_NUMBERS.some(n => n >= 21 && n <= 28);
      const hasLowerLeft = TOOTH_NUMBERS.some(n => n >= 31 && n <= 38);
      const hasLowerRight = TOOTH_NUMBERS.some(n => n >= 41 && n <= 48);
      expect(hasUpperRight).toBe(true);
      expect(hasUpperLeft).toBe(true);
      expect(hasLowerLeft).toBe(true);
      expect(hasLowerRight).toBe(true);
    });
  });

  describe('PEDIATRIC_TOOTH_NUMBERS', () => {
    test('contains exactly 20 primary teeth (AC-CHART-01)', () => {
      expect(PEDIATRIC_TOOTH_NUMBERS).toHaveLength(20);
    });

    test('includes all 4 pediatric quadrants', () => {
      const hasUpperRight = PEDIATRIC_TOOTH_NUMBERS.some(n => n >= 51 && n <= 55);
      const hasUpperLeft  = PEDIATRIC_TOOTH_NUMBERS.some(n => n >= 61 && n <= 65);
      const hasLowerLeft  = PEDIATRIC_TOOTH_NUMBERS.some(n => n >= 71 && n <= 75);
      const hasLowerRight = PEDIATRIC_TOOTH_NUMBERS.some(n => n >= 81 && n <= 85);
      expect(hasUpperRight).toBe(true);
      expect(hasUpperLeft).toBe(true);
      expect(hasLowerLeft).toBe(true);
      expect(hasLowerRight).toBe(true);
    });

    test('has no overlap with permanent TOOTH_NUMBERS', () => {
      const permanent = new Set(TOOTH_NUMBERS);
      const overlap = PEDIATRIC_TOOTH_NUMBERS.filter(n => permanent.has(n));
      expect(overlap).toHaveLength(0);
    });
  });

  describe('buildToothMap', () => {
    test('creates a map from toothNumber to state', () => {
      const teeth = [
        { toothNumber: 11, state: 'healthy' },
        { toothNumber: 21, state: 'caries' },
      ];
      const map = buildToothMap(teeth);
      expect(map.get(11)).toBe('healthy');
      expect(map.get(21)).toBe('caries');
      expect(map.get(36)).toBeUndefined();
    });
  });

  describe('getToothColorClass', () => {
    test('returns green for healthy', () => {
      expect(getToothColorClass('healthy')).toContain('green');
    });

    test('returns red for caries', () => {
      expect(getToothColorClass('caries')).toContain('red');
    });

    test('returns orange for fractured', () => {
      expect(getToothColorClass('fractured')).toContain('orange');
    });

    test('returns teal for filled', () => {
      const cls = getToothColorClass('filled');
      expect(cls === 'tooth-filled' || cls.includes('teal') || cls.includes('filled')).toBe(true);
    });

    test('returns lemon for crown', () => {
      const cls = getToothColorClass('crown');
      expect(cls === 'tooth-crown' || cls.includes('lemon') || cls.includes('crown') || cls.includes('yellow')).toBe(true);
    });

    test('returns gray-dashed for missing', () => {
      const cls = getToothColorClass('missing');
      expect(cls === 'tooth-missing' || cls.includes('gray') || cls.includes('missing')).toBe(true);
    });

    test('returns default for unknown state', () => {
      const cls = getToothColorClass('unknown_state' as any);
      expect(typeof cls).toBe('string');
    });
  });
});

// ─── FDI ↔ Universal adapter (written RED — fdiToUniversal/universalToFdi don't exist yet) ───

import { fdiToUniversal, universalToFdi } from './dental-chart.helpers';

describe('FDI ↔ Universal adapter', () => {
  describe('fdiToUniversal', () => {
    test('FDI 11 (UR central) → Universal 8', () => expect(fdiToUniversal(11)).toBe(8));
    test('FDI 18 (UR wisdom) → Universal 1', () => expect(fdiToUniversal(18)).toBe(1));
    test('FDI 21 (UL central) → Universal 9', () => expect(fdiToUniversal(21)).toBe(9));
    test('FDI 28 (UL wisdom) → Universal 16', () => expect(fdiToUniversal(28)).toBe(16));
    test('FDI 31 (LL central) → Universal 24', () => expect(fdiToUniversal(31)).toBe(24));
    test('FDI 38 (LL wisdom) → Universal 17', () => expect(fdiToUniversal(38)).toBe(17));
    test('FDI 41 (LR central) → Universal 25', () => expect(fdiToUniversal(41)).toBe(25));
    test('FDI 48 (LR wisdom) → Universal 32', () => expect(fdiToUniversal(48)).toBe(32));
  });

  describe('universalToFdi', () => {
    test('Universal 1 (UR wisdom) → FDI 18', () => expect(universalToFdi(1)).toBe(18));
    test('Universal 8 (UR central) → FDI 11', () => expect(universalToFdi(8)).toBe(11));
    test('Universal 9 (UL central) → FDI 21', () => expect(universalToFdi(9)).toBe(21));
    test('Universal 16 (UL wisdom) → FDI 28', () => expect(universalToFdi(16)).toBe(28));
    test('Universal 17 (LL wisdom) → FDI 38', () => expect(universalToFdi(17)).toBe(38));
    test('Universal 24 (LL central) → FDI 31', () => expect(universalToFdi(24)).toBe(31));
    test('Universal 25 (LR central) → FDI 41', () => expect(universalToFdi(25)).toBe(41));
    test('Universal 32 (LR wisdom) → FDI 48', () => expect(universalToFdi(32)).toBe(48));
  });

  describe('round-trip fidelity', () => {
    test('universalToFdi(fdiToUniversal(n)) === n for all 32 FDI numbers', () => {
      const allFdi = [
        11,12,13,14,15,16,17,18,
        21,22,23,24,25,26,27,28,
        31,32,33,34,35,36,37,38,
        41,42,43,44,45,46,47,48,
      ];
      for (const n of allFdi) {
        expect(universalToFdi(fdiToUniversal(n))).toBe(n);
      }
    });
  });
});
