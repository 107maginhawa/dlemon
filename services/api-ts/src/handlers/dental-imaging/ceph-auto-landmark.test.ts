/**
 * ceph-auto-landmark.test.ts — P1-10 AI / auto cephalometric landmarking (Phase 0)
 *
 * Covers (plan §5):
 *   - detect gates: flag-OFF → 403 FEATURE_DISABLED, free tier → 403,
 *     non-member → 404, non-ceph modality → 422, image-not-found → 404, 401.
 *   - FakeDetector predictions persist as source='ai', status='placed', confidence set.
 *   - SAFETY: an AI batch-write with status='confirmed'/'locked' → rejected;
 *     report cannot be generated from an all-AI, zero-confirmed landmark set.
 *   - PROVENANCE: editing an 'ai' landmark's coords → source 'ai_corrected';
 *     confirming (status-only) preserves source.
 *   - FakeDetector unit: deterministic, image-bounded, low-confidence point present.
 *
 * Uses a mock DB (no real DB) mirroring ceph.test.ts. @monobase/ceph-math runs live.
 */

import { describe, test, expect } from 'bun:test';
import { Hono } from 'hono';
import { AppError } from '@/core/errors';
import type { CephLandmarkStatus, ImagingCephAnalysis } from './repos/imaging_ceph.schema';
import {
  FakeDetector,
  FAKE_DETECTOR_MODEL_VERSION,
  CEPH_LOW_CONFIDENCE_THRESHOLD,
} from './repos/ceph-landmark-detector';

const DENTIST_USER = { id: 'aaaaaaaa-0000-0000-0000-000000000001', email: 'dentist@clinic.com' };
const PATIENT_ID = 'dddddddd-0000-0000-0000-000000000004';
const BRANCH_ID = 'eeeeeeee-0000-0000-0000-000000000005';
const STUDY_ID = 'ffffffff-0000-0000-0000-000000000006';
const IMAGE_ID = '11111111-0000-0000-0000-000000000007';

const MOCK_STUDY = {
  id: STUDY_ID,
  patientId: PATIENT_ID,
  visitId: null,
  branchId: BRANCH_ID,
  acquiredBy: DENTIST_USER.id,
  modality: 'cephalometric' as const,
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
  fileId: '22222222-0000-0000-0000-000000000008',
  pixelSpacingMm: 0.2 as number | null,
  sequenceNumber: 0,
  dicomMetadata: null,
  modality: 'cephalometric' as const,
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
  source: 'manual' as 'manual' | 'ai' | 'ai_corrected',
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
  calibrationValue: 0.2 as number | null,
  calibrationMethod: 'manual_ruler' as ImagingCephAnalysis['calibrationMethod'],
  calibratedAt: null as Date | null,
  calibratedBy: null as string | null,
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
  createdBy: DENTIST_USER.id,
  updatedBy: DENTIST_USER.id,
};

type MockLandmark = typeof MOCK_LANDMARK;

/** Captures every batchUpsert payload so we can assert source/status/confidence. */
type Captured = { upserts: any[]; updates: any[] };

