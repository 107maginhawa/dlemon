/**
 * imaging-capture-date.test.ts — §capture-date real-DB owner
 *
 * Images gain a `capturedAt` (acquisition date, distinct from createdAt/upload
 * time) + `capturedAtSource` provenance. These assertions exercise the REAL
 * createImagingStudy + updateImageMetadata handlers and listPatientImages sort
 * against a cloned DB.
 *
 * Covers:
 *   - create: no capturedAt → defaults to upload time, source 'defaulted_upload'
 *   - create: explicit capturedAt + source (e.g. DICOM) is persisted
 *   - create: a future capturedAt → 422
 *   - PATCH metadata: capturedAt correction → 200, stamped source 'manual', audited
 *   - PATCH metadata: a future capturedAt → 422
 *   - list: sorts by capturedAt DESC (taken-earlier-but-uploaded-later sorts by capture)
 */

import { describe, test, expect, beforeAll, beforeEach } from 'bun:test';
import { and, eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { createDatabase } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';
import { dentalAuditLog } from '@/handlers/dental-audit/repos/audit-log.schema';
import type { PatientImageItem } from './listPatientImages';

const db = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgresql://postgres:password@localhost:5432/monobase_test',
});

// Stable IDs (suite tag: imgcap)
const ORG_ID = 'c6d00000-0000-4000-8000-000000000001';
const BRANCH_ID = 'b6d00000-0000-4000-8000-000000000001';
const DENTIST = { id: 'a6d00000-0000-4000-8000-0000000000d1', email: 'dentist@imgcap.test' };
const PATIENT_ID = 'd6d00000-0000-4000-8000-0000000000f5';

// Fake storage — createImagingStudy needs generateUploadUrl; listPatientImages
// needs generateDownloadUrl (both read ctx.get('storage')).
const storage = {
  generateUploadUrl: async (_fileId: string, _mime: string) => 'https://storage.example.com/presigned-upload-url',
  generateDownloadUrl: async (fileId: string) => `https://storage.example.com/presigned-get/${fileId}`,
} as any;

function buildApp(user?: { id: string; email: string }) {
  return buildTestApp({ db, user: user ?? null, services: { storage } });
}

const json = (body: unknown) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

async function seedOrg() {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Img Cap Clinic', tier: 'clinic', ownerPersonId: DENTIST.id,
    countryCode: 'PH', imagingTier: 'addon', createdBy: DENTIST.id, updatedBy: DENTIST.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main', timezone: 'Asia/Manila',
    createdBy: DENTIST.id, updatedBy: DENTIST.id,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: 'aac60000-0000-4000-8000-0000000000d1', branchId: BRANCH_ID, personId: DENTIST.id,
    displayName: 'Owner Dentist', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, createdBy: DENTIST.id, updatedBy: DENTIST.id,
  }).onConflictDoNothing();
}

/** Seed one study + image directly; returns imageId. `overrides` apply to the image row. */
async function seedImage(overrides: Record<string, unknown> = {}): Promise<string> {
  const { imagingStudies, imagingStudyImages } = await import('./repos/imaging.schema');
  const { storedFiles } = await import('@/handlers/storage/repos/file.schema');
  const studyId = uuidv4();
  const imageId = uuidv4();
  const fileId = uuidv4();
  await db.insert(storedFiles).values({
    id: fileId, filename: 'pa.png', mimeType: 'image/png', size: 102400,
    status: 'available', owner: DENTIST.id, createdBy: DENTIST.id, updatedBy: DENTIST.id,
  });
  await db.insert(imagingStudies).values({
    id: studyId, patientId: PATIENT_ID, visitId: null, branchId: BRANCH_ID, acquiredBy: DENTIST.id,
    modality: 'periapical', status: 'active', createdBy: DENTIST.id, updatedBy: DENTIST.id,
  });
  await db.insert(imagingStudyImages).values({
    id: imageId, studyId, fileId, modality: 'periapical', sequenceNumber: 0,
    dicomMetadata: { fileName: 'pa.png', mimeType: 'image/png' },
    status: 'active', createdBy: DENTIST.id, updatedBy: DENTIST.id, ...overrides,
  });
  return imageId;
}

const createStudy = (app: ReturnType<typeof buildTestApp>, body: unknown) =>
  app.request('/dental/imaging/studies', { method: 'POST', ...json(body) });
const patchMeta = (app: ReturnType<typeof buildTestApp>, imageId: string, body: unknown) =>
  app.request(`/dental/imaging/images/${imageId}/metadata`, { method: 'PATCH', ...json(body) });
const listImages = (app: ReturnType<typeof buildTestApp>, query = '') =>
  app.request(`/dental/patients/${PATIENT_ID}/images?branchId=${BRANCH_ID}${query}`, { method: 'GET' });

const baseBody = { patientId: PATIENT_ID, branchId: BRANCH_ID, modality: 'periapical', filename: 'pa.png', mimeType: 'image/png', size: 102400 };

