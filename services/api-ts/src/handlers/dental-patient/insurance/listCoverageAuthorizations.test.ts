/**
 * listCoverageAuthorizations.test.ts — GET /dental/patients/:patientId/authorizations
 *
 * The revenue-cycle contract (dental-revenue-cycle.hurl) creates + transitions an LOA
 * but never READS the per-patient list, and no be-unit exercised the list handler. This
 * covers it through buildTestApp: 401 (no auth), 404 (unknown patient), 403 (caller not
 * a member of the patient's branch — assertPatientBranchAccess), and 200 returning ONLY
 * the path patient's authorizations (scope), never another patient's.
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { createDatabase } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { dentalInsuranceProfiles } from '@/handlers/dental-patient/repos/insurance-profile.schema';
import { dentalCoverageAuthorizations } from '@/handlers/dental-patient/repos/coverage-authorization.schema';

const db = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test',
});

// `026` segment = suite-unique tag (P1-26 LOA) avoiding cross-suite id collisions.
const MEMBER = { id: 'a0260000-0000-4000-8000-000000000001', email: 'biller@example.com' };
const NONMEMBER = { id: 'a0260000-0000-4000-8000-000000000099', email: 'outsider@example.com' };
const PERSON_A = 'a0260000-0000-4000-8000-000000000010';
const PERSON_B = 'a0260000-0000-4000-8000-000000000020';
const PATIENT_A = 'b0260000-0000-4000-8000-000000000001';
const PATIENT_B = 'b0260000-0000-4000-8000-000000000002';
const UNKNOWN_PATIENT = 'ffffffff-ffff-4000-8000-ffffffffff26';

const ORG_ID = 'c0260000-0000-4000-8000-000000000001';
const BRANCH_ID = 'd0260000-0000-4000-8000-000000000001';
const MEMBERSHIP_ID = 'e0260000-0000-4000-8000-000000000001';
const PROFILE_A = '0a260000-0000-4000-8000-000000000001';
const PROFILE_B = '0a260000-0000-4000-8000-000000000002';
const LOA_A1 = 'f0260000-0000-4000-8000-0000000000a1';
const LOA_A2 = 'f0260000-0000-4000-8000-0000000000a2';
const LOA_B1 = 'f0260000-0000-4000-8000-0000000000b1';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'LOA Clinic', tier: 'solo', ownerPersonId: MEMBER.id,
    countryCode: 'PH', createdBy: MEMBER.id, updatedBy: MEMBER.id,
  }).onConflictDoNothing();

  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main', timezone: 'Asia/Manila',
    createdBy: MEMBER.id, updatedBy: MEMBER.id,
  }).onConflictDoNothing();

  await db.insert(dentalMemberships).values({
    id: MEMBERSHIP_ID, branchId: BRANCH_ID, personId: MEMBER.id,
    displayName: 'Biller', role: 'staff_full', status: 'active',
    pinFailedAttempts: 0, createdBy: MEMBER.id, updatedBy: MEMBER.id,
  }).onConflictDoNothing();

  await db.insert(persons).values([
    { id: MEMBER.id, firstName: 'Bill', lastName: 'Er', createdBy: MEMBER.id, updatedBy: MEMBER.id },
    { id: NONMEMBER.id, firstName: 'Out', lastName: 'Sider', createdBy: NONMEMBER.id, updatedBy: NONMEMBER.id },
    { id: PERSON_A, firstName: 'Patient', lastName: 'Aye', createdBy: MEMBER.id, updatedBy: MEMBER.id },
    { id: PERSON_B, firstName: 'Patient', lastName: 'Bee', createdBy: MEMBER.id, updatedBy: MEMBER.id },
  ]).onConflictDoNothing();

  await db.insert(patients).values([
    { id: PATIENT_A, person: PERSON_A, preferredBranchId: BRANCH_ID, createdBy: MEMBER.id, updatedBy: MEMBER.id },
    { id: PATIENT_B, person: PERSON_B, preferredBranchId: BRANCH_ID, createdBy: MEMBER.id, updatedBy: MEMBER.id },
  ]).onConflictDoNothing();

  await db.insert(dentalInsuranceProfiles).values([
    { id: PROFILE_A, patientId: PATIENT_A, insurerName: 'Maxicare', policyNumber: 'POL-A', subscriberName: 'Patient Aye', createdBy: MEMBER.id, updatedBy: MEMBER.id },
    { id: PROFILE_B, patientId: PATIENT_B, insurerName: 'Intellicare', policyNumber: 'POL-B', subscriberName: 'Patient Bee', createdBy: MEMBER.id, updatedBy: MEMBER.id },
  ]).onConflictDoNothing();

  await db.insert(dentalCoverageAuthorizations).values([
    { id: LOA_A1, patientId: PATIENT_A, insuranceProfileId: PROFILE_A, branchId: BRANCH_ID, loaNumber: 'LOA-A1', status: 'requested', createdBy: MEMBER.id, updatedBy: MEMBER.id },
    { id: LOA_A2, patientId: PATIENT_A, insuranceProfileId: PROFILE_A, branchId: BRANCH_ID, loaNumber: 'LOA-A2', status: 'approved', createdBy: MEMBER.id, updatedBy: MEMBER.id },
    { id: LOA_B1, patientId: PATIENT_B, insuranceProfileId: PROFILE_B, branchId: BRANCH_ID, loaNumber: 'LOA-B1', status: 'requested', createdBy: MEMBER.id, updatedBy: MEMBER.id },
  ]).onConflictDoNothing();
});

function app(user?: { id: string; email: string }) {
  return buildTestApp({ db, user: user ?? null });
}

describe('GET /dental/patients/:patientId/authorizations', () => {
  test('unauthenticated → 401', async () => {
    const res = await app(undefined).request(`/dental/patients/${PATIENT_A}/authorizations`);
    expect(res.status).toBe(401);
  });

  test('unknown patient → 404', async () => {
    const res = await app(MEMBER).request(`/dental/patients/${UNKNOWN_PATIENT}/authorizations`);
    expect(res.status).toBe(404);
  });

  test('caller not a member of the patient branch → 403', async () => {
    const res = await app(NONMEMBER).request(`/dental/patients/${PATIENT_A}/authorizations`);
    expect(res.status).toBe(403);
  });

  test('member: returns ONLY the path patient authorizations (scope)', async () => {
    const res = await app(MEMBER).request(`/dental/patients/${PATIENT_A}/authorizations`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any[];
    expect(body.length).toBe(2);
    const ids = body.map((a) => a.id);
    expect(ids).toContain(LOA_A1);
    expect(ids).toContain(LOA_A2);
    // Scope: patient B's authorization must NEVER leak.
    expect(ids).not.toContain(LOA_B1);
    expect(body.every((a) => a.patientId === PATIENT_A)).toBe(true);
  });
});
