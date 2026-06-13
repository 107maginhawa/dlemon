/**
 * dental-visit-module6.test.ts — Phase 1.2: Treatment-plan versioning
 *
 * FRs covered:
 *   J09  Treatment plan accepted → immutable snapshot version created
 *
 * Written RED — acceptTreatmentPlan / getTreatmentPlanVersion stubs
 * throw "Not implemented". Tests pass after GREEN impl below.
 */

// Migrated off the bespoke raw-handler mount to the shared validator-mounting harness.
import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique IDs — b600 namespace
const TEST_USER  = { id: 'e6000000-0000-1000-8000-000000000001', email: 'dentist6@clinic.com' };
const PATIENT_ID = 'f6000000-0000-1000-8000-000000000001';
const PERSON_ID  = 'f6000000-0000-1000-8000-000000000002';
const BRANCH_ID  = '7b600000-0000-4000-8000-000000000006';
const ORG_ID     = 'a6000000-0000-1000-8000-000000000006';
const MEMBER_ID  = '7c600000-0000-4000-8000-000000000006';
const VISIT_ID   = 'f6000000-0000-1000-8000-000000000003';

// Archived patient fixture — b601 namespace
const ARCHIVED_PATIENT_ID = 'f6010000-0000-1000-8000-000000000001';
const ARCHIVED_PERSON_ID  = 'f6010000-0000-1000-8000-000000000002';
const ARCHIVED_VISIT_ID   = 'f6010000-0000-1000-8000-000000000003';

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

  // Seed archived patient
  await db.insert(persons).values({
    id: ARCHIVED_PERSON_ID, firstName: 'Archived', lastName: 'Patient',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(patients).values({
    id: ARCHIVED_PATIENT_ID, person: ARCHIVED_PERSON_ID, preferredBranchId: BRANCH_ID,
    status: 'archived',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalVisits).values({
    id: ARCHIVED_VISIT_ID, patientId: ARCHIVED_PATIENT_ID, branchId: BRANCH_ID,
    dentistMemberId: MEMBER_ID,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
});

// ─── Teardown ──────────────────────────────────────────────────────────────────

afterEach(async () => {
  const { treatmentPlanVersions } = await import('./repos/treatment-plan-version.schema');
  await db.delete(treatmentPlanVersions).where(
    sql`patient_id = ${PATIENT_ID}::uuid`
  );
  await db.delete(treatmentPlanVersions).where(
    sql`patient_id = ${ARCHIVED_PATIENT_ID}::uuid`
  );
});

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('acceptTreatmentPlan', () => {
  test('creates version 1 snapshot for patient with no prior versions', async () => {
    const app = buildTestApp({ db, user: TEST_USER });
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
    const app = buildTestApp({ db, user: TEST_USER });
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
    const app = buildTestApp({ db, user: TEST_USER });
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
    const app = buildTestApp({ db });
    const res = await app.request(
      `/dental/patients/${PATIENT_ID}/treatment-plan/accept?branchId=${BRANCH_ID}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
    );
    expect(res.status).toBe(401);
  });

  test('returns 400 without branchId query param', async () => {
    const app = buildTestApp({ db, user: TEST_USER });
    const res = await app.request(
      `/dental/patients/${PATIENT_ID}/treatment-plan/accept`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
    );
    expect(res.status).toBe(400);
  });

  test('returns 422 PATIENT_ARCHIVED when patient is archived and writes no snapshot', async () => {
    const app = buildTestApp({ db, user: TEST_USER });
    const { treatmentPlanVersions } = await import('./repos/treatment-plan-version.schema');

    const res = await app.request(
      `/dental/patients/${ARCHIVED_PATIENT_ID}/treatment-plan/accept?branchId=${BRANCH_ID}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
    );
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('PATIENT_ARCHIVED');

    // Guard must fire BEFORE the snapshot insert — no version row written
    const versions = await db
      .select({ id: treatmentPlanVersions.id })
      .from(treatmentPlanVersions)
      .where(sql`patient_id = ${ARCHIVED_PATIENT_ID}::uuid`);
    expect(versions).toHaveLength(0);
  });
});

describe('getTreatmentPlanVersion', () => {
  test('returns the created snapshot by id', async () => {
    const app = buildTestApp({ db, user: TEST_USER });
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
    const app = buildTestApp({ db, user: TEST_USER });
    const res = await app.request(
      `/dental/patients/${PATIENT_ID}/treatment-plan/versions/00000000-0000-0000-0000-000000000000?branchId=${BRANCH_ID}`,
    );
    expect(res.status).toBe(404);
  });
});
