/**
 * clinical-attachment-amendment handler tests
 *
 * Covers:
 *   - createAttachment  POST /dental/visits/:visitId/attachments
 *   - listAttachments   GET  /dental/visits/:visitId/attachments
 *   - deleteAttachment  DELETE /dental/visits/:visitId/attachments/:attachmentId
 *   - createAmendment   POST /dental/visits/:visitId/amendments
 *   - listAmendments    GET  /dental/visits/:visitId/amendments
 */

import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  CreateAttachmentBody, CreateAttachmentParams,
  CreateAmendmentBody, CreateAmendmentParams,
} from '@/generated/openapi/validators';
import { createAttachment } from './attachments/createAttachment';
import { listAttachments } from './attachments/listAttachments';
import { deleteAttachment } from './attachments/deleteAttachment';
import { createAmendment } from './amendments/createAmendment';
import { listAmendments } from './amendments/listAmendments';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: '00000000-0000-0000-0000-000000000001', email: 'test@clinic.com' };
const PATIENT_ID = 'a0000000-0000-1000-8000-000000000001';
const BRANCH_ID = 'b0000000-0000-1000-8000-000000000002';
const MEMBER_ID = 'ee000000-0000-1000-8000-000000000001';
const ORG_ID = 'd0000000-0000-1000-8000-000000000004';
const NONEXISTENT_ID = 'ffffffff-ffff-4000-8000-ffffffffffff';

const PERSON_ID = 'f1000000-0000-1000-8000-000000000001';

// Re-seed org, branch, membership, person, and patient before each test
// (using beforeEach so parallel test files can't clobber this data mid-suite)
beforeEach(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Test Clinic', tier: 'solo', ownerPersonId: TEST_USER.id,
    countryCode: 'PH', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch',
    timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  // Membership used by assertBranchAccess and seedVisit (MEMBER_ID = this id)
  await db.insert(dentalMemberships).values({
    id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id,
    displayName: 'Test User', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  // Person + patient needed for visit FK and attachment FK
  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'Test', lastName: 'Patient',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
});

function buildTestApp(user?: typeof TEST_USER) {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err.message) }, 500);
  });

  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    if (user) {
      ctx.set('user', user);
      ctx.set('session', { id: 'test-session' });
    }
    await next();
  });

  // zValidator hook receives { data, success, error, target } — not a raw ZodError
  const ve = (result: any, c: any) => {
    if (!result.success) return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
  };
  // Body schemas include visitId (from OpenAPI spec) but it comes from path params — omit from body validation
  const AttachmentBodyOnly = CreateAttachmentBody.omit({ visitId: true });
  const AmendmentBodyOnly = CreateAmendmentBody.omit({ visitId: true });
  app.post('/dental/visits/:visitId/attachments',
    zValidator('param', CreateAttachmentParams, ve),
    zValidator('json', AttachmentBodyOnly, ve),
    createAttachment as any,
  );
  app.get('/dental/visits/:visitId/attachments', listAttachments);
  app.delete('/dental/visits/:visitId/attachments/:attachmentId', deleteAttachment);
  app.post('/dental/visits/:visitId/amendments',
    zValidator('param', CreateAmendmentParams, ve),
    zValidator('json', AmendmentBodyOnly, ve),
    createAmendment as any,
  );
  app.get('/dental/visits/:visitId/amendments', listAmendments);

  return app;
}

async function seedVisit() {
  const { createVisit } = await import('@/handlers/dental-visit/utils/visit.service');
  const visit = await createVisit(db, {
    patientId: PATIENT_ID,
    branchId: BRANCH_ID,
    dentistMemberId: MEMBER_ID,
  });
  return visit;
}

// V-CLN-011: amendments referencing an in-module record type (e.g. 'prescription')
// must point at a record that resolves — seed a real prescription for those tests.
async function seedPrescription(visitId: string) {
  const { PrescriptionRepository } = await import('./repos/prescription.repo');
  const repo = new PrescriptionRepository(db);
  return repo.createOne({
    visitId,
    patientId: PATIENT_ID,
    prescriberMemberId: MEMBER_ID,
    drugName: 'Amoxicillin',
    dosage: '500mg',
    frequency: 'TID',
  });
}

afterEach(async () => {
  // Clean visit-scoped records first (FK order), then infrastructure
  await db.execute(
    sql`TRUNCATE TABLE amendment, consent_form, dental_attachment, lab_order, medical_history_entry, prescription, dental_treatment, dental_visit CASCADE`,
  );
  await db.execute(
    sql`TRUNCATE TABLE dental_membership, dental_branch, dental_organization CASCADE`,
  );
  await db.execute(sql`DELETE FROM patient WHERE id = ${PATIENT_ID}`);
  await db.execute(sql`DELETE FROM person WHERE id = ${PERSON_ID}`);
});

// ---------------------------------------------------------------------------
// createAttachment
// ---------------------------------------------------------------------------

