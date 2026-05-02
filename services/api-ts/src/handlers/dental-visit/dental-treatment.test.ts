/**
 * dental-treatment handler tests
 *
 * Covers: createDentalTreatment, listDentalTreatments, updateDentalTreatment
 *
 * Tests HTTP-level behavior: auth, validation, success on seeded data.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { VisitRepository } from './repos/visit.repo';
import { TreatmentRepository } from './repos/treatment.repo';
import { createDentalTreatment } from './createDentalTreatment';
import { listDentalTreatments } from './listDentalTreatments';
import { updateDentalTreatment } from './updateDentalTreatment';

const db = createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' });

const TEST_USER = { id: '00000000-0000-0000-0000-000000000001', email: 'test@clinic.com' };
const PATIENT_ID = 'a0000000-0000-1000-8000-000000000001';
const BRANCH_ID = 'b0000000-0000-1000-8000-000000000002';
const DENTIST_MEMBER_ID = 'c0000000-0000-1000-8000-000000000003';
const NONEXISTENT_ID = 'f0000000-0000-1000-8000-000000000099';

function buildTestApp(user?: typeof TEST_USER) {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
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

  app.post('/dental/visits/:visitId/treatments', createDentalTreatment as any);
  app.get('/dental/visits/:visitId/treatments', listDentalTreatments as any);
  app.patch('/dental/visits/:visitId/treatments/:treatmentId', updateDentalTreatment as any);

  return app;
}

async function seedVisit() {
  const repo = new VisitRepository(db);
  return repo.createOne({
    patientId: PATIENT_ID,
    branchId: BRANCH_ID,
    dentistMemberId: DENTIST_MEMBER_ID,
  });
}

async function seedTreatment(visitId: string) {
  const repo = new TreatmentRepository(db);
  return repo.createOne({
    visitId,
    patientId: PATIENT_ID,
    cdtCode: 'D0120',
    description: 'Periodic oral evaluation',
    priceCents: 5000,
    carriedOver: false,
  });
}

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

afterEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE dental_treatment, dental_chart, visit_notes, dental_visit CASCADE`,
  );
});

// ---------------------------------------------------------------------------
// createDentalTreatment
// ---------------------------------------------------------------------------

describe('createDentalTreatment handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/visits/${NONEXISTENT_ID}/treatments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        cdtCode: 'D0120',
        description: 'Periodic oral evaluation',
        priceCents: 5000,
      }),
    });
    expect(res.status).toBe(401);
  });

  test('returns 400 when patientId is missing', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cdtCode: 'D0120', description: 'Eval', priceCents: 5000 }),
    });
    expect(res.status).toBe(400);
  });

  test('returns 400 when cdtCode is missing', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, description: 'Eval', priceCents: 5000 }),
    });
    expect(res.status).toBe(400);
  });

  test('returns 400 when description is missing', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, cdtCode: 'D0120', priceCents: 5000 }),
    });
    expect(res.status).toBe(400);
  });

  test('returns 400 when priceCents is missing', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, cdtCode: 'D0120', description: 'Eval' }),
    });
    expect(res.status).toBe(400);
  });

  test('returns 400 when priceCents is not a number', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, cdtCode: 'D0120', description: 'Eval', priceCents: 'free' }),
    });
    expect(res.status).toBe(400);
  });

  test('returns 201 with created treatment on valid input', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        cdtCode: 'D1110',
        description: 'Adult prophylaxis',
        priceCents: 8500,
        toothNumber: 11,
        surfaces: ['mesial', 'distal'],
        conditionCode: 'K02.1',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeTruthy();
    expect(body.visitId).toBe(visit.id);
    expect(body.patientId).toBe(PATIENT_ID);
    expect(body.cdtCode).toBe('D1110');
    expect(body.priceCents).toBe(8500);
    expect(body.status).toBe('diagnosed');
    expect(body.toothNumber).toBe(11);
  });
});

// ---------------------------------------------------------------------------
// listDentalTreatments
// ---------------------------------------------------------------------------

describe('listDentalTreatments handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/visits/${NONEXISTENT_ID}/treatments`);
    expect(res.status).toBe(401);
  });

  test('returns 200 with empty list when visit has no treatments', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
  });

  test('returns 200 with seeded treatments for visit', async () => {
    const visit = await seedVisit();
    await seedTreatment(visit.id);
    await seedTreatment(visit.id);
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.items.length).toBe(2);
    expect(body.total).toBe(2);
    expect(body.items[0].visitId).toBe(visit.id);
  });

  test('returns only treatments for the specified visit', async () => {
    const visit1 = await seedVisit();
    const visit2 = await seedVisit();
    await seedTreatment(visit1.id);
    await seedTreatment(visit2.id);
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit1.id}/treatments`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.items.length).toBe(1);
    expect(body.items[0].visitId).toBe(visit1.id);
  });
});

// ---------------------------------------------------------------------------
// updateDentalTreatment
// ---------------------------------------------------------------------------

describe('updateDentalTreatment handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/visits/${NONEXISTENT_ID}/treatments/${NONEXISTENT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'planned' }),
    });
    expect(res.status).toBe(401);
  });

  test('returns 404 when treatment does not exist', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments/${NONEXISTENT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'planned' }),
    });
    expect(res.status).toBe(404);
  });

  test('returns 400 when status is invalid', async () => {
    const visit = await seedVisit();
    const treatment = await seedTreatment(visit.id);
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments/${treatment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    expect(res.status).toBe(400);
  });

  test('returns 200 and advances treatment to planned', async () => {
    const visit = await seedVisit();
    const treatment = await seedTreatment(visit.id);
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments/${treatment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'planned' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('planned');
  });

  test('returns 200 and advances treatment to performed', async () => {
    const visit = await seedVisit();
    const treatment = await seedTreatment(visit.id);
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments/${treatment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'performed' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('performed');
  });

  test('returns 200 and dismisses treatment with reason', async () => {
    const visit = await seedVisit();
    const treatment = await seedTreatment(visit.id);
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments/${treatment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'dismissed', dismissReason: 'Patient refused' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('dismissed');
    expect(body.dismissReason).toBe('Patient refused');
  });

  test('returns 200 and updates tooth and CDT fields', async () => {
    const visit = await seedVisit();
    const treatment = await seedTreatment(visit.id);
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/treatments/${treatment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toothNumber: 22,
        surfaces: ['buccal'],
        cdtCode: 'D2140',
        description: 'Amalgam restoration',
        conditionCode: 'K02.9',
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.toothNumber).toBe(22);
    expect(body.cdtCode).toBe('D2140');
    expect(body.conditionCode).toBe('K02.9');
  });

  test('EC4: priceCents is locked at creation — update cannot change fee', async () => {
    const visit = await seedVisit();
    const treatment = await seedTreatment(visit.id);
    const app = buildTestApp(TEST_USER);

    // Attempt to change price in update
    const res = await app.request(`/dental/visits/${visit.id}/treatments/${treatment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceCents: 99999 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    // priceCents must remain at original value — EC4 locks it
    expect(body.priceCents).toBe(treatment.priceCents);
    expect(body.priceCents).not.toBe(99999);
  });
});
