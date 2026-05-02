/**
 * dental-visit handler tests — visit, chart, and notes handlers
 *
 * Covers: createDentalVisit, getDentalVisit, listDentalVisits, updateDentalVisit,
 *         getDentalChart, upsertDentalChart, updateTooth,
 *         getVisitNotes, upsertVisitNotes, getToothHistory
 *
 * Tests HTTP-level behavior: auth, validation, success on seeded data.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { VisitRepository } from './repos/visit.repo';
import { DentalChartRepository } from './repos/dental-chart.repo';
import { createDentalVisit } from './createDentalVisit';
import { getDentalVisit } from './getDentalVisit';
import { listDentalVisits } from './listDentalVisits';
import { updateDentalVisit } from './updateDentalVisit';
import { getDentalChart } from './getDentalChart';
import { upsertDentalChart } from './upsertDentalChart';
import { updateTooth } from './updateTooth';
import { getVisitNotes } from './getVisitNotes';
import { upsertVisitNotes } from './upsertVisitNotes';
import { getToothHistory } from './getToothHistory';

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

  // Visit routes
  app.post('/dental/visits', createDentalVisit as any);
  app.get('/dental/visits', listDentalVisits as any);
  app.get('/dental/visits/history/:patientId/teeth/:toothNumber', getToothHistory as any);
  app.get('/dental/visits/:visitId', getDentalVisit as any);
  app.patch('/dental/visits/:visitId', updateDentalVisit as any);

  // Chart routes
  app.get('/dental/visits/:visitId/chart', getDentalChart as any);
  app.post('/dental/visits/:visitId/chart', upsertDentalChart as any);
  app.patch('/dental/visits/:visitId/chart/teeth/:toothNumber', updateTooth as any);

  // Notes routes
  app.get('/dental/visits/:visitId/notes', getVisitNotes as any);
  app.post('/dental/visits/:visitId/notes', upsertVisitNotes as any);

  return app;
}

async function seedVisit(overrides?: Partial<{ patientId: string; status: string }>) {
  const repo = new VisitRepository(db);
  return repo.createOne({
    patientId: (overrides?.patientId ?? PATIENT_ID) as string,
    branchId: BRANCH_ID,
    dentistMemberId: DENTIST_MEMBER_ID,
  });
}

async function seedCompletedVisit() {
  const repo = new VisitRepository(db);
  const visit = await repo.createOne({
    patientId: PATIENT_ID,
    branchId: BRANCH_ID,
    dentistMemberId: DENTIST_MEMBER_ID,
  });
  return repo.complete(visit.id);
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
// createDentalVisit
// ---------------------------------------------------------------------------

describe('createDentalVisit handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request('/dental/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: DENTIST_MEMBER_ID }),
    });
    expect(res.status).toBe(401);
  });

  test('returns 400 when patientId is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId: BRANCH_ID, dentistMemberId: DENTIST_MEMBER_ID }),
    });
    expect(res.status).toBe(400);
  });

  test('returns 400 when branchId is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, dentistMemberId: DENTIST_MEMBER_ID }),
    });
    expect(res.status).toBe(400);
  });

  test('returns 400 when dentistMemberId is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, branchId: BRANCH_ID }),
    });
    expect(res.status).toBe(400);
  });

  test('returns 201 with created visit on valid input', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        branchId: BRANCH_ID,
        dentistMemberId: DENTIST_MEMBER_ID,
        chiefComplaint: 'Toothache upper left',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeTruthy();
    expect(body.patientId).toBe(PATIENT_ID);
    expect(body.status).toBe('draft');
    expect(body.chiefComplaint).toBe('Toothache upper left');
  });
});

// ---------------------------------------------------------------------------
// getDentalVisit
// ---------------------------------------------------------------------------

describe('getDentalVisit handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/visits/${NONEXISTENT_ID}`);
    expect(res.status).toBe(401);
  });

  test('returns 404 when visit does not exist', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${NONEXISTENT_ID}`);
    expect(res.status).toBe(404);
  });

  test('returns 200 with visit on valid id', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit!.id}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(visit!.id);
    expect(body.patientId).toBe(PATIENT_ID);
  });
});

// ---------------------------------------------------------------------------
// listDentalVisits
// ---------------------------------------------------------------------------

describe('listDentalVisits handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request('/dental/visits');
    expect(res.status).toBe(401);
  });

  test('returns 200 with empty list when no visits', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/visits');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
  });

  test('returns 200 with seeded visits', async () => {
    await seedVisit();
    await seedVisit({ patientId: 'a0000000-0000-1000-8000-000000000002' });
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/visits');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.items.length).toBe(2);
    expect(body.total).toBe(2);
  });

  test('filters by patientId', async () => {
    await seedVisit({ patientId: PATIENT_ID });
    await seedVisit({ patientId: 'a0000000-0000-1000-8000-000000000002' });
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits?patientId=${PATIENT_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.items.length).toBe(1);
    expect(body.items[0].patientId).toBe(PATIENT_ID);
  });
});

// ---------------------------------------------------------------------------
// updateDentalVisit
// ---------------------------------------------------------------------------

describe('updateDentalVisit handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/visits/${NONEXISTENT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    expect(res.status).toBe(401);
  });

  test('returns 404 when visit does not exist', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${NONEXISTENT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    expect(res.status).toBe(404);
  });

  test('returns 400 when status is invalid', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit!.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    expect(res.status).toBe(400);
  });

  test('returns 200 and activates visit', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit!.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('active');
    expect(body.activatedAt).toBeTruthy();
  });

  test('returns 200 and completes visit', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit!.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('completed');
    expect(body.completedAt).toBeTruthy();
  });

  test('returns 200 and locks visit', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit!.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'locked' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('locked');
    expect(body.lockedAt).toBeTruthy();
  });

  test('returns 200 and updates chiefComplaint', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit!.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chiefComplaint: 'Sensitivity to cold' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.chiefComplaint).toBe('Sensitivity to cold');
  });
});

// ---------------------------------------------------------------------------
// getDentalChart
// ---------------------------------------------------------------------------

describe('getDentalChart handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/visits/${NONEXISTENT_ID}/chart`);
    expect(res.status).toBe(401);
  });

  test('returns 404 when chart does not exist for visit', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit!.id}/chart`);
    expect(res.status).toBe(404);
  });

  test('returns 200 with chart when it exists', async () => {
    const visit = await seedVisit();
    const chartRepo = new DentalChartRepository(db);
    await chartRepo.upsert({
      visitId: visit!.id,
      patientId: PATIENT_ID,
      teeth: [{ toothNumber: 11, state: 'healthy' }],
    });
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit!.id}/chart`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.visitId).toBe(visit!.id);
    expect(Array.isArray(body.teeth)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// upsertDentalChart
// ---------------------------------------------------------------------------

describe('upsertDentalChart handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/visits/${NONEXISTENT_ID}/chart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, teeth: [] }),
    });
    expect(res.status).toBe(401);
  });

  test('returns 400 when patientId is missing', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit!.id}/chart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teeth: [] }),
    });
    expect(res.status).toBe(400);
  });

  test('returns 400 when teeth is not an array', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit!.id}/chart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, teeth: 'invalid' }),
    });
    expect(res.status).toBe(400);
  });

  test('returns 201 with created chart on valid input', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit!.id}/chart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        teeth: [
          { toothNumber: 11, state: 'healthy' },
          { toothNumber: 21, state: 'caries' },
        ],
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.visitId).toBe(visit!.id);
    expect(body.teeth.length).toBe(2);
  });

  test('updates existing chart on second upsert', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);

    await app.request(`/dental/visits/${visit!.id}/chart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, teeth: [{ toothNumber: 11, state: 'healthy' }] }),
    });

    const res = await app.request(`/dental/visits/${visit!.id}/chart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, teeth: [{ toothNumber: 11, state: 'filled' }] }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.teeth[0].state).toBe('filled');
  });
});

// ---------------------------------------------------------------------------
// updateTooth
// ---------------------------------------------------------------------------

describe('updateTooth handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/visits/${NONEXISTENT_ID}/chart/teeth/11`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'healthy' }),
    });
    expect(res.status).toBe(401);
  });

  test('returns 404 when chart does not exist for visit', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit!.id}/chart/teeth/11`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'caries' }),
    });
    expect(res.status).toBe(404);
  });

  test('returns 400 when state is missing', async () => {
    const visit = await seedVisit();
    const chartRepo = new DentalChartRepository(db);
    await chartRepo.upsert({ visitId: visit!.id, patientId: PATIENT_ID, teeth: [] });
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit!.id}/chart/teeth/11`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  test('returns 200 and updates tooth state', async () => {
    const visit = await seedVisit();
    const chartRepo = new DentalChartRepository(db);
    await chartRepo.upsert({
      visitId: visit!.id,
      patientId: PATIENT_ID,
      teeth: [{ toothNumber: 11, state: 'healthy' }],
    });
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit!.id}/chart/teeth/11`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'caries', surfaces: ['mesial', 'distal'], conditionCode: 'K02.1' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const tooth = (body.teeth as any[]).find(t => t.toothNumber === 11);
    expect(tooth?.state).toBe('caries');
    expect(tooth?.conditionCode).toBe('K02.1');
  });
});

// ---------------------------------------------------------------------------
// getVisitNotes
// ---------------------------------------------------------------------------

describe('getVisitNotes handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/visits/${NONEXISTENT_ID}/notes`);
    expect(res.status).toBe(401);
  });

  test('returns 404 when notes do not exist for visit', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit!.id}/notes`);
    expect(res.status).toBe(404);
  });

  test('returns 200 with notes when they exist', async () => {
    const visit = await seedVisit();
    // Create notes via upsert endpoint first
    const app = buildTestApp(TEST_USER);
    await app.request(`/dental/visits/${visit!.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subjective: 'Patient reports pain', plan: 'Extract tooth 11' }),
    });

    const res = await app.request(`/dental/visits/${visit!.id}/notes`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.visitId).toBe(visit!.id);
    expect(body.subjective).toBe('Patient reports pain');
  });
});

// ---------------------------------------------------------------------------
// upsertVisitNotes
// ---------------------------------------------------------------------------

describe('upsertVisitNotes handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/visits/${NONEXISTENT_ID}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'some notes' }),
    });
    expect(res.status).toBe(401);
  });

  test('returns 201 with created notes on valid input', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit!.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subjective: 'Patient complains of sensitivity',
        objective: 'Visible caries on tooth 21',
        assessment: 'Moderate caries',
        plan: 'Composite filling',
        notes: 'Follow up in 6 months',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.visitId).toBe(visit!.id);
    expect(body.authorMemberId).toBe(TEST_USER.id);
    expect(body.subjective).toBe('Patient complains of sensitivity');
    expect(body.plan).toBe('Composite filling');
  });

  test('updates notes on second upsert', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);

    await app.request(`/dental/visits/${visit!.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subjective: 'First note' }),
    });

    const res = await app.request(`/dental/visits/${visit!.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subjective: 'Updated note' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.subjective).toBe('Updated note');
  });
});

// ---------------------------------------------------------------------------
// getToothHistory
// ---------------------------------------------------------------------------

describe('getToothHistory handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/visits/history/${PATIENT_ID}/teeth/11`);
    expect(res.status).toBe(401);
  });

  test('returns 200 with empty items when no completed visits', async () => {
    // Only a draft visit — not included in history
    await seedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/history/${PATIENT_ID}/teeth/11`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
  });

  test('returns 200 with tooth history entries from completed visits', async () => {
    const completedVisit = await seedCompletedVisit();
    const chartRepo = new DentalChartRepository(db);
    await chartRepo.upsert({
      visitId: completedVisit!.id,
      patientId: PATIENT_ID,
      teeth: [{ toothNumber: 11, state: 'caries', conditionCode: 'K02.1' }],
    });

    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/history/${PATIENT_ID}/teeth/11`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.total).toBe(1);
    expect(body.items[0].toothNumber).toBe(11);
    expect(body.items[0].state).toBe('caries');
    expect(body.items[0].visitId).toBe(completedVisit!.id);
  });
});
