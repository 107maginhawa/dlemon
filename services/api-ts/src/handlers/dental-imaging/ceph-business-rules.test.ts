/**
 * ceph-business-rules.test.ts — formal BR-036..047 test owners (G10-S2)
 *
 * Each describe/it references the BR id so the traceability scanner can map
 * the rule → test. Covers happy + violation paths with strong assertions on
 * status code, response body, and computed values.
 *
 * Strategy: handler unit tests over a mock DB (mirrors ceph.test.ts harness).
 * @monobase/ceph-math is exercised live so measurement/calibration assertions
 * pin real computation, not a stub.
 *
 * BR coverage:
 *   BR-036 idempotent batch upsert (onConflictDoUpdate on imageId+code)
 *   BR-037 locked landmarks skipped in batch (setWhere status != locked)
 *   BR-038 recompute idempotent (analyses only, no report row)
 *   BR-039 calibration provenance frozen into report snapshot
 *   BR-040 uncalibrated → not_calibrated + null mm metrics; calibrated → mm metrics
 *   BR-041 non-member → 404 (never 403) on every CephMgmt_* op
 *   BR-042 report version monotonic (1,2,3…)
 *   BR-043 steiner_hybrid_sn is the only analysis label
 *   BR-044 delete permitted on confirmed/placed; locked → 422 LANDMARK_LOCKED
 *   BR-045 snapshot measurements nullable (missing landmark → null, not error)
 *   BR-046 PATCH marks analysis stale; explicit recompute is the contract
 *   BR-047 ceph ops require an existing imageId → 404
 */

import { describe, test, expect } from 'bun:test';
import { Hono } from 'hono';
import { AppError } from '@/core/errors';
import type { CephLandmarkStatus, ImagingCephAnalysis } from './repos/imaging_ceph.schema';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DENTIST_USER = { id: 'aaaaaaaa-0000-0000-0000-000000000001', email: 'dentist@clinic.com' };
const PATIENT_ID = 'dddddddd-0000-0000-0000-000000000004';
const BRANCH_ID = 'eeeeeeee-0000-0000-0000-000000000005';
const STUDY_ID = 'ffffffff-0000-0000-0000-000000000006';
const IMAGE_ID = '11111111-0000-0000-0000-000000000007';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_STUDY = {
  id: STUDY_ID,
  patientId: PATIENT_ID,
  visitId: null,
  branchId: BRANCH_ID,
  acquiredBy: DENTIST_USER.id,
  modality: 'other' as const,
  status: 'active' as const,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date(),
  version: 1,
  createdBy: DENTIST_USER.id,
  updatedBy: DENTIST_USER.id,
};

const MOCK_IMAGE = {
  id: IMAGE_ID,
  studyId: STUDY_ID,
  fileId: 'file-id-ceph-0001',
  pixelSpacingMm: null as number | null,
  sequenceNumber: 0,
  dicomMetadata: null,
  modality: 'other' as const,
  status: 'active' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
  createdBy: DENTIST_USER.id,
  updatedBy: DENTIST_USER.id,
};

const MOCK_LANDMARK = {
  id: 'landmark-id-1',
  imageId: IMAGE_ID,
  landmarkCode: 'N',
  x: 300,
  y: 200,
  source: 'manual' as const,
  confidence: null as number | null,
  status: 'placed' as CephLandmarkStatus,
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
  createdBy: DENTIST_USER.id,
  updatedBy: DENTIST_USER.id,
};

const MOCK_ANALYSIS = {
  id: 'analysis-id-1',
  imageId: IMAGE_ID,
  analysisType: 'steiner_hybrid_sn' as const,
  measurements: {} as Record<string, number | null>,
  calibrationValue: null as number | null,
  calibrationMethod: 'not_calibrated' as ImagingCephAnalysis['calibrationMethod'],
  calibratedAt: null as Date | null,
  calibratedBy: null as string | null,
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
  createdBy: DENTIST_USER.id,
  updatedBy: DENTIST_USER.id,
};

const MOCK_REPORT = {
  id: 'report-id-1',
  imageId: IMAGE_ID,
  version: 1,
  snapshot: {} as Record<string, unknown>,
  createdAt: new Date(),
  createdBy: DENTIST_USER.id,
};

/** D-L gate landmarks: A, B, Go, Po all confirmed. */
const GATE_LANDMARKS = (['A', 'B', 'Go', 'Po'] as const).map((code, i) => ({
  ...MOCK_LANDMARK,
  id: `gate-landmark-${i}`,
  landmarkCode: code,
  status: 'confirmed' as const,
}));

/** Calibrated image (0.1 mm/px is inside the [0.05, 0.50] valid window). */
const CALIBRATED_IMAGE = { ...MOCK_IMAGE, pixelSpacingMm: 0.1 };