describe('createAttachment handler', () => {
  test('returns 401 when user is not authenticated', async () => {
    const app = buildTestApp(undefined);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        imageType: 'xray',
        fileName: 'xray.jpg',
        filePath: '/uploads/xray.jpg',
        fileSizeBytes: 204800,
        mimeType: 'image/jpeg',
      }),
    });

    expect(res.status).toBe(401);
  });

  test('returns 400 when patientId is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageType: 'xray',
        fileName: 'xray.jpg',
        filePath: '/uploads/xray.jpg',
        fileSizeBytes: 204800,
        mimeType: 'image/jpeg',
      }),
    });

    expect(res.status).toBe(400);
  });

  test('returns 400 when imageType is invalid', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        imageType: 'mri',
        fileName: 'scan.jpg',
        filePath: '/uploads/scan.jpg',
        fileSizeBytes: 204800,
        mimeType: 'image/jpeg',
      }),
    });

    expect(res.status).toBe(400);
  });

  test('returns 400 when fileName is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        imageType: 'xray',
        filePath: '/uploads/xray.jpg',
        fileSizeBytes: 204800,
        mimeType: 'image/jpeg',
      }),
    });

    expect(res.status).toBe(400);
  });

  test('returns 201 with created attachment on valid input', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        imageType: 'xray',
        fileName: 'panoramic.jpg',
        filePath: '/uploads/panoramic.jpg',
        fileSizeBytes: 512000,
        mimeType: 'image/jpeg',
        note: 'Panoramic x-ray',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeTruthy();
    expect(body.visitId).toBe(visit.id);
    expect(body.imageType).toBe('xray');
    expect(body.fileName).toBe('panoramic.jpg');
  });

  // FIX-010 (doc reconcile): this endpoint is metadata-only — it records the
  // client-reported fileSizeBytes/mimeType with NO size cap and NO MIME allow-list.
  // The real byte ceiling lives one layer up in the storage module
  // (POST /storage/files/upload → maxUploadSizeForMime: 100 MB non-DICOM / 2 GB DICOM).
  // Pinning this design on purpose: a cap added HERE would 422 after storage already
  // accepted the bytes, orphaning the stored S3 object — so any future cap is a
  // conscious change, not an accident. (See API_CONTRACTS.md attachment section.)
  test('records client-reported size/MIME with no cap (metadata-only; storage is the byte boundary)', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        imageType: 'document',
        fileName: 'oversized-report.bin',
        filePath: '/uploads/oversized-report.bin',
        // 80 MB — ABOVE the 50 MB UI guard and an arbitrary non-image/pdf MIME;
        // both are accepted here because enforcement lives in storage, not this endpoint.
        fileSizeBytes: 83886080,
        mimeType: 'application/octet-stream',
        note: 'metadata-only endpoint enforces no size/MIME cap',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(Number(body.fileSizeBytes)).toBe(83886080);
    expect(body.mimeType).toBe('application/octet-stream');
  });
});

// ---------------------------------------------------------------------------
// listAttachments
// ---------------------------------------------------------------------------

describe('listAttachments handler', () => {
  test('returns 401 when user is not authenticated', async () => {
    const app = buildTestApp(undefined);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/attachments`);

    expect(res.status).toBe(401);
  });

  test('returns 200 with empty items array for a new visit', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/attachments`);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(0);
  });

  test('returns 200 with seeded attachments', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    // Seed an attachment first
    await app.request(`/dental/visits/${visit.id}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        imageType: 'photo',
        fileName: 'before.jpg',
        filePath: '/uploads/before.jpg',
        fileSizeBytes: 102400,
        mimeType: 'image/jpeg',
      }),
    });

    const res = await app.request(`/dental/visits/${visit.id}/attachments`);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toHaveLength(1);
    expect(body.pagination.totalCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// deleteAttachment
// ---------------------------------------------------------------------------

describe('deleteAttachment handler', () => {
  test('returns 401 when user is not authenticated', async () => {
    const app = buildTestApp(undefined);
    const visit = await seedVisit();

    const res = await app.request(
      `/dental/visits/${visit.id}/attachments/${NONEXISTENT_ID}`,
      { method: 'DELETE' },
    );

    expect(res.status).toBe(401);
  });

  test('returns 404 when attachment does not exist', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(
      `/dental/visits/${visit.id}/attachments/${NONEXISTENT_ID}`,
      { method: 'DELETE' },
    );

    expect(res.status).toBe(404);
  });

  test('returns 204 when attachment is successfully deleted', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    // Create an attachment
    const createRes = await app.request(`/dental/visits/${visit.id}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        imageType: 'scan',
        fileName: 'cbct.dcm',
        filePath: '/uploads/cbct.dcm',
        fileSizeBytes: 1048576,
        mimeType: 'application/dicom',
      }),
    });
    const created = await createRes.json() as any;

    const deleteRes = await app.request(
      `/dental/visits/${visit.id}/attachments/${created.id}`,
      { method: 'DELETE' },
    );

    expect(deleteRes.status).toBe(204);
  });
});

// ---------------------------------------------------------------------------
// createAmendment
// ---------------------------------------------------------------------------

