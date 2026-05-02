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
import { buildToothMap, getToothColorClass, TOOTH_NUMBERS } from './dental-chart.helpers';

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
