/**
 * dental-patient cross-tenant pins for orphan write ops.
 *
 * approveTreatmentPlan + updateClaimStatus ship a handler + SDK with no FE
 * consumer (sensitive mutating orphans). Both gate on assertPatientBranchAccess
 * against the patient's preferred branch — a caller outside that branch must be
 * DENIED (403). DB-backed; pins the deny path against silent regression.
 *
 * Discharges the two dental-patient entries of the sensitive-orphan allowlist.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { approveTreatmentPlan } from './treatment-plans/approveTreatmentPlan';
import { updateClaimStatus } from './insurance/updateClaimStatus';

const db = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test',
});

const OWNER_A = { id: 'cd010000-0000-1000-8000-000000000001', email: 'owner-a@test.com' };
const ATTACKER = { id: 'cd020000-0000-1000-8000-000000000002', email: 'attacker@test.com' };
const ORG_A_ID = 'cd010000-0000-1000-8000-000000000010';
const BRANCH_A_ID = 'cd010000-0000-1000-8000-000000000020';
const PERSON_A = 'cd010000-0000-1000-8000-0000000000a0';
const PATIENT_A = 'cd010000-0000-1000-8000-0000000000b0';
const PLAN_ID = 'cd010000-0000-1000-8000-0000000000c0';
const CLAIM_ID = 'cd010000-0000-1000-8000-0000000000d0';

function veh(result: any, c: any) { if (!result.success) return c.json({ error: 'validation' }, 400); }
function makeErrorHandler() {
  return (err: any, c: any) =>
    err instanceof AppError ? c.json({ error: err.message }, err.statusCode as any) : c.json({ error: String(err?.message) }, 500);
}
function injectDeps(user: { id: string; email: string } | null) {
  return async (c: any, next: any) => {
    c.set('database', db);
    c.set('logger', { debug() {}, info() {}, warn() {}, error() {} });
    if (user) { c.set('user', user); c.set('session', { user }); }
    await next();
  };
}
async function seedPatientInBranchA() {
  await db.insert(dentalOrganizations).values({
    id: ORG_A_ID, name: 'Clinic A', tier: 'solo', ownerPersonId: OWNER_A.id, countryCode: 'PH', active: true,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_A_ID, organizationId: ORG_A_ID, name: 'Main', timezone: 'Asia/Manila', active: true, createdBy: OWNER_A.id, updatedBy: OWNER_A.id,
  }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_A, firstName: 'Pat', lastName: 'A', createdBy: OWNER_A.id, updatedBy: OWNER_A.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_A, person: PERSON_A, preferredBranchId: BRANCH_A_ID, createdBy: OWNER_A.id, updatedBy: OWNER_A.id }).onConflictDoNothing();
}
async function seedOwnerMembership() {
  await db.insert(dentalMemberships).values({
    id: 'cd010000-0000-1000-8000-000000000030', branchId: BRANCH_A_ID, personId: OWNER_A.id,
    displayName: 'Owner A', role: 'dentist_owner', status: 'active', createdBy: OWNER_A.id, updatedBy: OWNER_A.id,
  }).onConflictDoNothing();
}

afterEach(async () => {
  await db.execute(sql`
    TRUNCATE dental_membership, dental_branch, dental_organization, patient, person RESTART IDENTITY CASCADE
  `);
});

const J = { 'Content-Type': 'application/json' };

describe('approveTreatmentPlan — patient-branch access (cross-tenant deny)', () => {
  function makeApp(user: any) {
    const app = new Hono();
    app.onError(makeErrorHandler());
    app.use('*', injectDeps(user));
    app.post('/dental/patients/:patientId/treatment-plans/:planId/approval',
      zValidator('param', z.object({ patientId: z.string(), planId: z.string() }), veh),
      zValidator('json', z.object({}).passthrough(), veh),
      approveTreatmentPlan as any);
    return app;
  }
  const url = `/dental/patients/${PATIENT_A}/treatment-plans/${PLAN_ID}/approval`;

  test('a caller outside the patient’s branch cannot approve their treatment plan → 403', async () => {
    await seedPatientInBranchA();
    const res = await makeApp(ATTACKER).request(url, { method: 'POST', headers: J, body: '{}' });
    expect(res.status).toBe(403);
  });
  test('a branch member is allowed past the access gate (baseline, not 403)', async () => {
    await seedPatientInBranchA();
    await seedOwnerMembership();
    const res = await makeApp(OWNER_A).request(url, { method: 'POST', headers: J, body: '{}' });
    expect(res.status).not.toBe(403);
  });
});

describe('updateClaimStatus — patient-branch access (cross-tenant deny)', () => {
  function makeApp(user: any) {
    const app = new Hono();
    app.onError(makeErrorHandler());
    app.use('*', injectDeps(user));
    app.patch('/dental/patients/:patientId/claims/:claimId/status',
      zValidator('param', z.object({ patientId: z.string(), claimId: z.string() }), veh),
      zValidator('json', z.object({ status: z.string() }), veh),
      updateClaimStatus as any);
    return app;
  }
  const url = `/dental/patients/${PATIENT_A}/claims/${CLAIM_ID}/status`;
  const body = JSON.stringify({ status: 'submitted' });

  test('a caller outside the patient’s branch cannot change their claim status → 403', async () => {
    await seedPatientInBranchA();
    const res = await makeApp(ATTACKER).request(url, { method: 'PATCH', headers: J, body });
    expect(res.status).toBe(403);
  });
  test('a branch member is allowed past the access gate (baseline, not 403)', async () => {
    await seedPatientInBranchA();
    await seedOwnerMembership();
    const res = await makeApp(OWNER_A).request(url, { method: 'PATCH', headers: J, body });
    expect(res.status).not.toBe(403);
  });
});
