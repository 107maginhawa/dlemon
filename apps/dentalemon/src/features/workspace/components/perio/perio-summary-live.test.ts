/**
 * computeLivePerioSummary — draft-mode live summary preview.
 *
 * Draft perio charts have no persisted summary (the backend only computes BOP%/mean
 * depth/deep pockets at completion). Showing three "–" next to a live "Over threshold"
 * count was incoherent. This helper computes the same stats live from the same readings
 * using the SAME formula as completePerioChart.ts, so the draft preview equals the
 * eventual finalized numbers — no divergence.
 */
import { describe, test, expect } from 'bun:test';
import type { PerioToothReading } from '@monobase/sdk-ts/generated';
import { computeLivePerioSummary } from './perio-types';

function r(fields: Partial<PerioToothReading>): PerioToothReading {
  return fields as PerioToothReading;
}

describe('computeLivePerioSummary', () => {
  test('empty readings → all null (summary bar shows "–")', () => {
    expect(computeLivePerioSummary([])).toEqual({
      bopPercent: null,
      meanDepth: null,
      deepPocketCount: null,
    });
  });

  test('computes mean depth, deep-pocket count and BOP% from charted sites', () => {
    const s = computeLivePerioSummary([
      r({ depthBM: 3, depthBC: 5, depthBD: 6, bopBM: true, bopBC: false, bopBD: true }),
    ]);
    expect(s.meanDepth).toBeCloseTo((3 + 5 + 6) / 3, 5); // 4.667
    expect(s.deepPocketCount).toBe(2); // 5mm and 6mm are ≥ 5
    expect(s.bopPercent).toBeCloseTo((2 / 3) * 100, 5); // 66.67%
  });

  test('deep-pocket uses the fixed 5mm clinical constant, not the adjustable red-line', () => {
    const s = computeLivePerioSummary([r({ depthBM: 4, depthBC: 5 })]);
    expect(s.deepPocketCount).toBe(1); // only the 5mm site counts
    expect(s.meanDepth).toBeCloseTo(4.5, 5);
  });

  test('only counts charted sites (ignores null/undefined depths and non-boolean bop)', () => {
    const s = computeLivePerioSummary([
      r({ depthBM: 6, depthBC: null, bopBM: true }),
    ]);
    expect(s.meanDepth).toBe(6);
    expect(s.deepPocketCount).toBe(1);
    expect(s.bopPercent).toBe(100); // 1 of 1 charted bop site
  });
});
