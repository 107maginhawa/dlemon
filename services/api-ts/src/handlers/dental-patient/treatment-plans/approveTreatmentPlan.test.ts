/**
 * approveTreatmentPlan + recompute trigger — endpoint flow (TR-P1-08 / CR-05 / TP-BR-005)
 *
 * Drives the full vertical through HTTP: approve a presented plan (binds items +
 * writes CR-05 record), then mark its treatments performed via the real
 * treatment-PATCH endpoint and assert the plan's derived status advances
 * partially_completed → completed (and never completes early — TP-BR-005).
 */
import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { UpdateDentalTreatmentBody, UpdateDentalTreatmentParams } from '@/generated/openapi/validators';
import { updateDentalTreatment } from '@/handlers/dental-visit/treatments/updateDentalTreatment';
import { approveTreatmentPlan } from './approveTreatmentPlan';
import { TreatmentPlanPlanParams, ApproveTreatmentPlanBody } from '../utils/treatment-plan-validators';
import { dentalTreatmentPlans } from '../repos/treatment-plan.schema';
import { dentalTreatments } from '@/handlers/dental-visit/repos/treatment.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER  = { id: 'e8000000-0000-1000-8000-000000000001', email: 'tp8@clinic.com' };
const PATIENT_ID = 'f8000000-0000-1000-8000-000000000001';
const PERSON_ID  = 'f8000000-0000-1000-8000-000000000002';
const BRANCH_ID  = '7b800000-0000-4000-8000-000000000004';
const ORG_ID     = 'a8000000-0000-1000-8000-000000000003';
const MEMBER_ID  = '7c800000-0000-4000-8000-000000000004';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');

  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'TP8 Clinic', tier: 'solo', ownerPersonId: TEST_USER.id, countryCode: 'PH', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'TP8 Branch', timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id, displayName: 'TP8 Dentist', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'TP8', lastName: 'Patient', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
});

const ve = (result: any, c: any) => {
  if (!result.success) return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
};

function buildApp() {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    if (err instanceof z.ZodError) return c.json({ error: 'validation' }, 400);
    console.error('Unhandled test error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    ctx.set('user', TEST_USER);
    ctx.set('session', { id: 'tp8-session', userId: TEST_USER.id });
    await next();
  });
  app.post('/dental/patients/:patientId/treatment-plans/:planId/approval',
    zValidator('param', TreatmentPlanPlanParams, ve), zValidator('json', ApproveTreatmentPlanBody, ve), approveTreatmentPlan as any);
  app.patch('/dental/visits/:visitId/treatments/:treatmentId',
    zValidator('param', UpdateDentalTreatmentParams, ve), zValidator('json', UpdateDentalTreatmentBody, ve), updateDentalTreatment as any);
  return app;
}

let visitId: string;

async function seedVisitWithConsent(): Promise<string> {
  const { dentalVisits } = await import('@/handlers/dental-visit/repos/visit.schema');
  const { consentForms } = await import('@/handlers/dental-clinical/repos/consent-form.schema');
  const id = crypto.randomUUID();
  await db.insert(dentalVisits).values({ id, patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID, status: 'active', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).returning();
  await db.insert(consentForms).values({ id: crypto.randomUUID(), visitId: id, patientId: PATIENT_ID, templateId: 'general-consent-v1', templateName: 'General Treatment Consent', signed: true, signedAt: new Date(), signatureData: 'data:image/png;base64,test', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  return id;
}

async function seedPlan(status: string) {
  const [p] = await db.insert(dentalTreatmentPlans).values({ patientId: PATIENT_ID, providerId: MEMBER_ID, status: status as any, totalEstimateCents: 0 }).returning();
  return p!;
}

async function seedTreatment(vId: string, status = 'planned') {
  const [t] = await db.insert(dentalTreatments).values({ visitId: vId, patientId: PATIENT_ID, cdtCode: 'D2140', description: 'Amalgam', priceCents: 10000, status: status as any, carriedOver: false, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).returning();
  return t!;
}

async function planStatus(planId: string): Promise<string> {
  const [p] = await db.select({ status: dentalTreatmentPlans.status }).from(dentalTreatmentPlans).where(eq(dentalTreatmentPlans.id, planId));
  return p!.status as string;
}

async function truncate() {
  await db.execute(sql`TRUNCATE TABLE dental_treatment_plan_approval, dental_treatment, dental_treatment_plan CASCADE`);
  await db.execute(sql`TRUNCATE TABLE dental_visit CASCADE`);
}

describe('approveTreatmentPlan + recompute (TP-BR-005)', () => {
  afterEach(truncate);

  test('approval: 201, records CR-05, links pending items, moves plan to approved', async () => {
    const app = buildApp();
    visitId = await seedVisitWithConsent();
    const plan = await seedPlan('presented');
    const t1 = await seedTreatment(visitId);
    const t2 = await seedTreatment(visitId);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/treatment-plans/${plan.id}/approval`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvedByPersonId: PERSON_ID, method: 'signature', signatureData: 'data:image/png;base64,sig' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.approval.method).toBe('signature');
    expect(body.plan.status).toBe('approved');

    // both pending treatments linked to the plan
    for (const t of [t1, t2]) {
      const [row] = await db.select({ planId: dentalTreatments.treatmentPlanId }).from(dentalTreatments).where(eq(dentalTreatments.id, t.id));
      expect(row!.planId).toBe(plan.id);
    }
  });

  test('TP-BR-005 end-to-end: performing one item → partially_completed; both → completed', async () => {
    const app = buildApp();
    visitId = await seedVisitWithConsent();
    const plan = await seedPlan('presented');
    const t1 = await seedTreatment(visitId);
    const t2 = await seedTreatment(visitId);

    await app.request(`/dental/patients/${PATIENT_ID}/treatment-plans/${plan.id}/approval`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvedByPersonId: PERSON_ID, method: 'verbal' }),
    });
    expect(await planStatus(plan.id)).toBe('approved');

    // perform t1 → plan partially_completed (NOT completed — TP-BR-005)
    const r1 = await app.request(`/dental/visits/${visitId}/treatments/${t1.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'performed' }),
    });
    expect(r1.status).toBe(200);
    expect(await planStatus(plan.id)).toBe('partially_completed');

    // perform t2 → plan completed
    const r2 = await app.request(`/dental/visits/${visitId}/treatments/${t2.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'performed' }),
    });
    expect(r2.status).toBe(200);
    expect(await planStatus(plan.id)).toBe('completed');
  });

  test('approving a draft plan → 422 PLAN_NOT_APPROVABLE', async () => {
    const app = buildApp();
    const plan = await seedPlan('draft');
    const res = await app.request(`/dental/patients/${PATIENT_ID}/treatment-plans/${plan.id}/approval`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvedByPersonId: PERSON_ID, method: 'portal' }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('PLAN_NOT_APPROVABLE');
  });
});