function makeCephDb(
  opts: {
    hasMembership?: boolean;
    study?: typeof MOCK_STUDY | null;
    image?: typeof MOCK_IMAGE | null;
    imagingTier?: 'free' | 'basic' | 'addon' | null;
    landmark?: MockLandmark | null;
    landmarks?: MockLandmark[];
    analysis?: typeof MOCK_ANALYSIS | null;
  } = {},
  captured?: Captured,
) {
  const hasMembership = opts.hasMembership !== false;
  const study = opts.study !== undefined ? opts.study : MOCK_STUDY;
  const image = opts.image !== undefined ? opts.image : MOCK_IMAGE;
  const imagingTier = opts.imagingTier !== undefined ? opts.imagingTier : 'addon';
  const landmark = opts.landmark !== undefined ? opts.landmark : MOCK_LANDMARK;
  const landmarks = opts.landmarks !== undefined ? opts.landmarks : (landmark ? [landmark] : []);
  const analysis = opts.analysis !== undefined ? opts.analysis : MOCK_ANALYSIS;

  const buildSelectChain = (tableRef: any, fields?: any) => {
    const hasPersonId = tableRef?.personId !== undefined;
    const hasStudyId = tableRef?.studyId !== undefined;
    const hasPatientId = tableRef?.patientId !== undefined && !hasStudyId;
    const hasLandmarkCode = tableRef?.landmarkCode !== undefined;
    const hasAnalysisType = tableRef?.analysisType !== undefined;
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
      innerJoin: (_t: any, _c: any) => ({
        where: (_c2: any) => ({
          limit: (_n: number) =>
            Promise.resolve([{ imagingTier, ...(hasBranchNameField ? { branchName: 'Main Branch' } : {}) }]),
        }),
      }),
    };
  };

  return {
    select: (fields?: any) => ({ from: (tableRef: any) => buildSelectChain(tableRef, fields) }),
    insert: (tableRef: any) => {
      const isLandmarkTable = tableRef?.landmarkCode !== undefined;
      return {
        values: (data: any) => {
          if (isLandmarkTable && captured) captured.upserts.push(data);
          const voidPromise = Promise.resolve(undefined);
          return {
            returning: () => Promise.resolve([analysis ?? MOCK_ANALYSIS]),
            onConflictDoUpdate: (_o: any) =>
              Object.assign(voidPromise, {
                returning: () => Promise.resolve([analysis ?? MOCK_ANALYSIS]),
              }),
          };
        },
      };
    },
    update: (_tableRef: any) => ({
      set: (data: any) => {
        if (captured) captured.updates.push(data);
        return {
          where: (_c: any) => ({ returning: () => Promise.resolve([landmark ?? MOCK_LANDMARK]) }),
        };
      },
    }),
    delete: (_tableRef: any) => ({ where: (_c: any) => Promise.resolve(undefined) }),
  };
}

const DEFAULT_LOGGER = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
const STORAGE_STUB = { generateDownloadUrl: async (_id: string) => 'https://signed.example/img' };

function buildApp(
  handler: (ctx: any) => Promise<Response>,
  opts: {
    user?: typeof DENTIST_USER;
    db?: ReturnType<typeof makeCephDb>;
    flagOn?: boolean;
    method?: string;
    path?: string;
  } = {},
) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err) }, 500);
  });
  app.use('*', async (c, next) => {
    c.set('database' as any, opts.db ?? makeCephDb());
    c.set('logger' as any, DEFAULT_LOGGER);
    c.set('storage' as any, STORAGE_STUB);
    c.set('config' as any, { features: { dentalImagingAutoLandmark: opts.flagOn ?? true } });
    if (opts.user) {
      c.set('user' as any, opts.user);
      c.set('session' as any, { id: 'test-session' });
    }
    const rawBody = await c.req.json().catch(() => ({}));
    (c.req as any).addValidatedData?.('json', rawBody);
    (c.req as any).addValidatedData?.('query', {});
    await next();
  });
  const method = (opts.method ?? 'POST').toLowerCase();
  (app as any)[method](opts.path ?? '/', async (c: any, next: any) => {
    (c.req as any).addValidatedData?.('param', c.req.param());
    await next();
  }, handler);
  return app;
}

// ---------------------------------------------------------------------------
// FakeDetector unit
// ---------------------------------------------------------------------------

