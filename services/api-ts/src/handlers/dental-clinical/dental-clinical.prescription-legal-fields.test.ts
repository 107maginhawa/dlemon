/**
 * P2-13: Prescription legal fields (US-context, record-only)
 *
 * Adds prescriber DEA number, prescriber NPI, and DEA controlled-substance
 * schedule (none/II/III/IV/V) to prescriptions. EPCS/Surescripts transmission
 * is out of scope — fields + record only. Fields are optional and additive so
 * the non-controlled ₱/PH flow is unaffected.
 *
 * Tests:
 * - schedule defaults to 'none' when omitted (PH flow unaffected)
 * - DEA / NPI default to null when omitted
 * - all three legal fields persist on create
 * - each controlled-substance schedule value (II–V) round-trips
 * - legal fields are updatable via PATCH
 * - omitting legal fields in PATCH preserves the stored values
 */

import { describe, test, expect, afterEach, beforeAll, beforeEach } from 'bun:test';
import { sql, eq, and } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  CreatePrescriptionBody, CreatePrescriptionParams,
  UpdatePrescriptionBody, UpdatePrescriptionParams,
} from '@/generated/openapi/validators';
import { createPrescription } from './prescriptions/createPrescription';
import { updatePrescription } from './prescriptions/updatePrescription';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: '00000000-0000-0000-0000-0000000000a1', email: 'rx-legal@clinic.com' };
const PATIENT_ID = 'a0000000-0000-1000-8000-0000000000a1';
const BRANCH_ID = 'b9000000-0000-1000-8000-0000000000a9';
const ORG_ID = 'd9000000-0000-1000-8000-0000000000a9';
const PERSON_ID = 'f9000000-0000-1000-8000-0000000000a9';
const VISIT_ID = 'ee000000-0000-1000-8000-0000000000a1';
const MEMBER_ID = 'c0000000-0000-1000-8000-0000000000a3';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');
  const { dentalVisits } = await import('@/handlers/dental-visit/repos/visit.schema');

  await db.execute(sql`DELETE FROM dental_visit WHERE id = ${VISIT_ID}`);
  await db.delete(dentalMemberships).where(
    and(eq(dentalMemberships.personId, TEST_USER.id), eq(dentalMemberships.branchId, BRANCH_ID))
  );

  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'RxLegal Clinic', tier: 'solo', ownerPersonId: TEST_USER.id, countryCode: 'US', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch', timezone: 'America/New_York', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id, displayName: 'Test User', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'Test', lastName: 'Patient', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalVisits).values({ id: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID, status: 'active', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
});

const ve = (result: any, c: any) => {
  if (!result.success) return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
};

const PrescriptionBodyOnly = CreatePrescriptionBody.omit({ visitId: true });

function buildTestApp(user?: typeof TEST_USER) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err.message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    if (user) ctx.set('user', user);
    await next();
  });
  app.post('/dental/visits/:visitId/prescriptions',
    zValidator('param', CreatePrescriptionParams, ve),
    zValidator('json', PrescriptionBodyOnly, ve),
    createPrescription as any,
  );
  app.patch('/dental/visits/:visitId/prescriptions/:prescriptionId',
    zValidator('param', UpdatePrescriptionParams, ve),
    zValidator('json', UpdatePrescriptionBody, ve),
    updatePrescription as any,
  );
  return app;
}

async function createRx(extra: Record<string, unknown> = {}) {
  const app = buildTestApp(TEST_USER);
  const res = await app.request(`/dental/visits/${VISIT_ID}/prescriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patientId: PATIENT_ID,
      prescriberMemberId: MEMBER_ID,
      drugName: 'Amoxicillin',
      dosage: '500mg',
      frequency: 'TID',
      ...extra,
    }),
  });
  return res;
}

beforeEach(async () => {
  const { dentalVisits } = await import('@/handlers/dental-visit/repos/visit.schema');
  await db.insert(dentalVisits).values({ id: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID, status: 'active', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE prescription, dental_treatment, dental_visit CASCADE`);
});

describe('P2-13: Prescription legal fields', () => {
  test('schedule defaults to none and DEA/NPI null when omitted (PH flow unaffected)', async () => {
    const res = await createRx();
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.controlledSubstanceSchedule).toBe('none');
    expect(body.prescriberDea ?? null).toBeNull();
    expect(body.prescriberNpi ?? null).toBeNull();
  });

  test('all three legal fields persist on create', async () => {
    const res = await createRx({
      controlledSubstanceSchedule: 'III',
      prescriberDea: 'BD1234563',
      prescriberNpi: '1234567893',
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.controlledSubstanceSchedule).toBe('III');
    expect(body.prescriberDea).toBe('BD1234563');
    expect(body.prescriberNpi).toBe('1234567893');
  });

  test.each(['II', 'III', 'IV', 'V'])('controlled-substance schedule %s round-trips', async (schedule) => {
    const res = await createRx({ controlledSubstanceSchedule: schedule });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.controlledSubstanceSchedule).toBe(schedule);
  });

  test('legal fields are updatable via PATCH', async () => {
    const created = await (await createRx()).json() as any;
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${VISIT_ID}/prescriptions/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        controlledSubstanceSchedule: 'II',
        prescriberDea: 'AB1234567',
        prescriberNpi: '1987654321',
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.controlledSubstanceSchedule).toBe('II');
    expect(body.prescriberDea).toBe('AB1234567');
    expect(body.prescriberNpi).toBe('1987654321');
  });

  test('omitting legal fields in PATCH preserves stored values', async () => {
    const created = await (await createRx({
      controlledSubstanceSchedule: 'IV',
      prescriberDea: 'BD1234563',
      prescriberNpi: '1234567893',
    })).json() as any;

    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${VISIT_ID}/prescriptions/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dosage: '250mg' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.dosage).toBe('250mg');
    // Legal fields untouched
    expect(body.controlledSubstanceSchedule).toBe('IV');
    expect(body.prescriberDea).toBe('BD1234563');
    expect(body.prescriberNpi).toBe('1234567893');
  });

  test('invalid schedule value is rejected (422)', async () => {
    const res = await createRx({ controlledSubstanceSchedule: 'VI' });
    // zValidator rejects unknown enum → 400
    expect(res.status).toBe(400);
  });
});
