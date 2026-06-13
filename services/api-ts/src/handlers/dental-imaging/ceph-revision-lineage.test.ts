/**
 * ceph-revision-lineage.test.ts — G1-B real-DB owner
 *
 * Gap 1 (light lineage): the immutable ceph report-version chain gains explicit
 * `revisionOf` + `revisionReason` so a re-finalized trace is an explicit, reasoned
 * lineage — WITHOUT a separate trace-session FSM. These assertions exercise the
 * REAL createSnapshotVersion sequencing (getLatestReport → insert) + the new
 * columns against a cloned DB; the mock harness in ceph.test.ts cannot fake the
 * multi-row prior-version lookup faithfully.
 *
 * Covers:
 *   - v1 report → revisionOf = null (no prior version)
 *   - v2 report → revisionOf = v1.id, revisionReason persisted from body
 *   - revisionReason omitted → null (back-compat with pre-G1-B callers)
 *   - getCephReport surfaces revisionOf/revisionReason on read
 */

// Migrated off the bespoke raw-handler mount to the shared validator-mounting harness.
import { describe, test, expect, beforeAll, beforeEach } from 'bun:test';
import { v4 as uuidv4 } from 'uuid';
import { createDatabase } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';

const db = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgresql://postgres:password@localhost:5432/monobase_test',
});

// Stable IDs (suite tag: cephrev)
const ORG_ID = 'c2b00000-0000-4000-8000-000000000001';
const BRANCH_ID = 'b2b00000-0000-4000-8000-000000000001';
const DENTIST = { id: 'a2b00000-0000-4000-8000-0000000000d1', email: 'dentist@cephrev.test' };
const PATIENT_ID = 'd2b00000-0000-4000-8000-0000000000f5';

function buildApp(user?: { id: string; email: string }) {
  return buildTestApp({ db, user });
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
    id: ORG_ID, name: 'Ceph Rev Clinic', tier: 'clinic',
    ownerPersonId: DENTIST.id, countryCode: 'PH', imagingTier: 'addon',
    createdBy: DENTIST.id, updatedBy: DENTIST.id,
  }).onConflictDoNothing();

  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main', timezone: 'Asia/Manila',
    createdBy: DENTIST.id, updatedBy: DENTIST.id,
  }).onConflictDoNothing();

  await db.insert(dentalMemberships).values({
    id: 'aacf0000-0000-4000-8000-0000000000d1', branchId: BRANCH_ID, personId: DENTIST.id,
    displayName: 'Owner Dentist', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, createdBy: DENTIST.id, updatedBy: DENTIST.id,
  }).onConflictDoNothing();
}

/** Seed a study + calibrated image and return the imageId. */
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
    pixelSpacingMm: 0.1, dicomMetadata: { fileName: 'ceph.png', mimeType: 'image/png' },
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

beforeAll(async () => {
  await seedOrg();
});

describe('G1-B ceph report revision lineage', () => {
  let imageId: string;

  beforeEach(async () => {
    imageId = await seedImage();
    await seedGateLandmarks(imageId);
  });

  test('v1 report has revisionOf = null (no prior version)', async () => {
    const app = buildApp(DENTIST);
    const res = await app.request(`/dental/imaging/images/${imageId}/ceph/reports`, {
      method: 'POST', ...json({}),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.version).toBe(1);
    expect(body.revisionOf).toBeNull();
    expect(body.revisionReason).toBeNull();
  });

  test('v2 report links revisionOf = v1.id and persists revisionReason', async () => {
    const app = buildApp(DENTIST);
    const r1 = await app.request(`/dental/imaging/images/${imageId}/ceph/reports`, {
      method: 'POST', ...json({}),
    });
    const v1 = (await r1.json()) as any;
    expect(v1.version).toBe(1);

    const r2 = await app.request(`/dental/imaging/images/${imageId}/ceph/reports`, {
      method: 'POST', ...json({ revisionReason: 'Re-traced Gonion after calibration fix' }),
    });
    expect(r2.status).toBe(201);
    const v2 = (await r2.json()) as any;
    expect(v2.version).toBe(2);
    expect(v2.revisionOf).toBe(v1.id);
    expect(v2.revisionReason).toBe('Re-traced Gonion after calibration fix');
  });

  test('revisionReason omitted on a revision → null (back-compat)', async () => {
    const app = buildApp(DENTIST);
    await app.request(`/dental/imaging/images/${imageId}/ceph/reports`, { method: 'POST', ...json({}) });
    const r2 = await app.request(`/dental/imaging/images/${imageId}/ceph/reports`, {
      method: 'POST', ...json({}),
    });
    const v2 = (await r2.json()) as any;
    expect(v2.version).toBe(2);
    expect(v2.revisionOf).not.toBeNull();
    expect(v2.revisionReason).toBeNull();
  });

  test('blank/whitespace revisionReason is normalized to null', async () => {
    const app = buildApp(DENTIST);
    const res = await app.request(`/dental/imaging/images/${imageId}/ceph/reports`, {
      method: 'POST', ...json({ revisionReason: '   ' }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.revisionReason).toBeNull();
  });

  test('getCephReport surfaces revisionOf/revisionReason on read', async () => {
    const app = buildApp(DENTIST);
    await app.request(`/dental/imaging/images/${imageId}/ceph/reports`, { method: 'POST', ...json({}) });
    await app.request(`/dental/imaging/images/${imageId}/ceph/reports`, {
      method: 'POST', ...json({ revisionReason: 'second pass' }),
    });

    const read = await app.request(`/dental/imaging/images/${imageId}/ceph/reports`, { method: 'GET' });
    expect(read.status).toBe(200);
    const latest = (await read.json()) as any;
    expect(latest.version).toBe(2);
    expect(latest.revisionReason).toBe('second pass');
    expect(latest.revisionOf).not.toBeNull();
  });
});
