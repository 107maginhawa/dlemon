/**
 * dental-imaging domain-event audit-trace tests
 *
 * Per ADR-006, dental-imaging domain events are AUDIT-LOG-ONLY semantic markers — there
 * is no event bus. A "publish" is satisfied by the producer writing a synchronous
 * dental_audit_log row via logAuditEvent. A publisher test therefore:
 *   1. triggers the producing HTTP action (via app.request through the real handler), then
 *   2. asserts a dental_audit_log row exists with the expected action / targetType /
 *      targetId / actorId.
 *
 * Events covered (previously untraced — TRACE_REPORT TR-P1-04):
 *   DE-018 ImagingStudyUploaded     → action 'imaging_study.create'            / target imaging_study
 *   DE-019 ImagingFindingConfirmed  → action 'imaging_finding.confirmed'       / target imaging_finding
 *   DE-020 CephAnalysisComputed     → action 'imaging_ceph_analysis.computed'  / target imaging_ceph_analysis
 *
 * Consumer / idempotency tests are out of scope (no bus, per ADR-006).
 */

import { describe, test, expect, beforeAll, beforeEach } from 'bun:test';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { ZodError } from 'zod';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { createImagingStudy } from './createImagingStudy';
import { updateFinding } from './updateFinding';
import { recomputeCephAnalysis } from './recomputeCephAnalysis';
import { dentalAuditLog } from '@/handlers/dental-audit/repos/audit-log.schema';

const db = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgresql://postgres:password@localhost:5432/monobase_test',
});

// Stable IDs (suite tag: imgevt)
const ORG_ID = 'c1e00000-0000-4000-8000-0000000be001';
const BRANCH_ID = 'b1e00000-0000-4000-8000-0000000be001';
const DENTIST = { id: 'a1e00000-0000-4000-8000-0000000be0d1', email: 'dentist@imgevt.test' };
const PATIENT_ID = 'd1e00000-0000-4000-8000-0000000be0f5';

const storage = {
  generateUploadUrl: async (_fileId: string, _mime: string) =>
    'https://storage.example.com/presigned-upload-url',
} as any;

function buildTestApp(user?: { id: string; email: string }) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    if (err instanceof ZodError || (err as Error).name === 'ZodError') {
      return c.json({ error: 'Validation failed', code: 'VALIDATION_ERROR' }, 400);
    }
    return c.json({ error: String((err as Error).message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('storage', storage);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    if (user) ctx.set('user', user);
    await next();
  });
  app.post('/dental/imaging/studies', createImagingStudy as any);
  app.patch('/dental/imaging/findings/:findingId', updateFinding as any);
  app.post('/dental/imaging/images/:imageId/ceph/analysis/recompute', recomputeCephAnalysis as any);
  return app;
}

const json = (body: unknown) => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

async function seedOrgAndMember() {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Imaging Events Clinic', tier: 'clinic',
    ownerPersonId: DENTIST.id, countryCode: 'PH', imagingTier: 'addon',
    createdBy: DENTIST.id, updatedBy: DENTIST.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main', timezone: 'Asia/Manila',
    createdBy: DENTIST.id, updatedBy: DENTIST.id,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: 'aaef0000-0000-4000-8000-0000000be0d1', branchId: BRANCH_ID, personId: DENTIST.id,
    displayName: 'Owner Dentist', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, createdBy: DENTIST.id, updatedBy: DENTIST.id,
  }).onConflictDoNothing();
}

