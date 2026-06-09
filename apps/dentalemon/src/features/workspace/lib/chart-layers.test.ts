/**
 * chart-layers helper tests.
 *
 * The odontogram is a cumulative living document: its Proposed / Completed /
 * Declined layers are status-filtered views of the patient's treatments across
 * ALL visits — not the current visit alone. `deriveChartLayerSets` turns the
 * already-fetched cumulative treatment-plan aggregate into the per-layer tooth
 * sets the chart renders, applying the clinical precedence completed > proposed
 * > declined (a tooth that has been performed is shown done, even if another
 * planned/declined item also references it).
 */
import { describe, test, expect } from 'bun:test';
import { deriveChartLayerSets } from './chart-layers';
import type { TreatmentPlanData, TreatmentPlanItem } from '../hooks/use-treatment-plan';

const item = (over: Partial<TreatmentPlanItem>): TreatmentPlanItem => ({
  id: over.id ?? 'id',
  toothNumber: over.toothNumber ?? null,
  cdtCode: 'D0000',
  description: 'x',
  surfaces: null,
  priceCents: 0,
  status: over.status ?? 'planned',
  conditionCode: null,
  visitId: over.visitId ?? 'v1',
  carriedOver: over.carriedOver ?? false,
  ...over,
});

const plan = (over: Partial<TreatmentPlanData>): TreatmentPlanData => ({
  patientId: 'p1',
  totalEstimateCents: 0,
  treatmentCount: 0,
  toothCount: 0,
  byTooth: {},
  treatments: [],
  completedToothNumbers: [],
  ...over,
});

describe('deriveChartLayerSets', () => {
  test('completed comes from the cumulative completedToothNumbers field', () => {
    const sets = deriveChartLayerSets(plan({ completedToothNumbers: [26, 36] }));
    expect([...sets.completed].sort((a, b) => a - b)).toEqual([26, 36]);
  });

  test('proposed = diagnosed/planned tooth treatments', () => {
    const sets = deriveChartLayerSets(
      plan({
        treatments: [
          item({ toothNumber: 11, status: 'planned' }),
          item({ toothNumber: 12, status: 'diagnosed' }),
        ],
      }),
    );
    expect([...sets.proposed].sort((a, b) => a - b)).toEqual([11, 12]);
  });

  test('declined = declined tooth treatments', () => {
    const sets = deriveChartLayerSets(
      plan({ treatments: [item({ toothNumber: 21, status: 'declined' })] }),
    );
    expect([...sets.declined]).toEqual([21]);
    expect(sets.proposed.has(21)).toBe(false);
  });

  test('precedence: a completed tooth is never also proposed or declined', () => {
    const sets = deriveChartLayerSets(
      plan({
        completedToothNumbers: [26],
        treatments: [
          item({ toothNumber: 26, status: 'planned' }), // same tooth, still has a planned item
          item({ toothNumber: 26, status: 'declined' }),
        ],
      }),
    );
    expect(sets.completed.has(26)).toBe(true);
    expect(sets.proposed.has(26)).toBe(false);
    expect(sets.declined.has(26)).toBe(false);
  });

  test('carriedOver = carried-over proposed teeth (subset of proposed)', () => {
    const sets = deriveChartLayerSets(
      plan({
        treatments: [
          item({ toothNumber: 11, status: 'planned', carriedOver: true }),
          item({ toothNumber: 12, status: 'planned', carriedOver: false }),
        ],
      }),
    );
    expect([...sets.carriedOver]).toEqual([11]);
    expect(sets.proposed.has(11)).toBe(true);
  });

  test('general (null-tooth) treatments are ignored', () => {
    const sets = deriveChartLayerSets(
      plan({ treatments: [item({ toothNumber: null, status: 'planned' })] }),
    );
    expect(sets.proposed.size).toBe(0);
  });

  test('null plan → empty sets', () => {
    const sets = deriveChartLayerSets(null);
    expect(sets.completed.size).toBe(0);
    expect(sets.proposed.size).toBe(0);
    expect(sets.declined.size).toBe(0);
    expect(sets.carriedOver.size).toBe(0);
  });
});
