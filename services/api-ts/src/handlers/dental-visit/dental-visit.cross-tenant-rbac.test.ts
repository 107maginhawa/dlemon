/**
 * dental-visit cross-tenant + RBAC regression tests
 *
 * Adversarial security pins added in the 2026-06-08 module audit. Each asserts a
 * boundary that was previously bypassable:
 *
 *   1. applyTemplate must require a clinical role (parity with createDentalTreatment) —
 *      a staff_full member could otherwise inject billable treatments into a visit.
 *   2. applyTemplate must reject a template belonging to a DIFFERENT branch —
 *      otherwise one clinic's template (CDT codes + pricing) leaks into another's visit.
 *   3. getTreatmentPlan must scope authorization to the PATIENT's branch, not the
 *      caller-supplied branchId query param (cross-tenant PHI read leak).
 *   4. acceptTreatmentPlan — same, on the write path.
 *   5. getTreatmentPlanVersion — same, on the version read path.
 */

// Migrated off the bespoke raw-handler mount to the shared validator-mounting harness.
import { describe, test, expect, beforeAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { dentalVisits } from './repos/visit.schema';
import { dentalTreatmentTemplates } from './repos/treatment-template.schema';
import { treatmentPlanVersions } from './repos/treatment-plan-version.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique tag (xt1) avoids cross-suite collision on dental_membership's
// (person_id, branch_id) partial unique index.
const OWNER_A = { id: 'c0000000-0000-4000-8000-00000000aa01', email: 'ownerA@clinic.com' };
const STAFF_A = { id: 'c0000000-0000-4000-8000-00000000aa99', email: 'staffA@clinic.com' };
const OWNER_B = { id: 'c0000000-0000-4000-8000-00000000bb01', email: 'ownerB@clinic.com' };

const ORG_A = 'c1000000-0000-4000-8000-0000000000a0';
const ORG_B = 'c1000000-0000-4000-8000-0000000000b0';
const BRANCH_A = 'c2000000-0000-4000-8000-0000000000a0';
const BRANCH_B = 'c2000000-0000-4000-8000-0000000000b0';
const OWNER_A_MEMBER = 'c3000000-0000-4000-8000-0000000000a1';
const STAFF_A_MEMBER = 'c3000000-0000-4000-8000-0000000000a9';
const OWNER_B_MEMBER = 'c3000000-0000-4000-8000-0000000000b1';

const PATIENT_A = 'c4000000-0000-4000-8000-0000000000a0';
const PERSON_A = 'c5000000-0000-4000-8000-0000000000a0';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');

  await db.insert(dentalOrganizations).values([
    { id: ORG_A, name: 'Clinic A', tier: 'solo', ownerPersonId: OWNER_A.id, countryCode: 'PH', createdBy: OWNER_A.id, updatedBy: OWNER_A.id },
    { id: ORG_B, name: 'Clinic B', tier: 'solo', ownerPersonId: OWNER_B.id, countryCode: 'PH', createdBy: OWNER_B.id, updatedBy: OWNER_B.id },
  ]).onConflictDoNothing();
  await db.insert(dentalBranches).values([
    { id: BRANCH_A, organizationId: ORG_A, name: 'A Main', timezone: 'Asia/Manila', createdBy: OWNER_A.id, updatedBy: OWNER_A.id },
    { id: BRANCH_B, organizationId: ORG_B, name: 'B Main', timezone: 'Asia/Manila', createdBy: OWNER_B.id, updatedBy: OWNER_B.id },
  ]).onConflictDoNothing();
  await db.insert(dentalMemberships).values([
    { id: OWNER_A_MEMBER, branchId: BRANCH_A, personId: OWNER_A.id, displayName: 'Owner A', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: OWNER_A.id, updatedBy: OWNER_A.id },
    { id: STAFF_A_MEMBER, branchId: BRANCH_A, personId: STAFF_A.id, displayName: 'Staff A', role: 'staff_full', status: 'active', pinFailedAttempts: 0, createdBy: OWNER_A.id, updatedBy: OWNER_A.id },
    { id: OWNER_B_MEMBER, branchId: BRANCH_B, personId: OWNER_B.id, displayName: 'Owner B', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: OWNER_B.id, updatedBy: OWNER_B.id },
  ]).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_A, firstName: 'Patient', lastName: 'A', createdBy: OWNER_A.id, updatedBy: OWNER_A.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_A, person: PERSON_A, preferredBranchId: BRANCH_A, createdBy: OWNER_A.id, updatedBy: OWNER_A.id }).onConflictDoNothing();
});

