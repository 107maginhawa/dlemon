/**
 * cross-tenant-create-linkage.test.ts — P1-6 security pin.
 *
 * The create-side analog of the patient-contact IDOR (#38). createDentalVisit,
 * createAppointment, and createWaitlistEntry trusted a caller-supplied
 * `body.patientId` without verifying it belongs to the caller's branch. The RLS
 * WITH-CHECK only validates the NEW row's own branch_id, and the FK only checks
 * the patient EXISTS — so a Branch-A member could link a visit/appointment/
 * waitlist row to a FOREIGN Branch-B patient (cross-tenant PHI association; the
 * appointment path even fired a booking notification at the foreign patient).
 *
 * Fix: each handler resolves the patient and calls assertPatientBranchAccess
 * before the insert (mirroring the safe queue-item derive-from-parent pattern).
 * These tests assert the foreign-patient create is rejected (403) and a
 * same-branch create still succeeds.
 *
 * Run: DATABASE_URL=…monobase_test bun run scripts/test-with-db.ts \
 *   src/tests/cross-tenant-create-linkage.test.ts   (from services/api-ts)
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { createDatabase } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';

const db = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test',
});

// Suite-unique tag (ctl) avoids the dental_membership (person_id, branch_id)
// partial-unique collision with sibling cross-tenant suites.
const OWNER_A = { id: 'cc100000-0000-4000-8000-0000000c7101', email: 'ownerA.ctl@clinic.com' };
const OWNER_B = { id: 'cc100000-0000-4000-8000-0000000c7102', email: 'ownerB.ctl@clinic.com' };
const ORG_A = 'cc200000-0000-4000-8000-0000000c710a';
const ORG_B = 'cc200000-0000-4000-8000-0000000c710b';
const BRANCH_A = 'cc300000-0000-4000-8000-0000000c710a';
const BRANCH_B = 'cc300000-0000-4000-8000-0000000c710b';
const OWNER_A_MEMBER = 'cc400000-0000-4000-8000-0000000c710a';
const OWNER_B_MEMBER = 'cc400000-0000-4000-8000-0000000c710b';
const PATIENT_A = 'cc500000-0000-4000-8000-0000000c710a';
const PATIENT_B = 'cc500000-0000-4000-8000-0000000c710b';
const PERSON_A = 'cc600000-0000-4000-8000-0000000c710a';
const PERSON_B = 'cc600000-0000-4000-8000-0000000c710b';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');

  await db.insert(dentalOrganizations).values([
    { id: ORG_A, name: 'Clinic A ctl', tier: 'solo', ownerPersonId: OWNER_A.id, countryCode: 'PH', createdBy: OWNER_A.id, updatedBy: OWNER_A.id },
    { id: ORG_B, name: 'Clinic B ctl', tier: 'solo', ownerPersonId: OWNER_B.id, countryCode: 'PH', createdBy: OWNER_B.id, updatedBy: OWNER_B.id },
  ]).onConflictDoNothing();
  await db.insert(dentalBranches).values([
    { id: BRANCH_A, organizationId: ORG_A, name: 'A ctl', timezone: 'Asia/Manila', createdBy: OWNER_A.id, updatedBy: OWNER_A.id },
    { id: BRANCH_B, organizationId: ORG_B, name: 'B ctl', timezone: 'Asia/Manila', createdBy: OWNER_B.id, updatedBy: OWNER_B.id },
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
});

const appA = () => buildTestApp({ db, user: OWNER_A });

const future = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

describe('P1-6: cross-tenant patient linkage on CREATE is rejected', () => {
  test('createDentalVisit: Branch-A member cannot link a visit to a foreign (Branch-B) patient', async () => {
    const res = await appA().request('/dental/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId: BRANCH_A, patientId: PATIENT_B, dentistMemberId: OWNER_A_MEMBER, visitType: 'general' }),
    });
    expect(res.status).toBe(403);
  });

  test('createAppointment: Branch-A member cannot link an appointment to a foreign patient', async () => {
    const res = await appA().request('/dental/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branchId: BRANCH_A, providerId: OWNER_A_MEMBER, patientId: PATIENT_B,
        startAt: future(24), endAt: future(25), visitType: 'checkup', walkIn: true,
      }),
    });
    expect(res.status).toBe(403);
  });

  test('createWaitlistEntry: Branch-A member cannot waitlist a foreign patient', async () => {
    const res = await appA().request(`/dental/branches/${BRANCH_A}/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_B, urgency: 'routine' }),
    });
    expect(res.status).toBe(403);
  });

  // Positive control: the SAME-branch create still succeeds (the fix does not over-block).
  test('createWaitlistEntry: same-branch patient still succeeds (201)', async () => {
    const res = await appA().request(`/dental/branches/${BRANCH_A}/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_A, urgency: 'routine' }),
    });
    expect(res.status).toBe(201);
  });
});
