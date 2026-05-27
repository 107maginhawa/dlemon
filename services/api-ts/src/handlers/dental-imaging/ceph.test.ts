/**
 * ceph.test.ts — cephalometric handler unit tests (v1.4)
 *
 * Covers: CIMG-07..15, BR-030/031, D-G, D-I, D-J, D-L, D-4
 * Uses mock DB — no real DB connections. @monobase/ceph-math is called live.
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
  snapshot: {
    landmarks: [] as any[],
    measurements: {} as Record<string, number | null>,
    analysis_label: 'steiner_hybrid_sn',
    calibration: { value: null, method: 'not_calibrated' },
    software_version: '1.4.0',
    operator: DENTIST_USER.id,
    generated_at: new Date().toISOString(),
    study_date: '2026-01-01',
    patient_display_id: PATIENT_ID,
    branch_name: 'Main Branch',
  } as Record<string, unknown>,
  createdAt: new Date(),
  createdBy: DENTIST_USER.id,
};

/** D-L gate landmarks: A, B, Go, Po all confirmed */
const GATE_LANDMARKS = (['A', 'B', 'Go', 'Po'] as const).map((code, i) => ({
  ...MOCK_LANDMARK,
  id: `gate-landmark-${i}`,
  landmarkCode: code,
  status: 'confirmed' as const,
}));

// ---------------------------------------------------------------------------
// makeCephDb — mock DB factory
//
// Table detection by Drizzle column property presence:
//   personId            → dental_membership (assertBranchAccess)
//   studyId             → imaging_study_image
//   patientId (!studyId)→ imaging_study
//   landmarkCode        → imagingCephLandmarks
//   analysisType        → imagingCephAnalyses
//   snapshot            → imagingCephReports
//
// innerJoin returns { imagingTier } for most handlers;
// { imagingTier, branchName } when fields has 'branchName' key (createCephReport).
// ---------------------------------------------------------------------------

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
        // listByImage awaits .where() directly; findByCode uses .where().limit(1)
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
      return {
        values: (_data: any) => {
          const voidPromise = Promise.resolve(undefined);
          return {
            returning: () => {
              if (isReportTable) {
                return Promise.resolve([{ ...MOCK_REPORT, version: reportVersion + 1, createdBy: DENTIST_USER.id }]);
              }
              return Promise.resolve([analysis ?? MOCK_ANALYSIS]);
            },
            onConflictDoUpdate: (_opts: any) =>
              Object.assign(voidPromise, {
                returning: () => Promise.resolve([analysis ?? MOCK_ANALYSIS]),
              }),
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
    // Provide validated data (mirrors what zValidator middleware does)
    const rawBody = await c.req.json().catch(() => ({}));
    (c.req as any).addValidatedData?.('json', rawBody);
    (c.req as any).addValidatedData?.('query', opts.queryParams ?? {});
    await next();
  });
  const method = (opts.method ?? 'POST').toLowerCase();
  // Route-level middleware: path params are populated here (not in use('*'))
  (app as any)[method](opts.path ?? '/', async (c: any, next: any) => {
    (c.req as any).addValidatedData?.('param', c.req.param());
    await next();
  }, handler);
  return app;
}

// ---------------------------------------------------------------------------
// CIMG-07 batch upsert landmarks
// ---------------------------------------------------------------------------

describe('CIMG-07 batch upsert landmarks', () => {
  test('returns 200 with {items, analysis}', async () => {
    const { CephMgmt_batchUpsertCephLandmarks } = await import('./CephMgmt_batchUpsertCephLandmarks');
    const db = makeCephDb();
    const app = buildCephApp(CephMgmt_batchUpsertCephLandmarks as any, {
      user: DENTIST_USER, db, method: 'POST', path: '/:imageId/landmarks',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ landmarks: [{ landmarkCode: 'N', x: 300, y: 200 }] }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.analysis).not.toBeNull();
  });

  test('returns 401 when unauthenticated', async () => {
    const { CephMgmt_batchUpsertCephLandmarks } = await import('./CephMgmt_batchUpsertCephLandmarks');
    const app = buildCephApp(CephMgmt_batchUpsertCephLandmarks as any, {
      method: 'POST', path: '/:imageId/landmarks',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ landmarks: [{ landmarkCode: 'N', x: 300, y: 200 }] }),
    });
    expect(res.status).toBe(401);
  });

  test('returns 404 when image not found', async () => {
    const { CephMgmt_batchUpsertCephLandmarks } = await import('./CephMgmt_batchUpsertCephLandmarks');
    const db = makeCephDb({ image: null });
    const app = buildCephApp(CephMgmt_batchUpsertCephLandmarks as any, {
      user: DENTIST_USER, db, method: 'POST', path: '/:imageId/landmarks',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ landmarks: [{ landmarkCode: 'N', x: 300, y: 200 }] }),
    });
    expect(res.status).toBe(404);
  });

  test('D-G response has analysisType steiner_hybrid_sn', async () => {
    const { CephMgmt_batchUpsertCephLandmarks } = await import('./CephMgmt_batchUpsertCephLandmarks');
    const db = makeCephDb();
    const app = buildCephApp(CephMgmt_batchUpsertCephLandmarks as any, {
      user: DENTIST_USER, db, method: 'POST', path: '/:imageId/landmarks',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ landmarks: [{ landmarkCode: 'N', x: 300, y: 200 }] }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.analysis.analysisType).toBe('steiner_hybrid_sn');
  });
});