/** A full skeletal+dental landmark set so mm metrics + angles are computable. */
const FULL_LANDMARKS = (
  [
    ['S', 100, 100], ['N', 300, 110], ['A', 320, 260], ['B', 310, 380],
    ['Go', 120, 360], ['Po', 90, 150], ['Me', 300, 430], ['Or', 280, 160],
    ['U1T', 330, 300], ['U1A', 315, 250], ['L1T', 325, 320], ['L1A', 312, 380],
  ] as const
).map(([code, x, y], i) => ({
  ...MOCK_LANDMARK,
  id: `full-landmark-${i}`,
  landmarkCode: code as string,
  x: x as number,
  y: y as number,
  status: 'confirmed' as const,
}));

// ---------------------------------------------------------------------------
// makeCephDb — mock DB factory (table detection by Drizzle column presence)
// ---------------------------------------------------------------------------

type UpsertSpy = { lastConflict?: any; lastValues?: any; lastSetWhere?: any; calls: number };

function makeCephDb(opts: {
  hasMembership?: boolean;
  study?: typeof MOCK_STUDY | null;
  image?: typeof MOCK_IMAGE | null;
  imagingTier?: 'free' | 'basic' | 'addon' | null;
  landmark?: typeof MOCK_LANDMARK | null;
  landmarks?: (typeof MOCK_LANDMARK)[];
  analysis?: typeof MOCK_ANALYSIS | null;
  report?: typeof MOCK_REPORT | null;
  reportVersion?: number;
  landmarkUpsertSpy?: UpsertSpy;
} = {}) {
  const hasMembership = opts.hasMembership !== false;
  const study = opts.study !== undefined ? opts.study : MOCK_STUDY;
  const image = opts.image !== undefined ? opts.image : MOCK_IMAGE;
  const imagingTier = opts.imagingTier !== undefined ? opts.imagingTier : 'addon';
  const landmark = opts.landmark !== undefined ? opts.landmark : MOCK_LANDMARK;
  const landmarks = opts.landmarks !== undefined ? opts.landmarks : (landmark ? [landmark] : []);
  const analysis = opts.analysis !== undefined ? opts.analysis : MOCK_ANALYSIS;
  const report = opts.report !== undefined ? opts.report : MOCK_REPORT;
  const reportVersion = opts.reportVersion ?? 0;
  const lmSpy = opts.landmarkUpsertSpy;

  const buildSelectChain = (tableRef: any, fields?: any) => {
    const hasPersonId = tableRef?.personId !== undefined;
    const hasStudyId = tableRef?.studyId !== undefined;
    const hasPatientId = tableRef?.patientId !== undefined && !hasStudyId;
    const hasLandmarkCode = tableRef?.landmarkCode !== undefined;
    const hasAnalysisType = tableRef?.analysisType !== undefined;
    const hasSnapshot = tableRef?.snapshot !== undefined;
    const isMaxVersionQuery = hasSnapshot && fields != null && 'maxVersion' in fields;
    const hasBranchNameField = fields != null && 'branchName' in fields;

    const whereFn = (_cond: any): any => {
      let rows: Promise<any[]>;

      if (hasPersonId) {
        const isRoleQuery = fields != null && 'role' in fields;
        const memberRow = hasMembership
          ? (isRoleQuery ? [{ id: 'membership-id', role: 'dentist_owner' }] : [{ id: 'membership-id' }])
          : [];
        rows = Promise.resolve(memberRow);
        return Object.assign(rows, { limit: (_n: number) => rows });
      }

      if (hasLandmarkCode) {
        const allRows = Promise.resolve(landmarks);
        const singleRow = Promise.resolve(landmark ? [landmark] : []);
        return Object.assign(allRows, { limit: (_n: number) => singleRow });
      }

      if (hasAnalysisType) {
        rows = Promise.resolve(analysis ? [analysis] : []);
        return Object.assign(rows, { limit: (_n: number) => rows });
      }

      if (hasSnapshot) {
        if (isMaxVersionQuery) {
          rows = Promise.resolve([{ maxVersion: reportVersion }]);
        } else {
          rows = Promise.resolve(report ? [report] : []);
        }
        return Object.assign(rows, {
          limit: (_n: number) => rows,
          orderBy: (_col: any) => Object.assign(rows, { limit: (_n: number) => rows }),
        });
      }

      if (hasStudyId) {
        rows = Promise.resolve(image ? [image] : []);
        return Object.assign(rows, { limit: (_n: number) => rows });
      }

      if (hasPatientId) {
        rows = Promise.resolve(study ? [study] : []);
        return Object.assign(rows, { limit: (_n: number) => rows });
      }

      rows = Promise.resolve([]);
      return Object.assign(rows, { limit: (_n: number) => rows });
    };

    return {
      where: whereFn,
      innerJoin: (_joinTable: any, _cond: any) => ({
        where: (_cond2: any) => ({
          limit: (_n: number) =>
            Promise.resolve([{
              imagingTier,
              ...(hasBranchNameField ? { branchName: 'Main Branch' } : {}),
            }]),
        }),
      }),
    };
  };

  return {
    select: (fields?: any) => ({
      from: (tableRef: any) => buildSelectChain(tableRef, fields),
    }),
    insert: (tableRef: any) => {
      const isReportTable = tableRef?.snapshot !== undefined;
      const isLandmarkTable = tableRef?.landmarkCode !== undefined;
      return {
        values: (data: any) => {
          if (isLandmarkTable && lmSpy) { lmSpy.lastValues = data; lmSpy.calls += 1; }
          const voidPromise = Promise.resolve(undefined);
          return {
            returning: () => {
              if (isReportTable) {
                return Promise.resolve([{ ...MOCK_REPORT, version: reportVersion + 1, createdBy: DENTIST_USER.id }]);
              }
              return Promise.resolve([analysis ?? MOCK_ANALYSIS]);
            },
            onConflictDoUpdate: (conflictOpts: any) => {
              if (isLandmarkTable && lmSpy) {
                lmSpy.lastConflict = conflictOpts;
                lmSpy.lastSetWhere = conflictOpts?.setWhere;
              }
              return Object.assign(voidPromise, {
                returning: () => Promise.resolve([analysis ?? MOCK_ANALYSIS]),
              });
            },
          };
        },
      };
    },
    update: (_tableRef: any) => ({
      set: (_data: any) => ({
        where: (_cond: any) => ({
          returning: () => Promise.resolve([landmark ?? MOCK_LANDMARK]),
        }),
      }),
    }),
    delete: (_tableRef: any) => ({
      where: (_cond: any) => Promise.resolve(undefined),
    }),
  };
}

