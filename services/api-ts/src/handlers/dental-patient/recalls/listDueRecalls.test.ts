/**
 * listDueRecalls.test.ts — GET /dental/recalls/due (P1-24 front-desk recare worklist)
 *
 * The route-registration smoke (reminders-route-registration.test.ts) already proves
 * 401-no-auth + the route resolves. This covers the HANDLER's own behaviour that those
 * smokes cannot: the [from,to] window + terminal-status exclusion + patientName
 * projection, the DEFAULT window (today → +1 month) when from/to are omitted, the
 * branch-access 403, and the malformed-date 400. Mounted through buildTestApp so the
 * real authMiddleware → query zValidator → handler chain runs.
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { createDatabase } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { dentalRecalls } from '@/handlers/dental-patient/repos/recall.schema';
import { todayInTimezone, addMonths } from '@/handlers/dental-patient/utils/recall-dates';

const db = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test',
});

// `024` segment = suite-unique tag (P1-24) avoiding cross-suite id collisions.
const MEMBER = { id: 'a0240000-0000-4000-8000-000000000001', email: 'frontdesk@example.com' };
const NONMEMBER = { id: 'a0240000-0000-4000-8000-000000000099', email: 'outsider@example.com' };
const PATIENT_PERSON = 'a0240000-0000-4000-8000-000000000010';
const PATIENT = 'b0240000-0000-4000-8000-000000000001';

const ORG_ID = 'c0240000-0000-4000-8000-000000000001';
const BRANCH_ID = 'd0240000-0000-4000-8000-000000000001';
const MEMBERSHIP_ID = 'e0240000-0000-4000-8000-000000000001';

const R_IN = 'f0240000-0000-4000-8000-0000000000a1'; // due today, pending → IN window
const R_OUT = 'f0240000-0000-4000-8000-0000000000a2'; // due +2 months, pending → OUT of default window
const R_DONE = 'f0240000-0000-4000-8000-0000000000a3'; // due today, completed → terminal, excluded

const TZ = 'Asia/Manila';
const TODAY = todayInTimezone(TZ);
const PLUS_2MO = addMonths(TODAY, 2); // beyond the default +1-month horizon

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');

  await db
    .insert(dentalOrganizations)
    .values({
      id: ORG_ID, name: 'Recare Clinic', tier: 'solo', ownerPersonId: MEMBER.id,
      countryCode: 'PH', createdBy: MEMBER.id, updatedBy: MEMBER.id,
    })
    .onConflictDoNothing();

  await db
    .insert(dentalBranches)
    .values({
      id: BRANCH_ID, organizationId: ORG_ID, name: 'Main', timezone: TZ,
      createdBy: MEMBER.id, updatedBy: MEMBER.id,
    })
    .onConflictDoNothing();

  // MEMBER is an active branch member → assertBranchAccess passes. NONMEMBER has none.
  await db
    .insert(dentalMemberships)
    .values({
      id: MEMBERSHIP_ID, branchId: BRANCH_ID, personId: MEMBER.id,
      displayName: 'Front Desk', role: 'staff_full', status: 'active',
      pinFailedAttempts: 0, createdBy: MEMBER.id, updatedBy: MEMBER.id,
    })
    .onConflictDoNothing();

  await db
    .insert(persons)
    .values([
      { id: MEMBER.id, firstName: 'Front', lastName: 'Desk', createdBy: MEMBER.id, updatedBy: MEMBER.id },
      { id: NONMEMBER.id, firstName: 'Out', lastName: 'Sider', createdBy: NONMEMBER.id, updatedBy: NONMEMBER.id },
      { id: PATIENT_PERSON, firstName: 'Recall', lastName: 'Patient', createdBy: MEMBER.id, updatedBy: MEMBER.id },
    ])
    .onConflictDoNothing();

  await db
    .insert(patients)
    .values({
      id: PATIENT, person: PATIENT_PERSON, preferredBranchId: BRANCH_ID,
      createdBy: MEMBER.id, updatedBy: MEMBER.id,
    })
    .onConflictDoNothing();

  await db
    .insert(dentalRecalls)
    .values([
      { id: R_IN, patientId: PATIENT, type: 'checkup', dueDate: TODAY, status: 'pending', sendAttempts: 0, createdBy: MEMBER.id, updatedBy: MEMBER.id },
      { id: R_OUT, patientId: PATIENT, type: 'cleaning', dueDate: PLUS_2MO, status: 'pending', sendAttempts: 0, createdBy: MEMBER.id, updatedBy: MEMBER.id },
      { id: R_DONE, patientId: PATIENT, type: 'checkup', dueDate: TODAY, status: 'completed', sendAttempts: 0, createdBy: MEMBER.id, updatedBy: MEMBER.id },
    ])
    .onConflictDoNothing();
});

function app(user?: { id: string; email: string }) {
  return buildTestApp({ db, user: user ?? null });
}

describe('GET /dental/recalls/due', () => {
  test('member: returns only in-window non-terminal recalls, enriched with patientName', async () => {
    const res = await app(MEMBER).request(`/dental/recalls/due?branchId=${BRANCH_ID}&from=${TODAY}&to=${TODAY}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any[];
    // R_OUT is past the window; R_DONE is terminal → only R_IN survives.
    expect(body.length).toBe(1);
    expect(body[0].id).toBe(R_IN);
    expect(body[0].patientId).toBe(PATIENT);
    expect(body[0].patientName).toBe('Recall Patient');
    expect(body[0].status).toBe('pending');
    expect(body[0].type).toBe('checkup');
    expect(body[0].dueDate).toBe(TODAY);
    // Projection shape the front desk relies on.
    expect(body[0]).toHaveProperty('intervalMonths');
    expect(body[0]).toHaveProperty('sendAttempts', 0);
    expect(body[0]).toHaveProperty('lastSentAt', null);
    // The out-of-window and completed recalls must NOT leak.
    const ids = body.map((r) => r.id);
    expect(ids).not.toContain(R_OUT);
    expect(ids).not.toContain(R_DONE);
  });

  test('member: default window (no from/to) is today → +1 month, excluding a +2-month recall', async () => {
    const res = await app(MEMBER).request(`/dental/recalls/due?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any[];
    expect(body.length).toBe(1);
    expect(body[0].id).toBe(R_IN);
    expect(body.map((r) => r.id)).not.toContain(R_OUT); // +2mo is beyond the default horizon
  });

  test('non-member of the branch → 403 (branch-scoped authorization)', async () => {
    const res = await app(NONMEMBER).request(`/dental/recalls/due?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(403);
  });

  test('malformed from (not YYYY-MM-DD) → 400 (handler date guard)', async () => {
    const res = await app(MEMBER).request(`/dental/recalls/due?branchId=${BRANCH_ID}&from=last-tuesday`);
    expect(res.status).toBe(400);
  });
});
