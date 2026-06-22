/**
 * household.test.ts — P1-27 household / guarantor (family file)
 *
 * P1-27-AC1  create household → guarantor becomes first member (isGuarantor)
 * P1-27-AC2  add a member → relationship persisted, not guarantor
 * P1-27-AC3  a patient cannot belong to two households (422)
 * P1-27-AC4  guarantor cannot be removed (422); a dependent can
 * P1-27-AC5  getPatientHousehold returns the family for a member
 */

import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { createHousehold } from './household/createHousehold';
import { getHousehold } from './household/getHousehold';
import { addHouseholdMember } from './household/addHouseholdMember';
import { removeHouseholdMember } from './household/removeHouseholdMember';
import { getPatientHousehold } from './household/getPatientHousehold';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: 'a0000000-0000-1000-8000-0000000000aa', email: 'staff@clinic.com' };
const BRANCH_ID = 'b0000000-0000-1000-8000-0000000000aa';
const ORG_ID = 'c0000000-0000-1000-8000-0000000000aa';
const MEMBER_ID = 'a1000000-0000-1000-8000-0000000000aa';

const GUARANTOR_PT = 'd0000000-0000-1000-8000-0000000000a1';
const CHILD_PT = 'd0000000-0000-1000-8000-0000000000a2';
const OUTSIDER_PT = 'd0000000-0000-1000-8000-0000000000a3';
const GUARANTOR_PERSON = 'e0000000-0000-1000-8000-0000000000a1';
const CHILD_PERSON = 'e0000000-0000-1000-8000-0000000000a2';
const OUTSIDER_PERSON = 'e0000000-0000-1000-8000-0000000000a3';
// A patient whose preferred branch differs from the household's branch — used to
// exercise the MEMBER_BRANCH_MISMATCH guard (addHouseholdMember.ts).
const OTHER_BRANCH_ID = 'b0000000-0000-1000-8000-0000000000ab';
const MISMATCH_PT = 'd0000000-0000-1000-8000-0000000000a4';
const MISMATCH_PERSON = 'e0000000-0000-1000-8000-0000000000a4';

