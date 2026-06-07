/**
 * imaging-integration.test.ts — real-DB integration tests for the non-ceph
 * dental-imaging handlers.
 *
 * Unlike imaging.test.ts / imaging-coverage.test.ts (which use duck-typed mock
 * Drizzle objects), this suite runs every handler against a real Postgres clone
 * (per-file, via scripts/test-with-db.ts) with real repos, real branch-role /
 * tier gates and real audit-log writes. This catches wiring/repo bugs the mock
 * suites cannot (see MEMORY: "Tests must verify real wiring").
 *
 * Covered handlers (non-ceph):
 *   createImagingStudy, getImagingStudy, listPatientImages,
 *   createFinding, updateFinding, listFindings, deleteFinding,
 *   createMeasurement, listMeasurements, deleteMeasurement,
 *   deleteImage, updateImageCalibration, updateImageModality.
 *
 * Each endpoint asserts: status code + body shape + key field values, plus at
 * least one error / deny path (401 / 403 / 404 / 422).
 *
 * REQUIRES: DATABASE_URL pointing at a monobase_test* database.
 */

import { describe, test, expect, beforeEach, beforeAll } from 'bun:test';
import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { ZodError } from 'zod';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';

import { createImagingStudy } from './createImagingStudy';
import { getImagingStudy } from './getImagingStudy';
import { listPatientImages } from './listPatientImages';
import { createFinding } from './createFinding';
import { updateFinding } from './updateFinding';
import { listFindings } from './listFindings';
import { deleteFinding } from './deleteFinding';
import { createMeasurement } from './createMeasurement';
import { listMeasurements } from './listMeasurements';
import { deleteMeasurement } from './deleteMeasurement';
import { deleteImage } from './deleteImage';
import { updateImageCalibration } from './updateImageCalibration';
import { updateImageModality } from './updateImageModality';
import { finalizeCbctStudy } from './finalizeCbctStudy';
import { getCbctViewerLink } from './getCbctViewerLink';
import { buildSyntheticDicom } from './repos/dicom-fixture';

const db = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgresql://postgres:password@localhost:5432/monobase_test',
});

// ---------------------------------------------------------------------------
// Stable IDs (suite tag: imgint)
// ---------------------------------------------------------------------------

const ORG_ID = 'c1a00000-0000-4000-8000-000000000001';
const BRANCH_ID = 'b1a00000-0000-4000-8000-000000000001';
const FREE_ORG_ID = 'c1a00000-0000-4000-8000-000000000002';
const FREE_BRANCH_ID = 'b1a00000-0000-4000-8000-000000000002';
const OTHER_BRANCH_ID = 'b1a00000-0000-4000-8000-000000000003';

// Members
const DENTIST = { id: 'a1a00000-0000-4000-8000-0000000000d1', email: 'dentist@imgint.test' };
const ASSOCIATE = { id: 'a1a00000-0000-4000-8000-0000000000a2', email: 'assoc@imgint.test' };
const HYGIENIST = { id: 'a1a00000-0000-4000-8000-0000000000c3', email: 'hyg@imgint.test' };
const OUTSIDER = { id: 'a1a00000-0000-4000-8000-0000000000e4', email: 'outsider@imgint.test' };

const PATIENT_ID = 'd1a00000-0000-4000-8000-0000000000f5';

// ---------------------------------------------------------------------------
// Fake storage provider (createImagingStudy needs generateUploadUrl)
// ---------------------------------------------------------------------------

const storage = {
  generateUploadUrl: async (_fileId: string, _mime: string) =>
    'https://storage.example.com/presigned-upload-url',
  generateDownloadUrl: async (fileId: string) =>
    `https://storage.example.com/presigned-get/${fileId}`,
  initiateMultipartUpload: async (_fileId: string, _filename: string, _mime: string) =>
    'test-upload-id',
  generatePartUploadUrl: async (_fileId: string, _uploadId: string, partNumber: number) =>
    `https://storage.example.com/presigned-part/${partNumber}`,
  completeMultipartUpload: async () => undefined,
  abortMultipartUpload: async () => undefined,
} as any;

// ---------------------------------------------------------------------------
// App builder — wires real db + the requested handler
// ---------------------------------------------------------------------------

function buildTestApp(user?: { id: string; email: string }) {
  const app = new Hono();

  // Mirror the production error contract (src/core/errors.ts): AppError uses its
  // own statusCode/code; a raw ZodError (from handler-level .parse()) → 400.
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
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
  app.get('/dental/imaging/studies/:studyId', getImagingStudy as any);
  app.get('/dental/patients/:patientId/images', listPatientImages as any);

  app.post('/dental/imaging/images/:imageId/findings', createFinding as any);
  app.get('/dental/imaging/images/:imageId/findings', listFindings as any);
  app.patch('/dental/imaging/findings/:findingId', updateFinding as any);
  app.delete('/dental/imaging/findings/:findingId', deleteFinding as any);

  app.post('/dental/imaging/images/:imageId/measurements', createMeasurement as any);
  app.get('/dental/imaging/images/:imageId/measurements', listMeasurements as any);
  app.delete('/dental/imaging/measurements/:measurementId', deleteMeasurement as any);

  app.delete('/dental/imaging/images/:imageId', deleteImage as any);
  app.patch('/dental/imaging/images/:imageId/calibration', updateImageCalibration as any);
  app.patch('/dental/imaging/images/:imageId/modality', updateImageModality as any);

  // P2-7 CBCT
  app.post('/dental/imaging/studies/:studyId/cbct/finalize', finalizeCbctStudy as any);
  app.get('/dental/imaging/studies/:studyId/cbct/viewer-link', getCbctViewerLink as any);

  return app;
}

