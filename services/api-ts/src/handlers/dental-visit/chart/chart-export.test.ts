/**
 * chart-export.test.ts — P0-B structured chart export (pure builder)
 *
 * buildChartExport composes the portable export document: header, the odontogram
 * tooth/surface table with derived layers, the legend, and the proposed/completed/
 * declined treatment summary. Layer precedence is proposed > completed > declined
 * (item 6 flip: outstanding planned/diagnosed work wins so it is never hidden
 * behind a Treated layer), then baseline (entryClassification), else unset —
 * matching the FE living-document chart. Written RED before implementation.
 */
import { describe, test, expect } from 'bun:test';
import { buildChartExport, CHART_EXPORT_LEGEND, deriveLayerSetsAsOf, resolveTerminalTeeth } from './chart-export';

describe('resolveTerminalTeeth — missing/extracted are terminal', () => {
  test('extracted/missing teeth are terminal; other states are not', () => {
    const teeth = [
      { toothNumber: 36, state: 'extracted' },
      { toothNumber: 18, state: 'missing' },
      { toothNumber: 14, state: 'filled' },
    ];
    const terminal = resolveTerminalTeeth(teeth);
    expect([...terminal].sort((a, b) => a - b)).toEqual([18, 36]);
    expect(terminal.has(14)).toBe(false);
  });
});

const D = (s: string) => new Date(s);
const visitDates = new Map<string, Date>([
  ['v1', D('2026-01-10')], ['v2', D('2026-03-05')], ['v3', D('2026-06-20')],
]);

describe('deriveLayerSetsAsOf — cumulative as-of-visit layers', () => {
  test('as-of V1: tooth 36 caries planned → Planned only, changed this visit', () => {
    const tx = [{ toothNumber: 36, status: 'planned', performedAt: null, visitId: 'v1', sourceVisitId: null, carriedOver: false }];
    const r = deriveLayerSetsAsOf(tx, visitDates.get('v1')!, visitDates);
    expect([...r.proposed]).toEqual([36]);
    expect([...r.completed]).toEqual([]);
    expect([...r.changed]).toEqual([36]);
  });

  test('as-of V2: filling performed → Treated, and Treated PERSISTS as-of later dates', () => {
    const tx = [{ toothNumber: 36, status: 'performed', performedAt: D('2026-03-05'), visitId: 'v1', sourceVisitId: null, carriedOver: false }];
    const atV2 = deriveLayerSetsAsOf(tx, visitDates.get('v2')!, visitDates);
    expect([...atV2.completed]).toEqual([36]);
    expect([...atV2.changed]).toEqual([36]);
    const atV3 = deriveLayerSetsAsOf(tx, visitDates.get('v3')!, visitDates);
    expect([...atV3.completed]).toEqual([36]); // STILL treated at V3 — the headline fix
    expect([...atV3.changed]).toEqual([]);      // not changed at V3
  });

  test('as-of V3: prior performed filling + new RCT planned → Planned wins (precedence), changed=this visit', () => {
    const tx = [
      { toothNumber: 36, status: 'performed', performedAt: D('2026-03-05'), visitId: 'v1', sourceVisitId: null, carriedOver: false },
      { toothNumber: 36, status: 'planned', performedAt: null, visitId: 'v3', sourceVisitId: null, carriedOver: false },
    ];
    const r = deriveLayerSetsAsOf(tx, visitDates.get('v3')!, visitDates);
    expect([...r.proposed]).toEqual([36]);   // open work outranks completed
    expect([...r.completed]).toEqual([]);    // proposed owns the tooth (disjoint)
    expect([...r.changed]).toEqual([36]);    // re-flagged this visit
  });

  test('declined as-of the declining visit', () => {
    const tx = [{ toothNumber: 14, status: 'declined', performedAt: null, visitId: 'v2', sourceVisitId: null, carriedOver: false }];
    const r = deriveLayerSetsAsOf(tx, visitDates.get('v2')!, visitDates);
    expect([...r.declined]).toEqual([14]);
    expect([...r.changed]).toEqual([14]);
  });

  test('a treatment proposed AFTER the as-of date is invisible', () => {
    const tx = [{ toothNumber: 21, status: 'planned', performedAt: null, visitId: 'v3', sourceVisitId: null, carriedOver: false }];
    const r = deriveLayerSetsAsOf(tx, visitDates.get('v1')!, visitDates);
    expect([...r.proposed]).toEqual([]); // not yet flagged at V1
  });

  test('a carried-over treatment uses its origin (sourceVisitId) date for proposed-as-of', () => {
    // Carried into v3 but originally proposed at v1 → visible as-of v2 (after origin, before target).
    const tx = [{ toothNumber: 26, status: 'planned', performedAt: null, visitId: 'v3', sourceVisitId: 'v1', carriedOver: true }];
    const r = deriveLayerSetsAsOf(tx, visitDates.get('v2')!, visitDates);
    expect([...r.proposed]).toEqual([26]);
  });

  test('performed in the FUTURE relative to as-of but already proposed → shows as Planned then', () => {
    const tx = [{ toothNumber: 36, status: 'performed', performedAt: D('2026-06-20'), visitId: 'v1', sourceVisitId: null, carriedOver: false }];
    const r = deriveLayerSetsAsOf(tx, visitDates.get('v2')!, visitDates);
    expect([...r.proposed]).toEqual([36]); // it was still just planned at V2
    expect([...r.completed]).toEqual([]);
  });
});

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

describe('buildChartExport — derived tooth layers (precedence proposed > completed > declined > baseline)', () => {
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

  // Shared layer-precedence contract pin (chart-export.ts ↔ FE chart-layers.ts):
  // when ONE tooth is referenced by completed AND proposed AND declined items at
  // once, proposed must win outright (item 6 flip) — outstanding planned work is
  // never hidden behind a completed/Treated layer. Strongest statement of the
  // precedence both implementations must agree on.
  test('a tooth referenced by completed + proposed + declined resolves to proposed', () => {
    const out = buildChartExport({
      ...BASE,
      chartTeeth: [{ toothNumber: 36, state: 'filled' }],
      treatments: [
        { toothNumber: 36, cdtCode: 'D2750', description: 'Crown', status: 'declined', priceCents: 60000 },
        { toothNumber: 36, cdtCode: 'D2391', description: 'Composite', status: 'planned', priceCents: 15000 },
        { toothNumber: 36, cdtCode: 'D2740', description: 'Onlay', status: 'verified', priceCents: 50000 },
      ],
    });
    expect(out.teeth[0]!.layer).toBe('proposed');
    expect(out.summary.proposedCount).toBe(1);
    expect(out.summary.completedCount).toBe(0);
    expect(out.summary.declinedCount).toBe(0);
  });

  test('proposed wins over a competing completed item on the same tooth (item 6 flip)', () => {
    const out = buildChartExport({
      ...BASE,
      chartTeeth: [{ toothNumber: 16, state: 'filled' }],
      treatments: [
        { toothNumber: 16, cdtCode: 'D2740', description: 'Crown', status: 'verified', priceCents: 50000 },
        { toothNumber: 16, cdtCode: 'D2391', description: 'Composite', status: 'planned', priceCents: 15000 },
      ],
    });
    expect(out.teeth[0]!.layer).toBe('proposed');
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
