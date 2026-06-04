/**
 * Test #3 — red-line threshold behavior on the grid.
 *
 *   - depth cells ≥ threshold render text-destructive
 *   - the out-of-range count (via countOverThreshold) updates when threshold changes
 *   - the default threshold is 5mm
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { PerioChartGrid } from './perio-chart-grid';
import { countOverThreshold, DEFAULT_DEPTH_THRESHOLD } from './perio-types';
import type { PerioToothReading } from '@monobase/sdk-ts/generated';

afterEach(cleanup);

function reading(tooth: number, depths: Partial<PerioToothReading>): PerioToothReading {
  return {
    id: `r-${tooth}`,
    chartId: 'c-1',
    toothNumber: tooth,
    mobility: 0,
    furcation: 0,
    plaque: false,
    suppuration: false,
    createdAt: '2026-06-01T00:00:00.000Z' as unknown as PerioToothReading['createdAt'],
    updatedAt: '2026-06-01T00:00:00.000Z' as unknown as PerioToothReading['updatedAt'],
    ...depths,
  } as PerioToothReading;
}

describe('red-line threshold', () => {
  test('default threshold constant is 5mm', () => {
    expect(DEFAULT_DEPTH_THRESHOLD).toBe(5);
  });

  test('depth cell ≥ threshold renders text-destructive; below does not', () => {
    render(
      <PerioChartGrid
        readings={[reading(16, { depthBM: 6, depthBC: 3 })]}
        threshold={5}
        onPatchTooth={() => {}}
      />,
    );
    const deep = screen.getByLabelText(/Tooth 16 mesiobuccal depth/i);
    const shallow = screen.getByLabelText(/Tooth 16 buccal depth/i);
    expect(deep.className).toContain('text-destructive');
    expect(shallow.className).not.toContain('text-destructive');
  });

  test('countOverThreshold updates when threshold changes', () => {
    const readings = [reading(16, { depthBM: 4, depthBC: 5, depthBD: 6 })];
    expect(countOverThreshold(readings, 5)).toBe(2); // 5 and 6
    expect(countOverThreshold(readings, 7)).toBe(0); // none
    expect(countOverThreshold(readings, 4)).toBe(3); // 4,5,6
  });
});