const json = (body: unknown) => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

// ---------------------------------------------------------------------------
// Seed: two orgs (addon + free), three branches, members + roles.
// Per-row cleanup of imaging data happens in beforeEach; org/branch/members
// are seeded once and reused (they are not truncated by this file).
// ---------------------------------------------------------------------------

async function seedOrgsAndMembers() {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');

  await db.insert(dentalOrganizations).values([
    {
      id: ORG_ID, name: 'Imaging Int Clinic', tier: 'clinic',
      ownerPersonId: DENTIST.id, countryCode: 'PH', imagingTier: 'addon',
      createdBy: DENTIST.id, updatedBy: DENTIST.id,
    },
    {
      id: FREE_ORG_ID, name: 'Imaging Int Free Clinic', tier: 'solo',
      // Distinct owner: the dental_org_one_active_per_owner invariant forbids one
      // owner holding two active solo/clinic orgs. The dentist exercises the free
      // branch via its membership below (tier-gate test, not ownership), so a
      // separate owner is the faithful seed.
      ownerPersonId: 'c1a00000-0000-4000-8000-0000000000ff', countryCode: 'PH', imagingTier: 'free',
      createdBy: DENTIST.id, updatedBy: DENTIST.id,
    },
  ]).onConflictDoNothing();

  await db.insert(dentalBranches).values([
    {
      id: BRANCH_ID, organizationId: ORG_ID, name: 'Main', timezone: 'Asia/Manila',
      createdBy: DENTIST.id, updatedBy: DENTIST.id,
    },
    {
      id: FREE_BRANCH_ID, organizationId: FREE_ORG_ID, name: 'Free Main', timezone: 'Asia/Manila',
      createdBy: DENTIST.id, updatedBy: DENTIST.id,
    },
    {
      id: OTHER_BRANCH_ID, organizationId: ORG_ID, name: 'Other', timezone: 'Asia/Manila',
      createdBy: DENTIST.id, updatedBy: DENTIST.id,
    },
  ]).onConflictDoNothing();

  // Members in the addon branch
  await db.insert(dentalMemberships).values([
    {
      id: 'aaee0000-0000-4000-8000-0000000000d1', branchId: BRANCH_ID, personId: DENTIST.id,
      displayName: 'Owner Dentist', role: 'dentist_owner', status: 'active',
      pinFailedAttempts: 0, createdBy: DENTIST.id, updatedBy: DENTIST.id,
    },
    {
      id: 'aaee0000-0000-4000-8000-0000000000a2', branchId: BRANCH_ID, personId: ASSOCIATE.id,
      displayName: 'Associate', role: 'dentist_associate', status: 'active',
      pinFailedAttempts: 0, createdBy: DENTIST.id, updatedBy: DENTIST.id,
    },
    {
      id: 'aaee0000-0000-4000-8000-0000000000c3', branchId: BRANCH_ID, personId: HYGIENIST.id,
      displayName: 'Hygienist', role: 'hygienist', status: 'active',
      pinFailedAttempts: 0, createdBy: DENTIST.id, updatedBy: DENTIST.id,
    },
    // Dentist owner also in the free branch (to test tier gate, not role gate)
    {
      id: 'aaee0000-0000-4000-8000-0000000000f1', branchId: FREE_BRANCH_ID, personId: DENTIST.id,
      displayName: 'Owner Dentist', role: 'dentist_owner', status: 'active',
      pinFailedAttempts: 0, createdBy: DENTIST.id, updatedBy: DENTIST.id,
    },
  ]).onConflictDoNothing();
}

/**
 * Seed an active study + image (+ stored_file for size) directly in the addon
 * branch and return their ids. Defaults acquiredBy=DENTIST.
 */
async function seedStudyWithImage(opts: {
  branchId?: string;
  acquiredBy?: string;
  modality?: string;
} = {}): Promise<{ studyId: string; imageId: string; fileId: string }> {
  const { imagingStudies, imagingStudyImages } = await import('./repos/imaging.schema');
  const { storedFiles } = await import('@/handlers/storage/repos/file.schema');

  const studyId = uuidv4();
  const imageId = uuidv4();
  const fileId = uuidv4();
  const branchId = opts.branchId ?? BRANCH_ID;
  const acquiredBy = opts.acquiredBy ?? DENTIST.id;
  const modality = (opts.modality ?? 'periapical') as any;

  await db.insert(storedFiles).values({
    id: fileId, filename: 'xray.png', mimeType: 'image/png', size: 204800,
    status: 'available', owner: acquiredBy, createdBy: acquiredBy, updatedBy: acquiredBy,
  });

  await db.insert(imagingStudies).values({
    id: studyId, patientId: PATIENT_ID, visitId: null, branchId, acquiredBy,
    modality, status: 'active', createdBy: acquiredBy, updatedBy: acquiredBy,
  });

  await db.insert(imagingStudyImages).values({
    id: imageId, studyId, fileId, modality, sequenceNumber: 0,
    dicomMetadata: { fileName: 'xray.png', mimeType: 'image/png' },
    status: 'active', createdBy: acquiredBy, updatedBy: acquiredBy,
  });

  return { studyId, imageId, fileId };
}

