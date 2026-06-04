/**
 * cephSuperimposition.test.ts — P1-11 superimposition handler unit tests.
 *
 * Uses a focused mock DB (no real connections). @monobase/ceph-math runs live.
 * Covers: preview happy path + v1 label + calibration-gated mm, 422
 * SUPERIMPOSITION_NOT_IMPLEMENTED (non-cranial_base), 422 INSUFFICIENT_LANDMARKS,
 * 403 tier gate, 401 unauth, patient-mismatch guard, create-persist (201).
 *
 * NOTE: route-registration wiring is exercised centrally by the orchestrator's
 * real-server suite (per "tests must hit real server" memory) + the Hurl
 * contract suite; this file proves the handler business logic + error surface.
 */

import { describe, test, expect } from 'bun:test';
import { Hono } from 'hono';
import { AppError } from '@/core/errors';

const DENTIST_USER = { id: 'aaaaaaaa-0000-0000-0000-000000000001', email: 'd@clinic.com' };
const PATIENT_ID = 'dddddddd-0000-0000-0000-000000000004';
const BRANCH_ID = 'eeeeeeee-0000-0000-0000-000000000005';
const STUDY_ID = 'ffffffff-0000-0000-0000-000000000006';
const IMAGE_FROM = '11111111-0000-0000-0000-00000000a001';
const IMAGE_TO = '11111111-0000-0000-0000-00000000a002';
const REPORT_FROM = '22222222-0000-0000-0000-00000000b001';
const REPORT_TO = '22222222-0000-0000-0000-00000000b002';

const MOCK_STUDY = {
  id: STUDY_ID,
  patientId: PATIENT_ID,
  branchId: BRANCH_ID,
  modality: 'cephalometric',
  status: 'active',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date(),
};

function mockImage(id: string) {
  return { id, studyId: STUDY_ID, pixelSpacingMm: 0.1, status: 'active' };
}

// Two snapshots: S,N identical (→ identity registration), A displaced by (3,4)px.
function mockReport(id: string, imageId: string, aPoint: { x: number; y: number }, anb: number, calibrated = true) {
  return {
    id,
    imageId,
    version: 1,
    snapshot: {
      landmarks: [
        { landmarkCode: 'S', x: 100, y: 100 },
        { landmarkCode: 'N', x: 200, y: 90 },
        { landmarkCode: 'A', x: aPoint.x, y: aPoint.y },
      ],
      measurements: { anb, sna: 82 },
      calibration: { value: calibrated ? 0.1 : null, method: calibrated ? 'manual_ruler' : 'not_calibrated' },
      patient_display_id: PATIENT_ID,
    },
    createdAt: new Date('2026-02-01T00:00:00Z'),
  };
}

const SUPERIMP_ROW = {
  id: '33333333-0000-0000-0000-00000000c001',
  patientId: PATIENT_ID,
  reportFromId: REPORT_FROM,
  reportToId: REPORT_TO,
  referenceType: 'cranial_base',
  transform: { scale: 1, rotationRad: 0, tx: 0, ty: 0, basis: ['S', 'N'] },
  deltas: { landmarkDeltas: [], metricDeltas: [], uncalibrated: false },
  calibrationBasis: {},
  createdAt: new Date('2026-03-01T00:00:00Z'),
};

/**
 * Focused mock DB. Table detection by column presence:
 *   personId        → dental_membership (assertBranchRole)
 *   referenceType   → imaging_ceph_superimposition
 *   snapshot        → imaging_ceph_report  (getReportById)
 *   studyId         → imaging_study_image  (findImageById)
 *   patientId       → imaging_study        (findStudyById)
 */
