/**
 * ceph-signoff-split.test.ts — G4-B real-DB owner
 *
 * Gap 4 (assistant-prepares / clinician-finalizes): a dental_assistant may
 * PREPARE a draft tracing (place/edit landmarks at 'placed'), but only a dentist
 * may SIGN OFF — confirm/lock landmarks and create the immutable report. The
 * report snapshot records prepared_by (distinct landmark authors) + finalized_by.
 *
 * Real DB (not the mock harness) because the split is fundamentally about
 * membership roles + landmark authorship persistence across multiple writers.
 *
 * Covers:
 *   - assistant places 'placed' drafts → 200
 *   - assistant batch with a 'confirmed'/'locked' status → 403 ASSISTANT_CANNOT_FINALIZE
 *   - assistant PATCH transition to 'confirmed' → 403; dentist → 200
 *   - hygienist (not a draft role) → 404 (anti-enumeration)
 *   - assistant create-report → 403; dentist → 201 with prepared_by/finalized_by
 */

// Migrated off the bespoke raw-handler mount to the shared validator-mounting harness.
import { describe, test, expect, beforeAll, beforeEach } from 'bun:test';
import { v4 as uuidv4 } from 'uuid';
import { createDatabase } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';

const db = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgresql://postgres:password@localhost:5432/monobase_test',
});

// Stable IDs (suite tag: cephsso)
const ORG_ID = 'c3c00000-0000-4000-8000-000000000001';
const BRANCH_ID = 'b3c00000-0000-4000-8000-000000000001';
const DENTIST = { id: 'a3c00000-0000-4000-8000-0000000000d1', email: 'dentist@cephsso.test' };
const ASSISTANT = { id: 'a3c00000-0000-4000-8000-0000000000a5', email: 'assistant@cephsso.test' };
const HYGIENIST = { id: 'a3c00000-0000-4000-8000-0000000000c3', email: 'hygienist@cephsso.test' };
const PATIENT_ID = 'd3c00000-0000-4000-8000-0000000000f5';

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
    id: ORG_ID, name: 'Ceph SSO Clinic', tier: 'clinic',
    ownerPersonId: DENTIST.id, countryCode: 'PH', imagingTier: 'addon',
    createdBy: DENTIST.id, updatedBy: DENTIST.id,
  }).onConflictDoNothing();

  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main', timezone: 'Asia/Manila',
    createdBy: DENTIST.id, updatedBy: DENTIST.id,
  }).onConflictDoNothing();

  await db.insert(dentalMemberships).values([
    {
      id: 'aad0c000-0000-4000-8000-0000000000d1', branchId: BRANCH_ID, personId: DENTIST.id,
      displayName: 'Owner Dentist', role: 'dentist_owner', status: 'active',
      pinFailedAttempts: 0, createdBy: DENTIST.id, updatedBy: DENTIST.id,
    },
    {
      id: 'aad0c000-0000-4000-8000-0000000000a5', branchId: BRANCH_ID, personId: ASSISTANT.id,
      displayName: 'Dental Assistant', role: 'dental_assistant', status: 'active',
      pinFailedAttempts: 0, createdBy: DENTIST.id, updatedBy: DENTIST.id,
    },
    {
      id: 'aad0c000-0000-4000-8000-0000000000c3', branchId: BRANCH_ID, personId: HYGIENIST.id,
      displayName: 'Hygienist', role: 'hygienist', status: 'active',
      pinFailedAttempts: 0, createdBy: DENTIST.id, updatedBy: DENTIST.id,
    },
  ]).onConflictDoNothing();
}

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

const GATE = [
  { landmarkCode: 'A', x: 300, y: 400 },
  { landmarkCode: 'B', x: 310, y: 520 },
  { landmarkCode: 'Go', x: 180, y: 560 },
  { landmarkCode: 'Po', x: 120, y: 360 },
];

beforeAll(async () => {
  await seedOrg();
});

