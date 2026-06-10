/**
 * chart-conflict.helpers — pure derivations for the P0-A conflict UI.
 * Written RED before implementation.
 */
import { describe, test, expect } from 'bun:test';
import { conflictedToothNumbers, totalRejectedTeeth } from './chart-conflict.helpers';
import type { ChartConflict } from '@monobase/sdk-ts/generated';

function conflict(over: Partial<ChartConflict>): ChartConflict {
  return {
    chartId: 'c1', visitId: 'v1', patientId: 'p1',
    reason: 'stale_clock_rejected',
    rejectedTeeth: [],
    detectedAt: new Date('2026-06-10T00:00:00Z'),
    ...over,
  } as ChartConflict;
}

describe('conflictedToothNumbers', () => {
  test('collects every rejected tooth number across all conflicts (deduped)', () => {
    const set = conflictedToothNumbers([
      conflict({ rejectedTeeth: [{ toothNumber: 14, state: 'caries' }, { toothNumber: 21, state: 'fractured' }] as never }),
      conflict({ visitId: 'v2', rejectedTeeth: [{ toothNumber: 14, state: 'crown' }] as never }),
    ]);
    expect([...set].sort((a, b) => a - b)).toEqual([14, 21]);
  });

  test('is empty for no conflicts', () => {
    expect(conflictedToothNumbers([]).size).toBe(0);
  });
});

describe('totalRejectedTeeth', () => {
  test('counts every rejected tooth (the badge count must match the rows shown)', () => {
    expect(totalRejectedTeeth([
      conflict({ rejectedTeeth: [{ toothNumber: 14, state: 'caries' }, { toothNumber: 21, state: 'fractured' }] as never }),
      conflict({ visitId: 'v2', rejectedTeeth: [{ toothNumber: 36, state: 'filled' }] as never }),
    ])).toBe(3);
  });
});