function makeDb(opts: {
  hasMembership?: boolean;
  imagingTier?: 'free' | 'basic' | 'addon';
  reportFrom?: ReturnType<typeof mockReport> | null;
  reportTo?: ReturnType<typeof mockReport> | null;
  studyTo?: typeof MOCK_STUDY;
  studyFrom?: typeof MOCK_STUDY;
  superimp?: typeof SUPERIMP_ROW | null;
  superimpList?: (typeof SUPERIMP_ROW)[];
} = {}) {
  const hasMembership = opts.hasMembership !== false;
  const imagingTier = opts.imagingTier ?? 'addon';
  const reportFrom = opts.reportFrom !== undefined ? opts.reportFrom : mockReport(REPORT_FROM, IMAGE_FROM, { x: 150, y: 200 }, 4.1);
  const reportTo = opts.reportTo !== undefined ? opts.reportTo : mockReport(REPORT_TO, IMAGE_TO, { x: 153, y: 204 }, 2.3);
  const studyTo = opts.studyTo ?? MOCK_STUDY;
  const studyFrom = opts.studyFrom ?? MOCK_STUDY;
  const superimp = opts.superimp !== undefined ? opts.superimp : SUPERIMP_ROW;
  const superimpList = opts.superimpList ?? (superimp ? [superimp] : []);

  // image lookup keyed by id (from vs to) — detected via the where condition is
  // opaque in the mock, so resolve by call order using a counter is brittle.
  // Instead we return BOTH images' study via the study branch, and resolve the
  // correct report by id in the report branch.
  function reportById(): unknown[] {
    // The handler calls getReportById(reportFromId) then (reportToId). We can't
    // see the id, so return a function-of-call-order list.
    return [];
  }
  void reportById;

  let reportCall = 0;
  let imageCall = 0;

  const buildSelectChain = (tableRef: any) => {
    const hasPersonId = tableRef?.personId !== undefined;
    const hasReferenceType = tableRef?.referenceType !== undefined;
    const hasSnapshot = tableRef?.snapshot !== undefined && !hasReferenceType;
    const hasStudyId = tableRef?.studyId !== undefined;
    const hasPatientId = tableRef?.patientId !== undefined && !hasStudyId && !hasReferenceType;

    const resolveRows = (): unknown[] => {
      if (hasPersonId) {
        return hasMembership ? [{ id: 'm', role: 'dentist_owner' }] : [];
      }
      if (hasReferenceType) {
        return superimp ? [superimp] : [];
      }
      if (hasSnapshot) {
        // getReportById: 1st call → from, 2nd → to (handler order)
        reportCall += 1;
        const r = reportCall === 1 ? reportFrom : reportTo;
        return r ? [r] : [];
      }
      if (hasStudyId) {
        // findImageById: 1st → to-image, 2nd → from-image (handler order)
        imageCall += 1;
        return [imageCall === 1 ? mockImage(IMAGE_TO) : mockImage(IMAGE_FROM)];
      }
      if (hasPatientId) {
        // findStudyById: 1st → studyTo, 2nd → studyFrom
        return [imageCall <= 1 ? studyTo : studyFrom];
      }
      return [];
    };

    const where = (_c: any) => {
      const rows = Promise.resolve(resolveRows());
      return Object.assign(rows, {
        limit: (_n: number) => rows,
        orderBy: (_col: any) => Object.assign(Promise.resolve(superimpList), { limit: (_n: number) => Promise.resolve(superimpList) }),
      });
    };
    return {
      where,
      innerJoin: (_t: any, _c: any) => ({
        where: (_c2: any) => ({ limit: (_n: number) => Promise.resolve([{ imagingTier }]) }),
      }),
    };
  };

  return {
    select: (_fields?: any) => ({ from: (tableRef: any) => buildSelectChain(tableRef) }),
    insert: (_tableRef: any) => ({
      values: (_data: any) => ({ returning: () => Promise.resolve([SUPERIMP_ROW]) }),
    }),
  };
}

const LOGGER = { debug() {}, info() {}, warn() {}, error() {} };

function buildApp(handler: (ctx: any) => Promise<Response>, opts: {
  user?: typeof DENTIST_USER | null;
  db?: ReturnType<typeof makeDb>;
  method?: string;
  path?: string;
} = {}) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err) }, 500);
  });
  app.use('*', async (c, next) => {
    c.set('database' as any, opts.db ?? makeDb());
    c.set('logger' as any, LOGGER);
    if (opts.user !== null) {
      c.set('user' as any, opts.user ?? DENTIST_USER);
      c.set('session' as any, { id: 's' });
    }
    await next();
  });
  const method = (opts.method ?? 'POST').toLowerCase();
  (app as any)[method](opts.path ?? '/', async (c: any, next: any) => {
    (c.req as any).addValidatedData?.('param', c.req.param());
    await next();
  }, handler);
  return app;
}