beforeAll(async () => { await seedOrg(); });

beforeEach(async () => {
  // Child→parent FK order. Ceph snapshot rows + findings reference
  // imaging_study_image, so they MUST be cleared before the images.
  const { imagingStudies, imagingStudyImages, imagingStudyTeeth, imagingAnnotations, imagingCalibrations, imagingLinks } =
    await import('./repos/imaging.schema');
  const { imagingFindings } = await import('./repos/imaging_finding.schema');
  const { imagingCephSuperimpositions, imagingCephReports, imagingCephAnalyses, imagingCephLandmarks } =
    await import('./repos/imaging_ceph.schema');
  await db.delete(imagingCephSuperimpositions);
  await db.delete(imagingCephReports);
  await db.delete(imagingCephAnalyses);
  await db.delete(imagingCephLandmarks);
  await db.delete(imagingFindings);
  await db.delete(imagingAnnotations);
  await db.delete(imagingStudyTeeth);
  await db.delete(imagingCalibrations);
  await db.delete(imagingLinks);
  await db.delete(imagingStudyImages);
  await db.delete(imagingStudies);
});

describe('§capture-date — createImagingStudy', () => {
  test('no capturedAt → defaults to upload time with source defaulted_upload', async () => {
    const app = buildApp(DENTIST);
    const res = await createStudy(app, baseBody);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { image: { capturedAt: string | null; capturedAtSource: string | null; createdAt: string } };
    expect(body.image.capturedAtSource).toBe('defaulted_upload');
    expect(body.image.capturedAt).not.toBeNull();
    // Default equals the upload moment (within a few seconds).
    const delta = Math.abs(new Date(body.image.capturedAt!).getTime() - Date.now());
    expect(delta).toBeLessThan(10_000);
  });

  test('explicit capturedAt + DICOM source is persisted verbatim', async () => {
    const app = buildApp(DENTIST);
    const captured = '2026-05-01T09:30:00.000Z';
    const res = await createStudy(app, { ...baseBody, capturedAt: captured, capturedAtSource: 'dicom_tag' });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { image: { capturedAt: string; capturedAtSource: string } };
    expect(new Date(body.image.capturedAt).toISOString()).toBe(captured);
    expect(body.image.capturedAtSource).toBe('dicom_tag');
  });

  test('a future capturedAt → 422', async () => {
    const app = buildApp(DENTIST);
    const future = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
    const res = await createStudy(app, { ...baseBody, capturedAt: future, capturedAtSource: 'manual' });
    expect(res.status).toBe(422);
  });
});

describe('§capture-date — updateImageMetadata correction', () => {
  let imageId: string;
  beforeEach(async () => { imageId = await seedImage(); });

  test('capturedAt correction → 200, value updated, source stamped manual', async () => {
    const app = buildApp(DENTIST);
    const corrected = '2026-04-15T00:00:00.000Z';
    const res = await patchMeta(app, imageId, { capturedAt: corrected });
    expect(res.status).toBe(200);
    const img = (await res.json()) as { capturedAt: string; capturedAtSource: string };
    expect(new Date(img.capturedAt).toISOString()).toBe(corrected);
    expect(img.capturedAtSource).toBe('manual');
  });

  test('a future capturedAt → 422', async () => {
    const app = buildApp(DENTIST);
    const future = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString();
    const res = await patchMeta(app, imageId, { capturedAt: future });
    expect(res.status).toBe(422);
  });

  test('capturedAt correction writes an audit row (medico-legal record integrity)', async () => {
    const app = buildApp(DENTIST);
    await patchMeta(app, imageId, { capturedAt: '2026-03-20T00:00:00.000Z' });
    const rows = await db.select().from(dentalAuditLog)
      .where(and(eq(dentalAuditLog.action, 'imaging_image.capture_date_update'), eq(dentalAuditLog.targetId, imageId)));
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });
});

describe('§capture-date — listPatientImages sort', () => {
  test('sorts by capturedAt DESC (taken earlier but uploaded later sorts by capture)', async () => {
    const app = buildApp(DENTIST);
    // Image A: uploaded now, but TAKEN long ago (should sort last).
    const older = await seedImage({ capturedAt: new Date('2026-01-01T00:00:00.000Z'), capturedAtSource: 'manual' });
    // Image B: uploaded now, TAKEN recently (should sort first).
    const newer = await seedImage({ capturedAt: new Date('2026-06-01T00:00:00.000Z'), capturedAtSource: 'manual' });
    const res = await listImages(app);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: PatientImageItem[] };
    const ids = body.items.filter((i) => i.id === older || i.id === newer).map((i) => i.id);
    expect(ids).toEqual([newer, older]);
    // capturedAt surfaced to the client.
    const newerItem = body.items.find((i) => i.id === newer)! as PatientImageItem & { capturedAt: string | null };
    expect(newerItem.capturedAt).not.toBeNull();
  });
});
