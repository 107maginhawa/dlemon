/**
 * exportDentalChart.test.ts — GET /dental/visits/:visitId/chart/export (WF-034)
 *
 * buildChartExport (the pure layer/summary logic) is covered by chart/chart-export.test.ts.
 * This covers the HANDLER GLUE that the pure function cannot: auth (401), unknown visit
 * (404), branch-access denial (403), and — the load-bearing one — that the treatment
 * summary aggregates across ALL of the patient's visits (lines 57-64), not just the
 * exported visit. A plan is a living document, so a treatment recorded on a DIFFERENT
 * visit of the same patient must appear in any visit's exported chart.
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { createDatabase } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { dentalVisits } from '@/handlers/dental-visit/repos/visit.schema';
import { dentalTreatments } from '@/handlers/dental-visit/repos/treatment.schema';

const db = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test',
});

// `034` segment = suite-unique tag (WF-034) avoiding cross-suite id collisions.
const MEMBER = { id: 'a0340000-0000-4000-8000-000000000001', email: 'dentist@example.com' };
const NONMEMBER = { id: 'a0340000-0000-4000-8000-000000000099', email: 'outsider@example.com' };
const PERSON_P = 'a0340000-0000-4000-8000-000000000010';
const PATIENT = 'b0340000-0000-4000-8000-000000000001';
const UNKNOWN_VISIT = 'ffffffff-ffff-4000-8000-ffffffffff34';

const ORG_ID = 'c0340000-0000-4000-8000-000000000001';
const BRANCH_ID = 'd0340000-0000-4000-8000-000000000001';
const MEMBERSHIP_ID = 'e0340000-0000-4000-8000-000000000001';
const VISIT_1 = 'f0340000-0000-4000-8000-0000000000a1'; // exported; no chart, no own treatment
const VISIT_2 = 'f0340000-0000-4000-8000-0000000000a2'; // carries the treatment
const TREATMENT = '0a340000-0000-4000-8000-000000000001'; // on VISIT_2

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Chart Clinic', tier: 'solo', ownerPersonId: MEMBER.id,
    countryCode: 'PH', createdBy: MEMBER.id, updatedBy: MEMBER.id,
  }).onConflictDoNothing();

  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main', timezone: 'Asia/Manila',
    createdBy: MEMBER.id, updatedBy: MEMBER.id,
  }).onConflictDoNothing();

  await db.insert(dentalMemberships).values({
    id: MEMBERSHIP_ID, branchId: BRANCH_ID, personId: MEMBER.id,
    displayName: 'Dr. Chart', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, createdBy: MEMBER.id, updatedBy: MEMBER.id,
  }).onConflictDoNothing();

  await db.insert(persons).values([
    { id: MEMBER.id, firstName: 'Dee', lastName: 'Entist', createdBy: MEMBER.id, updatedBy: MEMBER.id },
    { id: NONMEMBER.id, firstName: 'Out', lastName: 'Sider', createdBy: NONMEMBER.id, updatedBy: NONMEMBER.id },
    { id: PERSON_P, firstName: 'Chart', lastName: 'Patient', createdBy: MEMBER.id, updatedBy: MEMBER.id },
  ]).onConflictDoNothing();

  await db.insert(patients).values({
    id: PATIENT, person: PERSON_P, preferredBranchId: BRANCH_ID,
    createdBy: MEMBER.id, updatedBy: MEMBER.id,
  }).onConflictDoNothing();

  await db.insert(dentalVisits).values([
    { id: VISIT_1, patientId: PATIENT, branchId: BRANCH_ID, dentistMemberId: MEMBERSHIP_ID, status: 'active', createdBy: MEMBER.id, updatedBy: MEMBER.id },
    { id: VISIT_2, patientId: PATIENT, branchId: BRANCH_ID, dentistMemberId: MEMBERSHIP_ID, status: 'completed', createdBy: MEMBER.id, updatedBy: MEMBER.id },
  ]).onConflictDoNothing();

  // A proposed treatment recorded on VISIT_2 only.
  await db.insert(dentalTreatments).values({
    id: TREATMENT, visitId: VISIT_2, patientId: PATIENT, toothNumber: 14,
    cdtCode: 'D2740', description: 'Crown', status: 'diagnosed', priceCents: 800000,
    createdBy: MEMBER.id, updatedBy: MEMBER.id,
  }).onConflictDoNothing();
});

function app(user?: { id: string; email: string }) {
  return buildTestApp({ db, user: user ?? null });
}

describe('GET /dental/visits/:visitId/chart/export', () => {
  test('unauthenticated → 401', async () => {
    const res = await app(undefined).request(`/dental/visits/${VISIT_1}/chart/export`);
    expect(res.status).toBe(401);
  });

  test('unknown visit → 404', async () => {
    const res = await app(MEMBER).request(`/dental/visits/${UNKNOWN_VISIT}/chart/export`);
    expect(res.status).toBe(404);
  });

  test('caller without access to the visit branch → 403', async () => {
    const res = await app(NONMEMBER).request(`/dental/visits/${VISIT_1}/chart/export`);
    expect(res.status).toBe(403);
  });

  test('export aggregates treatments across ALL the patient visits, not just the exported one', async () => {
    // VISIT_1 has no treatment of its own; the crown lives on VISIT_2.
    const res = await app(MEMBER).request(`/dental/visits/${VISIT_1}/chart/export`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    const cdtCodes = (body.treatments as any[]).map((t) => t.cdtCode);
    expect(cdtCodes).toContain('D2740'); // the cross-visit treatment surfaced
    expect(body.summary.proposedCount).toBeGreaterThanOrEqual(1);
  });
});