function buildApp(user: { id: string; email: string }) {
  return buildTestApp({ db, user });
}

// Use 'draft' so repeated seeds don't collide on the active-visit partial unique
// index (one active visit per patient). applyTemplate allows draft/active alike.
async function seedVisitA(status = 'draft'): Promise<string> {
  const [v] = await db.insert(dentalVisits).values({
    id: crypto.randomUUID(), patientId: PATIENT_A, branchId: BRANCH_A,
    dentistMemberId: OWNER_A_MEMBER, status: status as any,
    createdBy: OWNER_A.id, updatedBy: OWNER_A.id,
  }).returning();
  return v!.id;
}

async function seedTemplate(branchId: string): Promise<string> {
  const [t] = await db.insert(dentalTreatmentTemplates).values({
    id: crypto.randomUUID(), branchId, name: 'Tpl', active: true,
    items: [{ cdtCode: 'D0120', description: 'Exam', priceCents: 100000 }],
    createdBy: OWNER_A.id, updatedBy: OWNER_A.id,
  }).returning();
  return t!.id;
}

describe('applyTemplate — RBAC + cross-branch (audit 2026-06-08) [BR-VIS-009]', () => {
  test('staff_full member cannot apply a template (clinical-role gate, parity with createDentalTreatment)', async () => {
    const visitId = await seedVisitA();
    const templateId = await seedTemplate(BRANCH_A);
    const res = await buildApp(STAFF_A).request(`/dental/visits/${visitId}/apply-template/${templateId}`, { method: 'POST' });
    expect(res.status).toBe(403);
  });

  test('owner can apply a same-branch template (not 403)', async () => {
    const visitId = await seedVisitA();
    const templateId = await seedTemplate(BRANCH_A);
    const res = await buildApp(OWNER_A).request(`/dental/visits/${visitId}/apply-template/${templateId}`, { method: 'POST' });
    expect(res.status).toBe(201);
  });

  test('applying a template owned by a DIFFERENT branch is rejected (404 — no cross-clinic template leak)', async () => {
    const visitId = await seedVisitA();
    const foreignTemplateId = await seedTemplate(BRANCH_B);
    const res = await buildApp(OWNER_A).request(`/dental/visits/${visitId}/apply-template/${foreignTemplateId}`, { method: 'POST' });
    expect(res.status).toBe(404);
  });
});

describe('treatment-plan — cross-tenant PHI scoping (audit 2026-06-08) [BR-VIS-010]', () => {
  test('getTreatmentPlan: a foreign-branch owner cannot read another branch patient by supplying their OWN branchId', async () => {
    // OWNER_B belongs only to BRANCH_B; PATIENT_A belongs to BRANCH_A.
    const res = await buildApp(OWNER_B).request(`/dental/patients/${PATIENT_A}/treatment-plan?branchId=${BRANCH_B}`);
    expect(res.status).toBe(403);
  });

  test('getTreatmentPlan: the patient-branch owner still succeeds', async () => {
    const res = await buildApp(OWNER_A).request(`/dental/patients/${PATIENT_A}/treatment-plan?branchId=${BRANCH_A}`);
    expect(res.status).toBe(200);
  });

  test('acceptTreatmentPlan: a foreign-branch owner cannot snapshot another branch patient plan', async () => {
    const res = await buildApp(OWNER_B).request(`/dental/patients/${PATIENT_A}/treatment-plan/accept?branchId=${BRANCH_B}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    expect(res.status).toBe(403);
  });

  test('getTreatmentPlanVersion: a foreign-branch owner cannot read another branch patient version', async () => {
    await db.delete(treatmentPlanVersions).where(sql`patient_id = ${PATIENT_A}::uuid`);
    const [ver] = await db.insert(treatmentPlanVersions).values({
      id: crypto.randomUUID(), patientId: PATIENT_A, version: 1,
      snapshot: { patientId: PATIENT_A, treatments: [] }, createdBy: OWNER_A.id,
    }).returning();
    const res = await buildApp(OWNER_B).request(`/dental/patients/${PATIENT_A}/treatment-plan/versions/${ver!.id}?branchId=${BRANCH_B}`);
    expect(res.status).toBe(403);
  });
});
