/**
 * dental-treatment.fee-default.test.ts — dental-org G2 (decision §5 = DRIVE pricing).
 *
 * Proves the fee schedule actually drives treatment pricing (closes AC-ORG-002):
 * when a treatment is created WITHOUT an explicit priceCents, the handler defaults
 * it from the fee schedule — a per-branch override wins, else the global catalog
 * default. An explicit priceCents always wins.
 *
 * Mounts the GENERATED validator (CreateDentalTreatmentBody) so this also pins the
 * spec change that makes priceCents optional — before regen the validator rejects
 * the price-less body with 400 (RED).
 */
import { describe, test, expect, afterEach, beforeAll, afterAll } from 'bun:test';
import { sql, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { CreateDentalTreatmentBody, CreateDentalTreatmentParams } from '@/generated/openapi/validators';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { VisitRepository } from './repos/visit.repo';
import { createDentalTreatment } from './treatments/createDentalTreatment';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const OWNER = { id: '00000000-0000-0000-0000-0000000feed1', email: 'feeowner@clinic.com' };
const PATIENT_ID = 'a0000000-0000-1000-8000-00000000fee1';
const PERSON_ID = 'e0000000-0000-1000-8000-00000000fee1';
const BRANCH_ID = 'b0000000-0000-1000-8000-00000000fee2';
const ORG_ID = 'db000000-0000-1000-8000-00000000fee2';
const MEMBER_ID = 'c0000000-0000-1000-8000-00000000fee3';

// CDT_OVR has a branch override; CDT_DEF relies on the catalog default.
const CDT_OVR = 'D1110';
const CDT_OVR_DEFAULT = 10000; // catalog default (centavos)
const CDT_OVR_OVERRIDE = 25000; // per-branch override (centavos) — should win
const CDT_DEF = 'D2391';
const CDT_DEF_DEFAULT = 40000; // catalog default — used when no override

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { dentalProcedureCodes } = await import('./repos/procedure-code.schema');

  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'Fee Clinic', tier: 'solo', ownerPersonId: OWNER.id, countryCode: 'PH', createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Fee Branch', timezone: 'Asia/Manila', settings: { currency: 'PHP', feeSchedule: { [CDT_OVR]: CDT_OVR_OVERRIDE } }, createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  // Ensure the override is present even if the branch row pre-existed from a prior run.
  await db.update(dentalBranches).set({ settings: { currency: 'PHP', feeSchedule: { [CDT_OVR]: CDT_OVR_OVERRIDE } } }).where(eq(dentalBranches.id, BRANCH_ID));
  await db.insert(dentalMemberships).values({ id: MEMBER_ID, branchId: BRANCH_ID, personId: OWNER.id, displayName: 'Dr Fee', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'Fee', lastName: 'Patient', createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  await db.insert(dentalProcedureCodes).values([
    { cdtCode: CDT_OVR, description: 'Adult prophylaxis', category: 'preventive', defaultFeePhp: CDT_OVR_DEFAULT, active: true, createdBy: OWNER.id, updatedBy: OWNER.id },
    { cdtCode: CDT_DEF, description: 'Composite — 1 surface', category: 'restorative', defaultFeePhp: CDT_DEF_DEFAULT, active: true, createdBy: OWNER.id, updatedBy: OWNER.id },
  ]).onConflictDoNothing();
});

afterAll(async () => {
  const { dentalProcedureCodes } = await import('./repos/procedure-code.schema');
  await db.delete(dentalProcedureCodes).where(eq(dentalProcedureCodes.cdtCode, CDT_OVR)).catch(() => {});
  await db.delete(dentalProcedureCodes).where(eq(dentalProcedureCodes.cdtCode, CDT_DEF)).catch(() => {});
  await db.execute(sql`DELETE FROM dental_membership WHERE branch_id = ${BRANCH_ID}`).catch(() => {});
  await db.execute(sql`DELETE FROM dental_branch WHERE id = ${BRANCH_ID}`).catch(() => {});
  await db.execute(sql`DELETE FROM dental_organization WHERE id = ${ORG_ID}`).catch(() => {});
});

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE dental_treatment, dental_chart, visit_notes, dental_visit CASCADE`);
  await db.execute(sql`TRUNCATE TABLE dental_audit_log`);
});

const ve = (result: any, c: any) => {
  if (!result.success) return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
};
const TreatmentBodyOnly = CreateDentalTreatmentBody.omit({ visitId: true });

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
    ctx.set('user', OWNER);
    ctx.set('session', { id: 'test-session' });
    await next();
  });
  app.post('/dental/visits/:visitId/treatments', zValidator('param', CreateDentalTreatmentParams, ve), zValidator('json', TreatmentBodyOnly, ve), createDentalTreatment as any);
  return app;
}

async function seedVisit() {
  return new VisitRepository(db).createOne({ patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID });
}

describe('createDentalTreatment — fee-schedule price defaulting (AC-ORG-002)', () => {
  test('defaults priceCents from the per-branch override when omitted', async () => {
    const visit = await seedVisit();
    const app = buildApp();
    const res = await app.request(`/dental/visits/${visit.id}/treatments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, cdtCode: CDT_OVR, description: 'Cleaning' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { priceCents: number };
    expect(body.priceCents).toBe(CDT_OVR_OVERRIDE);
  });

  test('defaults priceCents from the catalog default when no override and omitted', async () => {
    const visit = await seedVisit();
    const app = buildApp();
    const res = await app.request(`/dental/visits/${visit.id}/treatments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, cdtCode: CDT_DEF, description: 'Composite' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { priceCents: number };
    expect(body.priceCents).toBe(CDT_DEF_DEFAULT);
  });

  test('an explicit priceCents always wins over the fee schedule', async () => {
    const visit = await seedVisit();
    const app = buildApp();
    const res = await app.request(`/dental/visits/${visit.id}/treatments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, cdtCode: CDT_OVR, description: 'Cleaning', priceCents: 99900 }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { priceCents: number };
    expect(body.priceCents).toBe(99900);
  });
});
