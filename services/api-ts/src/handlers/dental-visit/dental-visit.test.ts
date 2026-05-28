/**
 * dental-visit handler tests — visit, chart, and notes handlers
 *
 * Covers: createDentalVisit, getDentalVisit, listDentalVisits, updateDentalVisit,
 *         getDentalChart, upsertDentalChart, updateTooth,
 *         getVisitNotes, upsertVisitNotes, getToothHistory, updateDentalTreatment
 *
 * Tests HTTP-level behavior: auth, validation, success on seeded data.
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  CreateDentalVisitBody,
  UpdateDentalVisitBody, UpdateDentalVisitParams,
  UpsertDentalChartBody, UpsertDentalChartParams,
  UpdateToothBody, UpdateToothParams,
  UpsertVisitNotesBody, UpsertVisitNotesParams,
  UpdateDentalTreatmentBody, UpdateDentalTreatmentParams,
} from '@/generated/openapi/validators';
import { VisitRepository } from './repos/visit.repo';
import { DentalChartRepository } from './repos/dental-chart.repo';
import { TreatmentRepository, VisitNotesRepository } from './repos/treatment.repo';
import { ConsentFormRepository } from '@/handlers/dental-clinical/repos/consent-form.repo';
import { consentForms } from '@/handlers/dental-clinical/repos/consent-form.schema';
import { createDentalVisit } from './visits/createDentalVisit';
import { getDentalVisit } from './visits/getDentalVisit';
import { listDentalVisits } from './visits/listDentalVisits';
import { updateDentalVisit } from './visits/updateDentalVisit';
import { getDentalChart } from './chart/getDentalChart';
import { upsertDentalChart } from './chart/upsertDentalChart';
import { updateTooth } from './chart/updateTooth';
import { getVisitNotes } from './notes/getVisitNotes';
import { upsertVisitNotes } from './notes/upsertVisitNotes';
import { getToothHistory } from './chart/getToothHistory';
import { updateDentalTreatment } from './treatments/updateDentalTreatment';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique BRANCH_ID + membership id (tag a01) breaks the cross-suite
// collision on dental_membership's (person_id, branch_id) partial unique index.
// Org/patient/person ids stay at their original deterministic values so
// onConflictDoNothing is a correct no-op against rows from prior runs.
const TEST_USER = { id: '00000000-0000-0000-0000-000000000001', email: 'test@clinic.com' };
const STAFF_USER = { id: '00000000-0000-0000-0000-000000000099', email: 'staff@clinic.com' };
const PATIENT_ID = 'a0000000-0000-1000-8000-000000000001';
const PERSON_ID = 'e0000000-0000-1000-8000-000000000001';
const BRANCH_ID = '7b000000-0000-4000-8000-000000000a01';
const ORG_ID = 'da000000-0000-1000-8000-000000000002';
const DENTIST_MEMBER_ID = '7c000000-0000-4000-8000-000000000a01';
const STAFF_MEMBER_ID = '7c000000-0000-4000-8000-000000000a99';
const PATIENT_2_ID = 'a0000000-0000-1000-8000-000000000002';
const PERSON_2_ID = 'e0000000-0000-1000-8000-000000000002';
const NONEXISTENT_ID = 'f0000000-0000-1000-8000-000000000099';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'DentalVisit Clinic', tier: 'solo',
    ownerPersonId: TEST_USER.id, countryCode: 'PH',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch',
    timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: DENTIST_MEMBER_ID, branchId: BRANCH_ID,
    personId: TEST_USER.id, displayName: 'Test Dentist', role: 'dentist_owner',
    status: 'active', pinFailedAttempts: 0,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: STAFF_MEMBER_ID, branchId: BRANCH_ID,
    personId: STAFF_USER.id, displayName: 'Test Staff', role: 'staff_full',
    status: 'active', pinFailedAttempts: 0,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'Test', lastName: 'Patient', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  // Second patient for listDentalVisits multi-patient tests
  await db.insert(persons).values({ id: PERSON_2_ID, firstName: 'Test2', lastName: 'Patient', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_2_ID, person: PERSON_2_ID, preferredBranchId: BRANCH_ID, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
});

const ve = (result: any, c: any) => {
  if (!result.success) return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
};

const ChartBodyOnly = UpsertDentalChartBody.omit({ visitId: true });
const VisitNotesBodyOnly = UpsertVisitNotesBody.omit({ visitId: true });
const UpdateToothParamsCoerced = UpdateToothParams.extend({ toothNumber: z.union([z.number().int(), z.string().transform(Number)]) });

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
  app.post('/dental/visits', zValidator('json', CreateDentalVisitBody, ve), createDentalVisit as any);
  app.get('/dental/visits', listDentalVisits as any);
  app.get('/dental/visits/history/:patientId/teeth/:toothNumber', getToothHistory as any);
  app.get('/dental/visits/:visitId', getDentalVisit as any);
  app.patch('/dental/visits/:visitId', zValidator('param', UpdateDentalVisitParams, ve), zValidator('json', UpdateDentalVisitBody, ve), updateDentalVisit as any);

  // Chart routes
  app.get('/dental/visits/:visitId/chart', getDentalChart as any);
  app.post('/dental/visits/:visitId/chart', zValidator('param', UpsertDentalChartParams, ve), zValidator('json', ChartBodyOnly, ve), upsertDentalChart as any);
  app.patch('/dental/visits/:visitId/chart/teeth/:toothNumber', zValidator('param', UpdateToothParamsCoerced, ve), zValidator('json', UpdateToothBody, ve), updateTooth as any);

  // Notes routes
  app.get('/dental/visits/:visitId/notes', getVisitNotes as any);
  app.post('/dental/visits/:visitId/notes', zValidator('param', UpsertVisitNotesParams, ve), zValidator('json', VisitNotesBodyOnly, ve), upsertVisitNotes as any);

  // Treatment routes
  app.patch('/dental/visits/:visitId/treatments/:treatmentId', zValidator('param', UpdateDentalTreatmentParams, ve), zValidator('json', UpdateDentalTreatmentBody, ve), updateDentalTreatment as any);

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

async function seedSignedConsent(visitId: string) {
  await db.insert(consentForms).values({
    visitId,
    patientId: PATIENT_ID,
    templateId: 'template-standard',
    templateName: 'Standard Consent',
    signed: true,
    signedAt: new Date(),
    signatureData: 'test-sig',
    createdBy: TEST_USER.id,
    updatedBy: TEST_USER.id,
  });
}

async function seedNotes(visitId: string) {
  const notesRepo = new VisitNotesRepository(db);
  await notesRepo.upsert({
    visitId,
    authorMemberId: DENTIST_MEMBER_ID,
    subjective: 'Patient reports pain',
    plan: 'Extract tooth 11',
    createdBy: TEST_USER.id,
    updatedBy: TEST_USER.id,
  });
}

async function seedPerformedTreatment(visitId: string) {
  // Seeds a performed treatment to make the visit non-empty (bypasses BR-005 auto-discard).
  const { dentalTreatments } = await import('./repos/treatment.schema');
  await db.insert(dentalTreatments).values({
    id: crypto.randomUUID(), visitId, patientId: PATIENT_ID,
    cdtCode: 'D0120', description: 'Periodic eval',
    priceCents: 10000, status: 'performed', carriedOver: false,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  });
}

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

afterEach(async () => {
  // delete in FK-dependency order; non-cascade refs must precede their targets.
  // billing tables
  await db.execute(sql`DELETE FROM dental_payment`);
  await db.execute(sql`DELETE FROM dental_payment_plan`);
  await db.execute(sql`DELETE FROM dental_invoice`); // cascades → dental_invoice_line_item
  // clinical tables
  await db.execute(sql`DELETE FROM dental_treatment`);
  await db.execute(sql`DELETE FROM dental_chart`);
  await db.execute(sql`DELETE FROM visit_notes`);
  await db.execute(sql`DELETE FROM consent_form`);
  // other modules with non-cascade FKs to dental_visit
  await db.execute(sql`DELETE FROM pmd_document`);
  await db.execute(sql`UPDATE imaging_finding SET visit_id = NULL WHERE visit_id IS NOT NULL`);
  await db.execute(sql`UPDATE dental_appointment SET visit_id = NULL WHERE visit_id IS NOT NULL`);
  await db.execute(sql`DELETE FROM dental_visit`); // cascades → lab_order, attachment, amendment, prescription
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
    const res = await app.request(`/dental/visits?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toEqual([]);
    expect(body.pagination.totalCount).toBe(0);
  });

  test('returns 200 with seeded visits', async () => {
    await seedVisit();
    await seedVisit({ patientId: 'a0000000-0000-1000-8000-000000000002' });
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.length).toBe(2);
    expect(body.pagination.totalCount).toBe(2);
  });

  test('filters by patientId', async () => {
    await seedVisit({ patientId: PATIENT_ID });
    await seedVisit({ patientId: 'a0000000-0000-1000-8000-000000000002' });
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits?branchId=${BRANCH_ID}&patientId=${PATIENT_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.length).toBe(1);
    expect(body.data[0].patientId).toBe(PATIENT_ID);
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
    expect(body.activatedAt).not.toBeNull();
  });

  test('returns 200 and completes visit', async () => {
    const visit = await seedVisit();
    const repo = new VisitRepository(db);
    await repo.activate(visit!.id); // draft → active first
    await seedSignedConsent(visit!.id);
    await seedNotes(visit!.id);
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit!.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('completed');
    expect(body.completedAt).not.toBeNull();
  });

  test('returns 200 and locks visit', async () => {
    const visit = await seedVisit();
    const repo = new VisitRepository(db);
    await repo.activate(visit!.id); // draft → active
    await repo.complete(visit!.id); // active → completed
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit!.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'locked' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('locked');
    expect(body.lockedAt).not.toBeNull();
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

  test('persists surface data on updateTooth and returns it on chart read [AC-CHART-05]', async () => {
    const visit = await seedVisit();
    const chartRepo = new DentalChartRepository(db);
    await chartRepo.upsert({
      visitId: visit!.id,
      patientId: PATIENT_ID,
      teeth: [{ toothNumber: 14, state: 'healthy' }],
    });
    const app = buildTestApp(TEST_USER);

    // Update tooth with surface data
    const patchRes = await app.request(`/dental/visits/${visit!.id}/chart/teeth/14`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'caries', surfaces: ['mesial', 'occlusal', 'distal'] }),
    });
    expect(patchRes.status).toBe(200);

    // Read chart back and verify surfaces persisted
    const getRes = await app.request(`/dental/visits/${visit!.id}/chart`);
    expect(getRes.status).toBe(200);
    const chart = await getRes.json() as any;
    const tooth = (chart.teeth as any[]).find((t: any) => t.toothNumber === 14);
    expect(tooth).not.toBeUndefined();
    expect(tooth.state).toBe('caries');
    expect(tooth.surfaces).toEqual(['mesial', 'occlusal', 'distal']);
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
    expect(body.authorMemberId).toBe(DENTIST_MEMBER_ID);
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
    expect(body.data).toEqual([]);
    expect(body.pagination.totalCount).toBe(0);
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
    expect(body.pagination.totalCount).toBe(1);
    expect(body.data[0].toothNumber).toBe(11);
    expect(body.data[0].state).toBe('caries');
    expect(body.data[0].visitId).toBe(completedVisit!.id);
  });
});

// ---------------------------------------------------------------------------
// Role gate — updateDentalVisit (dentist_* only)
// ---------------------------------------------------------------------------

describe('updateDentalVisit role gate', () => {
  test('staff_full → 403', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(STAFF_USER);
    const res = await app.request(`/dental/visits/${visit.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    expect(res.status).toBe(403);
  });

  test('dentist_owner → passes role gate (not 403)', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    expect(res.status).not.toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Role gate — createDentalVisit (FIX-05)
// ---------------------------------------------------------------------------

describe('createDentalVisit role gate', () => {
  test('staff_full → 403', async () => {
    const app = buildTestApp(STAFF_USER);
    const res = await app.request('/dental/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: DENTIST_MEMBER_ID }),
    });
    expect(res.status).toBe(403);
  });

  test('dentist_owner → passes role gate (not 403)', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: DENTIST_MEMBER_ID }),
    });
    expect(res.status).not.toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Role gate — upsertDentalChart (FIX-05)
// ---------------------------------------------------------------------------

describe('upsertDentalChart role gate', () => {
  test('staff_full → 403', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(STAFF_USER);
    const res = await app.request(`/dental/visits/${visit.id}/chart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, teeth: [] }),
    });
    expect(res.status).toBe(403);
  });

  test('dentist_owner → passes role gate (not 403)', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/chart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, teeth: [] }),
    });
    expect(res.status).not.toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Completion preconditions (FIX-03)
// ---------------------------------------------------------------------------

describe('updateDentalVisit — completion preconditions (FIX-03)', () => {
  test('422 VISIT_HAS_OPEN_TREATMENTS when diagnosed treatments remain', async () => {
    const visit = await seedVisit();
    const visitRepo = new VisitRepository(db);
    await visitRepo.activate(visit!.id);
    const treatRepo = new TreatmentRepository(db);
    await treatRepo.createOne({
      visitId: visit!.id,
      patientId: PATIENT_ID,
      cdtCode: 'D0120',
      description: 'Periodic exam',
      priceCents: 5000,
      status: 'diagnosed',
      createdBy: TEST_USER.id,
      updatedBy: TEST_USER.id,
    });
    await seedSignedConsent(visit!.id);
    await seedNotes(visit!.id);

    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit!.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('VISIT_HAS_OPEN_TREATMENTS');
  });

  test('422 VISIT_CONSENT_REQUIRED when no signed consent form', async () => {
    const visit = await seedVisit();
    const visitRepo = new VisitRepository(db);
    await visitRepo.activate(visit!.id);
    await seedPerformedTreatment(visit!.id); // BR-005: must have content to reach consent guard
    await seedNotes(visit!.id);
    // no consent form seeded

    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit!.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('VISIT_CONSENT_REQUIRED');
  });

  test('422 VISIT_NOTES_REQUIRED when no visit notes', async () => {
    const visit = await seedVisit();
    const visitRepo = new VisitRepository(db);
    await visitRepo.activate(visit!.id);
    await seedPerformedTreatment(visit!.id); // BR-005: must have content to reach notes guard
    await seedSignedConsent(visit!.id);
    // no notes seeded

    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit!.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('VISIT_NOTES_REQUIRED');
  });

  test('200 when all preconditions satisfied', async () => {
    const visit = await seedVisit();
    const visitRepo = new VisitRepository(db);
    await visitRepo.activate(visit!.id);
    await seedSignedConsent(visit!.id);
    await seedNotes(visit!.id);
    // no open treatments

    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit!.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('completed');
  });
});

// ---------------------------------------------------------------------------
// Role gate — upsertVisitNotes (FIX-05)
// ---------------------------------------------------------------------------

describe('upsertVisitNotes role gate', () => {
  test('staff_full → 403', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(STAFF_USER);
    const res = await app.request(`/dental/visits/${visit.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'some notes' }),
    });
    expect(res.status).toBe(403);
  });

  test('dentist_owner → passes role gate (not 403)', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'some notes' }),
    });
    expect(res.status).not.toBe(403);
  });
});

// ---------------------------------------------------------------------------
// updateDentalTreatment
// ---------------------------------------------------------------------------

describe('updateDentalTreatment handler', () => {
  test('sets performedAt when treatment transitions to performed', async () => {
    // 1. Create a visit
    const visit = await seedVisit();

    // 2. Create a treatment in 'planned' status
    const treatRepo = new TreatmentRepository(db);
    const treatment = await treatRepo.createOne({
      visitId: visit!.id,
      patientId: PATIENT_ID,
      cdtCode: 'D2150',
      description: 'Amalgam filling',
      priceCents: 8000,
      status: 'planned',
      carriedOver: false,
      createdBy: TEST_USER.id,
      updatedBy: TEST_USER.id,
    });

    // 3. Insert a signed consent form for the visit
    await seedSignedConsent(visit!.id);

    // 4. PATCH treatment to status: 'performed'
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit!.id}/treatments/${treatment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'performed' }),
    });

    // 5. Expect 200
    expect(res.status).toBe(200);

    // 6. Expect body.performedAt to be a non-null ISO string
    const body = await res.json() as any;
    expect(body.performedAt).not.toBeNull();
    expect(typeof body.performedAt).toBe('string');
    expect(new Date(body.performedAt).getTime()).not.toBeNaN();
  });
});
