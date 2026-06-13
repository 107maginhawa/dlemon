/**
 * Unit tests for the perio multi-exam comparison maths (pure, no React).
 */
import { describe, test, expect } from 'bun:test';
import {
  readingMaxPd,
  buildSummaryRows,
  buildToothPdRows,
  buildStagingCells,
  formatStage,
  examDateLabel,
} from './perio-comparison.logic';
import type { PerioChart } from '@monobase/sdk-ts/generated';

function reading(toothNumber: number, depths: Partial<Record<'depthBM' | 'depthBC' | 'depthBD' | 'depthLM' | 'depthLC' | 'depthLD', number>>): any {
  return { id: `r-${toothNumber}`, chartId: 'c', toothNumber, ...depths };
}

function chart(over: Partial<PerioChart> & { id: string }): PerioChart {
  return {
    visitId: 'v', patientId: 'p', branchId: 'b', examinerMemberId: 'm',
    status: 'completed', readings: [], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    ...over,
  } as PerioChart;
}

// Newest-first (as the API returns).
const NEW = chart({
  id: 'new', completedAt: '2026-05-20T10:00:00Z',
  summaryBopPercent: 18, summaryMeanDepth: 2.8, summaryDeepPocketCount: 1,
  readings: [reading(16, { depthBM: 3, depthBD: 4 }), reading(26, { depthBC: 2 })],
});
const OLD = chart({
  id: 'old', completedAt: '2026-01-10T10:00:00Z',
  summaryBopPercent: 40, summaryMeanDepth: 3.5, summaryDeepPocketCount: 5,
  readings: [reading(16, { depthBM: 5, depthBD: 6 }), reading(26, { depthBC: 2 })],
});

describe('readingMaxPd', () => {
  test('returns the deepest of the 6 sites; null when none recorded', () => {
    expect(readingMaxPd(reading(16, { depthBM: 3, depthBD: 4, depthLC: 2 }))).toBe(4);
    expect(readingMaxPd(reading(16, {}))).toBeNull();
  });
});

describe('buildStagingCells / formatStage', () => {
  test('maps each chart to its persisted stage/grade; null when absent (legacy)', () => {
    const withStage = chart({ id: 's', stage: 'II', grade: 'B' } as any);
    const legacy = chart({ id: 'l' });
    expect(buildStagingCells([withStage, legacy])).toEqual([
      { stage: 'II', grade: 'B' },
      { stage: null, grade: null },
    ]);
  });
  test('formatStage labels a stage or an em-dash, never "Stage null"', () => {
    expect(formatStage('III')).toBe('Stage III');
    expect(formatStage(null)).toBe('—');
  });
});

describe('buildSummaryRows', () => {
  const rows = buildSummaryRows([NEW, OLD]);
  test('produces three metric rows aligned newest-first', () => {
    expect(rows.map((r) => r.key)).toEqual(['bop', 'meanDepth', 'deepPockets']);
    expect(rows[0]!.values).toEqual([18, 40]);
  });
  test('newest column improved vs older (down = better)', () => {
    const bop = rows[0]!;
    expect(bop.deltas[0]).toEqual({ dir: 'down', better: true, amount: -22 });
    // oldest column has no older exam to compare against
    expect(bop.deltas[1]).toBeNull();
  });
  test('coerces numeric-string summaries (wire format) to numbers', () => {
    const rows = buildSummaryRows([
      chart({ id: 'a', summaryBopPercent: '18.00' as any, completedAt: '2026-06-01T00:00:00Z' }),
      chart({ id: 'b', summaryBopPercent: '40.00' as any, completedAt: '2026-01-01T00:00:00Z' }),
    ]);
    expect(rows[0]!.values).toEqual([18, 40]);
    expect(rows[0]!.deltas[0]).toEqual({ dir: 'down', better: true, amount: -22 });
  });

  test('worsening shows up = not better', () => {
    const worse = buildSummaryRows([
      chart({ id: 'a', summaryBopPercent: 50, completedAt: '2026-06-01T00:00:00Z' }),
      chart({ id: 'b', summaryBopPercent: 30, completedAt: '2026-01-01T00:00:00Z' }),
    ]);
    expect(worse[0]!.deltas[0]).toEqual({ dir: 'up', better: false, amount: 20 });
  });
});

describe('buildToothPdRows', () => {
  const rows = buildToothPdRows([NEW, OLD]);
  test('one row per charted tooth, FDI ascending, max PD per exam', () => {
    expect(rows.map((r) => r.toothNumber)).toEqual([16, 26]);
    const t16 = rows.find((r) => r.toothNumber === 16)!;
    expect(t16.maxPd).toEqual([4, 6]); // newest 4, older 6
  });
  test('flags worsening (newer deeper than older)', () => {
    // tooth 16 improved (4 < 6) → not worse; build a worsening case
    const worsen = buildToothPdRows([
      chart({ id: 'n', completedAt: '2026-06-01T00:00:00Z', readings: [reading(11, { depthBM: 6 })] }),
      chart({ id: 'o', completedAt: '2026-01-01T00:00:00Z', readings: [reading(11, { depthBM: 3 })] }),
    ]);
    expect(worsen[0]!.worse[0]).toBe(true);   // 6 > 3 → worse
    expect(worsen[0]!.worse[1]).toBe(false);  // oldest column never "worse"
  });
});

describe('examDateLabel', () => {
  test('formats completedAt; falls back to — on missing/invalid', () => {
    expect(examDateLabel(NEW)).toContain('2026');
    expect(examDateLabel(chart({ id: 'x', completedAt: undefined, createdAt: '', updatedAt: '' }))).toBe('—');
  });
});