// ---------------------------------------------------------------------------
// buildCephApp
// ---------------------------------------------------------------------------

const DEFAULT_LOGGER = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

function buildCephApp(
  handler: (ctx: any) => Promise<Response>,
  opts: {
    user?: typeof DENTIST_USER;
    db?: ReturnType<typeof makeCephDb>;
    logger?: any;
    method?: string;
    path?: string;
    queryParams?: Record<string, any>;
  } = {},
) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
    return c.json({ error: String(err) }, 500);
  });
  app.use('*', async (c, next) => {
    c.set('database' as any, opts.db ?? makeCephDb());
    c.set('logger' as any, opts.logger ?? DEFAULT_LOGGER);
    if (opts.user) {
      c.set('user' as any, opts.user);
      c.set('session' as any, { id: 'test-session' });
    }
    const rawBody = await c.req.json().catch(() => ({}));
    (c.req as any).addValidatedData?.('json', rawBody);
    (c.req as any).addValidatedData?.('query', opts.queryParams ?? {});
    await next();
  });
  const method = (opts.method ?? 'POST').toLowerCase();
  (app as any)[method](opts.path ?? '/', async (c: any, next: any) => {
    (c.req as any).addValidatedData?.('param', c.req.param());
    await next();
  }, handler);
  return app;
}

