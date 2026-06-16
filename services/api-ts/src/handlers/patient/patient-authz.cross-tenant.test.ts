/**
 * patient-authz.cross-tenant.test.ts — P1-2 / P1-3 security pin.
 *
 * The upstream-template patient/ handlers never gated on the caller's
 * relationship to the patient:
 *   - updatePatient COMPUTED `isOwner` but only logged it; the mutation ran
 *     unconditionally (the route admits the bare `user` role) → any authenticated
 *     user could PATCH any patient row (IDOR write).
 *   - deactivatePatient had ZERO authz → any authenticated user could DELETE
 *     (soft-archive) any patient.
 *
 * Fix: both handlers now assertPatientBranchAccess(db, user.id,
 * patient.preferredBranchId) — a caller who is not a member of the patient's
 * branch is rejected (403). These tests prove the cross-tenant write/delete is
 * rejected while the patient's own-branch owner still succeeds.
 *
 * Run: DATABASE_URL=…monobase_test bun run scripts/test-with-db.ts \
 *   src/handlers/patient/patient-authz.cross-tenant.test.ts   (from services/api-ts)
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { createDatabase } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';

const db = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test',
});

// Suite-unique tag (pa2) — distinct hex avoids membership unique-index collisions.
const OWNER_A = { id: 'dd100000-0000-4000-8000-00000000fa01', email: 'ownerA.fad@clinic.com' };
const OWNER_B = { id: 'dd100000-0000-4000-8000-00000000fa02', email: 'ownerB.fad@clinic.com' };
const ORG_A = 'dd200000-0000-4000-8000-00000000fa0a';
const ORG_B = 'dd200000-0000-4000-8000-00000000fa0b';
const BRANCH_A = 'dd300000-0000-4000-8000-00000000fa0a';
const BRANCH_B = 'dd300000-0000-4000-8000-00000000fa0b';
const OWNER_A_MEMBER = 'dd400000-0000-4000-8000-00000000fa0a';
const OWNER_B_MEMBER = 'dd400000-0000-4000-8000-00000000fa0b';
const PATIENT_A = 'dd500000-0000-4000-8000-00000000fa0a'; // for update tests
const PATIENT_DEL = 'dd500000-0000-4000-8000-00000000fa0c'; // for delete positive control
const PERSON_A = 'dd600000-0000-4000-8000-00000000fa0a';
const PERSON_DEL = 'dd600000-0000-4000-8000-00000000fa0c';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');

  await db.insert(dentalOrganizations).values([
    { id: ORG_A, name: 'Clinic A pa2', tier: 'solo', ownerPersonId: OWNER_A.id, countryCode: 'PH', createdBy: OWNER_A.id, updatedBy: OWNER_A.id },
    { id: ORG_B, name: 'Clinic B pa2', tier: 'solo', ownerPersonId: OWNER_B.id, countryCode: 'PH', createdBy: OWNER_B.id, updatedBy: OWNER_B.id },
  ]).onConflictDoNothing();
  await db.insert(dentalBranches).values([
    { id: BRANCH_A, organizationId: ORG_A, name: 'A pa2', timezone: 'Asia/Manila', createdBy: OWNER_A.id, updatedBy: OWNER_A.id },
    { id: BRANCH_B, organizationId: ORG_B, name: 'B pa2', timezone: 'Asia/Manila', createdBy: OWNER_B.id, updatedBy: OWNER_B.id },
  ]).onConflictDoNothing();
  await db.insert(dentalMemberships).values([
    { id: OWNER_A_MEMBER, branchId: BRANCH_A, personId: OWNER_A.id, displayName: 'Owner A', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: OWNER_A.id, updatedBy: OWNER_A.id },
    { id: OWNER_B_MEMBER, branchId: BRANCH_B, personId: OWNER_B.id, displayName: 'Owner B', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: OWNER_B.id, updatedBy: OWNER_B.id },
  ]).onConflictDoNothing();
  await db.insert(persons).values([
    { id: PERSON_A, firstName: 'Pat', lastName: 'A', createdBy: OWNER_A.id, updatedBy: OWNER_A.id },
    { id: PERSON_DEL, firstName: 'Pat', lastName: 'Del', createdBy: OWNER_A.id, updatedBy: OWNER_A.id },
  ]).onConflictDoNothing();
  await db.insert(patients).values([
    { id: PATIENT_A, person: PERSON_A, preferredBranchId: BRANCH_A, createdBy: OWNER_A.id, updatedBy: OWNER_A.id },
    { id: PATIENT_DEL, person: PERSON_DEL, preferredBranchId: BRANCH_A, createdBy: OWNER_A.id, updatedBy: OWNER_A.id },
  ]).onConflictDoNothing();
});

const app = (u: { id: string; email: string }) => buildTestApp({ db, user: u });
const patch = (id: string, body: object) => ({ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('P1-2: updatePatient cross-tenant write is rejected', () => {
  test('a foreign-branch user cannot PATCH another branch patient (403)', async () => {
    const res = await app(OWNER_B).request(`/patients/${PATIENT_A}`, patch(PATIENT_A, { needsFollowUp: true }));
    expect(res.status).toBe(403);
  });

  test("the patient's own-branch owner still succeeds (200)", async () => {
    const res = await app(OWNER_A).request(`/patients/${PATIENT_A}`, patch(PATIENT_A, { needsFollowUp: true }));
    expect(res.status).toBe(200);
  });
});

describe('P1-3: deactivatePatient cross-tenant delete is rejected', () => {
  test('a foreign-branch user cannot DELETE (archive) another branch patient (403)', async () => {
    const res = await app(OWNER_B).request(`/patients/${PATIENT_A}`, { method: 'DELETE' });
    expect(res.status).toBe(403);
  });

  test("the patient's own-branch owner still succeeds (204)", async () => {
    const res = await app(OWNER_A).request(`/patients/${PATIENT_DEL}`, { method: 'DELETE' });
    expect(res.status).toBe(204);
  });
});
