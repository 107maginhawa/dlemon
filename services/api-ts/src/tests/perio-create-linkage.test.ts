/**
 * perio-create-linkage.test.ts — P1-6 class (round 2).
 *
 * createPerioChart took a caller-supplied patientId and stamped it onto the chart
 * without verifying it matched the chart's visit patient — a write-linkage that
 * mislabels clinical PHI. Fix mirrors generatePMD's PATIENT_VISIT_MISMATCH guard.
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { createDatabase } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { dentalVisits } from '@/handlers/dental-visit/repos/visit.schema';

const db = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test',
});

const OWNER_A = { id: 'ff100000-0000-4000-8000-00000000fb01', email: 'ownerA.fb1@clinic.com' };
const OWNER_B = { id: 'ff100000-0000-4000-8000-00000000fb02', email: 'ownerB.fb1@clinic.com' };
const ORG_A = 'ff200000-0000-4000-8000-00000000fb0a';
const ORG_B = 'ff200000-0000-4000-8000-00000000fb0b';
const BRANCH_A = 'ff300000-0000-4000-8000-00000000fb0a';
const BRANCH_B = 'ff300000-0000-4000-8000-00000000fb0b';
const OWNER_A_MEMBER = 'ff400000-0000-4000-8000-00000000fb0a';
const OWNER_B_MEMBER = 'ff400000-0000-4000-8000-00000000fb0b';
const PATIENT_A = 'ff500000-0000-4000-8000-00000000fb0a';
const PATIENT_B = 'ff500000-0000-4000-8000-00000000fb0b';
const PERSON_A = 'ff600000-0000-4000-8000-00000000fb0a';
const PERSON_B = 'ff600000-0000-4000-8000-00000000fb0b';
const VISIT_A = 'ff700000-0000-4000-8000-00000000fb0a'; // Branch A visit for PATIENT_A

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  await db.insert(dentalOrganizations).values([
    { id: ORG_A, name: 'Clinic A fb1', tier: 'solo', ownerPersonId: OWNER_A.id, countryCode: 'PH', createdBy: OWNER_A.id, updatedBy: OWNER_A.id },
    { id: ORG_B, name: 'Clinic B fb1', tier: 'solo', ownerPersonId: OWNER_B.id, countryCode: 'PH', createdBy: OWNER_B.id, updatedBy: OWNER_B.id },
  ]).onConflictDoNothing();
  await db.insert(dentalBranches).values([
    { id: BRANCH_A, organizationId: ORG_A, name: 'A fb1', timezone: 'Asia/Manila', createdBy: OWNER_A.id, updatedBy: OWNER_A.id },
    { id: BRANCH_B, organizationId: ORG_B, name: 'B fb1', timezone: 'Asia/Manila', createdBy: OWNER_B.id, updatedBy: OWNER_B.id },
  ]).onConflictDoNothing();
  await db.insert(dentalMemberships).values([
    { id: OWNER_A_MEMBER, branchId: BRANCH_A, personId: OWNER_A.id, displayName: 'Owner A', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: OWNER_A.id, updatedBy: OWNER_A.id },
    { id: OWNER_B_MEMBER, branchId: BRANCH_B, personId: OWNER_B.id, displayName: 'Owner B', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: OWNER_B.id, updatedBy: OWNER_B.id },
  ]).onConflictDoNothing();
  await db.insert(persons).values([
    { id: PERSON_A, firstName: 'Pat', lastName: 'A', createdBy: OWNER_A.id, updatedBy: OWNER_A.id },
    { id: PERSON_B, firstName: 'Pat', lastName: 'B', createdBy: OWNER_B.id, updatedBy: OWNER_B.id },
  ]).onConflictDoNothing();
  await db.insert(patients).values([
    { id: PATIENT_A, person: PERSON_A, preferredBranchId: BRANCH_A, createdBy: OWNER_A.id, updatedBy: OWNER_A.id },
    { id: PATIENT_B, person: PERSON_B, preferredBranchId: BRANCH_B, createdBy: OWNER_B.id, updatedBy: OWNER_B.id },
  ]).onConflictDoNothing();
  await db.insert(dentalVisits).values({
    id: VISIT_A, patientId: PATIENT_A, branchId: BRANCH_A, dentistMemberId: OWNER_A_MEMBER,
    status: 'draft', createdBy: OWNER_A.id, updatedBy: OWNER_A.id,
  }).onConflictDoNothing();
});

const post = (path: string, payload: object, user: { id: string; email: string }) =>
  buildTestApp({ db, user }).request(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });

describe('P1-6 class: perio cross-patient create-linkage is rejected', () => {
  test('createPerioChart: a chart whose patientId mismatches the visit patient is rejected (422)', async () => {
    const res = await post('/dental/perio-charts', { visitId: VISIT_A, patientId: PATIENT_B }, OWNER_A);
    expect(res.status).toBe(422);
  });

  test('createPerioChart: the visit-matching patient still succeeds (201)', async () => {
    const res = await post('/dental/perio-charts', { visitId: VISIT_A, patientId: PATIENT_A }, OWNER_A);
    expect(res.status).toBe(201);
  });
});
