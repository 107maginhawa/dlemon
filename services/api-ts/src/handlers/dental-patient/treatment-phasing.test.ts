/**
 * treatment-phasing.test.ts — P1-18 clinical phasing / sequencing
 *
 * P1-18-AC1  getTreatmentPlan orders pending items by clinical phase order
 * P1-18-AC2  intra-phase ties break on `priority` (lower first)
 * P1-18-AC3  unphased items sort after all phased items
 * P1-18-AC4  phase + priority round-trip through the response items
 */

import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { getTreatmentPlan } from '@/handlers/dental-visit/treatment-plans/getTreatmentPlan';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: 'a0000000-0000-1000-8000-0000000000ph', email: 'staff@clinic.com' };
const BRANCH_ID = 'b0000000-0000-1000-8000-0000000000ph';
const ORG_ID = 'c0000000-0000-1000-8000-0000000000ph';
const PATIENT_ID = 'd0000000-0000-1000-8000-0000000000ph';
const PERSON_ID = 'e0000000-0000-1000-8000-0000000000ph';
const MEMBER_ID = 'a1000000-0000-1000-8000-0000000000ph';
const VISIT_ID = 'f0000000-0000-1000-8000-0000000000ph';

const URGENT_ID = 'f4000000-0000-1000-8000-0000000000p1';
const CONTROL_HI_ID = 'f4000000-0000-1000-8000-0000000000p2';
const CONTROL_LO_ID = 'f4000000-0000-1000-8000-0000000000p3';
const DEFINITIVE_ID = 'f4000000-0000-1000-8000-0000000000p4';
const UNPHASED_ID = 'f4000000-0000-1000-8000-0000000000p5';

const ve = (result: any, c: any) => {
  if (!result.success) return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
};

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');
  const { dentalVisits } = await import('@/handlers/dental-visit/repos/visit.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Phase Clinic', tier: 'solo', ownerPersonId: TEST_USER.id, countryCode: 'PH',
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
    id: PERSON_ID, firstName: 'Phase', lastName: 'Patient', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
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

async function seedPhased() {
  const { dentalTreatments } = await import('@/handlers/dental-visit/repos/treatment.schema');
  // Insert intentionally out of clinical order to prove the server re-sequences.
  await db.insert(dentalTreatments).values([
    { id: DEFINITIVE_ID, visitId: VISIT_ID, patientId: PATIENT_ID, cdtCode: 'D2740', description: 'Crown',
      status: 'planned', priceCents: 50000, phase: 'definitive', priority: 0,
      createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
    { id: UNPHASED_ID, visitId: VISIT_ID, patientId: PATIENT_ID, cdtCode: 'D1110', description: 'Cleaning',
      status: 'diagnosed', priceCents: 5000, priority: 0,
      createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
    { id: CONTROL_LO_ID, visitId: VISIT_ID, patientId: PATIENT_ID, cdtCode: 'D2391', description: 'Filling A',
      status: 'diagnosed', priceCents: 18000, phase: 'disease_control', priority: 5,
      createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
    { id: CONTROL_HI_ID, visitId: VISIT_ID, patientId: PATIENT_ID, cdtCode: 'D2392', description: 'Filling B',
      status: 'diagnosed', priceCents: 18000, phase: 'disease_control', priority: 1,
      createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
    { id: URGENT_ID, visitId: VISIT_ID, patientId: PATIENT_ID, cdtCode: 'D9110', description: 'Pain relief',
      status: 'diagnosed', priceCents: 8000, phase: 'systemic', priority: 0,
      createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
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
  app.get('/dental/patients/:patientId/treatment-plan',
    zValidator('query', z.object({ branchId: z.string().uuid() }), ve), getTreatmentPlan as any);
  return app;
}

describe('P1-18 — treatment phasing / sequencing', () => {
  test('P1-18-AC1/AC2/AC3: items sequence by phase order then priority; unphased last', async () => {
    await seedPhased();
    const app = buildApp();
    const res = await app.request(`/dental/patients/${PATIENT_ID}/treatment-plan?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    const order = body.treatments.map((t: any) => t.id);
    expect(order).toEqual([
      URGENT_ID,      // systemic (phase 0)
      CONTROL_HI_ID,  // disease_control, priority 1
      CONTROL_LO_ID,  // disease_control, priority 5
      DEFINITIVE_ID,  // definitive (phase 3)
      UNPHASED_ID,    // no phase → last
    ]);
  });

  test('P1-18-AC4: phase + priority round-trip in the response items', async () => {
    await seedPhased();
    const app = buildApp();
    const res = await app.request(`/dental/patients/${PATIENT_ID}/treatment-plan?branchId=${BRANCH_ID}`);
    const body = (await res.json()) as any;
    const urgent = body.treatments.find((t: any) => t.id === URGENT_ID);
    expect(urgent.phase).toBe('systemic');
    const ctrl = body.treatments.find((t: any) => t.id === CONTROL_LO_ID);
    expect(ctrl.phase).toBe('disease_control');
    expect(ctrl.priority).toBe(5);
    const unphased = body.treatments.find((t: any) => t.id === UNPHASED_ID);
    expect(unphased.phase).toBeNull();
  });
});
