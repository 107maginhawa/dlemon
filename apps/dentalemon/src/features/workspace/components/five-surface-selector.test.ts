/**
 * FiveSurfaceSelector tests
 *
 * Tests surface toggle logic and label switching for anterior/posterior teeth.
 *
 * Written RED — no implementation exists yet.
 */

import { describe, test, expect } from 'bun:test';
import { getSurfacesForTooth, isAnteriorTooth, type ToothSurface } from './five-surface-selector.helpers';

describe('FiveSurfaceSelector helpers', () => {
  describe('isAnteriorTooth', () => {
    test('teeth 11-13 are anterior (FDI notation)', () => {
      expect(isAnteriorTooth(11)).toBe(true);
      expect(isAnteriorTooth(12)).toBe(true);
      expect(isAnteriorTooth(13)).toBe(true);
    });

    test('teeth 14+ are posterior', () => {
      expect(isAnteriorTooth(14)).toBe(false);
      expect(isAnteriorTooth(36)).toBe(false);
    });

    test('returns false for null/undefined tooth', () => {
      expect(isAnteriorTooth(null)).toBe(false);
    });
  });

  describe('getSurfacesForTooth', () => {
    test('anterior teeth use incisal instead of occlusal', () => {
      const surfaces = getSurfacesForTooth(11);
      expect(surfaces).toContain('incisal');
      expect(surfaces).not.toContain('occlusal');
    });

    test('posterior teeth use occlusal instead of incisal', () => {
      const surfaces = getSurfacesForTooth(36);
      expect(surfaces).toContain('occlusal');
      expect(surfaces).not.toContain('incisal');
    });

    test('both anterior and posterior include mesial, distal, buccal, lingual', () => {
      const anterior = getSurfacesForTooth(11);
      const posterior = getSurfacesForTooth(36);
      for (const surface of ['mesial', 'distal', 'buccal', 'lingual']) {
        expect(anterior).toContain(surface);
        expect(posterior).toContain(surface);
      }
    });

    test('returns 5 surfaces for both tooth types', () => {
      expect(getSurfacesForTooth(11)).toHaveLength(5);
      expect(getSurfacesForTooth(36)).toHaveLength(5);
    });
  });
});
