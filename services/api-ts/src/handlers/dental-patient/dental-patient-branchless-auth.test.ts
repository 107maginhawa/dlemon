/**
 * dental-patient-branchless-auth.test.ts — V-PAT-002 (re-scoped) regression
 *
 * A patient with NO assigned branch (preferredBranchId = null) must NOT be a
 * free-for-all. Before the centralized `assertPatientBranchAccess` fix, 23
 * dental-patient handlers skipped the branch/role check entirely when
 * preferredBranchId was falsy — exposing PHI reads and clinical writes to any
 * authenticated user. This test pins the deny-403 behavior across the two
 * patient-lookup paths (direct repo + facade) so the fix can't silently regress.
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { z } from 'zod';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { getDentalPatientSafetyFloor } from './identity/getDentalPatientSafetyFloor';
import { createTreatmentPlan } from './treatment-plans/createTreatmentPlan';
import { listPatientInsuranceProfiles } from './insurance/listPatientInsuranceProfiles';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: 'a0000000-0000-1000-8000-0000000000b1', email: 'staff@clinic.com' };
const BRANCH_ID = 'b0000000-0000-1000-8000-0000000000b1';
const ORG_ID = 'c0000000-0000-1000-8000-0000000000b1';
// Patient deliberately created WITHOUT a preferredBranchId.
const BRANCHLESS_PATIENT_ID = 'd0000000-0000-1000-8000-0000000000b1';
const PERSON_ID = 'e0000000-0000-1000-8000-0000000000b1';

const ve = (result: any, c: any) => {
  if (!result.success) return c.json({ error: 'bad param' }, 400);
};

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Branchless Clinic', tier: 'solo',
    ownerPersonId: TEST_USER.id, countryCode: 'PH',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID,
    name: 'Main Branch', timezone: 'Asia/Manila',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  // The user IS an active member of a branch — proving the 403 comes from the
  // patient being branchless, not from the user lacking any membership.
  await db.insert(dentalMemberships).values({
    id: 'a1000000-0000-1000-8000-0000000000b1',
    branchId: BRANCH_ID, personId: TEST_USER.id,
    displayName: 'Dentist', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'Branchless', lastName: 'Patient',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(patients).values({
    id: BRANCHLESS_PATIENT_ID, person: PERSON_ID,
    preferredBranchId: null, // <-- the vulnerability precondition
    status: 'active',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
});

function buildApp() {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err.message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    ctx.set('user', TEST_USER);
    await next();
  });
  const idParam = zValidator('param', z.object({ id: z.string() }), ve);
  const patientParam = zValidator('param', z.object({ patientId: z.string() }), ve);

  // Direct-repo lookup path (PatientRepository.findOneById)
  app.get('/dental/patients/:id/safety-floor', idParam, getDentalPatientSafetyFloor as any);
  // Facade lookup path (getPatientForDentalPatient) — read + write
  app.get('/dental/patients/:patientId/insurance-profiles', patientParam, listPatientInsuranceProfiles as any);
  app.post('/dental/patients/:patientId/treatment-plans', patientParam,
    zValidator('json', z.object({ providerId: z.string(), totalEstimateCents: z.number().optional(), notes: z.string().optional() }), ve),
    createTreatmentPlan as any);
  return app;
}

describe('V-PAT-002: branchless patient denies access (403) on every path', () => {
  test('PHI read (safety-floor, direct-repo path) → 403', async () => {
    const res = await buildApp().request(`/dental/patients/${BRANCHLESS_PATIENT_ID}/safety-floor`);
    expect(res.status).toBe(403);
  });

  test('PHI read (insurance-profiles, facade path) → 403', async () => {
    const res = await buildApp().request(`/dental/patients/${BRANCHLESS_PATIENT_ID}/insurance-profiles`);
    expect(res.status).toBe(403);
  });

  test('clinical write (treatment-plan create, facade path) → 403', async () => {
    const res = await buildApp().request(`/dental/patients/${BRANCHLESS_PATIENT_ID}/treatment-plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId: TEST_USER.id, totalEstimateCents: 1000 }),
    });
    expect(res.status).toBe(403);
  });
});
