/**
 * EM-CLI-011: createAmendment — assertBranchRole([dentist_owner, dentist_associate])
 *
 * Prior implementation used getActiveMembershipId which only checks membership
 * existence without validating role.  The fix replaces it with assertBranchRole
 * so that non-dentist staff (e.g. staff_full, hygienist) cannot create amendments.
 *
 * Tests:
 *   (a) dentist_owner succeeds (201)
 *   (b) dentist_associate succeeds (201)
 *   (c) staff_full is rejected (403)
 *   (d) hygienist is rejected (403)
 *   (e) unauthenticated is rejected (401)
 */

import { describe, test, expect, afterEach, beforeAll, beforeEach } from 'bun:test';
import { sql, eq, and } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  CreateAmendmentBody,
  CreateAmendmentParams,
} from '@/generated/openapi/validators';
import { createAmendment } from './amendments/createAmendment';

const db = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test',
});

// ─── Fixed IDs (namespace: em-cli-011) ──────────────────────────────────────
const ORG_ID      = 'd0000000-0000-1000-8000-00000000cc11';
const BRANCH_ID   = 'b0000000-0000-1000-8000-00000000cc11';
const PERSON_ID   = 'f0000000-0000-1000-8000-00000000cc11';
const PATIENT_ID  = 'a0000000-0000-1000-8000-00000000cc11';

// Four users — each backed by a different person UUID so the unique(person_id, branch_id) index
// does not collide between their memberships.
const DENTIST_OWNER_USER      = { id: '00000000-0000-0000-0000-cc1101000000', email: 'owner@clinic.com'     };
const DENTIST_ASSOCIATE_USER  = { id: '00000000-0000-0000-0000-cc1102000000', email: 'associate@clinic.com' };
const STAFF_FULL_USER         = { id: '00000000-0000-0000-0000-cc1103000000', email: 'staff@clinic.com'     };
const HYGIENIST_USER          = { id: '00000000-0000-0000-0000-cc1104000000', email: 'hygienist@clinic.com' };

const OWNER_MEMBER_ID      = 'c0000000-0000-1000-8000-cc1101000000';
const ASSOCIATE_MEMBER_ID  = 'c0000000-0000-1000-8000-cc1102000000';
const STAFF_MEMBER_ID      = 'c0000000-0000-1000-8000-cc1103000000';
const HYGIENIST_MEMBER_ID  = 'c0000000-0000-1000-8000-cc1104000000';

const NONEXISTENT_ID = 'ffffffff-ffff-4000-8000-00000000cc11';

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches }      = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships }   = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons }             = await import('@/handlers/person/repos/person.schema');
  const { patients }            = await import('@/handlers/patient/repos/patient.schema');

  // Clean up any conflicting membership rows from previous runs
  for (const userId of [DENTIST_OWNER_USER.id, DENTIST_ASSOCIATE_USER.id, STAFF_FULL_USER.id, HYGIENIST_USER.id]) {
    await db.delete(dentalMemberships).where(
      and(eq(dentalMemberships.personId, userId), eq(dentalMemberships.branchId, BRANCH_ID)),
    );
  }

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'EM-CLI-011 Clinic', tier: 'solo',
    ownerPersonId: DENTIST_OWNER_USER.id,
    countryCode: 'PH', createdBy: DENTIST_OWNER_USER.id, updatedBy: DENTIST_OWNER_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch',
    timezone: 'Asia/Manila', createdBy: DENTIST_OWNER_USER.id, updatedBy: DENTIST_OWNER_USER.id,
  }).onConflictDoNothing();

  const memberValues = [
    { id: OWNER_MEMBER_ID,     personId: DENTIST_OWNER_USER.id,     role: 'dentist_owner'     },
    { id: ASSOCIATE_MEMBER_ID, personId: DENTIST_ASSOCIATE_USER.id, role: 'dentist_associate' },
    { id: STAFF_MEMBER_ID,     personId: STAFF_FULL_USER.id,        role: 'staff_full'        },
    { id: HYGIENIST_MEMBER_ID, personId: HYGIENIST_USER.id,         role: 'hygienist'         },
  ] as const;

  for (const m of memberValues) {
    await db.insert(dentalMemberships as any).values({
      id: m.id, branchId: BRANCH_ID, personId: m.personId,
      displayName: m.role, role: m.role, status: 'active',
      pinFailedAttempts: 0,
      createdBy: DENTIST_OWNER_USER.id, updatedBy: DENTIST_OWNER_USER.id,
    }).onConflictDoNothing();
  }

  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'Test', lastName: 'Patient',
    createdBy: DENTIST_OWNER_USER.id, updatedBy: DENTIST_OWNER_USER.id,
  }).onConflictDoNothing();

  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID,
    createdBy: DENTIST_OWNER_USER.id, updatedBy: DENTIST_OWNER_USER.id,
  }).onConflictDoNothing();
});

