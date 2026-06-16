/**
 * estimateClaimCoverage.cross-tenant.test.ts — P1-4 security pin.
 *
 * POST /dental/billing/estimate had no ownership check and read insurance
 * profile / coverage authorization on the RLS-bypassing connection, so a caller
 * passing a FOREIGN (patientId, insuranceProfileId) pair could read another
 * tenant's annual-limit / approved-coverage amounts. Fix: resolve the patient and
 * assertPatientBranchAccess before any coverage read.
 *
 * Run: DATABASE_URL=…monobase_test bun run scripts/test-with-db.ts \
 *   src/handlers/dental-billing/estimateClaimCoverage.cross-tenant.test.ts
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { createDatabase } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';

const db = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test',
});

const OWNER_A = { id: 'ee100000-0000-4000-8000-00000000ec41', email: 'ownerA.ec4@clinic.com' };
const OWNER_B = { id: 'ee100000-0000-4000-8000-00000000ec42', email: 'ownerB.ec4@clinic.com' };
const ORG_A = 'ee200000-0000-4000-8000-00000000ec4a';
const ORG_B = 'ee200000-0000-4000-8000-00000000ec4b';
const BRANCH_A = 'ee300000-0000-4000-8000-00000000ec4a';
const BRANCH_B = 'ee300000-0000-4000-8000-00000000ec4b';
const OWNER_A_MEMBER = 'ee400000-0000-4000-8000-00000000ec4a';
const OWNER_B_MEMBER = 'ee400000-0000-4000-8000-00000000ec4b';
const PATIENT_B = 'ee500000-0000-4000-8000-00000000ec4b'; // belongs to Branch B
const PERSON_B = 'ee600000-0000-4000-8000-00000000ec4b';
const FAKE_PROFILE = 'ee700000-0000-4000-8000-00000000ec4f';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  await db.insert(dentalOrganizations).values([
    { id: ORG_A, name: 'Clinic A ec4', tier: 'solo', ownerPersonId: OWNER_A.id, countryCode: 'PH', createdBy: OWNER_A.id, updatedBy: OWNER_A.id },
    { id: ORG_B, name: 'Clinic B ec4', tier: 'solo', ownerPersonId: OWNER_B.id, countryCode: 'PH', createdBy: OWNER_B.id, updatedBy: OWNER_B.id },
  ]).onConflictDoNothing();
  await db.insert(dentalBranches).values([
    { id: BRANCH_A, organizationId: ORG_A, name: 'A ec4', timezone: 'Asia/Manila', createdBy: OWNER_A.id, updatedBy: OWNER_A.id },
    { id: BRANCH_B, organizationId: ORG_B, name: 'B ec4', timezone: 'Asia/Manila', createdBy: OWNER_B.id, updatedBy: OWNER_B.id },
  ]).onConflictDoNothing();
  await db.insert(dentalMemberships).values([
    { id: OWNER_A_MEMBER, branchId: BRANCH_A, personId: OWNER_A.id, displayName: 'Owner A', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: OWNER_A.id, updatedBy: OWNER_A.id },
    { id: OWNER_B_MEMBER, branchId: BRANCH_B, personId: OWNER_B.id, displayName: 'Owner B', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: OWNER_B.id, updatedBy: OWNER_B.id },
  ]).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_B, firstName: 'Pat', lastName: 'B', createdBy: OWNER_B.id, updatedBy: OWNER_B.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_B, person: PERSON_B, preferredBranchId: BRANCH_B, createdBy: OWNER_B.id, updatedBy: OWNER_B.id }).onConflictDoNothing();
});

const body = (patientId: string) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ patientId, insuranceProfileId: FAKE_PROFILE, lines: [{ cdtCode: 'D0120', billedAmountCents: 10000 }] }),
});

describe('P1-4: estimateClaimCoverage cross-tenant coverage read is rejected', () => {
  test('a foreign-branch user cannot estimate against another branch patient (403)', async () => {
    const res = await buildTestApp({ db, user: OWNER_A }).request('/dental/billing/estimate', body(PATIENT_B));
    expect(res.status).toBe(403);
  });

  test("the patient's own-branch owner still gets an estimate (200)", async () => {
    const res = await buildTestApp({ db, user: OWNER_B }).request('/dental/billing/estimate', body(PATIENT_B));
    expect(res.status).toBe(200);
  });
});