describe('FakeDetector (provider seam)', () => {
  test('returns deterministic predictions across runs', async () => {
    const d = new FakeDetector();
    const a = await d.detect({ imageId: IMAGE_ID, imageUrl: null });
    const b = await d.detect({ imageId: IMAGE_ID, imageUrl: null });
    expect(a.landmarks).toEqual(b.landmarks);
    expect(a.modelVersion).toBe(FAKE_DETECTOR_MODEL_VERSION);
    expect(a.provider).toBe('fake');
    expect(a.landmarks.length).toBeGreaterThanOrEqual(6);
  });

  test('includes the 4 report-gate landmarks A/B/Go/Po', async () => {
    const d = new FakeDetector();
    const { landmarks } = await d.detect({ imageId: IMAGE_ID, imageUrl: null });
    const codes = new Set(landmarks.map((l) => l.code));
    for (const c of ['A', 'B', 'Go', 'Po']) expect(codes.has(c as any)).toBe(true);
  });

  test('emits at least one low-confidence prediction (flag path)', async () => {
    const d = new FakeDetector();
    const { landmarks } = await d.detect({ imageId: IMAGE_ID, imageUrl: null });
    expect(landmarks.some((l) => l.confidence < CEPH_LOW_CONFIDENCE_THRESHOLD)).toBe(true);
  });

  test('clamps predictions to image dimensions when provided', async () => {
    const d = new FakeDetector();
    const { landmarks } = await d.detect({ imageId: IMAGE_ID, imageUrl: null, width: 100, height: 100 });
    for (const l of landmarks) {
      expect(l.x).toBeLessThanOrEqual(100);
      expect(l.y).toBeLessThanOrEqual(100);
      expect(l.x).toBeGreaterThanOrEqual(0);
      expect(l.y).toBeGreaterThanOrEqual(0);
    }
  });
});

// ---------------------------------------------------------------------------
// detect endpoint gates
// ---------------------------------------------------------------------------

