/**
 * chart-carryover — unit tests.
 *
 * The dental chart is a living document: a new visit must inherit the patient's
 * cumulative existing dentition (the baseline), not start blank. The baseline is
 * already the last-write-wins, existing-protected current mouth state, so it is
 * carried forward VERBATIM (no classification filtering — that would risk dropping
 * performed restorations). New findings are charted on top this visit.
 */
import { describe, test, expect } from 'bun:test';
import { chartFromBaseline, CARRYOVER_CHART_ID } from './chart-carryover';

const teeth = [
  { toothNumber: 19, state: 'crown', entryClassification: 'existing' },
  { toothNumber: 14, state: 'missing', entryClassification: 'existing' },
  { toothNumber: 30, state: 'caries', entryClassification: 'condition' },
] as any;

describe('chartFromBaseline', () => {
  test('carries the baseline teeth verbatim (never drops/filters any tooth)', () => {
    const chart = chartFromBaseline({ teeth, snapshotAt: new Date('2026-06-01') } as any, { id: 'v2', patientId: 'p1' } as any);
    expect(chart.teeth).toEqual(teeth);
  });

  test('binds the response to the NEW visit + patient with a sentinel id', () => {
    const chart = chartFromBaseline({ teeth } as any, { id: 'v2', patientId: 'p1' } as any);
    expect(chart.visitId).toBe('v2');
    expect(chart.patientId).toBe('p1');
    expect(chart.id).toBe(CARRYOVER_CHART_ID);
  });
});
