/**
 * useDentalChart hook tests
 *
 * Tests tooth selection state and surface state management.
 *
 * Written RED — no implementation exists yet.
 */

import { describe, test, expect } from 'bun:test';
import { useDentalChart } from './use-dental-chart';

describe('useDentalChart', () => {
  describe('tooth selection', () => {
    test('no tooth selected initially', () => {
      const { selectedTooth } = useDentalChart();
      expect(selectedTooth).toBeNull();
    });

    test('selectTooth sets the selected tooth number', () => {
      const chart = useDentalChart();
      chart.selectTooth(21);
      expect(chart.selectedTooth).toBe(21);
    });

    test('selectTooth with same number deselects', () => {
      const chart = useDentalChart();
      chart.selectTooth(21);
      chart.selectTooth(21);
      expect(chart.selectedTooth).toBeNull();
    });

    test('selectTooth with different number switches selection', () => {
      const chart = useDentalChart();
      chart.selectTooth(21);
      chart.selectTooth(36);
      expect(chart.selectedTooth).toBe(36);
    });

    test('clearSelection sets selectedTooth to null', () => {
      const chart = useDentalChart();
      chart.selectTooth(21);
      chart.clearSelection();
      expect(chart.selectedTooth).toBeNull();
    });
  });

  describe('surface selection', () => {
    test('no surfaces selected initially', () => {
      const { selectedSurfaces } = useDentalChart();
      expect(selectedSurfaces).toEqual([]);
    });

    test('toggleSurface adds surface when not selected', () => {
      const chart = useDentalChart();
      chart.toggleSurface('mesial');
      expect(chart.selectedSurfaces).toContain('mesial');
    });

    test('toggleSurface removes surface when already selected', () => {
      const chart = useDentalChart();
      chart.toggleSurface('mesial');
      chart.toggleSurface('mesial');
      expect(chart.selectedSurfaces).not.toContain('mesial');
    });

    test('can select multiple surfaces', () => {
      const chart = useDentalChart();
      chart.toggleSurface('mesial');
      chart.toggleSurface('occlusal');
      chart.toggleSurface('buccal');
      expect(chart.selectedSurfaces).toHaveLength(3);
    });

    test('clearSurfaces resets to empty', () => {
      const chart = useDentalChart();
      chart.toggleSurface('mesial');
      chart.toggleSurface('occlusal');
      chart.clearSurfaces();
      expect(chart.selectedSurfaces).toEqual([]);
    });
  });
});