// helper request builders
function postLandmarks(app: Hono, body: unknown) {
  return app.request(`/${IMAGE_ID}/landmarks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
function postReport(app: Hono) {
  return app.request(`/${IMAGE_ID}/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
}

// ===========================================================================
// BR-036 — Ceph landmark batch upsert is idempotent
// ===========================================================================

describe('BR-036 batch upsert idempotency', () => {
  test('BR-036: re-upserting the same code updates via onConflictDoUpdate on (imageId, landmarkCode)', async () => {
    const { CephMgmt_batchUpsertCephLandmarks } = await import('./CephMgmt_batchUpsertCephLandmarks');
    const spy: UpsertSpy = { calls: 0 };
    const db = makeCephDb({ landmarkUpsertSpy: spy });
    const app = buildCephApp(CephMgmt_batchUpsertCephLandmarks as any, {
      user: DENTIST_USER, db, method: 'POST', path: '/:imageId/landmarks',
    });

    const res = await postLandmarks(app, { landmarks: [{ landmarkCode: 'N', x: 999, y: 888 }] });
    expect(res.status).toBe(200);

    // Upsert conflict target must be the (imageId, landmarkCode) unique pair — this is
    // what makes a second upsert of the same code a no-duplicate replace, not an insert.
    expect(spy.lastConflict).not.toBeUndefined();
    const targetArr = Array.isArray(spy.lastConflict.target) ? spy.lastConflict.target : [spy.lastConflict.target];
    expect(targetArr.length).toBe(2);
    // The SET clause overwrites x/y with the new (excluded) values — replace semantics.
    expect(spy.lastConflict.set).not.toBeUndefined();
    expect('x' in spy.lastConflict.set).toBe(true);
    expect('y' in spy.lastConflict.set).toBe(true);
  });

  test('BR-036: response items array reflects current persisted set (single row, not duplicated)', async () => {
    const { CephMgmt_batchUpsertCephLandmarks } = await import('./CephMgmt_batchUpsertCephLandmarks');
    // DB already holds exactly one 'N'; upserting 'N' again must not duplicate it.
    const db = makeCephDb({ landmarks: [{ ...MOCK_LANDMARK, landmarkCode: 'N' }] });
    const app = buildCephApp(CephMgmt_batchUpsertCephLandmarks as any, {
      user: DENTIST_USER, db, method: 'POST', path: '/:imageId/landmarks',
    });
    const res = await postLandmarks(app, { landmarks: [{ landmarkCode: 'N', x: 301, y: 201 }] });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    const nCount = body.items.filter((l: any) => l.landmarkCode === 'N').length;
    expect(nCount).toBe(1);
  });
});

// ===========================================================================
// BR-037 — Locked landmarks are skipped in a batch upsert (no error, no overwrite)
// ===========================================================================

describe('BR-037 batch upsert skips locked rows', () => {
  test('BR-037: upsert carries setWhere guarding status != locked (locked rows untouched)', async () => {
    const { CephMgmt_batchUpsertCephLandmarks } = await import('./CephMgmt_batchUpsertCephLandmarks');
    const spy: UpsertSpy = { calls: 0 };
    const db = makeCephDb({ landmarkUpsertSpy: spy });
    const app = buildCephApp(CephMgmt_batchUpsertCephLandmarks as any, {
      user: DENTIST_USER, db, method: 'POST', path: '/:imageId/landmarks',
    });
    const res = await postLandmarks(app, { landmarks: [{ landmarkCode: 'N', x: 5, y: 5 }] });
    expect(res.status).toBe(200);
    // The locked-skip is implemented as a conditional setWhere on the conflict update.
    // (Drizzle SQL objects are cyclic — inspect the queryChunks, not JSON.stringify.)
    expect(spy.lastSetWhere).not.toBeUndefined();
    const chunks = (spy.lastSetWhere as any)?.queryChunks ?? [];
    const literals = chunks
      .map((ch: any) => (typeof ch?.value?.join === 'function' ? ch.value.join('') : (ch?.value ?? '')))
      .join(' ');
    expect(literals).toContain('locked');
  });

  test('BR-037: batch containing a locked code still succeeds (200, no error) — skip not reject', async () => {
    const { CephMgmt_batchUpsertCephLandmarks } = await import('./CephMgmt_batchUpsertCephLandmarks');
    // DB has a locked 'N'; sending it in the batch must not raise — it is silently skipped.
    const lockedN = { ...MOCK_LANDMARK, landmarkCode: 'N', status: 'locked' as const };
    const db = makeCephDb({ landmarks: [lockedN] });
    const app = buildCephApp(CephMgmt_batchUpsertCephLandmarks as any, {
      user: DENTIST_USER, db, method: 'POST', path: '/:imageId/landmarks',
    });
    const res = await postLandmarks(app, { landmarks: [{ landmarkCode: 'N', x: 9, y: 9 }] });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    // Persisted row is still locked (the mock returns the unchanged stored set).
    expect(body.items.find((l: any) => l.landmarkCode === 'N').status).toBe('locked');
  });
});

// ===========================================================================
// BR-038 — recomputeCephAnalysis is idempotent; writes analyses only, never a report
// ===========================================================================

describe('BR-038 recompute idempotent, analysis-only', () => {
  test('BR-038: two successive recomputes yield identical measurements', async () => {
    const { CephMgmt_recomputeCephAnalysis } = await import('./CephMgmt_recomputeCephAnalysis');
    const db = makeCephDb({ image: CALIBRATED_IMAGE, landmarks: FULL_LANDMARKS });
    const app = buildCephApp(CephMgmt_recomputeCephAnalysis as any, {
      user: DENTIST_USER, db, method: 'POST', path: '/:imageId/analysis/recompute',
    });
    const first = (await (await app.request(`/${IMAGE_ID}/analysis/recompute`, { method: 'POST' })).json()) as any;
    const second = (await (await app.request(`/${IMAGE_ID}/analysis/recompute`, { method: 'POST' })).json()) as any;
    expect(first.measurements).toEqual(second.measurements);
    // sanity: at least one angle actually computed (sna), so equality is meaningful
    expect(typeof first.measurements.sna).toBe('number');
  });

  test('BR-038: recompute response is analysis-only — no report version/snapshot fields', async () => {
    const { CephMgmt_recomputeCephAnalysis } = await import('./CephMgmt_recomputeCephAnalysis');
    const db = makeCephDb({ image: CALIBRATED_IMAGE, landmarks: FULL_LANDMARKS });
    const app = buildCephApp(CephMgmt_recomputeCephAnalysis as any, {
      user: DENTIST_USER, db, method: 'POST', path: '/:imageId/analysis/recompute',
    });
    const res = await app.request(`/${IMAGE_ID}/analysis/recompute`, { method: 'POST' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.version).toBeUndefined();
    expect(body.snapshot).toBeUndefined();
    expect(body.analysisType).toBe('steiner_hybrid_sn');
  });
});

// ===========================================================================
// BR-039 — Calibration provenance frozen into the report snapshot at creation time
// ===========================================================================

describe('BR-039 calibration provenance frozen in snapshot', () => {
  test('BR-039: calibrated image freezes snapshot.calibration {value, method=manual_ruler}', async () => {
    const { CephMgmt_createCephReport } = await import('./CephMgmt_createCephReport');
    let captured: any = null;
    const base = makeCephDb({ image: { ...CALIBRATED_IMAGE }, landmarks: GATE_LANDMARKS, reportVersion: 0 });
    const spyDb = {
      ...base,
      insert: (tableRef: any) => {
        const isReport = tableRef?.snapshot !== undefined;
        const chain = base.insert(tableRef);
        if (!isReport) return chain;
        return { values: (data: any) => { captured = data.snapshot; return chain.values(data); } };
      },
    };
    const app = buildCephApp(CephMgmt_createCephReport as any, {
      user: DENTIST_USER, db: spyDb as any, method: 'POST', path: '/:imageId/reports',
    });
    const res = await postReport(app);
    expect(res.status).toBe(201);
    // G2: calibration snapshot also pins px/mm (= 1/0.1) + schema version.
    expect(captured.calibration).toEqual({
      value: 0.1,
      method: 'manual_ruler',
      pixels_per_mm: 10,
      version: 1,
    });
  });

  test('BR-039: uncalibrated image freezes snapshot.calibration {value:null, method=not_calibrated}', async () => {
    const { CephMgmt_createCephReport } = await import('./CephMgmt_createCephReport');
    let captured: any = null;
    const base = makeCephDb({ image: { ...MOCK_IMAGE, pixelSpacingMm: null }, landmarks: GATE_LANDMARKS, reportVersion: 0 });
    const spyDb = {
      ...base,
      insert: (tableRef: any) => {
        const isReport = tableRef?.snapshot !== undefined;
        const chain = base.insert(tableRef);
        if (!isReport) return chain;
        return { values: (data: any) => { captured = data.snapshot; return chain.values(data); } };
      },
    };
    const app = buildCephApp(CephMgmt_createCephReport as any, {
      user: DENTIST_USER, db: spyDb as any, method: 'POST', path: '/:imageId/reports',
    });
    const res = await postReport(app);
    expect(res.status).toBe(201);
    // G2: uncalibrated → px/mm null, but schema version still pinned.
    expect(captured.calibration).toEqual({
      value: null,
      method: 'not_calibrated',
      pixels_per_mm: null,
      version: 1,
    });
  });
});

// ===========================================================================
// BR-040 — Calibration gates mm-unit measurements
// ===========================================================================

describe('BR-040 calibration required for mm measurements', () => {
  test('BR-040: uncalibrated → calibrationMethod not_calibrated AND mm metrics are null', async () => {
    const { CephMgmt_batchUpsertCephLandmarks } = await import('./CephMgmt_batchUpsertCephLandmarks');
    // pixelSpacingMm null on a full landmark set: angles compute, mm metrics must be null.
    const db = makeCephDb({ image: { ...MOCK_IMAGE, pixelSpacingMm: null }, landmarks: FULL_LANDMARKS });
    const app = buildCephApp(CephMgmt_batchUpsertCephLandmarks as any, {
      user: DENTIST_USER, db, method: 'POST', path: '/:imageId/landmarks',
    });
    const res = await postLandmarks(app, { landmarks: [{ landmarkCode: 'N', x: 300, y: 110 }] });
    expect(res.status).toBe(200);
    const m = ((await res.json()) as any).analysis;
    expect(m.calibrationMethod).toBe('not_calibrated');
    // mm-unit metrics are null without calibration (clinical-misinterpretation guard)
    expect(m.measurements.u1_na_mm).toBeNull();
    expect(m.measurements.l1_nb_mm).toBeNull();
    expect(m.measurements.overjet).toBeNull();
    expect(m.measurements.overbite).toBeNull();
    // angle metrics still compute (calibration-independent)
    expect(typeof m.measurements.sna).toBe('number');
  });

  test('BR-040: calibrated (0.1mm/px) → calibrationMethod manual_ruler AND mm metrics non-null', async () => {
    const { CephMgmt_batchUpsertCephLandmarks } = await import('./CephMgmt_batchUpsertCephLandmarks');
    const calAnalysis = { ...MOCK_ANALYSIS, calibrationMethod: 'manual_ruler' as const, calibrationValue: 0.1 };
    const db = makeCephDb({ image: CALIBRATED_IMAGE, landmarks: FULL_LANDMARKS, analysis: calAnalysis });
    const app = buildCephApp(CephMgmt_batchUpsertCephLandmarks as any, {
      user: DENTIST_USER, db, method: 'POST', path: '/:imageId/landmarks',
    });
    const res = await postLandmarks(app, { landmarks: [{ landmarkCode: 'N', x: 300, y: 110 }] });
    expect(res.status).toBe(200);
    const m = ((await res.json()) as any).analysis;
    expect(m.calibrationMethod).toBe('manual_ruler');
    expect(m.calibrationValue).toBe(0.1);
    expect(typeof m.measurements.u1_na_mm).toBe('number');
    expect(typeof m.measurements.overjet).toBe('number');
  });
});

// ===========================================================================
// BR-041 — Non-member receives 404 (never 403) — no image-existence leak
// ===========================================================================

describe('BR-041 non-member → 404 not 403 (no info leak)', () => {
  const cases: Array<[string, string, string, string]> = [
    ['CephMgmt_batchUpsertCephLandmarks', 'POST', '/:imageId/landmarks', `/${IMAGE_ID}/landmarks`],
    ['CephMgmt_getCephAnalysis', 'GET', '/:imageId/analysis', `/${IMAGE_ID}/analysis`],
    ['CephMgmt_recomputeCephAnalysis', 'POST', '/:imageId/analysis/recompute', `/${IMAGE_ID}/analysis/recompute`],
    ['CephMgmt_createCephReport', 'POST', '/:imageId/reports', `/${IMAGE_ID}/reports`],
    ['CephMgmt_listCephLandmarks', 'GET', '/:imageId/landmarks', `/${IMAGE_ID}/landmarks`],
    ['CephMgmt_getCephReport', 'GET', '/:imageId/reports', `/${IMAGE_ID}/reports`],
    ['CephMgmt_updateCephLandmark', 'PATCH', '/:imageId/landmarks/:landmarkCode', `/${IMAGE_ID}/landmarks/N`],
    ['CephMgmt_deleteCephLandmark', 'DELETE', '/:imageId/landmarks/:landmarkCode', `/${IMAGE_ID}/landmarks/N`],
  ];

  for (const [name, method, path, url] of cases) {
    test(`BR-041: ${name} by non-member → 404, never 403`, async () => {
      const mod = await import(`./${name}`);
      const handler = (mod as any)[name];
      const db = makeCephDb({ hasMembership: false, landmarks: GATE_LANDMARKS });
      const app = buildCephApp(handler, {
        user: DENTIST_USER, db, method, path, queryParams: {},
      });
      const init: any = { method };
      if (method === 'POST' || method === 'PATCH') {
        init.headers = { 'Content-Type': 'application/json' };
        init.body = JSON.stringify({ landmarks: [{ landmarkCode: 'N', x: 1, y: 1 }], x: 1 });
      }
      const res = await app.request(url, init);
      expect(res.status).toBe(404);
      expect(res.status).not.toBe(403);
    });
  }
});

// ===========================================================================
// BR-042 — Report version numbers are monotonically increasing per image
// ===========================================================================

describe('BR-042 report version monotonicity', () => {
  test('BR-042: first report → version 1', async () => {
    const { CephMgmt_createCephReport } = await import('./CephMgmt_createCephReport');
    const db = makeCephDb({ landmarks: GATE_LANDMARKS, reportVersion: 0 });
    const app = buildCephApp(CephMgmt_createCephReport as any, {
      user: DENTIST_USER, db, method: 'POST', path: '/:imageId/reports',
    });
    const res = await postReport(app);
    expect(res.status).toBe(201);
    expect(((await res.json()) as any).version).toBe(1);
  });

  test('BR-042: with maxVersion=2 existing → next report is version 3 (no gap)', async () => {
    const { CephMgmt_createCephReport } = await import('./CephMgmt_createCephReport');
    const db = makeCephDb({ landmarks: GATE_LANDMARKS, reportVersion: 2 });
    const app = buildCephApp(CephMgmt_createCephReport as any, {
      user: DENTIST_USER, db, method: 'POST', path: '/:imageId/reports',
    });
    const res = await postReport(app);
    expect(res.status).toBe(201);
    expect(((await res.json()) as any).version).toBe(3);
  });
});

// ===========================================================================
// BR-043 — steiner_hybrid_sn is the only analysis label in v1.4
// ===========================================================================

describe('BR-043 steiner_hybrid_sn mandatory label', () => {
  test('BR-043: getCephAnalysis labels analysisType steiner_hybrid_sn', async () => {
    const { CephMgmt_getCephAnalysis } = await import('./CephMgmt_getCephAnalysis');
    const db = makeCephDb();
    const app = buildCephApp(CephMgmt_getCephAnalysis as any, {
      user: DENTIST_USER, db, method: 'GET', path: '/:imageId/analysis',
    });
    const res = await app.request(`/${IMAGE_ID}/analysis`);
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).analysis.analysisType).toBe('steiner_hybrid_sn');
  });

  test('BR-043: createCephReport freezes snapshot.analysis_label steiner_hybrid_sn', async () => {
    const { CephMgmt_createCephReport } = await import('./CephMgmt_createCephReport');
    let captured: any = null;
    const base = makeCephDb({ landmarks: GATE_LANDMARKS, reportVersion: 0 });
    const spyDb = {
      ...base,
      insert: (tableRef: any) => {
        const isReport = tableRef?.snapshot !== undefined;
        const chain = base.insert(tableRef);
        if (!isReport) return chain;
        return { values: (data: any) => { captured = data.snapshot; return chain.values(data); } };
      },
    };
    const app = buildCephApp(CephMgmt_createCephReport as any, {
      user: DENTIST_USER, db: spyDb as any, method: 'POST', path: '/:imageId/reports',
    });
    const res = await postReport(app);
    expect(res.status).toBe(201);
    expect(captured.analysis_label).toBe('steiner_hybrid_sn');
  });
});

