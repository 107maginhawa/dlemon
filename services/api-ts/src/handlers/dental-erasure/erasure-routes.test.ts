/**
 * V-DG-002 erasure HTTP route tests — exercises the real route + zValidator +
 * handler wiring (mirrors the manual dental-route registration in app.ts), per
 * the "tests must hit real route wiring" rule. Covers the full request →
 * approve/reject lifecycle, admin RBAC, validation, and 404s.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { openTestTx } from '@/core/test-tx';
import { AppError } from '@/core/errors';
import { persons } from '../person/repos/person.schema';
import { patients } from '../patient/repos/patient.schema';
import { storedFiles } from '../storage/repos/file.schema';
import { imagingStudies, imagingStudyImages } from '../dental-imaging/repos/imaging.schema';
import { ERASED_MARKER } from '../person/repos/person-erasure.facade';
import { requestErasureHandler } from './requestErasureHandler';
import { approveErasureHandler } from './approveErasureHandler';
import { rejectErasureHandler } from './rejectErasureHandler';
import { getErasureRequestHandler } from './getErasureRequestHandler';
import { listErasureRequestsHandler } from './listErasureRequestsHandler';
import { RequestErasureBody, RejectErasureBody, ErasureIdParams, ListErasureQuery } from './utils/erasure-validators';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

const PID = 'e3000000-0000-4000-8000-000000000001';
const TENANT = 'd3000000-0000-4000-8000-000000000001';
const ADMIN = { id: 'a3000000-0000-4000-8000-000000000001', email: 'admin@clinic.com', role: 'admin' };
const NON_ADMIN = { id: 'a3000000-0000-4000-8000-000000000002', email: 'staff@clinic.com', role: 'user' };

const validationErrorHandler = (result: any, c: any) => {
  if (!result.success) return c.json({ error: 'Validation failed', issues: result.error.issues }, 400);
};

function makeApp(
  db: NodePgDatabase,
  user: { id: string; email: string; role: string },
  storage?: unknown,
) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: 'Internal server error' }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug() {}, info() {}, warn() {}, error() {} });
    ctx.set('user', user);
    if (storage) ctx.set('storage', storage);
    await next();
  });
  app.post('/dental/erasure-requests', zValidator('json', RequestErasureBody, validationErrorHandler), requestErasureHandler as any);
  app.get('/dental/erasure-requests', zValidator('query', ListErasureQuery, validationErrorHandler), listErasureRequestsHandler as any);
  app.get('/dental/erasure-requests/:id', zValidator('param', ErasureIdParams, validationErrorHandler), getErasureRequestHandler as any);
  app.post('/dental/erasure-requests/:id/approve', zValidator('param', ErasureIdParams, validationErrorHandler), approveErasureHandler as any);
  app.post('/dental/erasure-requests/:id/reject', zValidator('param', ErasureIdParams, validationErrorHandler), zValidator('json', RejectErasureBody, validationErrorHandler), rejectErasureHandler as any);
  return app;
}

const J = (body: unknown) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('erasure HTTP routes (V-DG-002)', () => {
  let db: NodePgDatabase;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const t = await openTestTx();
    db = t.db;
    teardown = t.rollback;
    await db.insert(persons).values({ id: PID, firstName: 'Jane', lastName: 'Doe' });
    await db.insert(patients).values({ person: PID, emergencyContact: { name: 'Kin' } });
  });

  afterEach(() => teardown());

  const reqBody = { subjectPersonId: PID, tenantId: TENANT, reason: 'GDPR Art.17 request' };

  test('request → approve anonymizes the subject and walks the full lifecycle', async () => {
    const app = makeApp(db, ADMIN);

    const created = await app.request('/dental/erasure-requests', J(reqBody));
    expect(created.status).toBe(201);
    const reqRow = (await created.json()) as { id: string; status: string };
    expect(reqRow.status).toBe('requested');

    const got = await app.request(`/dental/erasure-requests/${reqRow.id}`);
    expect(got.status).toBe(200);

    const list = await app.request('/dental/erasure-requests');
    expect(list.status).toBe(200);
    // ER-P2-1: contract shape is { data: ErasureRequest[] }, not a bare array.
    const listBody = (await list.json()) as { data: unknown[] };
    expect(Array.isArray(listBody.data)).toBe(true);
    expect(listBody.data.length).toBeGreaterThanOrEqual(1);

    const approved = await app.request(`/dental/erasure-requests/${reqRow.id}/approve`, J({}));
    expect(approved.status).toBe(200);
    expect(((await approved.json()) as any).status).toBe('anonymized');

    const [p] = await db.select().from(persons).where(eq(persons.id, PID));
    expect(p!.firstName).toBe(ERASED_MARKER);
  });

  test('legal hold on approve blocks anonymization (request rejected, subject kept)', async () => {
    const app = makeApp(db, ADMIN);
    const created = await app.request('/dental/erasure-requests', J(reqBody));
    const reqRow = (await created.json()) as { id: string };

    const approved = await app.request(`/dental/erasure-requests/${reqRow.id}/approve`, J({ legalHold: true }));
    expect(approved.status).toBe(200);
    expect(((await approved.json()) as any).status).toBe('rejected');

    const [p] = await db.select().from(persons).where(eq(persons.id, PID));
    expect(p!.firstName).toBe('Jane');
  });

  test('reject marks the request rejected with a reason', async () => {
    const app = makeApp(db, ADMIN);
    const created = await app.request('/dental/erasure-requests', J(reqBody));
    const reqRow = (await created.json()) as { id: string };

    const rejected = await app.request(`/dental/erasure-requests/${reqRow.id}/reject`, J({ rejectionReason: 'not verified' }));
    expect(rejected.status).toBe(200);
    expect(((await rejected.json()) as any).status).toBe('rejected');
  });

  test('non-admin is forbidden (403)', async () => {
    const app = makeApp(db, NON_ADMIN);
    const res = await app.request('/dental/erasure-requests', J(reqBody));
    expect(res.status).toBe(403);
  });

  test('missing reason → 400', async () => {
    const app = makeApp(db, ADMIN);
    const res = await app.request('/dental/erasure-requests', J({ subjectPersonId: PID, tenantId: TENANT }));
    expect(res.status).toBe(400);
  });

  test('approve unknown id → 404', async () => {
    const app = makeApp(db, ADMIN);
    const res = await app.request('/dental/erasure-requests/e3000000-0000-4000-8000-0000000000ff/approve', J({}));
    expect(res.status).toBe(404);
  });

  test('approve physically deletes the radiograph S3 object + storage row via ctx storage (V-DG-002)', async () => {
    // Seed a radiograph: stored_file → imaging_study → imaging_study_image.
    // (Reuse the patient row created in beforeEach so the person→patient link
    // the imaging facade resolves matches the study's patientId.)
    const FILE_ID = 'f3000000-0000-4000-8000-000000000001';
    const [pat] = await db.select().from(patients).where(eq(patients.person, PID));
    await db.insert(storedFiles).values({
      id: FILE_ID, filename: 'rg.dcm', mimeType: 'application/dicom', size: 10, status: 'available', owner: ADMIN.id,
    });
    const studyId = 'f8000000-0000-4000-8000-000000000003';
    await db.insert(imagingStudies).values({
      id: studyId, patientId: pat!.id, branchId: 'b3000000-0000-4000-8000-000000000001',
      acquiredBy: 'e8000000-0000-4000-8000-000000000003', modality: 'periapical',
    });
    await db.insert(imagingStudyImages).values({ studyId, fileId: FILE_ID });

    const deleted: string[] = [];
    const storage = { async deleteFile(id: string) { deleted.push(id); } };
    const app = makeApp(db, ADMIN, storage);

    const created = await app.request('/dental/erasure-requests', J(reqBody));
    const reqRow = (await created.json()) as { id: string };
    const approved = await app.request(`/dental/erasure-requests/${reqRow.id}/approve`, J({}));
    expect(approved.status).toBe(200);
    expect(((await approved.json()) as any).status).toBe('anonymized');

    // S3 object physically deleted + storage row hard-deleted.
    expect(deleted).toContain(FILE_ID);
    const rows = await db.select().from(storedFiles).where(eq(storedFiles.id, FILE_ID));
    expect(rows).toHaveLength(0);
  });
});
