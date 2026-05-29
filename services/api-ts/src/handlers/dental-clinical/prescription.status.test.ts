/**
 * prescription.status.test.ts
 *
 * TDD: RED phase tests for EM-CLI-012 — prescription status FSM
 *
 * FSM: pending → dispensed | cancelled (both terminal)
 * New prescriptions must default to 'pending'.
 * Invalid transitions must return 422.
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError, BusinessLogicError } from '@/core/errors';
import {
  CreatePrescriptionBody,
  CreatePrescriptionParams,
  UpdatePrescriptionBody,
  UpdatePrescriptionParams,
} from '@/generated/openapi/validators';
import { createPrescription } from './prescriptions/createPrescription';
import { updatePrescription } from './prescriptions/updatePrescription';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: '00000000-0000-0000-0000-000000000001', email: 'test@clinic.com' };
const PATIENT_ID = 'a0000000-0000-1000-8000-000000000001';
const BRANCH_ID = 'b0000000-0000-1000-8000-000000000002';
const ORG_ID = 'd2000000-0000-1000-8000-000000000002';
const MEMBER_ID = 'c0000000-0000-1000-8000-000000000003';
const PERSON_ID = 'f2000000-0000-1000-8000-000000000002';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'FSM Test Clinic', tier: 'solo',
    ownerPersonId: TEST_USER.id, countryCode: 'PH',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch',
    timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: 'ee200000-0000-1000-8000-000000000002', branchId: BRANCH_ID,
    personId: TEST_USER.id, displayName: 'Test Dentist', role: 'dentist_owner',
    status: 'active', pinFailedAttempts: 0,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  // MEMBER_ID is used as dentistMemberId in seedVisit() and prescriberMemberId in seedPrescription();
  // it must exist as an active membership. Use PERSON_ID as personId to avoid the unique (personId, branchId) conflict.
  await db.insert(dentalMemberships).values({
    id: MEMBER_ID, branchId: BRANCH_ID,
    personId: PERSON_ID, displayName: 'Prescribing Dentist', role: 'dentist_associate',
    status: 'active', pinFailedAttempts: 0,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'Test', lastName: 'Patient',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
});

const ve = (result: any, c: any) => {
  if (!result.success) return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
};

const PrescriptionBodyOnly = CreatePrescriptionBody.omit({ visitId: true });

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

  app.post('/dental/visits/:visitId/prescriptions',
    zValidator('param', CreatePrescriptionParams, ve),
    zValidator('json', PrescriptionBodyOnly, ve),
    createPrescription as any,
  );
  app.patch('/dental/visits/:visitId/prescriptions/:prescriptionId',
    zValidator('param', UpdatePrescriptionParams, ve),
    zValidator('json', UpdatePrescriptionBody, ve),
    updatePrescription as any,
  );

  return app;
}

async function seedVisit() {
  const { VisitRepository } = await import('@/handlers/dental-visit/repos/visit.repo');
  const visitRepo = new VisitRepository(db);
  return visitRepo.createOne({ patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID });
}

async function seedPrescription(app: ReturnType<typeof buildTestApp>, visitId: string) {
  const res = await app.request(`/dental/visits/${visitId}/prescriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patientId: PATIENT_ID,
      prescriberMemberId: MEMBER_ID,
      drugName: 'Amoxicillin',
      dosage: '500mg',
      frequency: 'TID',
    }),
  });
  expect(res.status).toBe(201);
  return res.json() as Promise<any>;
}

afterEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE amendment, consent_form, dental_attachment, lab_order, medical_history_entry, prescription, dental_treatment, dental_visit CASCADE`,
  );
});

// ---------------------------------------------------------------------------
// EM-CLI-012: Default status
// ---------------------------------------------------------------------------

describe('EM-CLI-012: new prescription defaults to pending', () => {
  test('createPrescription returns status=pending', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        prescriberMemberId: MEMBER_ID,
        drugName: 'Ibuprofen',
        dosage: '400mg',
        frequency: 'BID',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.status).toBe('pending');
  });
});

// ---------------------------------------------------------------------------
// EM-CLI-012: Valid transitions
// ---------------------------------------------------------------------------

describe('EM-CLI-012: valid status transitions', () => {
  test('pending → dispensed returns 200 with status=dispensed', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();
    const prescription = await seedPrescription(app, visit.id);

    const res = await app.request(
      `/dental/visits/${visit.id}/prescriptions/${prescription.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'dispensed' }),
      },
    );

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('dispensed');
  });

  test('pending → cancelled returns 200 with status=cancelled', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();
    const prescription = await seedPrescription(app, visit.id);

    const res = await app.request(
      `/dental/visits/${visit.id}/prescriptions/${prescription.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      },
    );

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('cancelled');
  });
});

// ---------------------------------------------------------------------------
// EM-CLI-012: Invalid transitions → 422
// ---------------------------------------------------------------------------

describe('EM-CLI-012: invalid transitions return 422', () => {
  test('dispensed → dispensed (self-loop) returns 422', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();
    const prescription = await seedPrescription(app, visit.id);

    // Advance to dispensed
    const advance = await app.request(
      `/dental/visits/${visit.id}/prescriptions/${prescription.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'dispensed' }),
      },
    );
    expect(advance.status).toBe(200);

    // Try again from terminal state
    const res = await app.request(
      `/dental/visits/${visit.id}/prescriptions/${prescription.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'dispensed' }),
      },
    );
    expect(res.status).toBe(422);
  });

  test('dispensed → pending (backward) returns 422', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();
    const prescription = await seedPrescription(app, visit.id);

    await app.request(
      `/dental/visits/${visit.id}/prescriptions/${prescription.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'dispensed' }),
      },
    );

    const res = await app.request(
      `/dental/visits/${visit.id}/prescriptions/${prescription.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pending' }),
      },
    );
    expect(res.status).toBe(422);
  });

  test('cancelled → cancelled (terminal self-loop) returns 422', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();
    const prescription = await seedPrescription(app, visit.id);

    await app.request(
      `/dental/visits/${visit.id}/prescriptions/${prescription.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      },
    );

    const res = await app.request(
      `/dental/visits/${visit.id}/prescriptions/${prescription.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      },
    );
    expect(res.status).toBe(422);
  });
});