// Visit is seeded fresh for each test (truncated in afterEach)
async function seedVisit(memberId: string, createdBy: string): Promise<string> {
  const { VisitRepository } = await import('@/handlers/dental-visit/repos/visit.repo');
  const visit = await new VisitRepository(db).createOne({
    patientId: PATIENT_ID,
    branchId: BRANCH_ID,
    dentistMemberId: memberId,
  });
  return visit.id;
}

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE amendment, dental_treatment, dental_visit CASCADE`);
});

// ─── Test helpers ─────────────────────────────────────────────────────────────

const ve = (result: any, c: any) => {
  if (!result.success)
    return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
};

const AmendmentBodyOnly = CreateAmendmentBody.omit({ visitId: true });

function buildTestApp(user?: { id: string; email: string }) {
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
    '/dental/visits/:visitId/amendments',
    zValidator('param', CreateAmendmentParams, ve),
    zValidator('json', AmendmentBodyOnly, ve),
    createAmendment as any,
  );
  return app;
}

function amendmentBody() {
  // Use a non-in-module record type so V-CLN-011 FK validation passes through —
  // this suite asserts the role guard, not original-record resolution.
  return JSON.stringify({
    patientId: PATIENT_ID,
    originalRecordType: 'treatment',
    originalRecordId: NONEXISTENT_ID,
    reason: 'Role guard test correction',
    content: 'Corrected content',
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('EM-CLI-011: createAmendment role guard — assertBranchRole', () => {
  test('201 — dentist_owner can create amendment', async () => {
    const visitId = await seedVisit(OWNER_MEMBER_ID, DENTIST_OWNER_USER.id);
    const app = buildTestApp(DENTIST_OWNER_USER);
    const res = await app.request(`/dental/visits/${visitId}/amendments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: amendmentBody(),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeTruthy();
    expect(body.authorMemberId).toBe(OWNER_MEMBER_ID);
  });

  test('201 — dentist_associate can create amendment', async () => {
    const visitId = await seedVisit(OWNER_MEMBER_ID, DENTIST_OWNER_USER.id);
    const app = buildTestApp(DENTIST_ASSOCIATE_USER);
    const res = await app.request(`/dental/visits/${visitId}/amendments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: amendmentBody(),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeTruthy();
    expect(body.authorMemberId).toBe(ASSOCIATE_MEMBER_ID);
  });

  test('403 — staff_full cannot create amendment', async () => {
    const visitId = await seedVisit(OWNER_MEMBER_ID, DENTIST_OWNER_USER.id);
    const app = buildTestApp(STAFF_FULL_USER);
    const res = await app.request(`/dental/visits/${visitId}/amendments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: amendmentBody(),
    });
    expect(res.status).toBe(403);
  });

  test('403 — hygienist cannot create amendment', async () => {
    const visitId = await seedVisit(OWNER_MEMBER_ID, DENTIST_OWNER_USER.id);
    const app = buildTestApp(HYGIENIST_USER);
    const res = await app.request(`/dental/visits/${visitId}/amendments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: amendmentBody(),
    });
    expect(res.status).toBe(403);
  });

  test('401 — unauthenticated request is rejected', async () => {
    const visitId = await seedVisit(OWNER_MEMBER_ID, DENTIST_OWNER_USER.id);
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/visits/${visitId}/amendments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: amendmentBody(),
    });
    expect(res.status).toBe(401);
  });
});
