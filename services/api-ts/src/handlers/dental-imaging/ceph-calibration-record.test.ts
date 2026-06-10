/**
 * ceph-calibration-record.test.ts — G6 real-DB owner
 *
 * Gap 6 (versioned calibration record): a 2-point ruler calibration is persisted
 * as a first-class, append-only VERSIONED record (the two image-space points +
 * the known real-world distance), not just the single derived pixelSpacingMm.
 * A finalized ceph report then pins the LATEST calibration version so the trace
 * is reproducible against the exact calibration it used (couples with G2).
 *
 * These assertions exercise the REAL updateImageCalibration → createSnapshotVersion
 * sequencing + the new imaging_calibration table + the report-snapshot threading
 * against a cloned DB; the mock harness in ceph.test.ts cannot fake the
 * monotonic version lookup faithfully.
 *
 * Covers:
 *   - PATCH with pointA/pointB/knownDistanceMm → 200, pixelSpacingMm derived server-side
 *   - report snapshot pins point_a/point_b/known_distance_mm/record_version (=1)
 *   - re-calibration mints version 2; report pins the LATEST
 *   - PATCH without points (pre-G6 back-compat) → no record; report point_a = null
 *   - invalid ruler inputs (coincident points / non-positive distance / partial) → 400
 */

import { describe, test, expect, beforeAll, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { updateImageCalibration } from './updateImageCalibration';
import { createCephReport } from './createCephReport';

const db = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgresql://postgres:password@localhost:5432/monobase_test',
});

// Stable IDs (suite tag: cephcal)
const ORG_ID = 'c3c00000-0000-4000-8000-000000000001';
const BRANCH_ID = 'b3c00000-0000-4000-8000-000000000001';
const DENTIST = { id: 'a3c00000-0000-4000-8000-0000000000d1', email: 'dentist@cephcal.test' };
const PATIENT_ID = 'd3c00000-0000-4000-8000-0000000000f5';

function buildApp(user?: { id: string; email: string }) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
    return c.json({ error: String((err as Error).message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    if (user) ctx.set('user', user);
    await next();
  });
  app.patch('/dental/imaging/images/:imageId/calibration', updateImageCalibration as any);
  app.post('/dental/imaging/images/:imageId/ceph/reports', createCephReport as any);
  return app;
}

const json = (body: unknown) => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

async function seedOrg() {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Ceph Cal Clinic', tier: 'clinic',
    ownerPersonId: DENTIST.id, countryCode: 'PH', imagingTier: 'addon',
    createdBy: DENTIST.id, updatedBy: DENTIST.id,
  }).onConflictDoNothing();

  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main', timezone: 'Asia/Manila',
    createdBy: DENTIST.id, updatedBy: DENTIST.id,
  }).onConflictDoNothing();

  await db.insert(dentalMemberships).values({
    id: 'aac30000-0000-4000-8000-0000000000d1', branchId: BRANCH_ID, personId: DENTIST.id,
    displayName: 'Owner Dentist', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, createdBy: DENTIST.id, updatedBy: DENTIST.id,
  }).onConflictDoNothing();
}

/** Seed a study + UNCALIBRATED image and return the imageId. */
async function seedImage(): Promise<string> {
  const { imagingStudies, imagingStudyImages } = await import('./repos/imaging.schema');
  const { storedFiles } = await import('@/handlers/storage/repos/file.schema');
  const studyId = uuidv4();
  const imageId = uuidv4();
  const fileId = uuidv4();

  await db.insert(storedFiles).values({
    id: fileId, filename: 'ceph.png', mimeType: 'image/png', size: 204800,
    status: 'available', owner: DENTIST.id, createdBy: DENTIST.id, updatedBy: DENTIST.id,
  });
  await db.insert(imagingStudies).values({
    id: studyId, patientId: PATIENT_ID, visitId: null, branchId: BRANCH_ID, acquiredBy: DENTIST.id,
    modality: 'cephalometric', status: 'active', createdBy: DENTIST.id, updatedBy: DENTIST.id,
  });
  await db.insert(imagingStudyImages).values({
    id: imageId, studyId, fileId, modality: 'cephalometric', sequenceNumber: 0,
    pixelSpacingMm: null, dicomMetadata: { fileName: 'ceph.png', mimeType: 'image/png' },
    status: 'active', createdBy: DENTIST.id, updatedBy: DENTIST.id,
  });
  return imageId;
}

/** Seed the D-L gate landmarks (A, B, Go, Po) as 'confirmed' so report-create passes. */
async function seedGateLandmarks(imageId: string) {
  const { imagingCephLandmarks } = await import('./repos/imaging_ceph.schema');
  const coords: Record<string, { x: number; y: number }> = {
    A: { x: 300, y: 400 }, B: { x: 310, y: 520 }, Go: { x: 180, y: 560 }, Po: { x: 120, y: 360 },
  };
  await db.insert(imagingCephLandmarks).values(
    (['A', 'B', 'Go', 'Po'] as const).map((code) => ({
      imageId, landmarkCode: code, x: coords[code]!.x, y: coords[code]!.y,
      source: 'manual' as const, status: 'confirmed' as const,
      createdBy: DENTIST.id, updatedBy: DENTIST.id,
    })),
  );
}

