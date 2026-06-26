/**
 * chart-layers helper tests.
 *
 * The odontogram is a cumulative living document: its Proposed / Completed /
 * Declined layers are status-filtered views of the patient's treatments across
 * ALL visits — not the current visit alone. `deriveChartLayerSets` turns the
 * already-fetched cumulative treatment-plan aggregate into the per-layer tooth
 * sets the chart renders, applying the clinical precedence proposed > completed
 * > declined (item 6 flip: outstanding planned/diagnosed work is shown Planned
 * even when the tooth also has a performed treatment, so new work is never
 * hidden behind a Treated ring).
 */
import { describe, test, expect } from 'bun:test';
import { deriveChartLayerSets } from './chart-layers';
import { statusToLayer } from '../components/dental-chart.helpers';
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

  test('precedence (item 6 flip): a tooth with a planned item wins as proposed, even when also completed/declined', () => {
    const sets = deriveChartLayerSets(
      plan({
        completedToothNumbers: [26],
        treatments: [
          item({ toothNumber: 26, status: 'planned' }), // same tooth, still has a planned item
          item({ toothNumber: 26, status: 'declined' }),
        ],
      }),
    );
    // proposed wins → tooth 26 reads as Planned; not also listed as completed/declined.
    expect(sets.proposed.has(26)).toBe(true);
    expect(sets.completed.has(26)).toBe(false);
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

  // Cumulative-timeline terminal precedence (mirror BE resolveTerminalTeeth +
  // chart-export deriveLayerSetsAsOf): missing/extracted > proposed > completed >
  // declined. A terminal tooth is stripped from ALL actionable layers — a gone
  // tooth has no Planned/Treated/Declined lifecycle.
  test('terminal teeth (missing/extracted) are stripped from every actionable layer', () => {
    const sets = deriveChartLayerSets(
      plan({
        completedToothNumbers: [18],
        treatments: [
          item({ toothNumber: 36, status: 'planned' }),
          item({ toothNumber: 21, status: 'declined' }),
        ],
      }),
      new Set([36, 18, 21]), // all three are terminal as-of this chart
    );
    expect(sets.proposed.has(36)).toBe(false);
    expect(sets.completed.has(18)).toBe(false);
    expect(sets.declined.has(21)).toBe(false);
    expect(sets.carriedOver.has(36)).toBe(false);
  });

  // P0-2 single-source-of-truth: the chart's layer sets and the treatment list's
  // group/badge must derive from the SAME fold. Pin deriveChartLayerSets to the
  // shared statusToLayer() projection so the two can never silently diverge —
  // a tooth the list shows Planned is painted proposed by the chart, etc.
  test('classifies each non-completed tooth into the layer statusToLayer() returns for its status', () => {
    const sets = deriveChartLayerSets(
      plan({
        treatments: [
          item({ toothNumber: 11, status: 'planned' }),   // → proposed
          item({ toothNumber: 12, status: 'diagnosed' }), // → proposed
          item({ toothNumber: 21, status: 'declined' }),  // → declined
          item({ toothNumber: 22, status: 'dismissed' }), // → off-chart (null)
        ],
      }),
    );
    // statusToLayer is the contract; deriveChartLayerSets must agree with it.
    expect(sets.proposed.has(11)).toBe(statusToLayer('planned') === 'proposed');
    expect(sets.proposed.has(12)).toBe(statusToLayer('diagnosed') === 'proposed');
    expect(sets.declined.has(21)).toBe(statusToLayer('declined') === 'declined');
    // dismissed → off-chart: tooth 22 appears in NO layer set.
    expect(statusToLayer('dismissed')).toBeNull();
    expect(sets.proposed.has(22)).toBe(false);
    expect(sets.declined.has(22)).toBe(false);
    expect(sets.completed.has(22)).toBe(false);
  });
});
