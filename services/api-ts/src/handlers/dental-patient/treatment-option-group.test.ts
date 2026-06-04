/**
 * treatment-option-group.test.ts — P1-19 alternate cases
 *
 * P1-19-AC1  GET lists the options in a group (incl. recommended flag)
 * P1-19-AC2  accepting one option → planned; its siblings → declined
 * P1-19-AC3  accepting a treatment not in the group → 422
 * P1-19-AC4  unknown option group → 404
 */

import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { listTreatmentOptionGroup } from './treatment-plans/listTreatmentOptionGroup';
import { acceptTreatmentOption } from './treatment-plans/acceptTreatmentOption';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: 'a0000000-0000-1000-8000-0000000000bc', email: 'staff@clinic.com' };
const BRANCH_ID = 'b0000000-0000-1000-8000-0000000000bc';
const ORG_ID = 'c0000000-0000-1000-8000-0000000000bc';
const PATIENT_ID = 'd0000000-0000-1000-8000-0000000000bc';
const PERSON_ID = 'e0000000-0000-1000-8000-0000000000bc';
const MEMBER_ID = 'a1000000-0000-1000-8000-0000000000bc';
const VISIT_ID = 'f0000000-0000-1000-8000-0000000000bc';
const GROUP_ID = 'f3000000-0000-1000-8000-0000000000bc';
const IMPLANT_ID = 'f4000000-0000-1000-8000-0000000000b1';
const BRIDGE_ID = 'f4000000-0000-1000-8000-0000000000b2';
const STANDALONE_ID = 'f4000000-0000-1000-8000-0000000000b3';
const MISSING_GROUP_ID = 'f9000000-0000-1000-8000-0000000000bc';

const ve = (result: any, c: any) => {
  if (!result.success) return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
};
const Params = z.object({ patientId: z.string().uuid(), optionGroupId: z.string().uuid() });
const AcceptBody = z.object({ chosenTreatmentId: z.string().uuid() });

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');
  const { dentalVisits } = await import('@/handlers/dental-visit/repos/visit.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Opt Clinic', tier: 'solo', ownerPersonId: TEST_USER.id, countryCode: 'PH',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main', timezone: 'Asia/Manila',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id, displayName: 'Dentist',
    role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'Opt', lastName: 'Patient', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, status: 'active',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalVisits).values({
    id: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID,
    status: 'draft', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  } as any).onConflictDoNothing();
});

async function seedOptions() {
  const { dentalTreatments } = await import('@/handlers/dental-visit/repos/treatment.schema');
  await db.insert(dentalTreatments).values([
    { id: IMPLANT_ID, visitId: VISIT_ID, patientId: PATIENT_ID, cdtCode: 'D6010', description: 'Implant',
      status: 'diagnosed', priceCents: 80000, optionGroupId: GROUP_ID, recommended: true,
      createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
    { id: BRIDGE_ID, visitId: VISIT_ID, patientId: PATIENT_ID, cdtCode: 'D6240', description: 'Bridge',
      status: 'diagnosed', priceCents: 60000, optionGroupId: GROUP_ID, recommended: false,
      createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
    { id: STANDALONE_ID, visitId: VISIT_ID, patientId: PATIENT_ID, cdtCode: 'D1110', description: 'Cleaning',
      status: 'diagnosed', priceCents: 5000, createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
  ] as any).onConflictDoNothing();
}

afterEach(async () => {
  const { dentalTreatments } = await import('@/handlers/dental-visit/repos/treatment.schema');
  await db.delete(dentalTreatments).where(eq(dentalTreatments.patientId, PATIENT_ID));
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
  app.get('/dental/patients/:patientId/treatment-options/:optionGroupId',
    zValidator('param', Params, ve), listTreatmentOptionGroup as any);
  app.post('/dental/patients/:patientId/treatment-options/:optionGroupId/accept',
    zValidator('param', Params, ve), zValidator('json', AcceptBody, ve), acceptTreatmentOption as any);
  return app;
}

describe('P1-19 — alternate cases', () => {
  test('P1-19-AC1: lists options with recommended flag', async () => {
    await seedOptions();
    const app = buildApp();
    const res = await app.request(`/dental/patients/${PATIENT_ID}/treatment-options/${GROUP_ID}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.options.length).toBe(2);
    const implant = body.options.find((o: any) => o.id === IMPLANT_ID);
    expect(implant.recommended).toBe(true);
  });

  test('P1-19-AC2: accept one → planned; sibling → declined', async () => {
    await seedOptions();
    const app = buildApp();
    const res = await app.request(`/dental/patients/${PATIENT_ID}/treatment-options/${GROUP_ID}/accept`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chosenTreatmentId: IMPLANT_ID }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    const implant = body.options.find((o: any) => o.id === IMPLANT_ID);
    const bridge = body.options.find((o: any) => o.id === BRIDGE_ID);
    expect(implant.status).toBe('planned');
    expect(bridge.status).toBe('declined');
  });

  test('P1-19-AC3: chosen treatment not in group → 422', async () => {
    await seedOptions();
    const app = buildApp();
    const res = await app.request(`/dental/patients/${PATIENT_ID}/treatment-options/${GROUP_ID}/accept`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chosenTreatmentId: STANDALONE_ID }),
    });
    expect(res.status).toBe(422);
  });

  test('P1-19-AC4: unknown group → 404', async () => {
    await seedOptions();
    const app = buildApp();
    const res = await app.request(`/dental/patients/${PATIENT_ID}/treatment-options/${MISSING_GROUP_ID}`);
    expect(res.status).toBe(404);
  });
});
