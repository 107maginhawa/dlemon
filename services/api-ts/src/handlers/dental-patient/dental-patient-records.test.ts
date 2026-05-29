/**
 * dental-patient-records.test.ts — Slice A2: Patient-level read endpoints
 *
 * FRs covered:
 *   J01  listPatientVisits → PatientVisitRecord[] with teeth.status from entryClassification
 *   J05  listPatientConditions → PatientConditionEntry[] (chart teeth + treatments)
 *
 * Written RED — listPatientVisits / listPatientConditions stubs throw "Not implemented".
 * Tests pass after GREEN impl.
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  ListPatientVisitsParams,
  ListPatientVisitsQuery,
  ListPatientConditionsParams,
  ListPatientConditionsQuery,
  GetDentalPatientSafetyFloorParams,
  GetDentalPatientParams,
} from '@/generated/openapi/validators';
import { listPatientVisits } from './identity/listPatientVisits';
import { listPatientConditions } from './identity/listPatientConditions';
import { getDentalPatientSafetyFloor } from './identity/getDentalPatientSafetyFloor';
import { getDentalPatient } from './identity/getDentalPatient';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique IDs — b700 namespace
const TEST_USER  = { id: 'e7000000-0000-1000-8000-000000000001', email: 'dentist7@clinic.com' };
const PATIENT_ID = 'f7000000-0000-1000-8000-000000000001';
const PERSON_ID  = 'f7000000-0000-1000-8000-000000000002';
const BRANCH_ID  = '7b700000-0000-4000-8000-000000000007';
const ORG_ID     = 'a7000000-0000-1000-8000-000000000007';
const MEMBER_ID  = '7c700000-0000-4000-8000-000000000007';
const VISIT_ID   = 'f7000000-0000-1000-8000-000000000003';
const TREAT_ID   = 'f7000000-0000-1000-8000-000000000004';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');
  const { dentalVisits } = await import('@/handlers/dental-visit/repos/visit.schema');
  const { dentalCharts } = await import('@/handlers/dental-visit/repos/dental-chart.schema');
  const { dentalTreatments } = await import('@/handlers/dental-visit/repos/treatment.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Module7 Clinic', tier: 'solo',
    ownerPersonId: TEST_USER.id, countryCode: 'PH',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Module7 Branch',
    timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id,
    displayName: 'Module7 Dentist', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'Module7', lastName: 'Patient',
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
  // Chart with three teeth, each with different entryClassification
  await db.insert(dentalCharts).values({
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    teeth: [
      { toothNumber: 11, state: 'caries', entryClassification: 'existing' },
      { toothNumber: 12, state: 'watchlist', entryClassification: 'existing_other' },
      { toothNumber: 13, state: 'healthy', entryClassification: 'treatment_plan' },
    ],
    createdBy: TEST_USER.id,
    updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  // Treatment at 'planned' status for tooth 14
  await db.insert(dentalTreatments).values({
    id: TREAT_ID,
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    toothNumber: 14,
    cdtCode: 'D0120',
    description: 'Periodic oral evaluation',
    status: 'planned',
    priceCents: 0,
    createdBy: TEST_USER.id,
    updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
});

// ─── Validator error handler ───────────────────────────────────────────────────

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

  app.get(
    '/dental/patients/:patientId/visits',
    (c, next) => {
      const paramsResult = ListPatientVisitsParams.safeParse(c.req.param());
      if (!paramsResult.success) return c.json({ error: paramsResult.error.issues.map((i: any) => i.message).join('; ') }, 400);
      const queryResult = ListPatientVisitsQuery.safeParse(c.req.query());
      return ve(queryResult, c) ?? next();
    },
    (c) => listPatientVisits(c as any),
  );

  app.get(
    '/dental/patients/:patientId/treatments',
    (c, next) => {
      const paramsResult = ListPatientConditionsParams.safeParse(c.req.param());
      if (!paramsResult.success) return c.json({ error: paramsResult.error.issues.map((i: any) => i.message).join('; ') }, 400);
      const queryResult = ListPatientConditionsQuery.safeParse(c.req.query());
      return ve(queryResult, c) ?? next();
    },
    (c) => listPatientConditions(c as any),
  );

  return app;
}

// ─── Teardown ─────────────────────────────────────────────────────────────────

// No afterEach needed — data is stable for all tests.
// afterAll cleanup removes the test data when the suite finishes.

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('listPatientVisits', () => {
  test('returns visits with tooth status mapped from entryClassification', async () => {
    const app = buildTestApp();
    const res = await app.request(
      `/dental/patients/${PATIENT_ID}/visits?branchId=${BRANCH_ID}`,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.pagination).toBeDefined();

    const visit = body.data.find((v: any) => v.id === VISIT_ID);
    expect(visit).toBeDefined();
    expect(visit.patientId).toBe(PATIENT_ID);
    expect(visit.branchId).toBe(BRANCH_ID);
    expect(Array.isArray(visit.teeth)).toBe(true);

    // entryClassification: 'existing' → status: 'existing'
    const tooth11 = visit.teeth.find((t: any) => t.toothNumber === 11);
    expect(tooth11).toBeDefined();
    expect(tooth11.status).toBe('existing');
    expect(tooth11.state).toBe('caries');

    // entryClassification: 'existing_other' → status: 'existing_other'
    const tooth12 = visit.teeth.find((t: any) => t.toothNumber === 12);
    expect(tooth12).toBeDefined();
    expect(tooth12.status).toBe('existing_other');

    // entryClassification: 'treatment_plan' → status: 'planned'
    const tooth13 = visit.teeth.find((t: any) => t.toothNumber === 13);
    expect(tooth13).toBeDefined();
    expect(tooth13.status).toBe('planned');
  });

  test('returns 401 without auth', async () => {
    const noAuthApp = new Hono();
    noAuthApp.onError((err, c) => {
      if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
      return c.json({ error: 'Internal server error' }, 500);
    });
    noAuthApp.use('*', async (c, next) => {
      (c as any).set('user', null);
      (c as any).set('database', db);
      (c as any).set('logger', null);
      await next();
    });
    noAuthApp.get('/dental/patients/:patientId/visits', (c) => listPatientVisits(c as any));
    const res = await noAuthApp.request(
      `/dental/patients/${PATIENT_ID}/visits?branchId=${BRANCH_ID}`,
    );
    expect(res.status).toBe(401);
  });

  test('returns 200 without branchId (branchId is optional — journey spec omits it)', async () => {
    const app = buildTestApp();
    const res = await app.request(`/dental/patients/${PATIENT_ID}/visits`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toBeDefined();
  });
});

describe('listPatientConditions', () => {
  test('returns condition entries with status from entryClassification and treatments', async () => {
    const app = buildTestApp();
    const res = await app.request(
      `/dental/patients/${PATIENT_ID}/treatments?branchId=${BRANCH_ID}`,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toBeDefined();

    const statuses = body.data.map((e: any) => e.status);

    // Chart tooth 11 entryClassification: 'existing' → status: 'existing'
    expect(statuses).toContain('existing');
    // Chart tooth 12 entryClassification: 'existing_other' → status: 'existing_other'
    expect(statuses).toContain('existing_other');
    // Chart tooth 13 entryClassification: 'treatment_plan' → status: 'planned'
    // Treatment tooth 14 status: 'planned'
    expect(statuses).toContain('planned');

    // Each entry has required fields
    for (const entry of body.data) {
      expect(entry.id).toBeDefined();
      expect(entry.visitId).toBe(VISIT_ID);
      expect(entry.status).toBeDefined();
    }

    // The treatment entry has cdtCode
    const treatEntry = body.data.find((e: any) => e.cdtCode === 'D0120');
    expect(treatEntry).toBeDefined();
    expect(treatEntry.toothNumber).toBe(14);
    expect(treatEntry.status).toBe('planned');
  });

  test('returns 401 without auth', async () => {
    const noAuthApp = new Hono();
    noAuthApp.onError((err, c) => {
      if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
      return c.json({ error: 'Internal server error' }, 500);
    });
    noAuthApp.use('*', async (c, next) => {
      (c as any).set('user', null);
      (c as any).set('database', db);
      (c as any).set('logger', null);
      await next();
    });
    noAuthApp.get('/dental/patients/:patientId/treatments', (c) => listPatientConditions(c as any));
    const res = await noAuthApp.request(
      `/dental/patients/${PATIENT_ID}/treatments?branchId=${BRANCH_ID}`,
    );
    expect(res.status).toBe(401);
  });

  test('returns 200 without branchId (branchId is optional — journey spec omits it)', async () => {
    const app = buildTestApp();
    const res = await app.request(`/dental/patients/${PATIENT_ID}/treatments`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toBeDefined();
  });
});

// =============================================================================
// V-PAT-011 / AC-PAT-003: safety-floor counts (2 allergies + 1 medication)
// =============================================================================

describe('AC-PAT-003: safety floor aggregation counts', () => {
  afterEach(async () => {
    await db.execute(sql`DELETE FROM medical_history_entry WHERE patient_id = ${PATIENT_ID}`);
  });

  function buildSafetyApp() {
    const app = new Hono();
    app.onError((err, c) => {
      if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
      if (err instanceof z.ZodError) return c.json({ error: err.issues.map((i: any) => i.message).join('; ') }, 400);
      console.error('Unhandled safety-floor test error:', err);
      return c.json({ error: 'Internal server error' }, 500);
    });
    app.use('*', async (c, next) => {
      const ctx = c as any;
      ctx.set('user', TEST_USER);
      ctx.set('database', db);
      ctx.set('logger', null);
      await next();
    });
    app.get('/dental/patients/:id/safety-floor',
      zValidator('param', GetDentalPatientSafetyFloorParams, ve),
      (c) => getDentalPatientSafetyFloor(c as any));
    app.get('/dental/patients/:id',
      zValidator('param', GetDentalPatientParams, ve),
      (c) => getDentalPatient(c as any));
    return app;
  }

  async function seedSafetyEntries() {
    const { medicalHistoryEntries } = await import('@/handlers/dental-clinical/repos/medical-history.schema');
    await db.insert(medicalHistoryEntries).values([
      { patientId: PATIENT_ID, entryType: 'allergy', displayName: 'Penicillin', active: true, createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
      { patientId: PATIENT_ID, entryType: 'allergy', displayName: 'Latex', active: true, createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
      { patientId: PATIENT_ID, entryType: 'medication', displayName: 'Metformin 500mg', active: true, createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
    ]);
  }

  test('safety-floor endpoint returns 2 allergies and 1 medication', async () => {
    await seedSafetyEntries();
    const app = buildSafetyApp();
    const res = await app.request(`/dental/patients/${PATIENT_ID}/safety-floor`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.allergies.length).toBe(2);
    expect(body.medications.length).toBe(1);
    expect(body.hasAlerts).toBe(true);
  });

  test('GET /:id profile includes safety-floor summary counts (V-PAT-007)', async () => {
    await seedSafetyEntries();
    const app = buildSafetyApp();
    const res = await app.request(`/dental/patients/${PATIENT_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.safetyFloor).toBeDefined();
    expect(body.safetyFloor.allergyCount).toBe(2);
    expect(body.safetyFloor.medicationCount).toBe(1);
    expect(body.safetyFloor.hasAlerts).toBe(true);
    // V-PAT-014: person is a declared subset (no contactInfo / primaryAddress PII).
    expect(body.person.contactInfo).toBeUndefined();
    expect(body.person.primaryAddress).toBeUndefined();
    // V-PAT-007: follow-up notes present on the profile.
    expect(Array.isArray(body.followUpNotes)).toBe(true);
  });
});