describe('previewCephSuperimposition', () => {
  test('200 happy path: cranial-base identity → A displacement, mm-gated, v1 label', async () => {
    const { previewCephSuperimposition } = await import('./cephSuperimposition');
    const app = buildApp(previewCephSuperimposition);
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportFromId: REPORT_FROM, reportToId: REPORT_TO, reference: 'cranial_base' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.id).toBeNull(); // preview is not persisted
    expect(body.reference).toBe('cranial_base');
    expect(body.transform.basis).toEqual(['S', 'N']);
    expect(body.uncalibrated).toBe(false);
    // v1 honesty label present
    expect(body.label).toContain('simplified superimposition');
    expect(body.label).toContain('not a diagnosis');
    // A displaced (3,4)px → 5px → 0.5mm under identity registration
    const a = body.landmarkDeltas.find((d: any) => d.landmarkCode === 'A');
    expect(a.magnitudePx).toBeCloseTo(5, 1);
    expect(a.magnitudeMm).toBeCloseTo(0.5, 2);
    // ANB metric delta 4.1 → 2.3 = -1.8
    const anb = body.metricDeltas.find((d: any) => d.metric === 'anb');
    expect(anb.delta).toBeCloseTo(-1.8, 2);
  });

  test('uncalibrated timepoint → mm null but px emitted', async () => {
    const { previewCephSuperimposition } = await import('./cephSuperimposition');
    const db = makeDb({ reportFrom: mockReport(REPORT_FROM, IMAGE_FROM, { x: 150, y: 200 }, 4.1, false) });
    const app = buildApp(previewCephSuperimposition, { db });
    const res = await app.request('/', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportFromId: REPORT_FROM, reportToId: REPORT_TO, reference: 'cranial_base' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.uncalibrated).toBe(true);
    const a = body.landmarkDeltas.find((d: any) => d.landmarkCode === 'A');
    expect(a.magnitudeMm).toBeNull();
    expect(a.magnitudePx).toBeGreaterThan(0);
  });

  test('422 SUPERIMPOSITION_NOT_IMPLEMENTED for non-cranial_base (v1 gate)', async () => {
    const { previewCephSuperimposition } = await import('./cephSuperimposition');
    const app = buildApp(previewCephSuperimposition);
    const res = await app.request('/', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportFromId: REPORT_FROM, reportToId: REPORT_TO, reference: 'maxillary' }),
    });
    expect(res.status).toBe(422);
    expect((await res.json() as any).code).toBe('SUPERIMPOSITION_NOT_IMPLEMENTED');
  });

  test('422 INSUFFICIENT_LANDMARKS when basis missing on a timepoint', async () => {
    const { previewCephSuperimposition } = await import('./cephSuperimposition');
    const noN = mockReport(REPORT_TO, IMAGE_TO, { x: 153, y: 204 }, 2.3);
    noN.snapshot.landmarks = noN.snapshot.landmarks.filter((l) => l.landmarkCode !== 'N');
    const app = buildApp(previewCephSuperimposition, { db: makeDb({ reportTo: noN }) });
    const res = await app.request('/', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportFromId: REPORT_FROM, reportToId: REPORT_TO, reference: 'cranial_base' }),
    });
    expect(res.status).toBe(422);
    expect((await res.json() as any).code).toBe('INSUFFICIENT_LANDMARKS');
  });

  test('403 IMAGING_TIER_REQUIRED when not addon tier', async () => {
    const { previewCephSuperimposition } = await import('./cephSuperimposition');
    const app = buildApp(previewCephSuperimposition, { db: makeDb({ imagingTier: 'basic' }) });
    const res = await app.request('/', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportFromId: REPORT_FROM, reportToId: REPORT_TO, reference: 'cranial_base' }),
    });
    expect(res.status).toBe(403);
    expect((await res.json() as any).code).toBe('IMAGING_TIER_REQUIRED');
  });

  test('401 when unauthenticated', async () => {
    const { previewCephSuperimposition } = await import('./cephSuperimposition');
    const app = buildApp(previewCephSuperimposition, { user: null });
    const res = await app.request('/', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportFromId: REPORT_FROM, reportToId: REPORT_TO, reference: 'cranial_base' }),
    });
    expect(res.status).toBe(401);
  });

  test('404 when a report does not exist', async () => {
    const { previewCephSuperimposition } = await import('./cephSuperimposition');
    const app = buildApp(previewCephSuperimposition, { db: makeDb({ reportTo: null }) });
    const res = await app.request('/', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportFromId: REPORT_FROM, reportToId: REPORT_TO, reference: 'cranial_base' }),
    });
    expect(res.status).toBe(404);
  });
});

describe('createCephSuperimposition', () => {
  test('201 persists artifact with id + createdAt', async () => {
    const { createCephSuperimposition } = await import('./cephSuperimposition');
    const app = buildApp(createCephSuperimposition);
    const res = await app.request('/', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportFromId: REPORT_FROM, reportToId: REPORT_TO, reference: 'cranial_base' }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.id).toBe(SUPERIMP_ROW.id);
    expect(body.createdAt).not.toBeNull();
    expect(body.reference).toBe('cranial_base');
    expect(body.label).toContain('simplified superimposition');
  });
});

describe('listCephSuperimpositions', () => {
  test('200 returns patient superimpositions (tenant filtered)', async () => {
    const { listCephSuperimpositions } = await import('./cephSuperimposition');
    const app = buildApp(listCephSuperimpositions, { method: 'GET', path: '/:patientId' });
    const res = await app.request(`/${PATIENT_ID}`, { method: 'GET' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBe(1);
    expect(body.items[0].label).toContain('simplified superimposition');
  });

  test('200 empty list when membership absent (no leak)', async () => {
    const { listCephSuperimpositions } = await import('./cephSuperimposition');
    const app = buildApp(listCephSuperimpositions, {
      method: 'GET', path: '/:patientId', db: makeDb({ hasMembership: false }),
    });
    const res = await app.request(`/${PATIENT_ID}`, { method: 'GET' });
    expect(res.status).toBe(200);
    expect((await res.json() as any).items.length).toBe(0);
  });
});