/** Seed a study + image (+ stored_file) with optional calibration. */
async function seedStudyWithImage(opts: { modality?: string; pixelSpacingMm?: number | null } = {}): Promise<{ studyId: string; imageId: string }> {
  const { imagingStudies, imagingStudyImages } = await import('./repos/imaging.schema');
  const { storedFiles } = await import('@/handlers/storage/repos/file.schema');

  const studyId = uuidv4();
  const imageId = uuidv4();
  const fileId = uuidv4();
  const modality = (opts.modality ?? 'periapical') as any;

  await db.insert(storedFiles).values({
    id: fileId, filename: 'xray.png', mimeType: 'image/png', size: 204800,
    status: 'available', owner: DENTIST.id, createdBy: DENTIST.id, updatedBy: DENTIST.id,
  });
  await db.insert(imagingStudies).values({
    id: studyId, patientId: PATIENT_ID, visitId: null, branchId: BRANCH_ID, acquiredBy: DENTIST.id,
    modality, status: 'active', createdBy: DENTIST.id, updatedBy: DENTIST.id,
  });
  await db.insert(imagingStudyImages).values({
    id: imageId, studyId, fileId, modality, sequenceNumber: 0,
    pixelSpacingMm: opts.pixelSpacingMm ?? null,
    dicomMetadata: { fileName: 'xray.png', mimeType: 'image/png' },
    status: 'active', createdBy: DENTIST.id, updatedBy: DENTIST.id,
  });
  return { studyId, imageId };
}

async function seedFinding(imageId: string, status: 'draft' | 'confirmed' = 'draft'): Promise<string> {
  const { imagingFindings } = await import('./repos/imaging_finding.schema');
  const id = uuidv4();
  await db.insert(imagingFindings).values({
    id, imageId, annotationId: null, treatmentId: null, visitId: null,
    patientId: PATIENT_ID, branchId: BRANCH_ID, type: 'caries', status,
    toothNumber: 14, surfaces: ['occlusal'], note: null,
    createdBy: DENTIST.id, updatedBy: DENTIST.id,
  });
  return id;
}

async function seedLandmark(imageId: string, code: string, x: number, y: number) {
  const { imagingCephLandmarks } = await import('./repos/imaging_ceph.schema');
  await db.insert(imagingCephLandmarks).values({
    id: uuidv4(), imageId, landmarkCode: code, x, y, source: 'manual', status: 'placed',
    createdBy: DENTIST.id, updatedBy: DENTIST.id,
  });
}

async function auditRows(action: string, targetId: string) {
  return db.select().from(dentalAuditLog)
    .where(and(eq(dentalAuditLog.action, action), eq(dentalAuditLog.targetId, targetId)));
}

beforeAll(async () => {
  await seedOrgAndMember();
});

beforeEach(async () => {
  const { imagingStudies, imagingStudyImages, imagingStudyTeeth, imagingAnnotations } =
    await import('./repos/imaging.schema');
  const { imagingFindings } = await import('./repos/imaging_finding.schema');
  const { imagingCephLandmarks, imagingCephAnalyses } = await import('./repos/imaging_ceph.schema');
  await db.delete(imagingFindings);
  await db.delete(imagingCephAnalyses);
  await db.delete(imagingCephLandmarks);
  await db.delete(imagingAnnotations);
  await db.delete(imagingStudyTeeth);
  await db.delete(imagingStudyImages);
  await db.delete(imagingStudies);
  // dental_audit_log is append-only (DB trigger denies row UPDATE/DELETE, V-AUD-IMM-001).
  // Reset via table-level TRUNCATE, which the BEFORE ROW trigger does not block.
  await db.execute((await import('drizzle-orm')).sql`TRUNCATE TABLE dental_audit_log`);
});

// ---------------------------------------------------------------------------
// DE-018 ImagingStudyUploaded
// ---------------------------------------------------------------------------

