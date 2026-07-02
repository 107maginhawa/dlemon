/**
 * imaging-metadata.test.ts — G5 (library metadata) real-DB owner
 *
 * Gap 5 (metadata breadth): images gain isDiagnostic / qualityStatus / retakeReason /
 * tags, an update endpoint, and list filters. These assertions exercise the REAL
 * updateImageMetadata handler + listPatientImages filtering against a cloned DB.
 *
 * Covers:
 *   - PATCH metadata: full + partial updates, tag normalization
 *   - validation: bad qualityStatus / non-array tags / empty body → 400
 *   - list surfaces metadata + applies isDiagnostic / qualityStatus / tag filters
 *   - applyImageLibraryFilters pure-function behaviour
 */

// Migrated off the bespoke raw-handler mount to the shared validator-mounting harness.
import { describe, test, expect, beforeAll, beforeEach } from 'bun:test';
import { v4 as uuidv4 } from 'uuid';
import { createDatabase } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';
import {
  applyImageLibraryFilters,
  type PatientImageItem,
} from './listPatientImages';

const db = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgresql://postgres:password@localhost:5432/monobase_test',
});

// Stable IDs (suite tag: imgmeta)
const ORG_ID = 'c4d00000-0000-4000-8000-000000000001';
const BRANCH_ID = 'b4d00000-0000-4000-8000-000000000001';
const DENTIST = { id: 'a4d00000-0000-4000-8000-0000000000d1', email: 'dentist@imgmeta.test' };
const PATIENT_ID = 'd4d00000-0000-4000-8000-0000000000f5';

function buildApp(user?: { id: string; email: string }) {
  return buildTestApp({ db, user });
}

const json = (body: unknown) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

async function seedOrg() {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Img Meta Clinic', tier: 'clinic', ownerPersonId: DENTIST.id,
    countryCode: 'PH', imagingTier: 'addon', createdBy: DENTIST.id, updatedBy: DENTIST.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main', timezone: 'Asia/Manila',
    createdBy: DENTIST.id, updatedBy: DENTIST.id,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: 'aac40000-0000-4000-8000-0000000000d1', branchId: BRANCH_ID, personId: DENTIST.id,
    displayName: 'Owner Dentist', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, createdBy: DENTIST.id, updatedBy: DENTIST.id,
  }).onConflictDoNothing();
}

/** Seed one study + image; returns imageId. */
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

const patchMeta = (app: ReturnType<typeof buildTestApp>, imageId: string, body: unknown) =>
  app.request(`/dental/imaging/images/${imageId}/metadata`, { method: 'PATCH', ...json(body) });
const listImages = (app: ReturnType<typeof buildTestApp>, query = '') =>
  app.request(`/dental/patients/${PATIENT_ID}/images?branchId=${BRANCH_ID}${query}`, { method: 'GET' });

beforeAll(async () => {
  await seedOrg();
});