describe('createAmendment handler', () => {
  test('returns 401 when user is not authenticated', async () => {
    const app = buildTestApp(undefined);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/amendments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        originalRecordType: 'prescription',
        originalRecordId: NONEXISTENT_ID,
        reason: 'Incorrect dosage noted',
        content: 'Correct dosage is 500mg',
      }),
    });

    expect(res.status).toBe(401);
  });

  test('returns 400 when patientId is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/amendments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originalRecordType: 'prescription',
        originalRecordId: NONEXISTENT_ID,
        reason: 'Incorrect dosage',
        content: 'Correct dosage is 500mg',
      }),
    });

    expect(res.status).toBe(400);
  });

  test('returns 400 when originalRecordType is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/amendments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        originalRecordId: NONEXISTENT_ID,
        reason: 'Incorrect dosage',
        content: 'Correct dosage is 500mg',
      }),
    });

    expect(res.status).toBe(400);
  });

  test('returns 400 when reason is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/amendments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        originalRecordType: 'prescription',
        originalRecordId: NONEXISTENT_ID,
        content: 'Correct dosage is 500mg',
      }),
    });

    expect(res.status).toBe(400);
  });

  test('returns 400 when content is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/amendments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        originalRecordType: 'prescription',
        originalRecordId: NONEXISTENT_ID,
        reason: 'Incorrect dosage',
      }),
    });

    expect(res.status).toBe(400);
  });

  test('returns 201 with created amendment on valid input', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();
    const rx = await seedPrescription(visit.id);

    const res = await app.request(`/dental/visits/${visit.id}/amendments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        originalRecordType: 'prescription',
        originalRecordId: rx.id,
        reason: 'Typo in instructions',
        content: 'Take 500mg twice daily with food',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeTruthy();
    expect(body.visitId).toBe(visit.id);
    expect(body.patientId).toBe(PATIENT_ID);
    expect(body.originalRecordType).toBe('prescription');
    expect(body.reason).toBe('Typo in instructions');
  });

  // V-CLN-011: an amendment referencing a non-existent in-module record is rejected.
  test('returns 404 when originalRecordId does not resolve for an in-module type', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/amendments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        originalRecordType: 'prescription',
        originalRecordId: NONEXISTENT_ID,
        reason: 'References a prescription that does not exist',
        content: 'Should be rejected as a dangling reference',
      }),
    });

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// listAmendments
// ---------------------------------------------------------------------------

describe('listAmendments handler', () => {
  test('returns 401 when user is not authenticated', async () => {
    const app = buildTestApp(undefined);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/amendments`);

    expect(res.status).toBe(401);
  });

  test('returns 200 with empty items array for a new visit', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/amendments`);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(0);
  });

  test('returns 200 with seeded amendments', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    // Seed an amendment
    await app.request(`/dental/visits/${visit.id}/amendments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        originalRecordType: 'treatment',
        originalRecordId: NONEXISTENT_ID,
        reason: 'Missing tooth surface',
        content: 'Added mesial surface to code',
      }),
    });

    const res = await app.request(`/dental/visits/${visit.id}/amendments`);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toHaveLength(1);
    expect(body.pagination.totalCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// BR-019: Clinical records are append-only; corrections via amendments only
// ---------------------------------------------------------------------------

describe('BR-019: clinical records append-only', () => {
  test('createAmendment returns 201 with amendment record', async () => {
    const visit = await seedVisit();
    const rx = await seedPrescription(visit.id);
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/visits/${visit.id}/amendments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        originalRecordType: 'prescription',
        originalRecordId: rx.id,
        reason: 'Incorrect dosage recorded',
        content: 'Corrected: amoxicillin 500mg → 250mg per BR-019 append-only policy',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeTruthy();
    expect(body.originalRecordType).toBe('prescription');
    expect(body.reason).toBe('Incorrect dosage recorded');
  });

  test('multiple amendments accumulate — earlier records not mutated', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);

    // Post first amendment
    await app.request(`/dental/visits/${visit.id}/amendments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        originalRecordType: 'note',
        originalRecordId: NONEXISTENT_ID,
        reason: 'First correction',
        content: 'Amendment A',
      }),
    });

    // Post second amendment on the same record
    await app.request(`/dental/visits/${visit.id}/amendments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        originalRecordType: 'note',
        originalRecordId: NONEXISTENT_ID,
        reason: 'Second correction',
        content: 'Amendment B',
      }),
    });

    // Both amendments must be present — no overwrite
    const listRes = await app.request(`/dental/visits/${visit.id}/amendments`);
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json() as any;
    expect(listBody.pagination.totalCount).toBeGreaterThanOrEqual(2);
  });

  test('createAmendment returns 401 without auth', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(); // no user

    const res = await app.request(`/dental/visits/${visit.id}/amendments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        originalRecordType: 'note',
        originalRecordId: NONEXISTENT_ID,
        reason: 'Unauthorized attempt',
        content: 'Should fail',
      }),
    });

    expect(res.status).toBe(401);
  });
});
