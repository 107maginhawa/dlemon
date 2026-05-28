/**
 * Cross-org patient data isolation — HTTP enforcement
 *
 * Proves that assertBranchAccess blocks cross-tenant reads at the API layer.
 * A member of Org-B must receive 403 when requesting any Org-A resource.
 *
 * HIPAA/PHI risk: a missing or skipped assertBranchAccess call would silently
 * expose patient records across tenants. These tests pin that the enforcement
 * exists at the HTTP layer for every route tested here.
 *
 * Routes covered:
 *   GET /dental/patients/:id       (getDentalPatient → assertBranchAccess)
 *   GET /dental/visits/:visitId    (getDentalVisit   → assertBranchAccess)
 *
 * Pattern: business-rules.test.ts (real DB, real Hono routes, afterEach TRUNCATE).
 * UUID prefix ca/cb to avoid collisions with all other test files.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { VisitRepository } from '@/handlers/dental-visit/repos/visit.repo';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';

import { getDentalPatient } from './dental-patient/identity/getDentalPatient';
import { getDentalVisit } from './dental-visit/getDentalVisit';
import {
  GetDentalPatientParams,
  GetDentalVisitParams,
} from '@/generated/openapi/validators';

// ---------------------------------------------------------------------------
// DB
// ---------------------------------------------------------------------------

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// ---------------------------------------------------------------------------
// Org A — the resource owner
// ---------------------------------------------------------------------------

const USER_A    = { id: 'ca100000-0000-0000-0000-000000000001', email: 'user-a@org-a.com' };
const PERSON_A  = 'ca200000-0000-1000-8000-000000000001';
const PATIENT_A = 'ca300000-0000-1000-8000-000000000001';
const BRANCH_A  = 'ca400000-0000-1000-8000-000000000001';
const ORG_A     = 'ca500000-0000-1000-8000-000000000001';
const MEMBER_A  = 'ca600000-0000-1000-8000-000000000001';

// ---------------------------------------------------------------------------
// Org B — the attacker
// ---------------------------------------------------------------------------

const USER_B    = { id: 'cb100000-0000-0000-0000-000000000002', email: 'user-b@org-b.com' };
const PERSON_B  = 'cb200000-0000-1000-8000-000000000002';
const BRANCH_B  = 'cb400000-0000-1000-8000-000000000002';
const ORG_B     = 'cb500000-0000-1000-8000-000000000002';
const MEMBER_B  = 'cb600000-0000-1000-8000-000000000002';

// ---------------------------------------------------------------------------
// Error handler (pins code, not just status range)
// ---------------------------------------------------------------------------

const validationErrorHandler = (result: any, c: any) => {
  if (!result.success) return c.json({ error: 'Validation failed', issues: result.error.issues }, 400);
};

function makeApp(user: { id: string; email: string }) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: 'Internal server error' }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    ctx.set('user', user);
    ctx.set('session', { id: 'cross-org-session', userId: user.id });
    await next();
  });
  app.get('/dental/patients/:id',
    zValidator('param', GetDentalPatientParams, validationErrorHandler),
    getDentalPatient as any,
  );
  app.get('/dental/visits/:visitId',
    zValidator('param', GetDentalVisitParams, validationErrorHandler),
    getDentalVisit as any,
  );
  return app;
}

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

afterEach(async () => {
  await db.execute(sql`
    TRUNCATE TABLE
      dental_treatment,
      dental_chart,
      visit_notes,
      dental_visit,
      patient,
      person,
      dental_membership,
      dental_branch,
      dental_organization
    CASCADE
  `);
});

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

async function seedOrg(
  orgId: string,
  branchId: string,
  memberId: string,
  userId: string,
  personId: string,
  orgName: string,
) {
  await db.insert(dentalOrganizations).values({
    id: orgId, name: orgName, ownerPersonId: userId,
    tier: 'solo', countryCode: 'PH', createdBy: userId, updatedBy: userId,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: branchId, organizationId: orgId, name: 'Main Branch',
    timezone: 'Asia/Manila', createdBy: userId, updatedBy: userId,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: memberId, branchId, personId: userId,
    displayName: `Member ${orgName}`, role: 'dentist_owner', status: 'active',
    createdBy: userId, updatedBy: userId,
  }).onConflictDoNothing();
  await db.insert(persons).values({
    id: personId, firstName: 'Cross', lastName: 'Test',
    createdBy: userId, updatedBy: userId,
  }).onConflictDoNothing();
}

async function seedOrgAWithPatient() {
  await seedOrg(ORG_A, BRANCH_A, MEMBER_A, USER_A.id, PERSON_A, 'Org A Clinic');
  await db.insert(patients).values({
    id: PATIENT_A, person: PERSON_A, preferredBranchId: BRANCH_A,
    createdBy: USER_A.id, updatedBy: USER_A.id,
  }).onConflictDoNothing();
}

async function seedOrgB() {
  await seedOrg(ORG_B, BRANCH_B, MEMBER_B, USER_B.id, PERSON_B, 'Org B Clinic');
}

async function seedActiveVisitInOrgA() {
  await seedOrgAWithPatient();
  const repo = new VisitRepository(db);
  const visit = await repo.createOne({
    patientId: PATIENT_A, branchId: BRANCH_A, dentistMemberId: MEMBER_A,
  });
  return repo.activate(visit.id) as Promise<NonNullable<Awaited<ReturnType<VisitRepository['activate']>>>>;
}

// ---------------------------------------------------------------------------
// Tests: patient isolation
// ---------------------------------------------------------------------------

describe('cross-org isolation — GET /dental/patients/:id', () => {
  test('Org-B member requests Org-A patient → 403 [cross-org]', async () => {
    await seedOrgAWithPatient();
    await seedOrgB();
    const app = makeApp(USER_B);
    const res = await app.request(`/dental/patients/${PATIENT_A}`, { method: 'GET' });
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.error).toMatch(/access/i);
  });

  test('Org-A member requests own patient → 200 [cross-org baseline]', async () => {
    await seedOrgAWithPatient();
    const app = makeApp(USER_A);
    const res = await app.request(`/dental/patients/${PATIENT_A}`, { method: 'GET' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(PATIENT_A);
  });

  test('Unauthenticated request → 401 [cross-org auth baseline]', async () => {
    await seedOrgAWithPatient();
    const app = new Hono();
    app.onError((err, c) => {
      if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
      return c.json({ error: 'Internal server error' }, 500);
    });
    app.use('*', async (c, next) => {
      const ctx = c as any;
      ctx.set('database', db);
      ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
      // no user set
      await next();
    });
    app.get('/dental/patients/:id',
      zValidator('param', GetDentalPatientParams, validationErrorHandler),
      getDentalPatient as any,
    );
    const res = await app.request(`/dental/patients/${PATIENT_A}`, { method: 'GET' });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Tests: visit isolation
// ---------------------------------------------------------------------------

describe('cross-org isolation — GET /dental/visits/:visitId', () => {
  test('Org-B member requests Org-A visit → 403 [cross-org]', async () => {
    const visit = await seedActiveVisitInOrgA();
    await seedOrgB();
    const app = makeApp(USER_B);
    const res = await app.request(`/dental/visits/${visit.id}`, { method: 'GET' });
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.error).toMatch(/access/i);
  });

  test('Org-A member requests own visit → 200 [cross-org baseline]', async () => {
    const visit = await seedActiveVisitInOrgA();
    const app = makeApp(USER_A);
    const res = await app.request(`/dental/visits/${visit.id}`, { method: 'GET' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(visit.id);
    expect(body.branchId).toBe(BRANCH_A);
  });
});