async function seedFinding(imageId: string, status: 'draft' | 'confirmed' | 'resolved' = 'draft'): Promise<string> {
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

async function seedAnnotation(imageId: string, type: 'line' | 'label' = 'line'): Promise<string> {
  const { imagingAnnotations } = await import('./repos/imaging.schema');
  const id = uuidv4();
  await db.insert(imagingAnnotations).values({
    id, imageId, type, geometry: { type: 'distance', points: [{ x: 0, y: 0 }, { x: 3, y: 4 }] },
    measurementValue: 5, measurementUnit: 'mm', toothNumber: null, visible: true,
    createdBy: DENTIST.id, updatedBy: DENTIST.id,
  });
  return id;
}

beforeAll(async () => {
  await seedOrgsAndMembers();
});

beforeEach(async () => {
  // Wipe imaging rows between tests (FK order: annotations/findings/teeth → images → studies).
  const { imagingStudies, imagingStudyImages, imagingStudyTeeth, imagingAnnotations } =
    await import('./repos/imaging.schema');
  const { imagingFindings } = await import('./repos/imaging_finding.schema');
  await db.delete(imagingFindings);
  await db.delete(imagingAnnotations);
  await db.delete(imagingStudyTeeth);
  await db.delete(imagingStudyImages);
  await db.delete(imagingStudies);
});

// =============================================================================
// createImagingStudy — POST /dental/imaging/studies
// =============================================================================

describe('createImagingStudy', () => {
  test('happy path: dentist creates study, returns 201 with study/image/uploadUrl', async () => {
    const app = buildTestApp(DENTIST);
    const res = await app.request('/dental/imaging/studies', {
      method: 'POST',
      ...json({
        patientId: PATIENT_ID, branchId: BRANCH_ID, modality: 'panoramic',
        filename: 'pano.png', mimeType: 'image/png', size: 51200, toothNumbers: [18, 19],
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.study.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.study.patientId).toBe(PATIENT_ID);
    expect(body.study.branchId).toBe(BRANCH_ID);
    expect(body.study.modality).toBe('panoramic');
    expect(body.study.acquiredBy).toBe(DENTIST.id);
    expect(body.image.studyId).toBe(body.study.id);
    expect(body.image.modality).toBe('panoramic');
    expect(body.uploadUrl).toBe('https://storage.example.com/presigned-upload-url');
    expect(body.uploadMethod).toBe('PUT');
    expect(body.fileId).toMatch(/^[0-9a-f-]{36}$/);

    // tooth links persisted: verify via getImagingStudy
    const getRes = await app.request(`/dental/imaging/studies/${body.study.id}`);
    const studyBody = (await getRes.json()) as any;
    expect(studyBody.images[0].toothNumbers.sort()).toEqual([18, 19]);
  });

  test('401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request('/dental/imaging/studies', {
      method: 'POST',
      ...json({ patientId: PATIENT_ID, branchId: BRANCH_ID, filename: 'f.png', mimeType: 'image/png', size: 1 }),
    });
    expect(res.status).toBe(401);
  });

  test('422 UNSUPPORTED_MIME_TYPE for disallowed mime', async () => {
    const app = buildTestApp(DENTIST);
    const res = await app.request('/dental/imaging/studies', {
      method: 'POST',
      ...json({ patientId: PATIENT_ID, branchId: BRANCH_ID, filename: 'doc.pdf', mimeType: 'application/pdf', size: 1 }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.code).toBe('UNSUPPORTED_MIME_TYPE');
  });

  // E2 / doc-vs-code reconciliation: imaging CAPTURE is allowed for hygienist and
  // dental_assistant (under dentist supervision), matching the handler doc-comment.
  // (CBCT *finalize* and image management — delete/calibration/modality — stay
  // dentist-only and keep their hygienist-403 tests below.)
  test('201 when caller is a hygienist (imaging capture is clinical-write)', async () => {
    const app = buildTestApp(HYGIENIST);
    const res = await app.request('/dental/imaging/studies', {
      method: 'POST',
      ...json({ patientId: PATIENT_ID, branchId: BRANCH_ID, filename: 'f.png', mimeType: 'image/png', size: 1 }),
    });
    expect(res.status).toBe(201);
  });

  test('403 when caller has no membership in the branch', async () => {
    const app = buildTestApp(OUTSIDER);
    const res = await app.request('/dental/imaging/studies', {
      method: 'POST',
      ...json({ patientId: PATIENT_ID, branchId: BRANCH_ID, filename: 'f.png', mimeType: 'image/png', size: 1 }),
    });
    expect(res.status).toBe(403);
  });

  test('403 IMAGING_TIER_REQUIRED creating cephalometric study on a free-tier org', async () => {
    const app = buildTestApp(DENTIST);
    const res = await app.request('/dental/imaging/studies', {
      method: 'POST',
      ...json({
        patientId: PATIENT_ID, branchId: FREE_BRANCH_ID, modality: 'cephalometric',
        filename: 'ceph.png', mimeType: 'image/png', size: 1,
      }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.code).toBe('IMAGING_TIER_REQUIRED');
  });
});

// =============================================================================
// getImagingStudy — GET /dental/imaging/studies/:studyId
// =============================================================================

describe('getImagingStudy', () => {
  test('happy path: returns study with images and tooth numbers', async () => {
    const { studyId, imageId } = await seedStudyWithImage();
    const { imagingStudyTeeth } = await import('./repos/imaging.schema');
    await db.insert(imagingStudyTeeth).values({ imageId, toothNumber: 30, numberingSystem: 'universal' });

    const app = buildTestApp(DENTIST);
    const res = await app.request(`/dental/imaging/studies/${studyId}`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.id).toBe(studyId);
    expect(body.patientId).toBe(PATIENT_ID);
    expect(Array.isArray(body.images)).toBe(true);
    expect(body.images).toHaveLength(1);
    expect(body.images[0].id).toBe(imageId);
    expect(body.images[0].toothNumbers).toEqual([30]);
  });

  test('hygienist (read access) can read the study', async () => {
    const { studyId } = await seedStudyWithImage();
    const app = buildTestApp(HYGIENIST);
    const res = await app.request(`/dental/imaging/studies/${studyId}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.id).toBe(studyId);
  });

  test('404 when study does not exist', async () => {
    const app = buildTestApp(DENTIST);
    const res = await app.request(`/dental/imaging/studies/${uuidv4()}`);
    expect(res.status).toBe(404);
  });

  test('403 when caller has no membership in the study branch', async () => {
    const { studyId } = await seedStudyWithImage();
    const app = buildTestApp(OUTSIDER);
    const res = await app.request(`/dental/imaging/studies/${studyId}`);
    expect(res.status).toBe(403);
  });

  test('401 when unauthenticated', async () => {
    const { studyId } = await seedStudyWithImage();
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/imaging/studies/${studyId}`);
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// listPatientImages — GET /dental/patients/:patientId/images
// =============================================================================

describe('listPatientImages', () => {
  test('happy path: returns imaging items with file size and total', async () => {
    await seedStudyWithImage();
    const app = buildTestApp(DENTIST);
    const res = await app.request(`/dental/patients/${PATIENT_ID}/images?branchId=${BRANCH_ID}`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.total).toBe(1);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].source).toBe('imaging');
    expect(body.items[0].modality).toBe('periapical');
    expect(body.items[0].fileName).toBe('xray.png');
    expect(body.items[0].fileSizeBytes).toBe(204800);
  });

  test('400 VALIDATION_ERROR when branchId query param is missing', async () => {
    await seedStudyWithImage();
    const app = buildTestApp(DENTIST);
    const res = await app.request(`/dental/patients/${PATIENT_ID}/images`);
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('403 when caller has no membership in the branch', async () => {
    await seedStudyWithImage();
    const app = buildTestApp(OUTSIDER);
    const res = await app.request(`/dental/patients/${PATIENT_ID}/images?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(403);
  });

  test('401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/patients/${PATIENT_ID}/images?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// createFinding — POST /dental/imaging/images/:imageId/findings
// =============================================================================

describe('createFinding', () => {
  test('happy path: creates finding in draft state, returns 201', async () => {
    const { imageId } = await seedStudyWithImage();
    const app = buildTestApp(DENTIST);
    const res = await app.request(`/dental/imaging/images/${imageId}/findings`, {
      method: 'POST',
      ...json({ type: 'caries', toothNumber: 14, surfaces: ['occlusal'], note: 'small lesion' }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.imageId).toBe(imageId);
    expect(body.type).toBe('caries');
    expect(body.status).toBe('draft');
    expect(body.toothNumber).toBe(14);
    expect(body.patientId).toBe(PATIENT_ID);
    expect(body.branchId).toBe(BRANCH_ID);
  });

  test('404 when image does not exist', async () => {
    const app = buildTestApp(DENTIST);
    const res = await app.request(`/dental/imaging/images/${uuidv4()}/findings`, {
      method: 'POST',
      ...json({ type: 'caries' }),
    });
    expect(res.status).toBe(404);
  });

  test('404 (not 403) when caller lacks branch role — avoids resource enumeration', async () => {
    const { imageId } = await seedStudyWithImage();
    const app = buildTestApp(HYGIENIST);
    const res = await app.request(`/dental/imaging/images/${imageId}/findings`, {
      method: 'POST',
      ...json({ type: 'caries' }),
    });
    expect(res.status).toBe(404);
  });

  test('400 VALIDATION_ERROR for invalid finding type (zod enum)', async () => {
    const { imageId } = await seedStudyWithImage();
    const app = buildTestApp(DENTIST);
    const res = await app.request(`/dental/imaging/images/${imageId}/findings`, {
      method: 'POST',
      ...json({ type: 'not_a_real_type' }),
    });
    // CreateFindingSchema.parse() throws ZodError → 400 VALIDATION_ERROR (matches production)
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('401 when unauthenticated', async () => {
    const { imageId } = await seedStudyWithImage();
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/imaging/images/${imageId}/findings`, {
      method: 'POST',
      ...json({ type: 'caries' }),
    });
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// listFindings — GET /dental/imaging/images/:imageId/findings
// =============================================================================

describe('listFindings', () => {
  test('happy path: returns findings for an image with pagination meta', async () => {
    const { imageId } = await seedStudyWithImage();
    await seedFinding(imageId, 'draft');
    await seedFinding(imageId, 'confirmed');

    const app = buildTestApp(DENTIST);
    const res = await app.request(`/dental/imaging/images/${imageId}/findings`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.pagination.totalCount).toBe(2);
    expect(body.pagination.count).toBe(2);
    expect(body.data.every((f: any) => f.imageId === imageId)).toBe(true);
  });

  test('404 when image does not exist', async () => {
    const app = buildTestApp(DENTIST);
    const res = await app.request(`/dental/imaging/images/${uuidv4()}/findings`);
    expect(res.status).toBe(404);
  });

  test('404 (masked) when caller has no branch access', async () => {
    const { imageId } = await seedStudyWithImage();
    const app = buildTestApp(OUTSIDER);
    const res = await app.request(`/dental/imaging/images/${imageId}/findings`);
    expect(res.status).toBe(404);
  });
});

// =============================================================================
// updateFinding — PATCH /dental/imaging/findings/:findingId
// =============================================================================

describe('updateFinding', () => {
  test('happy path: draft → confirmed transition, returns 200', async () => {
    const { imageId } = await seedStudyWithImage();
    const findingId = await seedFinding(imageId, 'draft');

    const app = buildTestApp(DENTIST);
    const res = await app.request(`/dental/imaging/findings/${findingId}`, {
      method: 'PATCH',
      ...json({ status: 'confirmed', note: 'verified on review' }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.id).toBe(findingId);
    expect(body.status).toBe('confirmed');
    expect(body.note).toBe('verified on review');
  });

  test('422 INVALID_STATUS_TRANSITION for confirmed → draft (no back-edge)', async () => {
    const { imageId } = await seedStudyWithImage();
    const findingId = await seedFinding(imageId, 'confirmed');

    const app = buildTestApp(DENTIST);
    const res = await app.request(`/dental/imaging/findings/${findingId}`, {
      method: 'PATCH',
      ...json({ status: 'draft' }),
    });

    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.code).toBe('INVALID_STATUS_TRANSITION');
  });

  test('404 when finding does not exist', async () => {
    const app = buildTestApp(DENTIST);
    const res = await app.request(`/dental/imaging/findings/${uuidv4()}`, {
      method: 'PATCH',
      ...json({ note: 'x' }),
    });
    expect(res.status).toBe(404);
  });

  test('404 (masked) when caller lacks branch role', async () => {
    const { imageId } = await seedStudyWithImage();
    const findingId = await seedFinding(imageId, 'draft');
    const app = buildTestApp(HYGIENIST);
    const res = await app.request(`/dental/imaging/findings/${findingId}`, {
      method: 'PATCH',
      ...json({ note: 'x' }),
    });
    expect(res.status).toBe(404);
  });
});

// =============================================================================
// deleteFinding — DELETE /dental/imaging/findings/:findingId
// =============================================================================

describe('deleteFinding', () => {
  test('happy path: deletes finding, returns 204, and it disappears from list', async () => {
    const { imageId } = await seedStudyWithImage();
    const findingId = await seedFinding(imageId, 'draft');

    const app = buildTestApp(DENTIST);
    const res = await app.request(`/dental/imaging/findings/${findingId}`, { method: 'DELETE' });
    expect(res.status).toBe(204);

    const listRes = await app.request(`/dental/imaging/images/${imageId}/findings`);
    const listBody = (await listRes.json()) as any;
    expect(listBody.data).toHaveLength(0);
  });

  test('404 when finding does not exist', async () => {
    const app = buildTestApp(DENTIST);
    const res = await app.request(`/dental/imaging/findings/${uuidv4()}`, { method: 'DELETE' });
    expect(res.status).toBe(404);
  });

  test('404 (masked) when caller lacks branch role', async () => {
    const { imageId } = await seedStudyWithImage();
    const findingId = await seedFinding(imageId, 'draft');
    const app = buildTestApp(HYGIENIST);
    const res = await app.request(`/dental/imaging/findings/${findingId}`, { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});

// =============================================================================
// createMeasurement — POST /dental/imaging/images/:imageId/measurements
// =============================================================================

describe('createMeasurement', () => {
  test('happy path: distance measurement on addon tier, returns 201', async () => {
    const { imageId } = await seedStudyWithImage();
    const app = buildTestApp(DENTIST);
    const res = await app.request(`/dental/imaging/images/${imageId}/measurements`, {
      method: 'POST',
      ...json({
        type: 'distance',
        geometry: { type: 'distance', points: [{ x: 0, y: 0 }, { x: 3, y: 4 }] },
        measurementValue: 5, measurementUnit: 'mm',
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.imageId).toBe(imageId);
    expect(body.type).toBe('line'); // distance maps to 'line'
    expect(body.visible).toBe(true);
  });

  test('annotation type (label) allowed even when tier gate would block measurements', async () => {
    // Seed a study in the FREE branch; label annotations are not tier-gated (D3).
    const { imageId } = await seedStudyWithImage({ branchId: FREE_BRANCH_ID });
    const app = buildTestApp(DENTIST);
    const res = await app.request(`/dental/imaging/images/${imageId}/measurements`, {
      method: 'POST',
      ...json({ type: 'label', geometry: { type: 'label', point: { x: 1, y: 1 }, text: 'note' } }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.type).toBe('label');
  });

  test('403 measurement type blocked on free tier', async () => {
    const { imageId } = await seedStudyWithImage({ branchId: FREE_BRANCH_ID });
    const app = buildTestApp(DENTIST);
    const res = await app.request(`/dental/imaging/images/${imageId}/measurements`, {
      method: 'POST',
      ...json({ type: 'distance', geometry: { type: 'distance', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] } }),
    });
    expect(res.status).toBe(403);
  });

  test('400 VALIDATION_ERROR invalid geometry (distance requires exactly 2 points)', async () => {
    const { imageId } = await seedStudyWithImage();
    const app = buildTestApp(DENTIST);
    const res = await app.request(`/dental/imaging/images/${imageId}/measurements`, {
      method: 'POST',
      ...json({ type: 'distance', geometry: { type: 'distance', points: [{ x: 0, y: 0 }] } }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('400 VALIDATION_ERROR unknown measurement/annotation type', async () => {
    const { imageId } = await seedStudyWithImage();
    const app = buildTestApp(DENTIST);
    const res = await app.request(`/dental/imaging/images/${imageId}/measurements`, {
      method: 'POST',
      ...json({ type: 'bogus', geometry: {} }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('404 when image does not exist', async () => {
    const app = buildTestApp(DENTIST);
    const res = await app.request(`/dental/imaging/images/${uuidv4()}/measurements`, {
      method: 'POST',
      ...json({ type: 'distance', geometry: { type: 'distance', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] } }),
    });
    expect(res.status).toBe(404);
  });
});

// =============================================================================
// listMeasurements — GET /dental/imaging/images/:imageId/measurements
// =============================================================================

describe('listMeasurements', () => {
  test('happy path: returns only measurement-type (line/angle/area) annotations', async () => {
    const { imageId } = await seedStudyWithImage();
    await seedAnnotation(imageId, 'line');
    await seedAnnotation(imageId, 'label'); // should be excluded

    const app = buildTestApp(DENTIST);
    const res = await app.request(`/dental/imaging/images/${imageId}/measurements`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].type).toBe('line');
  });

  test('404 when image does not exist', async () => {
    const app = buildTestApp(DENTIST);
    const res = await app.request(`/dental/imaging/images/${uuidv4()}/measurements`);
    expect(res.status).toBe(404);
  });

  test('403 when caller has no branch access', async () => {
    const { imageId } = await seedStudyWithImage();
    const app = buildTestApp(OUTSIDER);
    const res = await app.request(`/dental/imaging/images/${imageId}/measurements`);
    expect(res.status).toBe(403);
  });
});

// =============================================================================
// deleteMeasurement — DELETE /dental/imaging/measurements/:measurementId
// =============================================================================

describe('deleteMeasurement', () => {
  test('happy path: deletes annotation, returns 204', async () => {
    const { imageId } = await seedStudyWithImage();
    const annotationId = await seedAnnotation(imageId, 'line');

    const app = buildTestApp(DENTIST);
    const res = await app.request(`/dental/imaging/measurements/${annotationId}`, { method: 'DELETE' });
    expect(res.status).toBe(204);

    const listRes = await app.request(`/dental/imaging/images/${imageId}/measurements`);
    const listBody = (await listRes.json()) as any;
    expect(listBody.items).toHaveLength(0);
  });

  test('404 when measurement does not exist', async () => {
    const app = buildTestApp(DENTIST);
    const res = await app.request(`/dental/imaging/measurements/${uuidv4()}`, { method: 'DELETE' });
    expect(res.status).toBe(404);
  });

  test('403 when caller lacks branch role (hygienist)', async () => {
    const { imageId } = await seedStudyWithImage();
    const annotationId = await seedAnnotation(imageId, 'line');
    const app = buildTestApp(HYGIENIST);
    const res = await app.request(`/dental/imaging/measurements/${annotationId}`, { method: 'DELETE' });
    expect(res.status).toBe(403);
  });
});

// =============================================================================
// deleteImage — DELETE /dental/imaging/images/:imageId
// =============================================================================

describe('deleteImage', () => {
  test('happy path: dentist soft-deletes any image, returns 200 success', async () => {
    const { studyId, imageId } = await seedStudyWithImage();
    const app = buildTestApp(DENTIST);
    const res = await app.request(`/dental/imaging/images/${imageId}`, { method: 'DELETE' });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);

    // archived → no longer returned by listImagesByStudy (status='active' filter)
    const getRes = await app.request(`/dental/imaging/studies/${studyId}`);
    const getBody = (await getRes.json()) as any;
    expect(getBody.images).toHaveLength(0);
  });

  test('403 BR-027: associate cannot delete an image they did not acquire', async () => {
    // Study acquired by DENTIST; associate attempts delete.
    const { imageId } = await seedStudyWithImage({ acquiredBy: DENTIST.id });
    const app = buildTestApp(ASSOCIATE);
    const res = await app.request(`/dental/imaging/images/${imageId}`, { method: 'DELETE' });
    expect(res.status).toBe(403);
  });

  test('associate CAN delete an image they acquired (BR-027)', async () => {
    const { imageId } = await seedStudyWithImage({ acquiredBy: ASSOCIATE.id });
    const app = buildTestApp(ASSOCIATE);
    const res = await app.request(`/dental/imaging/images/${imageId}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
  });

  test('403 hygienist forbidden (BR-026)', async () => {
    const { imageId } = await seedStudyWithImage();
    const app = buildTestApp(HYGIENIST);
    const res = await app.request(`/dental/imaging/images/${imageId}`, { method: 'DELETE' });
    expect(res.status).toBe(403);
  });

  test('404 when image does not exist', async () => {
    const app = buildTestApp(DENTIST);
    const res = await app.request(`/dental/imaging/images/${uuidv4()}`, { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});

// =============================================================================
// updateImageCalibration — PATCH /dental/imaging/images/:imageId/calibration
// =============================================================================

describe('updateImageCalibration', () => {
  test('happy path: sets pixelSpacingMm, returns 200', async () => {
    const { imageId } = await seedStudyWithImage();
    const app = buildTestApp(DENTIST);
    const res = await app.request(`/dental/imaging/images/${imageId}/calibration`, {
      method: 'PATCH',
      ...json({ pixelSpacingMm: 0.125 }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.id).toBe(imageId);
    expect(body.pixelSpacingMm).toBeCloseTo(0.125, 4);
  });

  test('400 VALIDATION_ERROR when pixelSpacingMm is not a positive number', async () => {
    const { imageId } = await seedStudyWithImage();
    const app = buildTestApp(DENTIST);
    const res = await app.request(`/dental/imaging/images/${imageId}/calibration`, {
      method: 'PATCH',
      ...json({ pixelSpacingMm: -1 }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('404 when image does not exist', async () => {
    const app = buildTestApp(DENTIST);
    const res = await app.request(`/dental/imaging/images/${uuidv4()}/calibration`, {
      method: 'PATCH',
      ...json({ pixelSpacingMm: 0.1 }),
    });
    expect(res.status).toBe(404);
  });

  test('403 when caller lacks branch role (hygienist)', async () => {
    const { imageId } = await seedStudyWithImage();
    const app = buildTestApp(HYGIENIST);
    const res = await app.request(`/dental/imaging/images/${imageId}/calibration`, {
      method: 'PATCH',
      ...json({ pixelSpacingMm: 0.1 }),
    });
    expect(res.status).toBe(403);
  });
});

// =============================================================================
// updateImageModality — PATCH /dental/imaging/images/:imageId/modality
// =============================================================================

describe('updateImageModality', () => {
  test('happy path: reclassifies modality, returns 200', async () => {
    const { imageId } = await seedStudyWithImage({ modality: 'other' });
    const app = buildTestApp(DENTIST);
    const res = await app.request(`/dental/imaging/images/${imageId}/modality`, {
      method: 'PATCH',
      ...json({ modality: 'bitewing' }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.id).toBe(imageId);
    expect(body.modality).toBe('bitewing');
  });

  test('404 when image does not exist', async () => {
    const app = buildTestApp(DENTIST);
    const res = await app.request(`/dental/imaging/images/${uuidv4()}/modality`, {
      method: 'PATCH',
      ...json({ modality: 'bitewing' }),
    });
    expect(res.status).toBe(404);
  });

  test('403 when caller lacks branch role (hygienist)', async () => {
    const { imageId } = await seedStudyWithImage();
    const app = buildTestApp(HYGIENIST);
    const res = await app.request(`/dental/imaging/images/${imageId}/modality`, {
      method: 'PATCH',
      ...json({ modality: 'bitewing' }),
    });
    expect(res.status).toBe(403);
  });

  test('401 when unauthenticated', async () => {
    const { imageId } = await seedStudyWithImage();
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/imaging/images/${imageId}/modality`, {
      method: 'PATCH',
      ...json({ modality: 'bitewing' }),
    });
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// P2-7 CBCT — multipart create routing, finalize parse, viewer-link, tier gate,
// volume surfacing, finding frame_index. Real DB wiring.
// =============================================================================

/** Seed a CBCT study + pre-finalize image (is_volume=false) + stored_file. */
async function seedCbctStudy(opts: { branchId?: string } = {}): Promise<{ studyId: string; imageId: string; fileId: string }> {
  const { imagingStudies, imagingStudyImages } = await import('./repos/imaging.schema');
  const { storedFiles } = await import('@/handlers/storage/repos/file.schema');
  const studyId = uuidv4();
  const imageId = uuidv4();
  const fileId = uuidv4();
  const branchId = opts.branchId ?? BRANCH_ID;

  await db.insert(storedFiles).values({
    id: fileId, filename: 'cbct.dcm', mimeType: 'application/dicom', size: 50 * 1024 * 1024,
    status: 'available', owner: DENTIST.id, createdBy: DENTIST.id, updatedBy: DENTIST.id,
  });
  await db.insert(imagingStudies).values({
    id: studyId, patientId: PATIENT_ID, visitId: null, branchId, acquiredBy: DENTIST.id,
    modality: 'cbct', status: 'active', createdBy: DENTIST.id, updatedBy: DENTIST.id,
  });
  await db.insert(imagingStudyImages).values({
    id: imageId, studyId, fileId, modality: 'cbct', sequenceNumber: 0,
    dicomMetadata: { fileName: 'cbct.dcm', mimeType: 'application/dicom' },
    isVolume: false, status: 'active', createdBy: DENTIST.id, updatedBy: DENTIST.id,
  });
  return { studyId, imageId, fileId };
}

const dicomB64 = (opts?: Parameters<typeof buildSyntheticDicom>[0]) =>
  Buffer.from(buildSyntheticDicom(opts)).toString('base64');

describe('P2-7 CBCT createImagingStudy multipart routing', () => {
  test('large cbct DICOM routes to S3 multipart (uploadId + parts, not single PUT)', async () => {
    const app = buildTestApp(DENTIST);
    const res = await app.request('/dental/imaging/studies', {
      method: 'POST',
      ...json({
        patientId: PATIENT_ID, branchId: BRANCH_ID, modality: 'cbct',
        filename: 'cbct.dcm', mimeType: 'application/dicom', size: 50 * 1024 * 1024,
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.uploadMethod).toBe('MULTIPART');
    expect(body.uploadId).toBe('test-upload-id');
    expect(body.partCount).toBe(10);
    expect(Array.isArray(body.partUrls)).toBe(true);
  });

  test('free-tier branch blocked from cbct create with IMAGING_TIER_REQUIRED', async () => {
    const app = buildTestApp(DENTIST);
    const res = await app.request('/dental/imaging/studies', {
      method: 'POST',
      ...json({
        patientId: PATIENT_ID, branchId: FREE_BRANCH_ID, modality: 'cbct',
        filename: 'cbct.dcm', mimeType: 'application/dicom', size: 50 * 1024 * 1024,
      }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.code).toBe('IMAGING_TIER_REQUIRED');
  });
});

describe('P2-7 finalizeCbctStudy', () => {
  test('parses DICOM tags, sets is_volume + spacing + frameCount + UIDs + dicom_tag calibration', async () => {
    const { studyId, imageId } = await seedCbctStudy();
    const app = buildTestApp(DENTIST);
    const res = await app.request(`/dental/imaging/studies/${studyId}/cbct/finalize`, {
      method: 'POST',
      ...json({ imageId, dicomBase64: dicomB64() }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.image.isVolume).toBe(true);
    expect(body.image.frameCount).toBe(128);
    expect(body.image.sliceThicknessMm).toBeCloseTo(0.3, 4);
    expect(body.image.seriesInstanceUid).toBe('1.2.3.4.6');
    expect(body.image.studyInstanceUid).toBe('1.2.3.4.5');
    expect(body.image.pixelSpacingMm).toBeCloseTo(0.25, 4);
    expect(body.image.dicomMetadata.calibrationMethod).toBe('dicom_tag');
    expect(body.image.dicomMetadata.spacing).toEqual([0.25, 0.25, 0.3]);
  });

  test('malformed DICOM → 422 INVALID_DICOM, NO half-written volume state', async () => {
    const { studyId, imageId } = await seedCbctStudy();
    const app = buildTestApp(DENTIST);
    const junkB64 = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]).toString('base64');
    const res = await app.request(`/dental/imaging/studies/${studyId}/cbct/finalize`, {
      method: 'POST',
      ...json({ imageId, dicomBase64: junkB64 }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.code).toBe('INVALID_DICOM');

    // The image row must remain at its pre-finalize state (is_volume still false).
    const { imagingStudyImages } = await import('./repos/imaging.schema');
    const { eq } = await import('drizzle-orm');
    const [img] = await db.select().from(imagingStudyImages).where(eq(imagingStudyImages.id, imageId));
    expect(img!.isVolume).toBe(false);
    expect(img!.frameCount).toBeNull();
  });

  test('403 when caller lacks branch role (hygienist)', async () => {
    const { studyId, imageId } = await seedCbctStudy();
    const app = buildTestApp(HYGIENIST);
    const res = await app.request(`/dental/imaging/studies/${studyId}/cbct/finalize`, {
      method: 'POST',
      ...json({ imageId, dicomBase64: dicomB64() }),
    });
    expect(res.status).toBe(403);
  });

  test('404 for a study in another tenant/branch the caller cannot access', async () => {
    const { studyId, imageId } = await seedCbctStudy({ branchId: OTHER_BRANCH_ID });
    // OUTSIDER has no membership anywhere → assertBranchRole denies.
    const app = buildTestApp(OUTSIDER);
    const res = await app.request(`/dental/imaging/studies/${studyId}/cbct/finalize`, {
      method: 'POST',
      ...json({ imageId, dicomBase64: dicomB64() }),
    });
    expect([403, 404]).toContain(res.status);
  });

  test('401 when unauthenticated', async () => {
    const { studyId, imageId } = await seedCbctStudy();
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/imaging/studies/${studyId}/cbct/finalize`, {
      method: 'POST',
      ...json({ imageId, dicomBase64: dicomB64() }),
    });
    expect(res.status).toBe(401);
  });
});

describe('P2-7 getCbctViewerLink (A1 presigned download handoff)', () => {
  test('returns presigned download URL + viewerKind=download for a finalized volume', async () => {
    const { studyId, imageId } = await seedCbctStudy();
    const app = buildTestApp(DENTIST);
    // finalize first so is_volume=true
    await app.request(`/dental/imaging/studies/${studyId}/cbct/finalize`, {
      method: 'POST', ...json({ imageId, dicomBase64: dicomB64() }),
    });
    const res = await app.request(`/dental/imaging/studies/${studyId}/cbct/viewer-link`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.viewerKind).toBe('download');
    expect(body.downloadUrl).toMatch(/^https:\/\//);
    expect(body.isVolume).toBe(true);
    expect(body.frameCount).toBe(128);
  });

  test('422 NOT_A_VOLUME for a non-finalized (flat) study', async () => {
    const { studyId } = await seedCbctStudy();
    const app = buildTestApp(DENTIST);
    const res = await app.request(`/dental/imaging/studies/${studyId}/cbct/viewer-link`);
    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.code).toBe('NOT_A_VOLUME');
  });

  test('401 when unauthenticated', async () => {
    const { studyId } = await seedCbctStudy();
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/imaging/studies/${studyId}/cbct/viewer-link`);
    expect(res.status).toBe(401);
  });
});

describe('P2-7 volume surfacing + finding frame_index', () => {
  test('getImagingStudy surfaces viewerKind=volume after finalize', async () => {
    const { studyId, imageId } = await seedCbctStudy();
    const app = buildTestApp(DENTIST);
    await app.request(`/dental/imaging/studies/${studyId}/cbct/finalize`, {
      method: 'POST', ...json({ imageId, dicomBase64: dicomB64() }),
    });
    const res = await app.request(`/dental/imaging/studies/${studyId}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.images[0].viewerKind).toBe('volume');
    expect(body.images[0].isVolume).toBe(true);
  });

  test('listPatientImages surfaces isVolume/frameCount/viewerKind', async () => {
    const { studyId, imageId } = await seedCbctStudy();
    const app = buildTestApp(DENTIST);
    await app.request(`/dental/imaging/studies/${studyId}/cbct/finalize`, {
      method: 'POST', ...json({ imageId, dicomBase64: dicomB64() }),
    });
    const res = await app.request(`/dental/patients/${PATIENT_ID}/images?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    const item = body.items.find((i: any) => i.studyId === studyId);
    expect(item).toBeDefined();
    expect(item.isVolume).toBe(true);
    expect(item.frameCount).toBe(128);
    expect(item.viewerKind).toBe('volume');
  });

  test('createFinding persists frame_index on a CBCT volume finding', async () => {
    const { studyId, imageId } = await seedCbctStudy();
    const app = buildTestApp(DENTIST);
    await app.request(`/dental/imaging/studies/${studyId}/cbct/finalize`, {
      method: 'POST', ...json({ imageId, dicomBase64: dicomB64() }),
    });
    const res = await app.request(`/dental/imaging/images/${imageId}/findings`, {
      method: 'POST',
      ...json({
        type: 'periapical_lesion', toothNumber: 36,
        visitId: uuidv4(), patientId: PATIENT_ID, branchId: BRANCH_ID,
        frameIndex: 64,
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.frameIndex).toBe(64);
  });
});
