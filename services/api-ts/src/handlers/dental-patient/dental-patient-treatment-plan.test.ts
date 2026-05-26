/**
 * dental-patient-treatment-plan.test.ts — TreatmentPlan Entity + Plan-Level FSM (P0-C)
 *
 * AC-001  POST returns 201 with plan (status defaults to 'draft')
 * AC-002  GET returns 200 with list of patient's plans
 * AC-003  PATCH status: draft → presented succeeds (200)
 * AC-004  PATCH status: presented → approved succeeds (200), sets approvedAt
 * AC-005  PATCH status: approved → in_progress succeeds (200)
 * AC-006  PATCH status: any non-terminal → cancelled succeeds (200)
 * AC-007  PATCH status: completed → anything rejected 422
 * AC-008  PATCH status: cancelled → anything rejected 422
 * AC-009  401 without auth
 * AC-010  404 for non-existent patient
 * AC-011  404 for non-existent planId
 * AC-012  400 for missing providerId on create
 * BR-001  Only one 'draft' plan per patient allowed (409 on duplicate)
 * BR-002  totalEstimateCents must be non-negative
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  TreatmentPlanParams,
  TreatmentPlanPlanParams,
  CreateTreatmentPlanBody,
  UpdateTreatmentPlanBody,
} from './treatment-plan-validators';
import { createTreatmentPlan } from './createTreatmentPlan';
import { listPatientTreatmentPlans } from './listPatientTreatmentPlans';
import { updateTreatmentPlan } from './updateTreatmentPlan';

const db = createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' });

const TEST_USER = { id: 'a0000000-0000-1000-8000-000000000001', email: 'staff@clinic.com' };
const BRANCH_ID = 'b0000000-0000-1000-8000-000000000033';
const ORG_ID = 'c0000000-0000-1000-8000-000000000033';
const PATIENT_ID = 'd0000000-0000-1000-8000-000000000033';
const PERSON_ID = 'e0000000-0000-1000-8000-000000000033';
const NONEXISTENT_ID = 'f0000000-0000-1000-8000-000000000099';

const ve = (result: any, c: any) => {
  if (!result.success) {
    return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
  }
};

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'TP Clinic', tier: 'solo',
    ownerPersonId: TEST_USER.id, countryCode: 'PH',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID,
    name: 'Main Branch', timezone: 'Asia/Manila',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalMemberships).values({
    id: 'a1000000-0000-1000-8000-000000000033',
    branchId: BRANCH_ID, personId: TEST_USER.id,
    displayName: 'Dentist', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'Plan', lastName: 'Patient',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID,
    preferredBranchId: BRANCH_ID,
    status: 'active',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
});

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
    if (user) ctx.set('user', user);
    await next();
  });

  app.post(
    '/dental/patients/:patientId/treatment-plans',
    zValidator('param', TreatmentPlanParams, ve),
    zValidator('json', CreateTreatmentPlanBody, ve),
    createTreatmentPlan as any,
  );
  app.get(
    '/dental/patients/:patientId/treatment-plans',
    zValidator('param', TreatmentPlanParams, ve),
    listPatientTreatmentPlans as any,
  );
  app.patch(
    '/dental/patients/:patientId/treatment-plans/:planId',
    zValidator('param', TreatmentPlanPlanParams, ve),
    zValidator('json', UpdateTreatmentPlanBody, ve),
    updateTreatmentPlan as any,
  );

  return app;
}

async function truncatePlans() {
  const { dentalTreatmentPlans } = await import('./repos/treatment-plan.schema');
  await db.delete(dentalTreatmentPlans).where(eq(dentalTreatmentPlans.patientId, PATIENT_ID));
}

afterEach(async () => {
  await truncatePlans();
});

// =============================================================================
// AC-001: POST creates plan in draft status
// =============================================================================

describe('POST /dental/patients/:patientId/treatment-plans (AC-001, AC-012)', () => {
  test('AC-001: creates plan and returns 201 with draft status', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/treatment-plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        providerId: TEST_USER.id,
        totalEstimateCents: 15000,
        notes: 'Full mouth restoration plan',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeDefined();
    expect(body.patientId).toBe(PATIENT_ID);
    expect(body.providerId).toBe(TEST_USER.id);
    expect(body.status).toBe('draft');
    expect(body.totalEstimateCents).toBe(15000);
    expect(body.notes).toBe('Full mouth restoration plan');
    expect(body.approvedAt).toBeNull();
  });

  test('AC-001: totalEstimateCents defaults to 0', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/treatment-plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId: TEST_USER.id }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.totalEstimateCents).toBe(0);
  });

  test('AC-012: returns 400 when providerId missing', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/treatment-plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ totalEstimateCents: 5000 }),
    });

    expect(res.status).toBe(400);
  });

  test('BR-002: returns 400 for negative totalEstimateCents', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/treatment-plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId: TEST_USER.id, totalEstimateCents: -100 }),
    });

    expect(res.status).toBe(400);
  });
});

// =============================================================================
// AC-002: GET list
// =============================================================================

describe('GET /dental/patients/:patientId/treatment-plans (AC-002)', () => {
  test('AC-002: returns empty array when no plans', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/patients/${PATIENT_ID}/treatment-plans`);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(0);
  });

  test('AC-002: returns list with created plan', async () => {
    const app = buildTestApp(TEST_USER);

    await app.request(`/dental/patients/${PATIENT_ID}/treatment-plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId: TEST_USER.id, totalEstimateCents: 5000 }),
    });

    const res = await app.request(`/dental/patients/${PATIENT_ID}/treatment-plans`);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.length).toBe(1);
    expect(body[0].status).toBe('draft');
  });
});

// =============================================================================
// AC-003..AC-008: FSM transitions
// =============================================================================

describe('TreatmentPlan FSM (AC-003..AC-008)', () => {
  async function createPlan(app: Hono) {
    const res = await app.request(`/dental/patients/${PATIENT_ID}/treatment-plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId: TEST_USER.id, totalEstimateCents: 10000 }),
    });
    return (await res.json()) as any;
  }

  async function transition(app: Hono, planId: string, status: string) {
    return app.request(`/dental/patients/${PATIENT_ID}/treatment-plans/${planId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  }

  test('AC-003: draft → presented succeeds', async () => {
    const app = buildTestApp(TEST_USER);
    const plan = await createPlan(app);

    const res = await transition(app, plan.id, 'presented');

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('presented');
    expect(body.presentedAt).toBeTruthy();
  });

  test('AC-004: presented → approved succeeds, sets approvedAt', async () => {
    const app = buildTestApp(TEST_USER);
    const plan = await createPlan(app);

    await transition(app, plan.id, 'presented');
    const res = await transition(app, plan.id, 'approved');

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('approved');
    expect(body.approvedAt).toBeTruthy();
  });

  test('AC-005: approved → in_progress succeeds', async () => {
    const app = buildTestApp(TEST_USER);
    const plan = await createPlan(app);

    await transition(app, plan.id, 'presented');
    await transition(app, plan.id, 'approved');
    const res = await transition(app, plan.id, 'in_progress');

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('in_progress');
  });

  test('AC-005: in_progress → completed succeeds', async () => {
    const app = buildTestApp(TEST_USER);
    const plan = await createPlan(app);

    await transition(app, plan.id, 'presented');
    await transition(app, plan.id, 'approved');
    await transition(app, plan.id, 'in_progress');
    const res = await transition(app, plan.id, 'completed');

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('completed');
  });

  test('AC-006: draft → cancelled is allowed', async () => {
    const app = buildTestApp(TEST_USER);
    const plan = await createPlan(app);

    const res = await transition(app, plan.id, 'cancelled');

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('cancelled');
  });

  test('AC-007: completed → presented rejected 422', async () => {
    const app = buildTestApp(TEST_USER);
    const plan = await createPlan(app);

    await transition(app, plan.id, 'presented');
    await transition(app, plan.id, 'approved');
    await transition(app, plan.id, 'in_progress');
    await transition(app, plan.id, 'completed');

    const res = await transition(app, plan.id, 'presented');
    expect(res.status).toBe(422);
  });

  test('AC-008: cancelled → approved rejected 422', async () => {
    const app = buildTestApp(TEST_USER);
    const plan = await createPlan(app);

    await transition(app, plan.id, 'cancelled');
    const res = await transition(app, plan.id, 'approved');
    expect(res.status).toBe(422);
  });

  test('skipping presented → approved directly from draft rejected 422', async () => {
    const app = buildTestApp(TEST_USER);
    const plan = await createPlan(app);

    const res = await transition(app, plan.id, 'approved');
    expect(res.status).toBe(422);
  });

  // GAP-003 RED: IDEAL standard §3.6 — the state is called "partially_completed", not "in_progress"
  test('GAP-003 AC-005r: approved → partially_completed succeeds (IDEAL §3.6)', async () => {
    const app = buildTestApp(TEST_USER);
    const plan = await createPlan(app);

    await transition(app, plan.id, 'presented');
    await transition(app, plan.id, 'approved');
    const res = await transition(app, plan.id, 'partially_completed');

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('partially_completed');
  });

  test('GAP-003 AC-005r: in_progress is no longer a valid status (removed)', async () => {
    const app = buildTestApp(TEST_USER);
    const plan = await createPlan(app);

    await transition(app, plan.id, 'presented');
    await transition(app, plan.id, 'approved');
    const res = await transition(app, plan.id, 'in_progress');

    expect(res.status).toBe(422);
  });
});

// =============================================================================
// AC-009..AC-011: Auth + 404
// =============================================================================

describe('Auth + 404 (AC-009..AC-011)', () => {
  test('AC-009: POST returns 401 without user', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/patients/${PATIENT_ID}/treatment-plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId: TEST_USER.id }),
    });
    expect(res.status).toBe(401);
  });

  test('AC-010: POST returns 404 for non-existent patient', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/patients/${NONEXISTENT_ID}/treatment-plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId: TEST_USER.id }),
    });
    expect(res.status).toBe(404);
  });

  test('AC-011: PATCH returns 404 for non-existent planId', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/patients/${PATIENT_ID}/treatment-plans/${NONEXISTENT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'presented' }),
    });
    expect(res.status).toBe(404);
  });
});