const ve = (result: any, c: any) => {
  if (!result.success) return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
};
const HouseholdParam = z.object({ householdId: z.string().uuid() });
const MemberParam = z.object({ householdId: z.string().uuid(), patientId: z.string().uuid() });
const PatientParam = z.object({ patientId: z.string().uuid() });
const CreateBody = z.object({ branchId: z.string().uuid(), name: z.string().min(1), guarantorPatientId: z.string().uuid(), notes: z.string().optional() });
const AddBody = z.object({ patientId: z.string().uuid(), relationship: z.string().optional() });

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'HH Clinic', tier: 'solo', ownerPersonId: TEST_USER.id, countryCode: 'PH',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values([
    { id: BRANCH_ID, organizationId: ORG_ID, name: 'Main', timezone: 'Asia/Manila',
      createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
    { id: OTHER_BRANCH_ID, organizationId: ORG_ID, name: 'Annex', timezone: 'Asia/Manila',
      createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
  ]).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id, displayName: 'Dentist',
    role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(persons).values([
    { id: GUARANTOR_PERSON, firstName: 'Maria', lastName: 'Santos', createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
    { id: CHILD_PERSON, firstName: 'Juan', lastName: 'Santos', createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
    { id: OUTSIDER_PERSON, firstName: 'Pedro', lastName: 'Cruz', createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
    { id: MISMATCH_PERSON, firstName: 'Ana', lastName: 'Reyes', createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
  ]).onConflictDoNothing();
  await db.insert(patients).values([
    { id: GUARANTOR_PT, person: GUARANTOR_PERSON, preferredBranchId: BRANCH_ID, status: 'active', createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
    { id: CHILD_PT, person: CHILD_PERSON, preferredBranchId: BRANCH_ID, status: 'active', createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
    { id: OUTSIDER_PT, person: OUTSIDER_PERSON, preferredBranchId: BRANCH_ID, status: 'active', createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
    { id: MISMATCH_PT, person: MISMATCH_PERSON, preferredBranchId: OTHER_BRANCH_ID, status: 'active', createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
  ]).onConflictDoNothing();
});

afterEach(async () => {
  const { dentalHouseholds } = await import('./repos/household.schema');
  // cascade removes members
  await db.delete(dentalHouseholds).where(eq(dentalHouseholds.branchId, BRANCH_ID));
});

function buildApp() {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err.message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    ctx.set('user', TEST_USER);
    await next();
  });
  app.post('/dental/households', zValidator('json', CreateBody, ve), createHousehold as any);
  app.get('/dental/households/:householdId', zValidator('param', HouseholdParam, ve), getHousehold as any);
  app.post('/dental/households/:householdId/members', zValidator('param', HouseholdParam, ve), zValidator('json', AddBody, ve), addHouseholdMember as any);
  app.delete('/dental/households/:householdId/members/:patientId', zValidator('param', MemberParam, ve), removeHouseholdMember as any);
  app.get('/dental/patients/:patientId/household', zValidator('param', PatientParam, ve), getPatientHousehold as any);
  return app;
}

async function makeHousehold(app: Hono) {
  const res = await app.request('/dental/households', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ branchId: BRANCH_ID, name: 'Santos Family', guarantorPatientId: GUARANTOR_PT }),
  });
  return res;
}

describe('P1-27 — household / guarantor', () => {
  test('P1-27-AC1: create → guarantor is the first member', async () => {
    const app = buildApp();
    const res = await makeHousehold(app);
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.household.guarantorPatientId).toBe(GUARANTOR_PT);
    expect(body.members.length).toBe(1);
    expect(body.members[0].patientId).toBe(GUARANTOR_PT);
    expect(body.members[0].isGuarantor).toBe(true);
    expect(body.members[0].relationship).toBe('self');
  });

  test('P1-27-AC2: add a member with relationship', async () => {
    const app = buildApp();
    const created = (await (await makeHousehold(app)).json()) as any;
    const res = await app.request(`/dental/households/${created.household.id}/members`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: CHILD_PT, relationship: 'child' }),
    });
    expect(res.status).toBe(201);
    const member = (await res.json()) as any;
    expect(member.patientId).toBe(CHILD_PT);
    expect(member.relationship).toBe('child');
    expect(member.isGuarantor).toBe(false);
  });

  test('MEMBER_BRANCH_MISMATCH: cannot add a patient whose preferred branch differs from the household branch', async () => {
    const app = buildApp();
    const created = (await (await makeHousehold(app)).json()) as any; // household in BRANCH_ID
    const res = await app.request(`/dental/households/${created.household.id}/members`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: MISMATCH_PT, relationship: 'child' }), // MISMATCH_PT lives in OTHER_BRANCH_ID
    });
    expect(res.status).toBe(422);
    expect((await res.json() as any).code).toBe('MEMBER_BRANCH_MISMATCH');
  });

  test('P1-27-AC3: a patient cannot join two households', async () => {
    const app = buildApp();
    const created = (await (await makeHousehold(app)).json()) as any;
    await app.request(`/dental/households/${created.household.id}/members`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: CHILD_PT, relationship: 'child' }),
    });
    // Try to make the same child a guarantor of a new household
    const res = await app.request('/dental/households', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId: BRANCH_ID, name: 'Other Family', guarantorPatientId: CHILD_PT }),
    });
    expect(res.status).toBe(422);
  });

  test('P1-27-AC4: guarantor not removable; dependent removable', async () => {
    const app = buildApp();
    const created = (await (await makeHousehold(app)).json()) as any;
    const hid = created.household.id;
    await app.request(`/dental/households/${hid}/members`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: CHILD_PT, relationship: 'child' }),
    });
    const guarantorRemove = await app.request(`/dental/households/${hid}/members/${GUARANTOR_PT}`, { method: 'DELETE' });
    expect(guarantorRemove.status).toBe(422);
    const childRemove = await app.request(`/dental/households/${hid}/members/${CHILD_PT}`, { method: 'DELETE' });
    expect(childRemove.status).toBe(200);
  });

  test('P1-27-AC5: getPatientHousehold returns the family for a member', async () => {
    const app = buildApp();
    const created = (await (await makeHousehold(app)).json()) as any;
    await app.request(`/dental/households/${created.household.id}/members`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: CHILD_PT, relationship: 'child' }),
    });
    const res = await app.request(`/dental/patients/${CHILD_PT}/household`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.household.id).toBe(created.household.id);
    expect(body.members.length).toBe(2);
    // guarantor sorted first
    expect(body.members[0].isGuarantor).toBe(true);
  });

  test('P1-27-AC6: getPatientHousehold 204 for a patient with no household', async () => {
    // An absent optional sub-resource returns 204 (matches the perio-chart
    // precedent) so the client treats it as "no household" without a
    // console-noise 404. Genuine patient-not-found still 404 (see handler).
    const app = buildApp();
    await makeHousehold(app);
    const res = await app.request(`/dental/patients/${OUTSIDER_PT}/household`);
    expect(res.status).toBe(204);
  });

  // EF-PAT-001 symmetry: addHouseholdMember already blocks archived patients;
  // removeHouseholdMember must too (you don't restructure an archived patient's
  // household). 403 PATIENT_ARCHIVED.
  test('EF-PAT-001: removing an archived member returns 403 PATIENT_ARCHIVED', async () => {
    const { patients } = await import('@/handlers/patient/repos/patient.schema');
    const app = buildApp();
    const created = (await (await makeHousehold(app)).json()) as any;
    const hid = created.household.id;
    await app.request(`/dental/households/${hid}/members`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: CHILD_PT, relationship: 'child' }),
    });

    await db.update(patients).set({ status: 'archived', archivedAt: new Date() }).where(eq(patients.id, CHILD_PT));
    try {
      const res = await app.request(`/dental/households/${hid}/members/${CHILD_PT}`, { method: 'DELETE' });
      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.code).toBe('PATIENT_ARCHIVED');
    } finally {
      // patients aren't cleaned in afterEach — restore so other tests see an active CHILD_PT
      await db.update(patients).set({ status: 'active', archivedAt: null }).where(eq(patients.id, CHILD_PT));
    }
  });
});
