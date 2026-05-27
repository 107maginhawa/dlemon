/**
 * dental-visit-module6.test.ts — Phase 1.2: Treatment-plan versioning
 *
 * FRs covered:
 *   J09  Treatment plan accepted → immutable snapshot version created
 *
 * Written RED — acceptTreatmentPlan / getTreatmentPlanVersion stubs
 * throw "Not implemented". Tests pass after GREEN impl below.
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  AcceptTreatmentPlanBody,
  AcceptTreatmentPlanParams,
  GetTreatmentPlanVersionParams,
} from '@/generated/openapi/validators';
import { acceptTreatmentPlan } from './acceptTreatmentPlan';
import { getTreatmentPlanVersion } from './getTreatmentPlanVersion';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique IDs — b600 namespace
const TEST_USER  = { id: 'e6000000-0000-1000-8000-000000000001', email: 'dentist6@clinic.com' };
const PATIENT_ID = 'f6000000-0000-1000-8000-000000000001';
const PERSON_ID  = 'f6000000-0000-1000-8000-000000000002';
const BRANCH_ID  = '7b600000-0000-4000-8000-000000000006';
const ORG_ID     = 'a6000000-0000-1000-8000-000000000006';
const MEMBER_ID  = '7c600000-0000-4000-8000-000000000006';
const VISIT_ID   = 'f6000000-0000-1000-8000-000000000003';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');
  const { dentalVisits } = await import('./repos/visit.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Module6 Clinic', tier: 'solo',
    ownerPersonId: TEST_USER.id, countryCode: 'PH',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Module6 Branch',
    timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id,
    displayName: 'Module6 Dentist', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'Module6', lastName: 'Patient',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalVisits).values({
    id: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID,
    dentistMemberId: MEMBER_ID,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
});

// ─── Error handler ─────────────────────────────────────────────────────────────

const ve = (result: any, c: any) => {
  if (!result.success) return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
};

// ─── App builder ───────────────────────────────────────────────────────────────

function buildTestApp(user?: typeof TEST_USER) {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
    if (err instanceof z.ZodError) {
      return c.json({ error: err.issues.map((i: any) => i.message).join('; ') }, 400);
    }
    console.error('Unhandled test error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  });

  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('user', user ?? TEST_USER);
    ctx.set('database', db);
    ctx.set('logger', null);
    await next();
  });

  app.post(
    '/dental/patients/:patientId/treatment-plan/accept',
    (c, next) => {
      const result = AcceptTreatmentPlanBody.safeParse(c.req.param());
      return ve(result, c) ?? next();
    },
    (c) => acceptTreatmentPlan(c as any),
  );

  app.get(
    '/dental/patients/:patientId/treatment-plan/versions/:versionId',
    (c, next) => {
      const result = GetTreatmentPlanVersionParams.safeParse(c.req.param());
      return ve(result, c) ?? next();
    },
    (c) => getTreatmentPlanVersion(c as any),
  );

  return app;
}

// ─── Teardown ──────────────────────────────────────────────────────────────────

afterEach(async () => {
  const { treatmentPlanVersions } = await import('./repos/treatment-plan-version.schema');
  await db.delete(treatmentPlanVersions).where(
    sql`patient_id = ${PATIENT_ID}::uuid`
  );
});

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('acceptTreatmentPlan', () => {
  test('creates version 1 snapshot for patient with no prior versions', async () => {
    const app = buildTestApp();
    const res = await app.request(
      `/dental/patients/${PATIENT_ID}/treatment-plan/accept?branchId=${BRANCH_ID}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
    );
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.version).toBe(1);
    expect(body.patientId).toBe(PATIENT_ID);
    expect(body.snapshot).toBeDefined();
    expect(body.snapshot.patientId).toBe(PATIENT_ID);
  });

  test('creates version 2 on second accept (new version, old preserved)', async () => {
    const app = buildTestApp();
    const first = await app.request(
      `/dental/patients/${PATIENT_ID}/treatment-plan/accept?branchId=${BRANCH_ID}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
    );
    expect(first.status).toBe(201);
    const v1 = await first.json() as any;
    expect(v1.version).toBe(1);

    const second = await app.request(
      `/dental/patients/${PATIENT_ID}/treatment-plan/accept?branchId=${BRANCH_ID}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
    );
    expect(second.status).toBe(201);
    const v2 = await second.json() as any;
    expect(v2.version).toBe(2);
    expect(v2.id).not.toBe(v1.id);
  });

  test('snapshot contains live plan fields', async () => {
    const app = buildTestApp();
    const res = await app.request(
      `/dental/patients/${PATIENT_ID}/treatment-plan/accept?branchId=${BRANCH_ID}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
    );
    const body = await res.json() as any;
    expect(body.snapshot).toHaveProperty('patientId');
    expect(body.snapshot).toHaveProperty('totalEstimateCents');
    expect(body.snapshot).toHaveProperty('treatments');
  });

  test('returns 401 without auth', async () => {
    const app = buildTestApp(undefined);
    // Manually override user to null
    const noAuthApp = new Hono();
    noAuthApp.onError((err, c) => {
      if (err instanceof AppError) return c.json({ error: err.message }, err.statusCode as any);
      return c.json({ error: 'Internal server error' }, 500);
    });
    noAuthApp.use('*', async (c, next) => {
      (c as any).set('user', null);
      (c as any).set('database', db);
      (c as any).set('logger', null);
      await next();
    });
    noAuthApp.post('/dental/patients/:patientId/treatment-plan/accept', (c) =>
      acceptTreatmentPlan(c as any),
    );
    const res = await noAuthApp.request(
      `/dental/patients/${PATIENT_ID}/treatment-plan/accept?branchId=${BRANCH_ID}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
    );
    expect(res.status).toBe(401);
  });

  test('returns 400 without branchId query param', async () => {
    const app = buildTestApp();
    const res = await app.request(
      `/dental/patients/${PATIENT_ID}/treatment-plan/accept`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
    );
    expect(res.status).toBe(400);
  });
});

describe('getTreatmentPlanVersion', () => {
  test('returns the created snapshot by id', async () => {
    const app = buildTestApp();
    const acceptRes = await app.request(
      `/dental/patients/${PATIENT_ID}/treatment-plan/accept?branchId=${BRANCH_ID}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
    );
    const version = await acceptRes.json() as any;

    const getRes = await app.request(
      `/dental/patients/${PATIENT_ID}/treatment-plan/versions/${version.id}?branchId=${BRANCH_ID}`,
    );
    expect(getRes.status).toBe(200);
    const body = await getRes.json() as any;
    expect(body.id).toBe(version.id);
    expect(body.version).toBe(1);
    expect(body.patientId).toBe(PATIENT_ID);
    expect(body.snapshot).toHaveProperty('totalEstimateCents');
  });

  test('returns 404 for unknown versionId', async () => {
    const app = buildTestApp();
    const res = await app.request(
      `/dental/patients/${PATIENT_ID}/treatment-plan/versions/00000000-0000-0000-0000-000000000000?branchId=${BRANCH_ID}`,
    );
    expect(res.status).toBe(404);
  });
});
