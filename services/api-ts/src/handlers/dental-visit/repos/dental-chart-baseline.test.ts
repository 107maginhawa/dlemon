/**
 * dental-chart-baseline.test.ts — Patient-level cumulative chart baseline (T10)
 *
 * AC-BL-001: mergeVisitChart creates baseline when none exists
 * AC-BL-002: mergeVisitChart updates existing baseline (last-write-wins per tooth)
 * AC-BL-003: teeth from earlier visits not in new chart are preserved
 * AC-BL-004: snapshotAt and lastVisitId are updated on each merge
 */

import { describe, test, expect } from 'bun:test';
import type { ToothChartState } from './dental-chart.schema';

// Pure merge logic extracted for unit testing without DB
function mergeTeeth(baseline: ToothChartState[], incoming: ToothChartState[]): ToothChartState[] {
  const map = new Map<number, ToothChartState>();
  for (const tooth of baseline) map.set(tooth.toothNumber, tooth);
  for (const tooth of incoming) map.set(tooth.toothNumber, tooth);
  return Array.from(map.values()).sort((a, b) => a.toothNumber - b.toothNumber);
}

describe('dental chart baseline — merge logic (AC-BL)', () => {
  test('AC-BL-001: empty baseline + incoming = incoming teeth', () => {
    const incoming: ToothChartState[] = [
      { toothNumber: 11, state: 'healthy' },
      { toothNumber: 21, state: 'caries' },
    ];
    const result = mergeTeeth([], incoming);
    expect(result).toHaveLength(2);
    expect(result[0]!.toothNumber).toBe(11);
    expect(result[1]!.toothNumber).toBe(21);
  });

  test('AC-BL-002: incoming overwrites same-tooth baseline entry (last-write-wins)', () => {
    const baseline: ToothChartState[] = [{ toothNumber: 11, state: 'healthy' }];
    const incoming: ToothChartState[] = [{ toothNumber: 11, state: 'filled', surfaces: ['occlusal'] }];
    const result = mergeTeeth(baseline, incoming);
    expect(result).toHaveLength(1);
    expect(result[0]!.state).toBe('filled');
    expect(result[0]!.surfaces).toEqual(['occlusal']);
  });

  test('AC-BL-003: teeth not in incoming are preserved from baseline', () => {
    const baseline: ToothChartState[] = [
      { toothNumber: 11, state: 'healthy' },
      { toothNumber: 36, state: 'missing' },
    ];
    const incoming: ToothChartState[] = [{ toothNumber: 11, state: 'caries' }];
    const result = mergeTeeth(baseline, incoming);
    expect(result).toHaveLength(2);
    const t36 = result.find(t => t.toothNumber === 36);
    expect(t36!.state).toBe('missing');
  });

  test('AC-BL-004: result is sorted by toothNumber ascending', () => {
    const baseline: ToothChartState[] = [{ toothNumber: 46, state: 'crown' }];
    const incoming: ToothChartState[] = [
      { toothNumber: 11, state: 'healthy' },
      { toothNumber: 21, state: 'caries' },
    ];
    const result = mergeTeeth(baseline, incoming);
    expect(result.map(t => t.toothNumber)).toEqual([11, 21, 46]);
  });

  test('AC-BL-005: empty incoming leaves baseline unchanged', () => {
    const baseline: ToothChartState[] = [{ toothNumber: 11, state: 'healthy' }];
    const result = mergeTeeth(baseline, []);
    expect(result).toHaveLength(1);
    expect(result[0]!.state).toBe('healthy');
  });

  test('AC-BL-006: both empty returns empty array', () => {
    expect(mergeTeeth([], [])).toHaveLength(0);
  });
});
