/**
 * initializeDentition role guard — POST /dental/patients/:patientId/dentition
 *
 * Per ROLE_PERMISSION_MATRIX.md and the sibling op `updateTooth`, scaffolding the
 * dentition (a chart-condition write of *healthy* teeth only — no diagnosis/
 * treatment) is permitted for dentist_owner, dentist_associate AND dental_assistant
 * (the assistant works under dentist supervision).
 *
 * A role×op drift detector caught the wired handler omitting `dental_assistant`,
 * wrongly blocking assistants in production. This suite pins the grant.
 *
 * Cases:
 *   (a) dental_assistant succeeds (201) — was the RED case (403 before the fix)
 *   (b) dentist_owner succeeds (201)
 *   (c) staff_scheduling is rejected (403) — proves the gate still denies
 *   (d) unauthenticated is rejected (401)
 *
 * Uses the SHARED validator-mounting harness (`buildTestApp`) so the request
 * traverses the real authMiddleware → generated zValidator → handler chain.
 */

import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { sql, eq, and } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';

const db = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test',
});

// ─── Fixed IDs (namespace: init-dentition / idn) ─────────────────────────────
const ORG_ID     = 'd0000000-0000-1000-8000-00000001d100';
const BRANCH_ID  = 'b0000000-0000-1000-8000-00000001d100';
const PERSON_ID  = 'f0000000-0000-1000-8000-00000001d100';
const PATIENT_ID = 'a0000000-0000-1000-8000-00000001d100';
const VISIT_ID   = 'e0000000-0000-1000-8000-00000001d100';

const OWNER_USER     = { id: '00000000-0000-0000-0000-1d1001000000', email: 'owner.idn@clinic.com' };
const ASSISTANT_USER = { id: '00000000-0000-0000-0000-1d1006000000', email: 'asst.idn@clinic.com' };
const SCHED_USER     = { id: '00000000-0000-0000-0000-1d1005000000', email: 'sched.idn@clinic.com' };

const OWNER_MEMBER_ID     = 'c0000000-0000-1000-8000-1d1001000000';
const ASSISTANT_MEMBER_ID = 'c0000000-0000-1000-8000-1d1006000000';
const SCHED_MEMBER_ID     = 'c0000000-0000-1000-8000-1d1005000000';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches }      = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships }   = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons }             = await import('@/handlers/person/repos/person.schema');
  const { patients }            = await import('@/handlers/patient/repos/patient.schema');
  const { dentalVisits }        = await import('@/handlers/dental-visit/repos/visit.schema');

  for (const userId of [OWNER_USER.id, ASSISTANT_USER.id, SCHED_USER.id]) {
    await db.delete(dentalMemberships).where(
      and(eq(dentalMemberships.personId, userId), eq(dentalMemberships.branchId, BRANCH_ID)),
    );
  }

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Init-Dentition Clinic', tier: 'solo',
    ownerPersonId: OWNER_USER.id,
    countryCode: 'PH', createdBy: OWNER_USER.id, updatedBy: OWNER_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch',
    timezone: 'Asia/Manila', createdBy: OWNER_USER.id, updatedBy: OWNER_USER.id,
  }).onConflictDoNothing();

  const memberValues = [
    { id: OWNER_MEMBER_ID,     personId: OWNER_USER.id,     role: 'dentist_owner'    },
    { id: ASSISTANT_MEMBER_ID, personId: ASSISTANT_USER.id, role: 'dental_assistant' },
    { id: SCHED_MEMBER_ID,     personId: SCHED_USER.id,     role: 'staff_scheduling' },
  ] as const;

  for (const m of memberValues) {
    await db.insert(dentalMemberships as any).values({
      id: m.id, branchId: BRANCH_ID, personId: m.personId,
      displayName: m.role, role: m.role, status: 'active',
      pinFailedAttempts: 0,
      createdBy: OWNER_USER.id, updatedBy: OWNER_USER.id,
    }).onConflictDoNothing();
  }

  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'Test', lastName: 'Patient',
    createdBy: OWNER_USER.id, updatedBy: OWNER_USER.id,
  }).onConflictDoNothing();

  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID,
    createdBy: OWNER_USER.id, updatedBy: OWNER_USER.id,
  }).onConflictDoNothing();

  // initializeDentition looks up the visit by body.visitId to resolve branchId.
  await db.insert(dentalVisits).values({
    id: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID,
    dentistMemberId: OWNER_MEMBER_ID, status: 'active',
    createdBy: OWNER_USER.id, updatedBy: OWNER_USER.id,
  }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE dental_chart CASCADE`);
});

function body() {
  return JSON.stringify({
    visitId: VISIT_ID,
    // 30-year-old → permanent dentition
    dateOfBirth: '1995-01-01',
  });
}

describe('initializeDentition role guard — ROLE_PERMISSION_MATRIX + updateTooth parity', () => {
  test('201 — dental_assistant may scaffold the dentition', async () => {
    const app = buildTestApp({ db, user: { id: ASSISTANT_USER.id, email: ASSISTANT_USER.email } });
    const res = await app.request(`/dental/patients/${PATIENT_ID}/dentition`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body(),
    });
    expect(res.status).toBe(201);
  });

  test('201 — dentist_owner may scaffold the dentition', async () => {
    const app = buildTestApp({ db, user: { id: OWNER_USER.id, email: OWNER_USER.email } });
    const res = await app.request(`/dental/patients/${PATIENT_ID}/dentition`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body(),
    });
    expect(res.status).toBe(201);
  });

  test('403 — staff_scheduling cannot scaffold the dentition (not in matrix)', async () => {
    const app = buildTestApp({ db, user: { id: SCHED_USER.id, email: SCHED_USER.email } });
    const res = await app.request(`/dental/patients/${PATIENT_ID}/dentition`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body(),
    });
    expect(res.status).toBe(403);
  });

  test('401 — unauthenticated request is rejected', async () => {
    const app = buildTestApp({ db, user: null });
    const res = await app.request(`/dental/patients/${PATIENT_ID}/dentition`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body(),
    });
    expect(res.status).toBe(401);
  });
});
