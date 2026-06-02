/**
 * treatment-plan-status-history.test.ts — P2-8 lifecycle + status history
 *
 * P2-8-AC1  presented → rejected succeeds (new terminal state)
 * P2-8-AC2  approved → scheduled succeeds (new state)
 * P2-8-AC3  scheduled → partially_completed succeeds
 * P2-8-AC4  rejected is terminal (rejected → anything is 422)
 * P2-8-AC5  every transition appends a status-history row (who/from→to)
 * P2-8-AC6  GET status-history returns the chronological timeline incl. draft seed
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
} from './utils/treatment-plan-validators';
import { createTreatmentPlan } from './treatment-plans/createTreatmentPlan';
import { updateTreatmentPlan } from './treatment-plans/updateTreatmentPlan';
import { listTreatmentPlanStatusHistory } from './treatment-plans/listTreatmentPlanStatusHistory';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: 'a0000000-0000-1000-8000-0000000000d8', email: 'staff@clinic.com' };
const BRANCH_ID = 'b0000000-0000-1000-8000-0000000000d8';
const ORG_ID = 'c0000000-0000-1000-8000-0000000000d8';
const PATIENT_ID = 'd0000000-0000-1000-8000-0000000000d8';
const PERSON_ID = 'e0000000-0000-1000-8000-0000000000d8';

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
    id: ORG_ID, name: 'SH Clinic', tier: 'solo',
    ownerPersonId: TEST_USER.id, countryCode: 'PH',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID,
    name: 'Main Branch', timezone: 'Asia/Manila',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalMemberships).values({
    id: 'a1000000-0000-1000-8000-0000000000d8',
    branchId: BRANCH_ID, personId: TEST_USER.id,
    displayName: 'Dentist', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'History', lastName: 'Patient',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID,
    preferredBranchId: BRANCH_ID, status: 'active',
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
    if (user) ctx.set('user', user);
    await next();
  });
  app.post('/dental/patients/:patientId/treatment-plans',
    zValidator('param', TreatmentPlanParams, ve), zValidator('json', CreateTreatmentPlanBody, ve), createTreatmentPlan as any);
  app.patch('/dental/patients/:patientId/treatment-plans/:planId',
    zValidator('param', TreatmentPlanPlanParams, ve), zValidator('json', UpdateTreatmentPlanBody, ve), updateTreatmentPlan as any);
  app.get('/dental/patients/:patientId/treatment-plans/:planId/status-history',
    zValidator('param', TreatmentPlanPlanParams, ve), listTreatmentPlanStatusHistory as any);
  return app;
}

afterEach(async () => {
  const { dentalTreatmentPlans } = await import('./repos/treatment-plan.schema');
  await db.delete(dentalTreatmentPlans).where(eq(dentalTreatmentPlans.patientId, PATIENT_ID));
});

async function createPlan(app: Hono) {
  const res = await app.request(`/dental/patients/${PATIENT_ID}/treatment-plans`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerId: TEST_USER.id, totalEstimateCents: 10000 }),
  });
  return (await res.json()) as any;
}

function transition(app: Hono, planId: string, status: string) {
  return app.request(`/dental/patients/${PATIENT_ID}/treatment-plans/${planId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
}

describe('P2-8 — new lifecycle states', () => {
  test('P2-8-AC1: presented → rejected succeeds', async () => {
    const app = buildTestApp(TEST_USER);
    const plan = await createPlan(app);
    await transition(app, plan.id, 'presented');
    const res = await transition(app, plan.id, 'rejected');
    expect(res.status).toBe(200);
    expect((await res.json() as any).status).toBe('rejected');
  });

  test('P2-8-AC2: approved → scheduled succeeds', async () => {
    const app = buildTestApp(TEST_USER);
    const plan = await createPlan(app);
    await transition(app, plan.id, 'presented');
    await transition(app, plan.id, 'approved');
    const res = await transition(app, plan.id, 'scheduled');
    expect(res.status).toBe(200);
    expect((await res.json() as any).status).toBe('scheduled');
  });

  test('P2-8-AC3: scheduled → partially_completed succeeds', async () => {
    const app = buildTestApp(TEST_USER);
    const plan = await createPlan(app);
    await transition(app, plan.id, 'presented');
    await transition(app, plan.id, 'approved');
    await transition(app, plan.id, 'scheduled');
    const res = await transition(app, plan.id, 'partially_completed');
    expect(res.status).toBe(200);
    expect((await res.json() as any).status).toBe('partially_completed');
  });

  test('P2-8-AC4: rejected is terminal', async () => {
    const app = buildTestApp(TEST_USER);
    const plan = await createPlan(app);
    await transition(app, plan.id, 'presented');
    await transition(app, plan.id, 'rejected');
    const res = await transition(app, plan.id, 'approved');
    expect(res.status).toBe(422);
  });
});

describe('P2-8 — status history', () => {
  test('P2-8-AC5 + AC6: every transition is recorded; GET returns chronological timeline', async () => {
    const app = buildTestApp(TEST_USER);
    const plan = await createPlan(app);
    await transition(app, plan.id, 'presented');
    await transition(app, plan.id, 'approved');
    await transition(app, plan.id, 'scheduled');

    const res = await app.request(`/dental/patients/${PATIENT_ID}/treatment-plans/${plan.id}/status-history`);
    expect(res.status).toBe(200);
    const history = (await res.json()) as any[];
    // draft (seed) + presented + approved + scheduled = 4 rows
    expect(history.length).toBe(4);
    expect(history[0].fromStatus).toBeNull();
    expect(history[0].toStatus).toBe('draft');
    expect(history[1].fromStatus).toBe('draft');
    expect(history[1].toStatus).toBe('presented');
    expect(history[3].toStatus).toBe('scheduled');
    // attribution recorded
    expect(history[1].changedByPersonId).toBe(TEST_USER.id);
  });
});