describe('G4-B ceph sign-off split', () => {
  let imageId: string;

  beforeEach(async () => {
    imageId = await seedImage();
  });

  test('assistant may place draft landmarks (placed) → 200', async () => {
    const app = buildApp(ASSISTANT);
    const res = await app.request(`/dental/imaging/images/${imageId}/ceph/landmarks`, {
      method: 'POST', ...json({ landmarks: [{ landmarkCode: 'N', x: 300, y: 200, status: 'placed' }] }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.items.length).toBeGreaterThanOrEqual(1);
  });

  test('assistant batch with a confirmed status → 403 ASSISTANT_CANNOT_FINALIZE', async () => {
    const app = buildApp(ASSISTANT);
    const res = await app.request(`/dental/imaging/images/${imageId}/ceph/landmarks`, {
      method: 'POST', ...json({ landmarks: [{ landmarkCode: 'A', x: 300, y: 400, status: 'confirmed' }] }),
    });
    expect(res.status).toBe(403);
    expect((await res.json() as any).code).toBe('ASSISTANT_CANNOT_FINALIZE');
  });

  test('assistant PATCH transition placed→confirmed → 403; dentist → 200', async () => {
    // Assistant places the draft.
    await buildApp(ASSISTANT).request(`/dental/imaging/images/${imageId}/ceph/landmarks`, {
      method: 'POST', ...json({ landmarks: [{ landmarkCode: 'A', x: 300, y: 400, status: 'placed' }] }),
    });

    const asAssistant = await buildApp(ASSISTANT).request(
      `/dental/imaging/images/${imageId}/ceph/landmarks/A`,
      { method: 'PATCH', ...json({ status: 'confirmed' }) },
    );
    expect(asAssistant.status).toBe(403);
    expect((await asAssistant.json() as any).code).toBe('ASSISTANT_CANNOT_FINALIZE');

    const asDentist = await buildApp(DENTIST).request(
      `/dental/imaging/images/${imageId}/ceph/landmarks/A`,
      { method: 'PATCH', ...json({ status: 'confirmed' }) },
    );
    expect(asDentist.status).toBe(200);
  });

  test('hygienist (not a draft role) → 404 anti-enumeration', async () => {
    const app = buildApp(HYGIENIST);
    const res = await app.request(`/dental/imaging/images/${imageId}/ceph/landmarks`, {
      method: 'POST', ...json({ landmarks: [{ landmarkCode: 'N', x: 300, y: 200, status: 'placed' }] }),
    });
    expect(res.status).toBe(404);
  });

  test('assistant cannot create a report (403); dentist finalizes with prepared_by/finalized_by', async () => {
    // Assistant prepares the gate landmarks as drafts.
    await buildApp(ASSISTANT).request(`/dental/imaging/images/${imageId}/ceph/landmarks`, {
      method: 'POST', ...json({ landmarks: GATE.map((g) => ({ ...g, status: 'placed' })) }),
    });
    // Dentist signs off each gate landmark (placed → confirmed).
    for (const g of GATE) {
      const r = await buildApp(DENTIST).request(
        `/dental/imaging/images/${imageId}/ceph/landmarks/${g.landmarkCode}`,
        { method: 'PATCH', ...json({ status: 'confirmed' }) },
      );
      expect(r.status).toBe(200);
    }

    // Assistant is blocked from finalizing.
    const assistantReport = await buildApp(ASSISTANT).request(
      `/dental/imaging/images/${imageId}/ceph/reports`, { method: 'POST', ...json({}) },
    );
    expect(assistantReport.status).toBe(403);
    expect((await assistantReport.json() as any).code).toBe('ASSISTANT_CANNOT_FINALIZE');

    // Dentist finalizes — snapshot attributes preparer(s) + finalizer.
    const dentistReport = await buildApp(DENTIST).request(
      `/dental/imaging/images/${imageId}/ceph/reports`, { method: 'POST', ...json({}) },
    );
    expect(dentistReport.status).toBe(201);
    const snap = (await dentistReport.json() as any).snapshot;
    expect(snap.finalized_by).toBe(DENTIST.id);
    expect(snap.prepared_by).toContain(ASSISTANT.id);
    expect(snap.prepared_by).toContain(DENTIST.id);
  });
});
