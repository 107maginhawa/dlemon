/**
 * chart-export.test.ts — P0-B structured chart export (pure builder)
 *
 * buildChartExport composes the portable export document: header, the odontogram
 * tooth/surface table with derived layers, the legend, and the proposed/completed/
 * declined treatment summary. Layer precedence is completed > proposed > declined,
 * then baseline (entryClassification), else unset — matching the FE living-document
 * chart. Written RED before implementation.
 */
import { describe, test, expect } from 'bun:test';
import { buildChartExport, CHART_EXPORT_LEGEND } from './chart-export';

const BASE = {
  patient: { id: 'pat-1', name: 'Maria Santos', dateOfBirth: '1990-02-01' },
  visit: { id: 'visit-1', date: new Date('2026-06-10T09:00:00Z'), status: 'active', providerMemberId: 'mem-1', branchId: 'branch-1' },
  branchName: 'Main Branch',
  providerName: 'Dr. Cruz',
  generatedAt: new Date('2026-06-10T10:00:00Z'),
};

describe('buildChartExport — header', () => {
  test('carries patient/provider/branch/date + FDI notation + generated timestamp', () => {
    const out = buildChartExport({ ...BASE, chartTeeth: [], treatments: [] });
    expect(out.patientName).toBe('Maria Santos');
    expect(out.patientDateOfBirth).toBe('1990-02-01');
    expect(out.providerName).toBe('Dr. Cruz');
    expect(out.branchName).toBe('Main Branch');
    expect(out.visitId).toBe('visit-1');
    expect(out.notation).toBe('FDI');
    expect(out.generatedAt).toEqual(new Date('2026-06-10T10:00:00Z'));
    expect(out.legend).toEqual(CHART_EXPORT_LEGEND);
  });
});

describe('buildChartExport — derived tooth layers (precedence completed > proposed > declined > baseline)', () => {
  test('assigns each chart tooth its derived layer', () => {
    const out = buildChartExport({
      ...BASE,
      chartTeeth: [
        { toothNumber: 11, state: 'crown', entryClassification: 'existing' },   // baseline
        { toothNumber: 16, state: 'filled' },                                   // completed (performed below)
        { toothNumber: 26, state: 'caries' },                                   // proposed (planned below)
        { toothNumber: 46, state: 'caries' },                                   // declined below
        { toothNumber: 21, state: 'healthy' },                                  // unset (no class, no treatment)
      ],
      treatments: [
        { toothNumber: 16, cdtCode: 'D2740', description: 'Crown', status: 'performed', priceCents: 50000 },
        { toothNumber: 26, cdtCode: 'D2391', description: 'Composite', status: 'planned', priceCents: 15000 },
        { toothNumber: 46, cdtCode: 'D2750', description: 'Crown', status: 'declined', priceCents: 60000 },
      ],
    });
    const layerOf = (n: number) => out.teeth.find(t => t.toothNumber === n)?.layer;
    expect(layerOf(11)).toBe('baseline');
    expect(layerOf(16)).toBe('completed');
    expect(layerOf(26)).toBe('proposed');
    expect(layerOf(46)).toBe('declined');
    expect(layerOf(21)).toBe('unset');
  });

  test('completed wins over a competing planned item on the same tooth', () => {
    const out = buildChartExport({
      ...BASE,
      chartTeeth: [{ toothNumber: 16, state: 'filled' }],
      treatments: [
        { toothNumber: 16, cdtCode: 'D2740', description: 'Crown', status: 'verified', priceCents: 50000 },
        { toothNumber: 16, cdtCode: 'D2391', description: 'Composite', status: 'planned', priceCents: 15000 },
      ],
    });
    expect(out.teeth[0]!.layer).toBe('completed');
  });
});

describe('buildChartExport — treatment summary', () => {
  test('counts proposed/completed/declined and totals only proposed cents', () => {
    const out = buildChartExport({
      ...BASE,
      chartTeeth: [],
      treatments: [
        { toothNumber: 16, cdtCode: 'D2740', description: 'Crown', status: 'performed', priceCents: 50000 },
        { toothNumber: 26, cdtCode: 'D2391', description: 'Composite', status: 'planned', priceCents: 15000 },
        { toothNumber: 27, cdtCode: 'D2392', description: 'Composite', status: 'diagnosed', priceCents: 18000 },
        { toothNumber: 46, cdtCode: 'D2750', description: 'Crown', status: 'declined', priceCents: 60000 },
      ],
    });
    expect(out.summary.completedCount).toBe(1);
    expect(out.summary.proposedCount).toBe(2);
    expect(out.summary.declinedCount).toBe(1);
    // total proposed = 15000 + 18000 (planned + diagnosed); completed/declined excluded
    expect(out.summary.totalProposedCents).toBe(33000);
    // every treatment is carried in the table
    expect(out.treatments.length).toBe(4);
  });
});