describe('detectCephLandmarks gates', () => {
  async function run(opts: Parameters<typeof buildApp>[1]) {
    const { CephMgmt_detectCephLandmarks } = await import('./CephMgmt_detectCephLandmarks');
    const app = buildApp(CephMgmt_detectCephLandmarks as any, {
      method: 'POST',
      path: '/:imageId/landmarks/detect',
      ...opts,
    });
    return app.request(`/${IMAGE_ID}/landmarks/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
  }

  test('401 when unauthenticated', async () => {
    const res = await run({});
    expect(res.status).toBe(401);
  });

  test('flag OFF → 403 FEATURE_DISABLED (kill-switch)', async () => {
    const res = await run({ user: DENTIST_USER, flagOn: false });
    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.code).toBe('FEATURE_DISABLED');
  });

  test('flag OFF writes ZERO landmark rows — kill-switch precedes all persistence', async () => {
    // CLINICAL INTEGRITY (plan §4): when the kill-switch is off, no FakeDetector
    // output may reach a real chart. The 403 alone is not enough — prove the
    // detector never ran and nothing was upserted. The DB is configured to succeed
    // for every read/write, so a missing/late gate would visibly persist rows.
    const captured: Captured = { upserts: [], updates: [] };
    const { CephMgmt_detectCephLandmarks } = await import('./CephMgmt_detectCephLandmarks');
    const app = buildApp(CephMgmt_detectCephLandmarks as any, {
      user: DENTIST_USER,
      flagOn: false,
      method: 'POST',
      path: '/:imageId/landmarks/detect',
      db: makeCephDb({ landmarks: [] }, captured),
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(403);
    expect(((await res.json()) as any).code).toBe('FEATURE_DISABLED');
    expect(captured.upserts.flat()).toHaveLength(0);
    expect(captured.updates).toHaveLength(0);
  });

  test('free tier → 403 IMAGING_TIER_REQUIRED', async () => {
    const res = await run({ user: DENTIST_USER, flagOn: true, db: makeCephDb({ imagingTier: 'free' }) });
    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.code).toBe('IMAGING_TIER_REQUIRED');
  });

  test('non-member → 404 (not 403, no info leak)', async () => {
    const res = await run({ user: DENTIST_USER, flagOn: true, db: makeCephDb({ hasMembership: false }) });
    expect(res.status).toBe(404);
    expect(res.status).not.toBe(403);
  });

  test('image not found → 404', async () => {
    const res = await run({ user: DENTIST_USER, flagOn: true, db: makeCephDb({ image: null }) });
    expect(res.status).toBe(404);
  });

  test('non-cephalometric modality → 422 INVALID_MODALITY', async () => {
    const panoImage = { ...MOCK_IMAGE, modality: 'panoramic' as any };
    const res = await run({ user: DENTIST_USER, flagOn: true, db: makeCephDb({ image: panoImage }) });
    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.code).toBe('INVALID_MODALITY');
  });
});

// ---------------------------------------------------------------------------
// detect persists predictions as ai / placed / confidence
// ---------------------------------------------------------------------------

describe('detectCephLandmarks persistence', () => {
  test('persists predictions as source=ai, status=placed, confidence set; returns succeeded', async () => {
    const captured: Captured = { upserts: [], updates: [] };
    const { CephMgmt_detectCephLandmarks } = await import('./CephMgmt_detectCephLandmarks');
    const app = buildApp(CephMgmt_detectCephLandmarks as any, {
      user: DENTIST_USER,
      flagOn: true,
      db: makeCephDb({ landmarks: [] }, captured),
      method: 'POST',
      path: '/:imageId/landmarks/detect',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.status).toBe('succeeded');
    expect(body.modelVersion).toBe(FAKE_DETECTOR_MODEL_VERSION);
    expect(Array.isArray(body.predictions)).toBe(true);
    expect(body.predictions.length).toBeGreaterThanOrEqual(6);

    // Every persisted row is ai / placed / has a confidence number.
    const persisted = captured.upserts.flat();
    expect(persisted.length).toBeGreaterThanOrEqual(6);
    for (const row of persisted) {
      expect(row.source).toBe('ai');
      expect(row.status).toBe('placed');
      expect(typeof row.confidence).toBe('number');
    }
  });

  test('NEVER persists a confirmed/locked AI landmark (safety)', async () => {
    const captured: Captured = { upserts: [], updates: [] };
    const { CephMgmt_detectCephLandmarks } = await import('./CephMgmt_detectCephLandmarks');
    const app = buildApp(CephMgmt_detectCephLandmarks as any, {
      user: DENTIST_USER,
      flagOn: true,
      db: makeCephDb({ landmarks: [] }, captured),
      method: 'POST',
      path: '/:imageId/landmarks/detect',
    });
    await app.request(`/${IMAGE_ID}/landmarks/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const persisted = captured.upserts.flat();
    expect(persisted.every((r) => r.status === 'placed')).toBe(true);
    expect(persisted.some((r) => r.status === 'confirmed' || r.status === 'locked')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SAFETY — batchUpsert may not auto-confirm/lock an AI write
// ---------------------------------------------------------------------------

describe('SAFETY: AI batch-write cannot auto-confirm/lock', () => {
  async function attempt(status: string) {
    const { CephMgmt_batchUpsertCephLandmarks } = await import('./CephMgmt_batchUpsertCephLandmarks');
    const app = buildApp(CephMgmt_batchUpsertCephLandmarks as any, {
      user: DENTIST_USER,
      flagOn: true,
      db: makeCephDb(),
      method: 'POST',
      path: '/:imageId/landmarks',
    });
    return app.request(`/${IMAGE_ID}/landmarks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ landmarks: [{ landmarkCode: 'A', x: 1, y: 2, source: 'ai', status }] }),
    });
  }

  test('source=ai + status=confirmed → 422 AI_LANDMARK_CANNOT_AUTOCONFIRM', async () => {
    const res = await attempt('confirmed');
    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.code).toBe('AI_LANDMARK_CANNOT_AUTOCONFIRM');
  });

  test('source=ai + status=locked → 422 AI_LANDMARK_CANNOT_AUTOCONFIRM', async () => {
    const res = await attempt('locked');
    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.code).toBe('AI_LANDMARK_CANNOT_AUTOCONFIRM');
  });

  test('source=ai + status=placed → 200 (allowed)', async () => {
    const res = await attempt('placed');
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// SAFETY — report cannot be generated from an all-AI, zero-confirmed set
// ---------------------------------------------------------------------------

describe('SAFETY: report gate blocks all-AI placed landmarks', () => {
  test('all-AI placed A/B/Go/Po → 422 REPORT_GATE_UNCONFIRMED', async () => {
    const { CephMgmt_createCephReport } = await import('./CephMgmt_createCephReport');
    const aiGate = (['A', 'B', 'Go', 'Po'] as const).map((code, i) => ({
      ...MOCK_LANDMARK,
      id: `ai-gate-${i}`,
      landmarkCode: code,
      source: 'ai' as const,
      status: 'placed' as CephLandmarkStatus,
      confidence: 0.8,
    }));
    const app = buildApp(CephMgmt_createCephReport as any, {
      user: DENTIST_USER,
      flagOn: true,
      db: makeCephDb({ landmarks: aiGate }),
      method: 'POST',
      path: '/:imageId/reports',
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
});

// ---------------------------------------------------------------------------
// PROVENANCE — ai → ai_corrected on coord edit; confirm preserves source
// ---------------------------------------------------------------------------

describe('PROVENANCE: ai → ai_corrected', () => {
  test('editing coords of an ai landmark sets source=ai_corrected', async () => {
    const captured: Captured = { upserts: [], updates: [] };
    const aiLandmark = { ...MOCK_LANDMARK, source: 'ai' as const, confidence: 0.8, status: 'placed' as CephLandmarkStatus };
    const { CephMgmt_updateCephLandmark } = await import('./CephMgmt_updateCephLandmark');
    const app = buildApp(CephMgmt_updateCephLandmark as any, {
      user: DENTIST_USER,
      flagOn: true,
      db: makeCephDb({ landmark: aiLandmark }, captured),
      method: 'PATCH',
      path: '/:imageId/landmarks/:landmarkCode',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks/N`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x: 999, y: 888 }),
    });
    expect(res.status).toBe(200);
    const setPayloads = captured.updates;
    expect(setPayloads.length).toBeGreaterThanOrEqual(1);
    expect(setPayloads[0].source).toBe('ai_corrected');
  });

  test('confirming an ai landmark (status-only) PRESERVES source (no source in update)', async () => {
    const captured: Captured = { upserts: [], updates: [] };
    const aiLandmark = { ...MOCK_LANDMARK, source: 'ai' as const, confidence: 0.8, status: 'placed' as CephLandmarkStatus };
    const { CephMgmt_updateCephLandmark } = await import('./CephMgmt_updateCephLandmark');
    const app = buildApp(CephMgmt_updateCephLandmark as any, {
      user: DENTIST_USER,
      flagOn: true,
      db: makeCephDb({ landmark: aiLandmark }, captured),
      method: 'PATCH',
      path: '/:imageId/landmarks/:landmarkCode',
    });
    const res = await app.request(`/${IMAGE_ID}/landmarks/N`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed' }),
    });
    expect(res.status).toBe(200);
    // status-only change must NOT rewrite source (provenance preserved)
    expect(captured.updates[0].source).toBeUndefined();
    expect(captured.updates[0].status).toBe('confirmed');
  });

  test('editing coords of a manual landmark does NOT set ai_corrected', async () => {
    const captured: Captured = { upserts: [], updates: [] };
    const { CephMgmt_updateCephLandmark } = await import('./CephMgmt_updateCephLandmark');
    const app = buildApp(CephMgmt_updateCephLandmark as any, {
      user: DENTIST_USER,
      flagOn: true,
      db: makeCephDb({ landmark: { ...MOCK_LANDMARK, source: 'manual' } }, captured),
      method: 'PATCH',
      path: '/:imageId/landmarks/:landmarkCode',
    });
    await app.request(`/${IMAGE_ID}/landmarks/N`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x: 999, y: 888 }),
    });
    expect(captured.updates[0].source).toBeUndefined();
  });
});