// ---------------------------------------------------------------------------
// Addon tier gate — free org → 403
// ---------------------------------------------------------------------------

describe('Addon tier gate — free org → 403', () => {
  test('batch upsert on free tier returns 403', async () => {
    const { CephMgmt_batchUpsertCephLandmarks } = await import('./CephMgmt_batchUpsertCephLandmarks');
    const db = makeCephDb({ imagingTier: 'free' });
    const app = buildCephApp(CephMgmt_batchUpsertCephLandmarks as any, {
      user: DENTIST_USER, db, method: 'POST', path: '/:imageId/landmarks',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ landmarks: [{ landmarkCode: 'N', x: 300, y: 200 }] }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.error).toMatch(/imaging add-on/i);
  });

  test('PATCH landmark on free tier returns 403', async () => {
    const { CephMgmt_updateCephLandmark } = await import('./CephMgmt_updateCephLandmark');
    const db = makeCephDb({ imagingTier: 'free' });
    const app = buildCephApp(CephMgmt_updateCephLandmark as any, {
      user: DENTIST_USER, db, method: 'PATCH', path: '/:imageId/landmarks/:landmarkCode',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks/N`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x: 310 }),
    });
    expect(res.status).toBe(403);
  });

  test('getCephAnalysis on free tier returns 403', async () => {
    const { CephMgmt_getCephAnalysis } = await import('./CephMgmt_getCephAnalysis');
    const db = makeCephDb({ imagingTier: 'free' });
    const app = buildCephApp(CephMgmt_getCephAnalysis as any, {
      user: DENTIST_USER, db, method: 'GET', path: '/:imageId/analysis',
    });
    const res = await app.request(`/${IMAGE_ID}/analysis`);
    expect(res.status).toBe(403);
  });

  test('null imagingTier treated as free → 403', async () => {
    const { CephMgmt_batchUpsertCephLandmarks } = await import('./CephMgmt_batchUpsertCephLandmarks');
    const db = makeCephDb({ imagingTier: null });
    const app = buildCephApp(CephMgmt_batchUpsertCephLandmarks as any, {
      user: DENTIST_USER, db, method: 'POST', path: '/:imageId/landmarks',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ landmarks: [{ landmarkCode: 'N', x: 300, y: 200 }] }),
    });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Branch isolation — non-member → 404, not 403 (no information leak)
// ---------------------------------------------------------------------------

describe('Branch isolation — non-member → 404 not 403', () => {
  test('batch upsert by non-member returns 404', async () => {
    const { CephMgmt_batchUpsertCephLandmarks } = await import('./CephMgmt_batchUpsertCephLandmarks');
    const db = makeCephDb({ hasMembership: false });
    const app = buildCephApp(CephMgmt_batchUpsertCephLandmarks as any, {
      user: DENTIST_USER, db, method: 'POST', path: '/:imageId/landmarks',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ landmarks: [{ landmarkCode: 'N', x: 300, y: 200 }] }),
    });
    expect(res.status).toBe(404);
    // Must not be 403 — that would leak branch existence
    expect(res.status).not.toBe(403);
  });

  test('getCephAnalysis by non-member returns 404', async () => {
    const { CephMgmt_getCephAnalysis } = await import('./CephMgmt_getCephAnalysis');
    const db = makeCephDb({ hasMembership: false });
    const app = buildCephApp(CephMgmt_getCephAnalysis as any, {
      user: DENTIST_USER, db, method: 'GET', path: '/:imageId/analysis',
    });
    const res = await app.request(`/${IMAGE_ID}/analysis`);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// BR-030 recompute-on-write — write handlers return {items, analysis}
// ---------------------------------------------------------------------------

describe('BR-030 recompute-on-write', () => {
  test('batch upsert response has both items array and analysis object', async () => {
    const { CephMgmt_batchUpsertCephLandmarks } = await import('./CephMgmt_batchUpsertCephLandmarks');
    const db = makeCephDb();
    const app = buildCephApp(CephMgmt_batchUpsertCephLandmarks as any, {
      user: DENTIST_USER, db, method: 'POST', path: '/:imageId/landmarks',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ landmarks: [{ landmarkCode: 'N', x: 300, y: 200 }] }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.analysis).not.toBeNull();
    expect(body.analysis.measurements).not.toBeNull();
  });

  test('PATCH landmark response has both items array and analysis object', async () => {
    const { CephMgmt_updateCephLandmark } = await import('./CephMgmt_updateCephLandmark');
    const db = makeCephDb();
    const app = buildCephApp(CephMgmt_updateCephLandmark as any, {
      user: DENTIST_USER, db, method: 'PATCH', path: '/:imageId/landmarks/:landmarkCode',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks/N`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x: 310 }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.analysis).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CIMG-13 PATCH landmark — returns updated analysis; out-of-order contract
// ---------------------------------------------------------------------------

describe('CIMG-13 PATCH landmark', () => {
  test('returns 200 with full {items, analysis} state (client reconciles out-of-order responses)', async () => {
    const { CephMgmt_updateCephLandmark } = await import('./CephMgmt_updateCephLandmark');
    const db = makeCephDb();
    const app = buildCephApp(CephMgmt_updateCephLandmark as any, {
      user: DENTIST_USER, db, method: 'PATCH', path: '/:imageId/landmarks/:landmarkCode',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks/N`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x: 310, y: 205 }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    // Response carries full current state — optimistic client can reconcile any order
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.analysis.imageId).toBe(IMAGE_ID);
    expect(body.analysis.analysisType).toBe('steiner_hybrid_sn');
  });

  test('returns 401 when unauthenticated', async () => {
    const { CephMgmt_updateCephLandmark } = await import('./CephMgmt_updateCephLandmark');
    const app = buildCephApp(CephMgmt_updateCephLandmark as any, {
      method: 'PATCH', path: '/:imageId/landmarks/:landmarkCode',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks/N`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x: 310 }),
    });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// CIMG-14 lock matrix
// ---------------------------------------------------------------------------

describe('CIMG-14 lock matrix', () => {
  test('PATCH x coordinate on locked landmark → 422 LANDMARK_LOCKED', async () => {
    const { CephMgmt_updateCephLandmark } = await import('./CephMgmt_updateCephLandmark');
    const lockedLandmark = { ...MOCK_LANDMARK, status: 'locked' as const };
    const db = makeCephDb({ landmark: lockedLandmark });
    const app = buildCephApp(CephMgmt_updateCephLandmark as any, {
      user: DENTIST_USER, db, method: 'PATCH', path: '/:imageId/landmarks/:landmarkCode',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks/N`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x: 999 }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.code).toBe('LANDMARK_LOCKED');
  });

  test('PATCH y coordinate on locked landmark → 422 LANDMARK_LOCKED', async () => {
    const { CephMgmt_updateCephLandmark } = await import('./CephMgmt_updateCephLandmark');
    const lockedLandmark = { ...MOCK_LANDMARK, status: 'locked' as const };
    const db = makeCephDb({ landmark: lockedLandmark });
    const app = buildCephApp(CephMgmt_updateCephLandmark as any, {
      user: DENTIST_USER, db, method: 'PATCH', path: '/:imageId/landmarks/:landmarkCode',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks/N`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ y: 999 }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.code).toBe('LANDMARK_LOCKED');
  });

  test('DELETE locked landmark → 422 LANDMARK_LOCKED', async () => {
    const { CephMgmt_deleteCephLandmark } = await import('./CephMgmt_deleteCephLandmark');
    const lockedLandmark = { ...MOCK_LANDMARK, status: 'locked' as const };
    const db = makeCephDb({ landmark: lockedLandmark });
    const app = buildCephApp(CephMgmt_deleteCephLandmark as any, {
      user: DENTIST_USER, db, method: 'DELETE', path: '/:imageId/landmarks/:landmarkCode',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks/N`, { method: 'DELETE' });
    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.code).toBe('LANDMARK_LOCKED');
  });

  test('DELETE placed landmark → 204', async () => {
    const { CephMgmt_deleteCephLandmark } = await import('./CephMgmt_deleteCephLandmark');
    const db = makeCephDb({ landmark: MOCK_LANDMARK });
    const app = buildCephApp(CephMgmt_deleteCephLandmark as any, {
      user: DENTIST_USER, db, method: 'DELETE', path: '/:imageId/landmarks/:landmarkCode',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks/N`, { method: 'DELETE' });
    expect(res.status).toBe(204);
  });
});

// ---------------------------------------------------------------------------
// CIMG-009 Landmark validation — status transitions and coordinate constraints
// ---------------------------------------------------------------------------

// @CIMG-009
describe('Invalid status transition', () => {
  test('PATCH placed → locked skips confirmed → 422 INVALID_STATUS_TRANSITION', async () => {
    const { CephMgmt_updateCephLandmark } = await import('./CephMgmt_updateCephLandmark');
    // placed → locked is invalid; placed → confirmed is valid
    const placedLandmark = { ...MOCK_LANDMARK, status: 'placed' as const };
    const db = makeCephDb({ landmark: placedLandmark });
    const app = buildCephApp(CephMgmt_updateCephLandmark as any, {
      user: DENTIST_USER, db, method: 'PATCH', path: '/:imageId/landmarks/:landmarkCode',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks/N`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'locked' }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.code).toBe('INVALID_STATUS_TRANSITION');
  });

  test('PATCH confirmed → placed (backward) → 422 INVALID_STATUS_TRANSITION', async () => {
    const { CephMgmt_updateCephLandmark } = await import('./CephMgmt_updateCephLandmark');
    const confirmedLandmark = { ...MOCK_LANDMARK, status: 'confirmed' as const };
    const db = makeCephDb({ landmark: confirmedLandmark });
    const app = buildCephApp(CephMgmt_updateCephLandmark as any, {
      user: DENTIST_USER, db, method: 'PATCH', path: '/:imageId/landmarks/:landmarkCode',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks/N`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'placed' }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.code).toBe('INVALID_STATUS_TRANSITION');
  });

  test('PATCH placed → confirmed (valid forward) → 200', async () => {
    const { CephMgmt_updateCephLandmark } = await import('./CephMgmt_updateCephLandmark');
    const placedLandmark = { ...MOCK_LANDMARK, status: 'placed' as const };
    const db = makeCephDb({ landmark: placedLandmark });
    const app = buildCephApp(CephMgmt_updateCephLandmark as any, {
      user: DENTIST_USER, db, method: 'PATCH', path: '/:imageId/landmarks/:landmarkCode',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks/N`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed' }),
    });
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// PATCH non-existent landmark → 404
// ---------------------------------------------------------------------------

describe('PATCH non-existent landmark → 404', () => {
  test('returns 404 when landmark not found', async () => {
    const { CephMgmt_updateCephLandmark } = await import('./CephMgmt_updateCephLandmark');
    const db = makeCephDb({ landmark: null });
    const app = buildCephApp(CephMgmt_updateCephLandmark as any, {
      user: DENTIST_USER, db, method: 'PATCH', path: '/:imageId/landmarks/:landmarkCode',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks/MISSING`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x: 100 }),
    });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// CIMG-15 recompute idempotent
// ---------------------------------------------------------------------------

describe('CIMG-15 recompute idempotent', () => {
  test('POST recompute returns 200 with analysis object (not {items, analysis})', async () => {
    const { CephMgmt_recomputeCephAnalysis } = await import('./CephMgmt_recomputeCephAnalysis');
    const db = makeCephDb();
    const app = buildCephApp(CephMgmt_recomputeCephAnalysis as any, {
      user: DENTIST_USER, db, method: 'POST', path: '/:imageId/analysis/recompute',
    });
    const res = await app.request(`/${IMAGE_ID}/analysis/recompute`, { method: 'POST' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    // Returns analysis only — not {items, analysis}
    expect(body.imageId).toBe(IMAGE_ID);
    expect(body.analysisType).toBe('steiner_hybrid_sn');
    expect(body.items).toBeUndefined();
  });

  test('recompute returns 401 when unauthenticated', async () => {
    const { CephMgmt_recomputeCephAnalysis } = await import('./CephMgmt_recomputeCephAnalysis');
    const app = buildCephApp(CephMgmt_recomputeCephAnalysis as any, {
      method: 'POST', path: '/:imageId/analysis/recompute',
    });
    const res = await app.request(`/${IMAGE_ID}/analysis/recompute`, { method: 'POST' });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// D-I immutability — recompute does not touch report rows
// ---------------------------------------------------------------------------

describe('D-I immutability', () => {
  test('recompute response has no version field (analysis only, not a report)', async () => {
    const { CephMgmt_recomputeCephAnalysis } = await import('./CephMgmt_recomputeCephAnalysis');
    const db = makeCephDb();
    const app = buildCephApp(CephMgmt_recomputeCephAnalysis as any, {
      user: DENTIST_USER, db, method: 'POST', path: '/:imageId/analysis/recompute',
    });
    const res = await app.request(`/${IMAGE_ID}/analysis/recompute`, { method: 'POST' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    // No report version — recompute touches imagingCephAnalyses only (D-I)
    expect(body.version).toBeUndefined();
    expect(body.snapshot).toBeUndefined();
  });

  test('second createCephReport returns version 2 (immutable append, D-I)', async () => {
    const { CephMgmt_createCephReport } = await import('./CephMgmt_createCephReport');
    // Simulate DB state where version 1 already exists (reportVersion: 1)
    const db = makeCephDb({ landmarks: GATE_LANDMARKS, reportVersion: 1 });
    const app = buildCephApp(CephMgmt_createCephReport as any, {
      user: DENTIST_USER, db, method: 'POST', path: '/:imageId/reports',
    });
    const res = await app.request(`/${IMAGE_ID}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.version).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// CIMG-11 report assembly
// ---------------------------------------------------------------------------

describe('CIMG-11 report assembly', () => {
  test('createCephReport returns 201 with {id, imageId, version, snapshot, createdAt}', async () => {
    const { CephMgmt_createCephReport } = await import('./CephMgmt_createCephReport');
    const db = makeCephDb({ landmarks: GATE_LANDMARKS, reportVersion: 0 });
    const app = buildCephApp(CephMgmt_createCephReport as any, {
      user: DENTIST_USER, db, method: 'POST', path: '/:imageId/reports',
    });
    const res = await app.request(`/${IMAGE_ID}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.id).not.toBeNull();
    expect(body.imageId).toBe(IMAGE_ID);
    expect(body.version).toBe(1);
    expect(body.snapshot).not.toBeNull();
    expect(body.createdAt).not.toBeNull();
  });

  test('createCephReport returns 401 when unauthenticated', async () => {
    const { CephMgmt_createCephReport } = await import('./CephMgmt_createCephReport');
    const app = buildCephApp(CephMgmt_createCephReport as any, {
      method: 'POST', path: '/:imageId/reports',
    });
    const res = await app.request(`/${IMAGE_ID}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// D-L confirm-gate
// ---------------------------------------------------------------------------

describe('D-L confirm-gate', () => {
  test('report blocked (422 REPORT_GATE_UNCONFIRMED) when A/B/Go/Po not confirmed', async () => {
    const { CephMgmt_createCephReport } = await import('./CephMgmt_createCephReport');
    // Only N landmark present — A, B, Go, Po missing
    const db = makeCephDb({ landmarks: [MOCK_LANDMARK] });
    const app = buildCephApp(CephMgmt_createCephReport as any, {
      user: DENTIST_USER, db, method: 'POST', path: '/:imageId/reports',
    });
    const res = await app.request(`/${IMAGE_ID}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.code).toBe('REPORT_GATE_UNCONFIRMED');
  });

  test('report blocked when gate landmarks are placed (not confirmed)', async () => {
    const { CephMgmt_createCephReport } = await import('./CephMgmt_createCephReport');
    const placedGateLandmarks = GATE_LANDMARKS.map((l) => ({ ...l, status: 'placed' as const }));
    const db = makeCephDb({ landmarks: placedGateLandmarks });
    const app = buildCephApp(CephMgmt_createCephReport as any, {
      user: DENTIST_USER, db, method: 'POST', path: '/:imageId/reports',
    });
    const res = await app.request(`/${IMAGE_ID}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(422);
  });

  test('report succeeds when A/B/Go/Po are all confirmed', async () => {
    const { CephMgmt_createCephReport } = await import('./CephMgmt_createCephReport');
    const db = makeCephDb({ landmarks: GATE_LANDMARKS, reportVersion: 0 });
    const app = buildCephApp(CephMgmt_createCephReport as any, {
      user: DENTIST_USER, db, method: 'POST', path: '/:imageId/reports',
    });
    const res = await app.request(`/${IMAGE_ID}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(201);
  });

  test('report succeeds when gate landmarks are locked (counts as confirmed)', async () => {
    const { CephMgmt_createCephReport } = await import('./CephMgmt_createCephReport');
    const lockedGateLandmarks = GATE_LANDMARKS.map((l) => ({ ...l, status: 'locked' as const }));
    const db = makeCephDb({ landmarks: lockedGateLandmarks, reportVersion: 0 });
    const app = buildCephApp(CephMgmt_createCephReport as any, {
      user: DENTIST_USER, db, method: 'POST', path: '/:imageId/reports',
    });
    const res = await app.request(`/${IMAGE_ID}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(201);
  });
});

// ---------------------------------------------------------------------------
// CIMG-010 Angular measurements — SNA/SNB/ANB via steiner_hybrid_sn analysis
// ---------------------------------------------------------------------------

// @CIMG-010
describe('D-G label — steiner_hybrid_sn', () => {
  test('getCephAnalysis returns analysisType steiner_hybrid_sn', async () => {
    const { CephMgmt_getCephAnalysis } = await import('./CephMgmt_getCephAnalysis');
    const db = makeCephDb();
    const app = buildCephApp(CephMgmt_getCephAnalysis as any, {
      user: DENTIST_USER, db, method: 'GET', path: '/:imageId/analysis',
    });
    const res = await app.request(`/${IMAGE_ID}/analysis`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.analysis.analysisType).toBe('steiner_hybrid_sn');
  });

  test('createCephReport snapshot.analysis_label is steiner_hybrid_sn', async () => {
    const { CephMgmt_createCephReport } = await import('./CephMgmt_createCephReport');
    const db = makeCephDb({ landmarks: GATE_LANDMARKS, reportVersion: 0 });
    const app = buildCephApp(CephMgmt_createCephReport as any, {
      user: DENTIST_USER, db, method: 'POST', path: '/:imageId/reports',
    });
    const res = await app.request(`/${IMAGE_ID}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.snapshot.analysis_label).toBe('steiner_hybrid_sn');
  });
});

// ---------------------------------------------------------------------------
// CIMG-012 Soft tissue profile — calibration required; uncalibrated flag gates linear measurements
// ---------------------------------------------------------------------------

// @CIMG-012
describe('D-J calibration provenance', () => {
  test('calibrated image → calibrationMethod manual_ruler in analysis', async () => {
    const { CephMgmt_batchUpsertCephLandmarks } = await import('./CephMgmt_batchUpsertCephLandmarks');
    const calibratedImage = { ...MOCK_IMAGE, pixelSpacingMm: 0.15 };
    const calibratedAnalysis = { ...MOCK_ANALYSIS, calibrationMethod: 'manual_ruler' as const, calibrationValue: 0.15 };
    const db = makeCephDb({ image: calibratedImage, analysis: calibratedAnalysis });
    const app = buildCephApp(CephMgmt_batchUpsertCephLandmarks as any, {
      user: DENTIST_USER, db, method: 'POST', path: '/:imageId/landmarks',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ landmarks: [{ landmarkCode: 'N', x: 300, y: 200 }] }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.analysis.calibrationMethod).toBe('manual_ruler');
  });

  test('uncalibrated image → calibrationMethod not_calibrated and uncalibrated flag', async () => {
    const { CephMgmt_batchUpsertCephLandmarks } = await import('./CephMgmt_batchUpsertCephLandmarks');
    const db = makeCephDb({ image: { ...MOCK_IMAGE, pixelSpacingMm: null } });
    const app = buildCephApp(CephMgmt_batchUpsertCephLandmarks as any, {
      user: DENTIST_USER, db, method: 'POST', path: '/:imageId/landmarks',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ landmarks: [{ landmarkCode: 'N', x: 300, y: 200 }] }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.analysis.calibrationMethod).toBe('not_calibrated');
    // uncalibrated is true when pixelSpacingMm is null and angle-dependent measurements exist
    // (depends on actual landmark codes placed; with only 'N' the result is uncalibrated = false)
    expect(typeof body.analysis.uncalibrated).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------
// D4 snapshot fields — study_date, patient_display_id, branch_name
// ---------------------------------------------------------------------------

describe('D4 snapshot fields', () => {
  test('createCephReport snapshot contains study_date, patient_display_id, branch_name', async () => {
    const { CephMgmt_createCephReport } = await import('./CephMgmt_createCephReport');

    let capturedSnapshot: Record<string, unknown> | null = null;
    const baseCephDb = makeCephDb({ landmarks: GATE_LANDMARKS, reportVersion: 0 });

    const spyDb = {
      ...baseCephDb,
      insert: (tableRef: any) => {
        const isReportTable = tableRef?.snapshot !== undefined;
        const chain = baseCephDb.insert(tableRef);
        if (!isReportTable) return chain;
        return {
          values: (data: any) => {
            capturedSnapshot = data.snapshot;
            return chain.values(data);
          },
        };
      },
    };

    const app = buildCephApp(CephMgmt_createCephReport as any, {
      user: DENTIST_USER,
      db: spyDb as any,
      method: 'POST',
      path: '/:imageId/reports',
    });
    const res = await app.request(`/${IMAGE_ID}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(201);
    expect(capturedSnapshot).not.toBeNull();
    expect((capturedSnapshot as any).study_date).toBe('2026-01-01');
    expect((capturedSnapshot as any).patient_display_id).toBe(PATIENT_ID);
    expect((capturedSnapshot as any).branch_name).toBe('Main Branch');
  });
});

// ---------------------------------------------------------------------------
// Version monotonicity
// ---------------------------------------------------------------------------

describe('Version monotonicity', () => {
  test('first createCephReport returns version 1', async () => {
    const { CephMgmt_createCephReport } = await import('./CephMgmt_createCephReport');
    const db = makeCephDb({ landmarks: GATE_LANDMARKS, reportVersion: 0 });
    const app = buildCephApp(CephMgmt_createCephReport as any, {
      user: DENTIST_USER, db, method: 'POST', path: '/:imageId/reports',
    });
    const res = await app.request(`/${IMAGE_ID}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.version).toBe(1);
  });

  test('second createCephReport returns version 2 (maxVersion + 1)', async () => {
    const { CephMgmt_createCephReport } = await import('./CephMgmt_createCephReport');
    const db = makeCephDb({ landmarks: GATE_LANDMARKS, reportVersion: 1 });
    const app = buildCephApp(CephMgmt_createCephReport as any, {
      user: DENTIST_USER, db, method: 'POST', path: '/:imageId/reports',
    });
    const res = await app.request(`/${IMAGE_ID}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.version).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// getCephAnalysis empty state — never 404
// ---------------------------------------------------------------------------

describe('getCephAnalysis empty state — never 404', () => {
  test('image with no landmarks returns 200 (not 404)', async () => {
    const { CephMgmt_getCephAnalysis } = await import('./CephMgmt_getCephAnalysis');
    const db = makeCephDb({ landmarks: [], analysis: null });
    const app = buildCephApp(CephMgmt_getCephAnalysis as any, {
      user: DENTIST_USER, db, method: 'GET', path: '/:imageId/analysis',
    });
    const res = await app.request(`/${IMAGE_ID}/analysis`);
    expect(res.status).toBe(200);
  });

  test('empty state has items:[] and non-empty missing[] array', async () => {
    const { CephMgmt_getCephAnalysis } = await import('./CephMgmt_getCephAnalysis');
    const db = makeCephDb({ landmarks: [], analysis: null });
    const app = buildCephApp(CephMgmt_getCephAnalysis as any, {
      user: DENTIST_USER, db, method: 'GET', path: '/:imageId/analysis',
    });
    const res = await app.request(`/${IMAGE_ID}/analysis`);
    const body = (await res.json()) as any;
    expect(body.items).toEqual([]);
    expect(Array.isArray(body.analysis.missing)).toBe(true);
    expect(body.analysis.missing.length).toBeGreaterThan(0);
    expect(body.analysis.measurements).not.toBeNull();
  });

  test('listCephLandmarks empty state returns 200 with items:[]', async () => {
    const { CephMgmt_listCephLandmarks } = await import('./CephMgmt_listCephLandmarks');
    const db = makeCephDb({ landmarks: [], analysis: null });
    const app = buildCephApp(CephMgmt_listCephLandmarks as any, {
      user: DENTIST_USER, db, method: 'GET', path: '/:imageId/landmarks',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.items).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Batch response completeness
// ---------------------------------------------------------------------------

describe('Batch response completeness', () => {
  test('response items includes all current landmarks (not just those in batch)', async () => {
    const { CephMgmt_batchUpsertCephLandmarks } = await import('./CephMgmt_batchUpsertCephLandmarks');
    // DB has 3 existing landmarks (one locked), batch sends only 1 new one
    const existingLandmarks = [
      { ...MOCK_LANDMARK, id: 'lm-1', landmarkCode: 'N' },
      { ...MOCK_LANDMARK, id: 'lm-2', landmarkCode: 'S', status: 'confirmed' as const },
      { ...MOCK_LANDMARK, id: 'lm-3', landmarkCode: 'A', status: 'locked' as const },
    ];
    // After batchUpsert, listByImage returns all 3 (mock returns landmarks array)
    const db = makeCephDb({ landmarks: existingLandmarks });
    const app = buildCephApp(CephMgmt_batchUpsertCephLandmarks as any, {
      user: DENTIST_USER, db, method: 'POST', path: '/:imageId/landmarks',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ landmarks: [{ landmarkCode: 'N', x: 310, y: 205 }] }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    // Response includes ALL 3 landmarks (not just the 1 in the batch)
    expect(body.items).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// getCephReport with ?version query param
// ---------------------------------------------------------------------------

describe('getCephReport', () => {
  test('returns 200 with report structure', async () => {
    const { CephMgmt_getCephReport } = await import('./CephMgmt_getCephReport');
    const db = makeCephDb({ report: MOCK_REPORT });
    const app = buildCephApp(CephMgmt_getCephReport as any, {
      user: DENTIST_USER, db, method: 'GET', path: '/:imageId/reports',
      queryParams: {},
    });
    const res = await app.request(`/${IMAGE_ID}/reports`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.id).not.toBeNull();
    expect(body.imageId).toBe(IMAGE_ID);
    expect(body.version).toBe(1);
    expect(body.snapshot).not.toBeNull();
    expect(body.createdAt).not.toBeNull();
  });

  test('returns 404 when no report exists', async () => {
    const { CephMgmt_getCephReport } = await import('./CephMgmt_getCephReport');
    const db = makeCephDb({ report: null });
    const app = buildCephApp(CephMgmt_getCephReport as any, {
      user: DENTIST_USER, db, method: 'GET', path: '/:imageId/reports',
      queryParams: {},
    });
    const res = await app.request(`/${IMAGE_ID}/reports`);
    expect(res.status).toBe(404);
  });

  test('?version=1 queries specific version (returns report)', async () => {
    const { CephMgmt_getCephReport } = await import('./CephMgmt_getCephReport');
    const db = makeCephDb({ report: MOCK_REPORT });
    const app = buildCephApp(CephMgmt_getCephReport as any, {
      user: DENTIST_USER, db, method: 'GET', path: '/:imageId/reports',
      queryParams: { version: 1 },
    });
    const res = await app.request(`/${IMAGE_ID}/reports?version=1`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.version).toBe(1);
  });

  test('returns 401 when unauthenticated', async () => {
    const { CephMgmt_getCephReport } = await import('./CephMgmt_getCephReport');
    const app = buildCephApp(CephMgmt_getCephReport as any, {
      method: 'GET', path: '/:imageId/reports',
      queryParams: {},
    });
    const res = await app.request(`/${IMAGE_ID}/reports`);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Pino audit emission
// ---------------------------------------------------------------------------

describe('Pino audit emission', () => {
  test('batch upsert emits logger.info with action ceph_landmarks_batch_upsert and by user.id', async () => {
    const { CephMgmt_batchUpsertCephLandmarks } = await import('./CephMgmt_batchUpsertCephLandmarks');
    const infoCalls: any[] = [];
    const logger = {
      debug: () => {},
      info: (meta: any, _msg?: string) => { infoCalls.push(meta); },
      warn: () => {},
      error: () => {},
    };
    const app = buildCephApp(CephMgmt_batchUpsertCephLandmarks as any, {
      user: DENTIST_USER,
      logger,
      method: 'POST',
      path: '/:imageId/landmarks',
    });
    await app.request(`/${IMAGE_ID}/landmarks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ landmarks: [{ landmarkCode: 'N', x: 300, y: 200 }] }),
    });
    expect(infoCalls.some((c) => c.action === 'ceph_landmarks_batch_upsert')).toBe(true);
    expect(infoCalls.some((c) => c.by === DENTIST_USER.id)).toBe(true);
  });

  test('PATCH landmark emits logger.info with action ceph_landmark_update', async () => {
    const { CephMgmt_updateCephLandmark } = await import('./CephMgmt_updateCephLandmark');
    const infoCalls: any[] = [];
    const logger = {
      debug: () => {},
      info: (meta: any, _msg?: string) => { infoCalls.push(meta); },
      warn: () => {},
      error: () => {},
    };
    const app = buildCephApp(CephMgmt_updateCephLandmark as any, {
      user: DENTIST_USER,
      logger,
      method: 'PATCH',
      path: '/:imageId/landmarks/:landmarkCode',
    });
    await app.request(`/${IMAGE_ID}/landmarks/N`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x: 310 }),
    });
    expect(infoCalls.some((c) => c.action === 'ceph_landmark_update')).toBe(true);
    expect(infoCalls.some((c) => c.by === DENTIST_USER.id)).toBe(true);
  });

  test('DELETE landmark emits logger.info with action ceph_landmark_delete', async () => {
    const { CephMgmt_deleteCephLandmark } = await import('./CephMgmt_deleteCephLandmark');
    const infoCalls: any[] = [];
    const logger = {
      debug: () => {},
      info: (meta: any, _msg?: string) => { infoCalls.push(meta); },
      warn: () => {},
      error: () => {},
    };
    const app = buildCephApp(CephMgmt_deleteCephLandmark as any, {
      user: DENTIST_USER,
      logger,
      method: 'DELETE',
      path: '/:imageId/landmarks/:landmarkCode',
    });
    await app.request(`/${IMAGE_ID}/landmarks/N`, { method: 'DELETE' });
    expect(infoCalls.some((c) => c.action === 'ceph_landmark_delete')).toBe(true);
    expect(infoCalls.some((c) => c.by === DENTIST_USER.id)).toBe(true);
  });

  test('createCephReport emits logger.info with action ceph_report_create', async () => {
    const { CephMgmt_createCephReport } = await import('./CephMgmt_createCephReport');
    const infoCalls: any[] = [];
    const logger = {
      debug: () => {},
      info: (meta: any, _msg?: string) => { infoCalls.push(meta); },
      warn: () => {},
      error: () => {},
    };
    const db = makeCephDb({ landmarks: GATE_LANDMARKS, reportVersion: 0 });
    const app = buildCephApp(CephMgmt_createCephReport as any, {
      user: DENTIST_USER,
      db,
      logger,
      method: 'POST',
      path: '/:imageId/reports',
    });
    await app.request(`/${IMAGE_ID}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(infoCalls.some((c) => c.action === 'ceph_report_create')).toBe(true);
    expect(infoCalls.some((c) => c.by === DENTIST_USER.id)).toBe(true);
  });

  test('recompute emits logger.info with action ceph_analysis_recompute', async () => {
    const { CephMgmt_recomputeCephAnalysis } = await import('./CephMgmt_recomputeCephAnalysis');
    const infoCalls: any[] = [];
    const logger = {
      debug: () => {},
      info: (meta: any, _msg?: string) => { infoCalls.push(meta); },
      warn: () => {},
      error: () => {},
    };
    const app = buildCephApp(CephMgmt_recomputeCephAnalysis as any, {
      user: DENTIST_USER,
      logger,
      method: 'POST',
      path: '/:imageId/analysis/recompute',
    });
    await app.request(`/${IMAGE_ID}/analysis/recompute`, { method: 'POST' });
    expect(infoCalls.some((c) => c.action === 'ceph_analysis_recompute')).toBe(true);
    expect(infoCalls.some((c) => c.by === DENTIST_USER.id)).toBe(true);
  });
});