describe('G5 image metadata — PATCH', () => {
  let imageId: string;
  beforeEach(async () => { imageId = await seedImage(); });

  test('defaults: a fresh image is diagnostic / ok / untagged', async () => {
    const app = buildApp(DENTIST);
    const res = await listImages(app);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: PatientImageItem[] };
    const item = body.items.find((i) => i.id === imageId)!;
    expect(item.isDiagnostic).toBe(true);
    expect(item.qualityStatus).toBe('ok');
    expect(item.tags).toEqual([]);
  });

  test('full update persists all metadata fields', async () => {
    const app = buildApp(DENTIST);
    const res = await patchMeta(app, imageId, {
      isDiagnostic: false, qualityStatus: 'retake', retakeReason: 'overexposed', tags: ['ortho', 'review'],
    });
    expect(res.status).toBe(200);
    const img = (await res.json()) as any;
    expect(img.isDiagnostic).toBe(false);
    expect(img.qualityStatus).toBe('retake');
    expect(img.retakeReason).toBe('overexposed');
    expect(img.tags).toEqual(['ortho', 'review']);
  });

  test('partial update only changes the supplied field', async () => {
    const app = buildApp(DENTIST);
    await patchMeta(app, imageId, { tags: ['baseline'] });
    const res = await patchMeta(app, imageId, { isDiagnostic: false });
    const img = (await res.json()) as any;
    expect(img.isDiagnostic).toBe(false);
    expect(img.tags).toEqual(['baseline']); // unchanged
    expect(img.qualityStatus).toBe('ok'); // unchanged default
  });

  test('tags are normalized: trimmed, de-duped, blanks dropped', async () => {
    const app = buildApp(DENTIST);
    const res = await patchMeta(app, imageId, { tags: ['  ortho ', 'ortho', '', 'Review'] });
    const img = (await res.json()) as any;
    expect(img.tags).toEqual(['ortho', 'Review']);
  });

  test('invalid qualityStatus → 400', async () => {
    const app = buildApp(DENTIST);
    const res = await patchMeta(app, imageId, { qualityStatus: 'blurry' });
    expect(res.status).toBe(400);
  });

  test('non-array tags → 400', async () => {
    const app = buildApp(DENTIST);
    const res = await patchMeta(app, imageId, { tags: 'ortho' });
    expect(res.status).toBe(400);
  });

  test('empty body → 400', async () => {
    const app = buildApp(DENTIST);
    const res = await patchMeta(app, imageId, {});
    expect(res.status).toBe(400);
  });
});

describe('G5 image metadata — list filters', () => {
  test('filters by isDiagnostic / qualityStatus / tag', async () => {
    const app = buildApp(DENTIST);
    const diag = await seedImage({ isDiagnostic: true, qualityStatus: 'ok', tags: ['baseline'] });
    const retake = await seedImage({ isDiagnostic: false, qualityStatus: 'retake', tags: ['ortho'] });

    const onlyDiagnostic = (await (await listImages(app, '&isDiagnostic=true')).json()) as { items: PatientImageItem[] };
    const ids = new Set(onlyDiagnostic.items.map((i) => i.id));
    expect(ids.has(diag)).toBe(true);
    expect(ids.has(retake)).toBe(false);

    const onlyRetake = (await (await listImages(app, '&qualityStatus=retake')).json()) as { items: PatientImageItem[] };
    expect(onlyRetake.items.every((i) => i.qualityStatus === 'retake')).toBe(true);
    expect(onlyRetake.items.some((i) => i.id === retake)).toBe(true);

    const orthoTag = (await (await listImages(app, '&tag=ortho')).json()) as { items: PatientImageItem[] };
    expect(orthoTag.items.some((i) => i.id === retake)).toBe(true);
    expect(orthoTag.items.some((i) => i.id === diag)).toBe(false);
  });
});

describe('applyImageLibraryFilters (pure)', () => {
  const base: PatientImageItem = {
    id: 'x', source: 'imaging', modality: 'periapical', fileName: 'a', mimeType: 'image/png',
    fileSizeBytes: 1, studyId: 's', visitId: null, toothNumbers: [], createdAt: new Date('2026-01-01'),
    capturedAt: new Date('2026-01-01'), capturedAtSource: 'defaulted_upload',
    downloadUrl: null, isVolume: false, frameCount: null, viewerKind: 'image',
    isDiagnostic: true, qualityStatus: 'ok', retakeReason: null, tags: ['ortho'], links: [],
  };
  const items: PatientImageItem[] = [
    base,
    { ...base, id: 'y', isDiagnostic: false, qualityStatus: 'retake', tags: ['review', 'PA'] },
  ];

  test('no filters → identity', () => {
    expect(applyImageLibraryFilters(items, {})).toHaveLength(2);
  });
  test('isDiagnostic filter', () => {
    expect(applyImageLibraryFilters(items, { isDiagnostic: false }).map((i) => i.id)).toEqual(['y']);
  });
  test('qualityStatus filter', () => {
    expect(applyImageLibraryFilters(items, { qualityStatus: 'ok' }).map((i) => i.id)).toEqual(['x']);
  });
  test('tag filter is case-insensitive', () => {
    expect(applyImageLibraryFilters(items, { tag: 'pa' }).map((i) => i.id)).toEqual(['y']);
  });
});