describe('DE-018 ImagingStudyUploaded — audit-row marker on study create', () => {
  test('writes a dental_audit_log row (imaging_study.create) referencing the new study', async () => {
    const app = buildTestApp(DENTIST);
    const res = await app.request('/dental/imaging/studies', {
      method: 'POST',
      ...json({
        patientId: PATIENT_ID, branchId: BRANCH_ID, modality: 'panoramic',
        filename: 'pano.png', mimeType: 'image/png', size: 51200,
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;

    const rows = await auditRows('imaging_study.create', body.study.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.targetType).toBe('imaging_study');
    expect(rows[0]?.actorId).toBe(DENTIST.id);
    expect(rows[0]?.branchId).toBe(BRANCH_ID);
  });

  test('does NOT write an imaging_study.create row when create fails (unsupported MIME)', async () => {
    const app = buildTestApp(DENTIST);
    const res = await app.request('/dental/imaging/studies', {
      method: 'POST',
      ...json({
        patientId: PATIENT_ID, branchId: BRANCH_ID, modality: 'panoramic',
        filename: 'bad.exe', mimeType: 'application/x-msdownload', size: 10,
      }),
    });
    expect(res.status).toBe(422);
    const rows = await db.select().from(dentalAuditLog)
      .where(and(eq(dentalAuditLog.action, 'imaging_study.create'), eq(dentalAuditLog.branchId, BRANCH_ID)));
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// DE-019 ImagingFindingConfirmed
// ---------------------------------------------------------------------------

describe('DE-019 ImagingFindingConfirmed — audit-row marker only on draft→confirmed', () => {
  test('writes a dental_audit_log row (imaging_finding.confirmed) on a draft→confirmed transition', async () => {
    const app = buildTestApp(DENTIST);
    const { imageId } = await seedStudyWithImage();
    const findingId = await seedFinding(imageId, 'draft');

    const res = await app.request(`/dental/imaging/findings/${findingId}`, {
      method: 'PATCH',
      ...json({ status: 'confirmed' }),
    });
    expect(res.status).toBe(200);

    const rows = await auditRows('imaging_finding.confirmed', findingId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.targetType).toBe('imaging_finding');
    expect(rows[0]?.actorId).toBe(DENTIST.id);
  });

  test('writes imaging_finding.update (NOT .confirmed) for a non-confirm edit', async () => {
    const app = buildTestApp(DENTIST);
    const { imageId } = await seedStudyWithImage();
    const findingId = await seedFinding(imageId, 'draft');

    const res = await app.request(`/dental/imaging/findings/${findingId}`, {
      method: 'PATCH',
      ...json({ note: 'updated note' }),
    });
    expect(res.status).toBe(200);

    expect(await auditRows('imaging_finding.confirmed', findingId)).toHaveLength(0);
    expect(await auditRows('imaging_finding.update', findingId)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// DE-020 CephAnalysisComputed
// ---------------------------------------------------------------------------

describe('DE-020 CephAnalysisComputed — audit-row marker on ceph recompute', () => {
  test('writes a dental_audit_log row (imaging_ceph_analysis.computed) on a successful recompute', async () => {
    const app = buildTestApp(DENTIST);
    // Calibrated image + the two required reference landmarks (S, N).
    const { imageId } = await seedStudyWithImage({ modality: 'cephalometric', pixelSpacingMm: 0.1 });
    await seedLandmark(imageId, 'S', 100, 100);
    await seedLandmark(imageId, 'N', 200, 100);

    const res = await app.request(`/dental/imaging/images/${imageId}/ceph/analysis/recompute`, {
      method: 'POST',
      ...json({}),
    });
    expect(res.status).toBe(200);

    const rows = await auditRows('imaging_ceph_analysis.computed', imageId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.targetType).toBe('imaging_ceph_analysis');
    expect(rows[0]?.actorId).toBe(DENTIST.id);
  });

  test('does NOT write the computed row when recompute fails (missing S/N landmarks)', async () => {
    const app = buildTestApp(DENTIST);
    const { imageId } = await seedStudyWithImage({ modality: 'cephalometric', pixelSpacingMm: 0.1 });
    // No landmarks placed → INSUFFICIENT_LANDMARKS (422)

    const res = await app.request(`/dental/imaging/images/${imageId}/ceph/analysis/recompute`, {
      method: 'POST',
      ...json({}),
    });
    expect(res.status).toBe(422);
    expect(await auditRows('imaging_ceph_analysis.computed', imageId)).toHaveLength(0);
  });
});
