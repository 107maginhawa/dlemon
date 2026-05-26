/**
 * BR-006 — Treatment FSM HTTP enforcement
 *
 * Covers two gaps not in business-rules.test.ts:
 * 1. diagnosed→performed skip (invalid direct jump) → 422
 * 2. Consent gate: planned→performed without signed consent → 422 TREATMENT_CONSENT_REQUIRED
 * 3. Correct happy path: planned→performed WITH signed consent → 200
 *
 * NOTE: The existing BR-006 test 'forward: planned → performed succeeds (200)' in
 * business-rules.test.ts is broken — it seeds no consent but the handler requires
 * a signed consent form before allowing the performed transition. That test will
 * return 422 (TREATMENT_CONSENT_REQUIRED), not 200.
 *
 * Pattern follows business-rules.test.ts exactly (makeApp + real DB + afterEach TRUNCATE).
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { VisitRepository } from './repos/visit.repo';
import { TreatmentRepository } from './repos/treatment.repo';
import { ConsentFormRepository } from '@/handlers/dental-clinical/repos/consent-form.repo';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';

import { updateDentalTreatment } from './updateDentalTreatment';
import {
  UpdateDentalTreatmentBody,
  UpdateDentalTreatmentParams,
} from '@/generated/openapi/validators';

// ---------------------------------------------------------------------------
// DB + constants — unique IDs avoid collisions with business-rules.test.ts
// ---------------------------------------------------------------------------

const db = createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' });

const TEST_USER   = { id: 'f0000000-0000-0000-0000-000000000001', email: 'fsm-http-test@clinic.com' };
const PERSON_ID   = 'f2000000-0000-1000-8000-000000000001';
const PATIENT_ID  = 'f1000000-0000-1000-8000-000000000001';
const BRANCH_ID   = 'f3000000-0000-1000-8000-000000000002';
const ORG_ID      = 'f4000000-0000-1000-8000-000000000004';
const MEMBER_ID   = 'f5000000-0000-1000-8000-000000000003';

// ---------------------------------------------------------------------------
// Hono app wiring — mirrors business-rules.test.ts makeApp
// ---------------------------------------------------------------------------

const validationErrorHandler = (result: any, c: any) => {
  if (!result.success) {
    return c.json({ error: 'Validation failed', issues: result.error.issues }, 400);
  }
};

function makeApp(user?: typeof TEST_USER) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
    return c.json({ error: 'Internal server error' }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    if (user) {
      ctx.set('user', user);
      ctx.set('session', { id: 'fsm-http-session', userId: user.id });
    }
    await next();
  });
  app.patch(
    '/dental/visits/:visitId/treatments/:treatmentId',
    zValidator('param', UpdateDentalTreatmentParams, validationErrorHandler),
    zValidator('json', UpdateDentalTreatmentBody, validationErrorHandler),
    updateDentalTreatment as any,
  );
  return app;
}

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

afterEach(async () => {
  await db.execute(sql`
    TRUNCATE TABLE
      consent_form,
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

async function ensureMembership() {
  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'FSM HTTP Test Clinic', ownerPersonId: TEST_USER.id,
    tier: 'solo', countryCode: 'PH', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch',
    timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id,
    displayName: 'FSM HTTP Test Dentist', role: 'dentist_owner', status: 'active',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'FSM', lastName: 'Patient',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
}

async function seedActiveVisit() {
  await ensureMembership();
  const repo = new VisitRepository(db);
  const visit = await repo.createOne({
    patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID,
  });
  return repo.activate(visit.id) as Promise<NonNullable<Awaited<ReturnType<VisitRepository['activate']>>>>;
}

async function seedTreatment(visitId: string, status?: string) {
  const repo = new TreatmentRepository(db);
  return repo.createOne({
    visitId, patientId: PATIENT_ID, cdtCode: 'D0120',
    description: 'Periodic oral evaluation', priceCents: 5000, carriedOver: false,
    ...(status ? { status: status as any } : {}),
  });
}

async function seedSignedConsent(visitId: string) {
  const repo = new ConsentFormRepository(db);
  const form = await repo.createOne({
    visitId, patientId: PATIENT_ID, templateId: 'tmpl-001', templateName: 'General Consent',
  });
  await repo.sign(form.id, 'data:image/png;base64,test-sig');
}

// ---------------------------------------------------------------------------
// BR-006: diagnosed → performed skip (the critical missing P0 test)
// ---------------------------------------------------------------------------

describe('BR-006 treatment FSM — diagnosed→performed skip (HTTP enforcement)', () => {
  test('PATCH diagnosed→performed (skip planned) → 422 [BR-006]', async () => {
    const visit = await seedActiveVisit();
    const treatment = await seedTreatment(visit.id); // default: diagnosed
    const app = makeApp(TEST_USER);
    const res = await app.request(
      `/dental/visits/${visit.id}/treatments/${treatment.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'performed' }),
      },
    );
    expect(res.status).toBe(422);
  });

  test('PATCH diagnosed→planned (step 1) → 200 [BR-006]', async () => {
    const visit = await seedActiveVisit();
    const treatment = await seedTreatment(visit.id);
    const app = makeApp(TEST_USER);
    const res = await app.request(
      `/dental/visits/${visit.id}/treatments/${treatment.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'planned' }),
      },
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('planned');
  });

  test('PATCH planned→diagnosed (reversal) → 422 [BR-006]', async () => {
    const visit = await seedActiveVisit();
    const treatment = await seedTreatment(visit.id, 'planned');
    const app = makeApp(TEST_USER);
    const res = await app.request(
      `/dental/visits/${visit.id}/treatments/${treatment.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'diagnosed' }),
      },
    );
    expect(res.status).toBe(422);
  });
});

// ---------------------------------------------------------------------------
// BR-006 + P0-003: consent gate before performed transition
// ---------------------------------------------------------------------------

describe('BR-006 treatment FSM — consent gate for performed (HTTP enforcement)', () => {
  test('PATCH planned→performed WITHOUT signed consent → 422 TREATMENT_CONSENT_REQUIRED', async () => {
    const visit = await seedActiveVisit();
    // Intentionally no consent seeded
    const treatment = await seedTreatment(visit.id, 'planned');
    const app = makeApp(TEST_USER);
    const res = await app.request(
      `/dental/visits/${visit.id}/treatments/${treatment.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'performed' }),
      },
    );
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('TREATMENT_CONSENT_REQUIRED');
  });

  test('PATCH planned→performed WITH signed consent → 200', async () => {
    const visit = await seedActiveVisit();
    await seedSignedConsent(visit.id);
    const treatment = await seedTreatment(visit.id, 'planned');
    const app = makeApp(TEST_USER);
    const res = await app.request(
      `/dental/visits/${visit.id}/treatments/${treatment.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'performed' }),
      },
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('performed');
    expect(body.performedAt).not.toBeNull();
  });

  test('two-step chain: diagnosed→planned→performed WITH consent → both 200', async () => {
    const visit = await seedActiveVisit();
    await seedSignedConsent(visit.id);
    const treatment = await seedTreatment(visit.id); // diagnosed
    const app = makeApp(TEST_USER);

    const step1 = await app.request(
      `/dental/visits/${visit.id}/treatments/${treatment.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'planned' }),
      },
    );
    expect(step1.status).toBe(200);

    const step2 = await app.request(
      `/dental/visits/${visit.id}/treatments/${treatment.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'performed' }),
      },
    );
    expect(step2.status).toBe(200);
    const body = await step2.json() as any;
    expect(body.status).toBe('performed');
  });
});
