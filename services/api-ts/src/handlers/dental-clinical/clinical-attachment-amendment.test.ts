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

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { createAttachment } from './createAttachment';
import { listAttachments } from './listAttachments';
import { deleteAttachment } from './deleteAttachment';
import { createAmendment } from './createAmendment';
import { listAmendments } from './listAmendments';

const db = createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' });

const TEST_USER = { id: '00000000-0000-0000-0000-000000000001', email: 'test@clinic.com' };
const PATIENT_ID = 'a0000000-0000-1000-8000-000000000001';
const BRANCH_ID = 'b0000000-0000-1000-8000-000000000002';
const MEMBER_ID = 'c0000000-0000-1000-8000-000000000003';
const NONEXISTENT_ID = 'ffffffff-ffff-4000-8000-ffffffffffff';

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

  app.post('/dental/visits/:visitId/attachments', createAttachment);
  app.get('/dental/visits/:visitId/attachments', listAttachments);
  app.delete('/dental/visits/:visitId/attachments/:attachmentId', deleteAttachment);
  app.post('/dental/visits/:visitId/amendments', createAmendment);
  app.get('/dental/visits/:visitId/amendments', listAmendments);

  return app;
}

async function seedVisit() {
  const { VisitRepository } = await import('@/handlers/dental-visit/repos/visit.repo');
  const visitRepo = new VisitRepository(db);
  const visit = await visitRepo.createOne({
    patientId: PATIENT_ID,
    branchId: BRANCH_ID,
    dentistMemberId: MEMBER_ID,
  });
  return visit;
}

afterEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE amendment, consent_form, dental_attachment, lab_order, medical_history_entry, prescription, dental_treatment, dental_visit CASCADE`,
  );
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
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items).toHaveLength(0);
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
    expect(body.items).toHaveLength(1);
    expect(body.total).toBe(1);
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

    const res = await app.request(`/dental/visits/${visit.id}/amendments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        originalRecordType: 'prescription',
        originalRecordId: NONEXISTENT_ID,
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
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items).toHaveLength(0);
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
    expect(body.items).toHaveLength(1);
    expect(body.total).toBe(1);
  });
});
