/**
 * EM-CLI-005: createPrescription — active-membership validation for prescriberMemberId
 *
 * The prescriberMemberId supplied in the request body must reference an active
 * dental_membership row in the same branch as the visit. The handler must reject:
 *
 *   (a) A member ID from a different branch (cross-branch spoofing)
 *   (b) An inactive member ID (soft-deleted prescriber)
 *   (c) A fabricated / non-existent member ID
 *
 * All three cases must return 403.  A valid in-branch active member must
 * still succeed (201).
 */

import { describe, test, expect, afterEach, beforeAll, beforeEach } from 'bun:test';
import { sql, eq, and } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  CreatePrescriptionBody,
  CreatePrescriptionParams,
} from '@/generated/openapi/validators';
import { createPrescription } from './prescriptions/createPrescription';

const db = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test',
});

// ─── Fixed IDs (namespace: em-cli-005) ──────────────────────────────────────
const TEST_USER   = { id: '00000000-0000-0000-0000-00000000cc05', email: 'cli005@clinic.com' };
const ORG_ID      = 'd0000000-0000-1000-8000-00000000cc05';
const BRANCH_ID   = 'b0000000-0000-1000-8000-00000000cc05';
const OTHER_BRANCH = 'b0000000-0000-1000-8000-00000000cc06';   // different branch
const PERSON_ID   = 'f0000000-0000-1000-8000-00000000cc05';
const PATIENT_ID  = 'a0000000-0000-1000-8000-00000000cc05';
const VISIT_ID    = 'ee000000-0000-1000-8000-00000000cc05';
const MEMBER_ID   = 'c0000000-0000-1000-8000-00000000cc05';   // caller + prescriber (same person)
const INACTIVE_MEMBER_ID = 'c0000000-0000-1000-8000-00000000cc07'; // inactive in branch
const OTHER_BRANCH_MEMBER_ID = 'c0000000-0000-1000-8000-00000000cc08'; // active in OTHER_BRANCH
const NONEXISTENT_MEMBER_ID  = 'ffffffff-ffff-4000-8000-00000000cc05';

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches }      = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships }   = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons }             = await import('@/handlers/person/repos/person.schema');
  const { patients }            = await import('@/handlers/patient/repos/patient.schema');

  // Clean up membership rows that conflict on (personId, branchId) unique index
  await db.delete(dentalMemberships).where(
    and(eq(dentalMemberships.personId, TEST_USER.id), eq(dentalMemberships.branchId, BRANCH_ID)),
  );

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'EM-CLI-005 Clinic', tier: 'solo', ownerPersonId: TEST_USER.id,
    countryCode: 'PH', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  // Primary branch and its other-branch sibling
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch',
    timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: OTHER_BRANCH, organizationId: ORG_ID, name: 'Other Branch',
    timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  // Caller membership (active, dentist_owner, in BRANCH_ID)
  await db.insert(dentalMemberships).values({
    id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id,
    displayName: 'Test Dentist', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  // Inactive membership in same branch
  await db.insert(dentalMemberships).values({
    id: INACTIVE_MEMBER_ID, branchId: BRANCH_ID, personId: null,
    displayName: 'Inactive Dentist', role: 'dentist_owner', status: 'inactive',
    pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  // Active membership in a different branch
  await db.insert(dentalMemberships).values({
    id: OTHER_BRANCH_MEMBER_ID, branchId: OTHER_BRANCH, personId: null,
    displayName: 'Other Branch Dentist', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
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

beforeEach(async () => {
  const { dentalVisits } = await import('@/handlers/dental-visit/repos/visit.schema');
  await db.insert(dentalVisits).values({
    id: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID,
    dentistMemberId: MEMBER_ID, status: 'active',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE prescription, dental_treatment, dental_visit CASCADE`);
});

// ─── Test helpers ─────────────────────────────────────────────────────────────

const ve = (result: any, c: any) => {
  if (!result.success)
    return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
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
    if (user) ctx.set('user', user);
    await next();
  });
  app.post(
    '/dental/visits/:visitId/prescriptions',
    zValidator('param', CreatePrescriptionParams, ve),
    zValidator('json', PrescriptionBodyOnly, ve),
    createPrescription as any,
  );
  return app;
}

function rxBody(prescriberMemberId: string) {
  return JSON.stringify({
    patientId: PATIENT_ID,
    prescriberMemberId,
    drugName: 'Amoxicillin',
    dosage: '500mg',
    frequency: 'twice daily',
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('EM-CLI-005: prescriberMemberId active-membership validation', () => {
  test('201 — valid in-branch active member as prescriber', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${VISIT_ID}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: rxBody(MEMBER_ID),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeTruthy();
    expect(body.prescriberMemberId).toBe(MEMBER_ID);
  });

  test('403 — prescriberMemberId from a different branch is rejected', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${VISIT_ID}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: rxBody(OTHER_BRANCH_MEMBER_ID),
    });
    expect(res.status).toBe(403);
  });

  test('403 — prescriberMemberId for inactive membership is rejected', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${VISIT_ID}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: rxBody(INACTIVE_MEMBER_ID),
    });
    expect(res.status).toBe(403);
  });

  test('403 — non-existent prescriberMemberId is rejected', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${VISIT_ID}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: rxBody(NONEXISTENT_MEMBER_ID),
    });
    expect(res.status).toBe(403);
  });

  test('401 — unauthenticated request is rejected before membership check', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/visits/${VISIT_ID}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: rxBody(MEMBER_ID),
    });
    expect(res.status).toBe(401);
  });
});