const patch = (app: Hono, imageId: string, body: unknown) =>
  app.request(`/dental/imaging/images/${imageId}/calibration`, { method: 'PATCH', ...json(body) });
const report = (app: Hono, imageId: string, body: unknown = {}) =>
  app.request(`/dental/imaging/images/${imageId}/ceph/reports`, { method: 'POST', ...json(body) });

beforeAll(async () => {
  await seedOrg();
});

describe('G6 versioned calibration record', () => {
  let imageId: string;

  beforeEach(async () => {
    imageId = await seedImage();
    await seedGateLandmarks(imageId);
  });

  test('PATCH with 2 ruler points derives pixelSpacingMm server-side', async () => {
    const app = buildApp(DENTIST);
    const res = await patch(app, imageId, {
      pixelSpacingMm: 0.2, // client-sent value is IGNORED in favour of the derived one
      pointA: { x: 0, y: 0 },
      pointB: { x: 100, y: 0 },
      knownDistanceMm: 20,
    });
    expect(res.status).toBe(200);
    const img = (await res.json()) as any;
    // 20 mm / 100 px = 0.2 mm/px
    expect(img.pixelSpacingMm).toBeCloseTo(0.2, 5);
  });

  test('report snapshot pins the calibration record (points + known distance + version)', async () => {
    const app = buildApp(DENTIST);
    await patch(app, imageId, {
      pixelSpacingMm: 0.2, pointA: { x: 0, y: 0 }, pointB: { x: 100, y: 0 }, knownDistanceMm: 20,
    });
    const res = await report(app, imageId);
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    const cal = body.snapshot.calibration;
    expect(cal.point_a).toEqual({ x: 0, y: 0 });
    expect(cal.point_b).toEqual({ x: 100, y: 0 });
    expect(cal.known_distance_mm).toBeCloseTo(20, 5);
    expect(cal.record_version).toBe(1);
    expect(cal.method).toBe('manual_ruler');
    expect(cal.value).toBeCloseTo(0.2, 5);
  });

  test('re-calibration mints version 2; report pins the LATEST', async () => {
    const app = buildApp(DENTIST);
    await patch(app, imageId, {
      pixelSpacingMm: 0.2, pointA: { x: 0, y: 0 }, pointB: { x: 100, y: 0 }, knownDistanceMm: 20,
    });
    // second calibration: 20 mm / 50 px = 0.4 mm/px
    await patch(app, imageId, {
      pixelSpacingMm: 0.4, pointA: { x: 0, y: 0 }, pointB: { x: 50, y: 0 }, knownDistanceMm: 20,
    });
    const res = await report(app, imageId);
    const body = (await res.json()) as any;
    const cal = body.snapshot.calibration;
    expect(cal.record_version).toBe(2);
    expect(cal.point_b).toEqual({ x: 50, y: 0 });
    expect(cal.value).toBeCloseTo(0.4, 5);
  });

  test('PATCH without ruler points (pre-G6 back-compat) creates no record', async () => {
    const app = buildApp(DENTIST);
    const res = await patch(app, imageId, { pixelSpacingMm: 0.25 });
    expect(res.status).toBe(200);
    const img = (await res.json()) as any;
    expect(img.pixelSpacingMm).toBeCloseTo(0.25, 5);

    const rep = await report(app, imageId);
    const cal = ((await rep.json()) as any).snapshot.calibration;
    expect(cal.point_a).toBeNull();
    expect(cal.point_b).toBeNull();
    expect(cal.known_distance_mm).toBeNull();
    expect(cal.record_version).toBeNull();
    // pixelSpacingMm still mirrored → value + method present
    expect(cal.value).toBeCloseTo(0.25, 5);
    expect(cal.method).toBe('manual_ruler');
  });

  test('coincident ruler points (zero pixel distance) → 400', async () => {
    const app = buildApp(DENTIST);
    const res = await patch(app, imageId, {
      pixelSpacingMm: 0.2, pointA: { x: 10, y: 10 }, pointB: { x: 10, y: 10 }, knownDistanceMm: 20,
    });
    expect(res.status).toBe(400);
  });

  test('non-positive knownDistanceMm → 400', async () => {
    const app = buildApp(DENTIST);
    const res = await patch(app, imageId, {
      pixelSpacingMm: 0.2, pointA: { x: 0, y: 0 }, pointB: { x: 100, y: 0 }, knownDistanceMm: 0,
    });
    expect(res.status).toBe(400);
  });

  test('partial ruler input (pointA without pointB) → 400', async () => {
    const app = buildApp(DENTIST);
    const res = await patch(app, imageId, {
      pixelSpacingMm: 0.2, pointA: { x: 0, y: 0 }, knownDistanceMm: 20,
    });
    expect(res.status).toBe(400);
  });
});