// ===========================================================================
// BR-044 — DELETE permitted on confirmed/placed; locked → 422 LANDMARK_LOCKED
// ===========================================================================

describe('BR-044 delete lock matrix', () => {
  test('BR-044: DELETE placed landmark → 204', async () => {
    const { CephMgmt_deleteCephLandmark } = await import('./CephMgmt_deleteCephLandmark');
    const db = makeCephDb({ landmark: { ...MOCK_LANDMARK, status: 'placed' } });
    const app = buildCephApp(CephMgmt_deleteCephLandmark as any, {
      user: DENTIST_USER, db, method: 'DELETE', path: '/:imageId/landmarks/:landmarkCode',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks/N`, { method: 'DELETE' });
    expect(res.status).toBe(204);
  });

  test('BR-044: DELETE confirmed landmark → 204 (confirmed is mutable/deletable)', async () => {
    const { CephMgmt_deleteCephLandmark } = await import('./CephMgmt_deleteCephLandmark');
    const db = makeCephDb({ landmark: { ...MOCK_LANDMARK, status: 'confirmed' } });
    const app = buildCephApp(CephMgmt_deleteCephLandmark as any, {
      user: DENTIST_USER, db, method: 'DELETE', path: '/:imageId/landmarks/:landmarkCode',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks/A`, { method: 'DELETE' });
    expect(res.status).toBe(204);
  });

  test('BR-044: DELETE locked landmark → 422 LANDMARK_LOCKED', async () => {
    const { CephMgmt_deleteCephLandmark } = await import('./CephMgmt_deleteCephLandmark');
    const db = makeCephDb({ landmark: { ...MOCK_LANDMARK, status: 'locked' } });
    const app = buildCephApp(CephMgmt_deleteCephLandmark as any, {
      user: DENTIST_USER, db, method: 'DELETE', path: '/:imageId/landmarks/:landmarkCode',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks/N`, { method: 'DELETE' });
    expect(res.status).toBe(422);
    expect(((await res.json()) as any).code).toBe('LANDMARK_LOCKED');
  });
});

// ===========================================================================
// BR-045 — Report snapshot measurement fields are nullable (missing landmark → null)
// ===========================================================================

describe('BR-045 snapshot measurements nullable', () => {
  test('BR-045: report created with only gate landmarks → measurements present but null, not an error', async () => {
    const { CephMgmt_createCephReport } = await import('./CephMgmt_createCephReport');
    let captured: any = null;
    // Only A/B/Go/Po confirmed (gate). S and N absent → sna/snb cannot compute → null.
    const base = makeCephDb({ landmarks: GATE_LANDMARKS, reportVersion: 0 });
    const spyDb = {
      ...base,
      insert: (tableRef: any) => {
        const isReport = tableRef?.snapshot !== undefined;
        const chain = base.insert(tableRef);
        if (!isReport) return chain;
        return { values: (data: any) => { captured = data.snapshot; return chain.values(data); } };
      },
    };
    const app = buildCephApp(CephMgmt_createCephReport as any, {
      user: DENTIST_USER, db: spyDb as any, method: 'POST', path: '/:imageId/reports',
    });
    const res = await postReport(app);
    // Report still creates (201) — missing landmarks produce null measurements, not 422.
    expect(res.status).toBe(201);
    expect(captured.measurements).not.toBeNull();
    // sna/snb require S+N which are absent → explicitly null (field present, value null)
    expect('sna' in captured.measurements).toBe(true);
    expect(captured.measurements.sna).toBeNull();
    expect(captured.measurements.snb).toBeNull();
    expect(captured.measurements.anb).toBeNull();
  });
});

// ===========================================================================
// BR-046 — PATCH recomputes inline; getCephAnalysis recomputes measurements live
// ===========================================================================

describe('BR-046 stale analysis contract', () => {
  test('BR-046: PATCH landmark response carries freshly recomputed {items, analysis} inline (CIMG-009)', async () => {
    const { CephMgmt_updateCephLandmark } = await import('./CephMgmt_updateCephLandmark');
    const db = makeCephDb({ image: CALIBRATED_IMAGE, landmarks: FULL_LANDMARKS, landmark: { ...MOCK_LANDMARK, status: 'placed' } });
    const app = buildCephApp(CephMgmt_updateCephLandmark as any, {
      user: DENTIST_USER, db, method: 'PATCH', path: '/:imageId/landmarks/:landmarkCode',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks/N`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x: 305, y: 115 }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    // Inline recompute: analysis reflects current full landmark set (sna computed)
    expect(typeof body.analysis.measurements.sna).toBe('number');
    expect(body.analysis.analysisType).toBe('steiner_hybrid_sn');
  });

  test('BR-046: explicit recompute endpoint exists and is the authoritative refresh (idempotent)', async () => {
    const { CephMgmt_recomputeCephAnalysis } = await import('./CephMgmt_recomputeCephAnalysis');
    const db = makeCephDb({ image: CALIBRATED_IMAGE, landmarks: FULL_LANDMARKS });
    const app = buildCephApp(CephMgmt_recomputeCephAnalysis as any, {
      user: DENTIST_USER, db, method: 'POST', path: '/:imageId/analysis/recompute',
    });
    const res = await app.request(`/${IMAGE_ID}/analysis/recompute`, { method: 'POST' });
    expect(res.status).toBe(200);
    expect(typeof ((await res.json()) as any).measurements.sna).toBe('number');
  });
});

// ===========================================================================
// BR-047 — All ceph routes require an existing imageId → 404 on missing image
// ===========================================================================

describe('BR-047 ceph ops require existing image → 404', () => {
  const cases: Array<[string, string, string, string]> = [
    ['CephMgmt_batchUpsertCephLandmarks', 'POST', '/:imageId/landmarks', `/${IMAGE_ID}/landmarks`],
    ['CephMgmt_getCephAnalysis', 'GET', '/:imageId/analysis', `/${IMAGE_ID}/analysis`],
    ['CephMgmt_recomputeCephAnalysis', 'POST', '/:imageId/analysis/recompute', `/${IMAGE_ID}/analysis/recompute`],
    ['CephMgmt_createCephReport', 'POST', '/:imageId/reports', `/${IMAGE_ID}/reports`],
    ['CephMgmt_listCephLandmarks', 'GET', '/:imageId/landmarks', `/${IMAGE_ID}/landmarks`],
    ['CephMgmt_updateCephLandmark', 'PATCH', '/:imageId/landmarks/:landmarkCode', `/${IMAGE_ID}/landmarks/N`],
    ['CephMgmt_deleteCephLandmark', 'DELETE', '/:imageId/landmarks/:landmarkCode', `/${IMAGE_ID}/landmarks/N`],
  ];

  for (const [name, method, path, url] of cases) {
    test(`BR-047: ${name} on missing image → 404`, async () => {
      const mod = await import(`./${name}`);
      const handler = (mod as any)[name];
      const db = makeCephDb({ image: null });
      const app = buildCephApp(handler, {
        user: DENTIST_USER, db, method, path, queryParams: {},
      });
      const init: any = { method };
      if (method === 'POST' || method === 'PATCH') {
        init.headers = { 'Content-Type': 'application/json' };
        init.body = JSON.stringify({ landmarks: [{ landmarkCode: 'N', x: 1, y: 1 }], x: 1 });
      }
      const res = await app.request(url, init);
      expect(res.status).toBe(404);
    });
  }
});
