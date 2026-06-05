/**
 * dental-patient-list-branch-isolation.test.ts — P1 (SECURITY) regression
 *
 * The patient LIST must be STRICTLY scoped to the requested branch. A prior bug
 * OR'd `isNull(preferredBranchId)` into the branch filter (patient-person.facade
 * `listConditions`), leaking EVERY branchless patient into EVERY branch's list
 * across orgs — a cross-tenant PHI leak — and causing a fresh/empty branch to
 * return a non-empty list.
 *
 * This pins strict per-branch scoping at the facade level so the leak cannot
 * silently return. Revert the fix (re-add the `isNull` OR in listConditions) and
 * the branchless patient appears in branch B's list → these assertions fail.
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { createDatabase } from '@/core/database';
import {
  listDentalPatientsWithPerson,
  countDentalPatientsWithPerson,
} from '../patient/repos/patient-dental-patient.facade';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const OWNER = 'a0000000-0000-1000-8000-0000000000c1';
const ORG_ID = 'c0000000-0000-1000-8000-0000000000c1';
const BRANCH_A = 'b0000000-0000-1000-8000-0000000000ca';
const BRANCH_B = 'b0000000-0000-1000-8000-0000000000cb';
const BRANCH_FRESH = 'b0000000-0000-1000-8000-0000000000cf'; // no patients — must list 0

const PERSON_A = 'e0000000-0000-1000-8000-0000000000ca';
const PERSON_B = 'e0000000-0000-1000-8000-0000000000cb';
const PERSON_NONE = 'e0000000-0000-1000-8000-0000000000c0';

const PATIENT_A = 'd0000000-0000-1000-8000-0000000000ca';      // preferredBranchId = BRANCH_A
const PATIENT_B = 'd0000000-0000-1000-8000-0000000000cb';      // preferredBranchId = BRANCH_B
const PATIENT_NONE = 'd0000000-0000-1000-8000-0000000000c0';   // preferredBranchId = null (branchless)

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Isolation Clinic', tier: 'clinic',
    ownerPersonId: OWNER, countryCode: 'PH',
    createdBy: OWNER, updatedBy: OWNER,
  }).onConflictDoNothing();

  for (const [id, name] of [[BRANCH_A, 'Branch A'], [BRANCH_B, 'Branch B'], [BRANCH_FRESH, 'Fresh Branch']] as const) {
    await db.insert(dentalBranches).values({
      id, organizationId: ORG_ID, name, timezone: 'Asia/Manila',
      createdBy: OWNER, updatedBy: OWNER,
    }).onConflictDoNothing();
  }

  await db.insert(persons).values([
    { id: PERSON_A, firstName: 'Alpha', lastName: 'Patient', createdBy: OWNER, updatedBy: OWNER },
    { id: PERSON_B, firstName: 'Beta', lastName: 'Patient', createdBy: OWNER, updatedBy: OWNER },
    { id: PERSON_NONE, firstName: 'Branchless', lastName: 'Patient', createdBy: OWNER, updatedBy: OWNER },
  ]).onConflictDoNothing();

  await db.insert(patients).values([
    { id: PATIENT_A, person: PERSON_A, preferredBranchId: BRANCH_A, status: 'active', createdBy: OWNER, updatedBy: OWNER },
    { id: PATIENT_B, person: PERSON_B, preferredBranchId: BRANCH_B, status: 'active', createdBy: OWNER, updatedBy: OWNER },
    { id: PATIENT_NONE, person: PERSON_NONE, preferredBranchId: null, status: 'active', createdBy: OWNER, updatedBy: OWNER },
  ]).onConflictDoNothing();
});

describe('P1: patient list is strictly branch-scoped (no branchless / cross-branch leak)', () => {
  test('branch A list contains only branch-A patients — not branch-B, not branchless', async () => {
    const rows = await listDentalPatientsWithPerson(db, { branchId: BRANCH_A }, { pagination: { limit: 200, offset: 0 } });
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(PATIENT_A);
    expect(ids).not.toContain(PATIENT_B);
    expect(ids).not.toContain(PATIENT_NONE); // the security regression
  });

  test('branch B list contains only branch-B patients — not branch-A, not branchless', async () => {
    const rows = await listDentalPatientsWithPerson(db, { branchId: BRANCH_B }, { pagination: { limit: 200, offset: 0 } });
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(PATIENT_B);
    expect(ids).not.toContain(PATIENT_A);
    expect(ids).not.toContain(PATIENT_NONE); // the security regression
  });

  test('a fresh branch with no patients lists zero (count = 0)', async () => {
    const rows = await listDentalPatientsWithPerson(db, { branchId: BRANCH_FRESH }, { pagination: { limit: 200, offset: 0 } });
    const ids = rows.map((r) => r.id);
    expect(ids).not.toContain(PATIENT_A);
    expect(ids).not.toContain(PATIENT_B);
    expect(ids).not.toContain(PATIENT_NONE);
    const count = await countDentalPatientsWithPerson(db, { branchId: BRANCH_FRESH });
    expect(count).toBe(0);
  });
});
