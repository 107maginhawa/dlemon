/**
 * case-presentation-real-flow.test.ts — case-presentation G1 (P0) + G3 (P1)
 *
 * The existing case-presentation.test.ts fixture PRE-LINKS treatments to the plan
 * (treatmentPlanId set on insert), which masks the real-world break: in the normal
 * flow, treatments are created during a visit UNLINKED, and nothing links them to
 * the plan before presentation. This file drives the *normal* flow:
 *
 *   draft plan + unlinked treatments → PATCH plan→presented (handler links: G1)
 *   → create presentation → GET aggregate (non-empty: G1)
 *   → accept (200 + consent: G1) → plan approved + items linked + approval record (G3)
 *
 * RED before the fix:
 *   - aggregate grandTotalCents === 0 / phases === [] (G1)
 *   - accept → 422 PLAN_HAS_NO_ITEMS (G1)
 *   - no TreatmentPlanApproval row after accept (G3)
 */

import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { eq, and, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  CreateCasePresentationParams,
  CreateCasePresentationBody,
  GetCasePresentationParams,
  AcceptCasePresentationParams,
  AcceptCasePresentationBody,
  UpdateTreatmentPlanParams,
  UpdateTreatmentPlanBody,
} from '@/generated/openapi/validators';
import { createCasePresentation } from './case-presentation/createCasePresentation';
import { getCasePresentation } from './case-presentation/getCasePresentation';
import { acceptCasePresentation } from './case-presentation/acceptCasePresentation';
import { updateTreatmentPlan } from './treatment-plans/updateTreatmentPlan';
import { TreatmentPlanRepository } from './repos/treatment-plan.repo';
import { dentalAuditLog } from '@/handlers/dental-audit/repos/audit-log.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: 'a0000000-0000-1000-8000-0000000000d7', email: 'dentist@clinic.com' };
const BRANCH_ID = 'b0000000-0000-1000-8000-0000000000d7';
const ORG_ID = 'c0000000-0000-1000-8000-0000000000d7';
const PATIENT_ID = 'd0000000-0000-1000-8000-0000000000d7';
const PERSON_ID = 'e0000000-0000-1000-8000-0000000000d7';
const VISIT_ID = 'f0000000-0000-1000-8000-0000000000d7';

const ve = (result: any, c: any) => {
  if (!result.success) {
    return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
  }
};

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');
  const { dentalVisits } = await import('@/handlers/dental-visit/repos/visit.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'RealFlow Clinic', tier: 'solo', ownerPersonId: TEST_USER.id, countryCode: 'PH',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main', timezone: 'Asia/Manila',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: 'a1000000-0000-1000-8000-0000000000d7', branchId: BRANCH_ID, personId: TEST_USER.id,
    displayName: 'Dentist', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'Juan', lastName: 'Dela Cruz',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, status: 'active',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalVisits).values({
    id: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID,
    dentistMemberId: 'a1000000-0000-1000-8000-0000000000d7', status: 'active',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
});

function buildTestApp(user = TEST_USER) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err.message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    ctx.set('user', user);
    ctx.set('session', { user });
    await next();
  });
  app.patch('/dental/patients/:patientId/treatment-plans/:planId',
    zValidator('param', UpdateTreatmentPlanParams, ve), zValidator('json', UpdateTreatmentPlanBody, ve), updateTreatmentPlan as any);
  app.post('/dental/patients/:patientId/case-presentations',
    zValidator('param', CreateCasePresentationParams, ve), zValidator('json', CreateCasePresentationBody, ve), createCasePresentation as any);
  app.get('/dental/patients/:patientId/case-presentations/:presentationId',
    zValidator('param', GetCasePresentationParams, ve), getCasePresentation as any);
  app.post('/dental/patients/:patientId/case-presentations/:presentationId/accept',
    zValidator('param', AcceptCasePresentationParams, ve), zValidator('json', AcceptCasePresentationBody, ve), acceptCasePresentation as any);
  return app;
}

/**
 * Seed a DRAFT plan + UNLINKED diagnosed/planned treatments — the normal state
 * after a visit (treatmentPlanId is NULL; the only writer is the link step).
 */
async function seedDraftPlanWithUnlinkedTreatments() {
  const { dentalTreatmentPlans } = await import('./repos/treatment-plan.schema');
  const { dentalTreatments } = await import('@/handlers/dental-visit/repos/treatment.schema');
  const [plan] = await db.insert(dentalTreatmentPlans).values({
    patientId: PATIENT_ID, providerId: TEST_USER.id, status: 'draft',
    totalEstimateCents: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).returning();
  // Two unlinked treatments created the normal way (no treatmentPlanId).
  await db.insert(dentalTreatments).values([
    {
      visitId: VISIT_ID, patientId: PATIENT_ID, toothNumber: 14, cdtCode: 'D2391',
      description: 'Filling', conditionCode: 'caries', status: 'planned', priceCents: 500000,
      phase: 'disease_control', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
    },
    {
      visitId: VISIT_ID, patientId: PATIENT_ID, toothNumber: 30, cdtCode: 'D2740',
      description: 'Crown', conditionCode: 'fracture', status: 'diagnosed', priceCents: 2000000,
      phase: 'definitive', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
    },
  ]);
  return plan!;
}

async function presentPlan(app: Hono, planId: string) {
  return app.request(`/dental/patients/${PATIENT_ID}/treatment-plans/${planId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'presented' }),
  });
}

async function createPresentation(app: Hono, planId: string) {
  const res = await app.request(`/dental/patients/${PATIENT_ID}/case-presentations`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ treatmentPlanId: planId }),
  });
  return (await res.json()) as any;
}

afterEach(async () => {
  const { dentalCasePresentations } = await import('./repos/case-presentation.schema');
  const { dentalTreatmentPlans, dentalTreatmentPlanApprovals, dentalTreatmentPlanStatusHistory } = await import('./repos/treatment-plan.schema');
  const { dentalTreatments } = await import('@/handlers/dental-visit/repos/treatment.schema');
  const { consentForms } = await import('@/handlers/dental-clinical/repos/consent-form.schema');
  await db.delete(dentalCasePresentations).where(eq(dentalCasePresentations.patientId, PATIENT_ID));
  await db.delete(consentForms).where(eq(consentForms.patientId, PATIENT_ID));
  await db.delete(dentalTreatments).where(eq(dentalTreatments.patientId, PATIENT_ID));
  const plans = await db.select().from(dentalTreatmentPlans).where(eq(dentalTreatmentPlans.patientId, PATIENT_ID));
  for (const p of plans) {
    await db.delete(dentalTreatmentPlanApprovals).where(eq(dentalTreatmentPlanApprovals.treatmentPlanId, p.id));
    await db.delete(dentalTreatmentPlanStatusHistory).where(eq(dentalTreatmentPlanStatusHistory.treatmentPlanId, p.id));
  }
  await db.delete(dentalTreatmentPlans).where(eq(dentalTreatmentPlans.patientId, PATIENT_ID));
  await db.execute(sql`TRUNCATE TABLE dental_audit_log`);
});

describe('case-presentation G1: present links treatments → aggregate non-empty', () => {
  test('presenting a plan links pending treatments; aggregate has phases + grand total', async () => {
    const app = buildTestApp();
    const plan = await seedDraftPlanWithUnlinkedTreatments();

    const presentRes = await presentPlan(app, plan.id);
    expect(presentRes.status).toBe(200);

    const presentation = await createPresentation(app, plan.id);
    expect(presentation.id).toBeDefined();

    const aggRes = await app.request(`/dental/patients/${PATIENT_ID}/case-presentations/${presentation.id}`);
    expect(aggRes.status).toBe(200);
    const agg = await aggRes.json() as any;
    expect(agg.grandTotalCents).toBeGreaterThan(0);
    expect(agg.phases.length).toBeGreaterThan(0);
  });
});

describe('case-presentation G1+G3: accept succeeds, links items, records approval', () => {
  test('accept from the normal flow returns 200 with a consent id', async () => {
    const app = buildTestApp();
    const plan = await seedDraftPlanWithUnlinkedTreatments();
    await presentPlan(app, plan.id);
    const presentation = await createPresentation(app, plan.id);

    const acceptRes = await app.request(`/dental/patients/${PATIENT_ID}/case-presentations/${presentation.id}/accept`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signatureData: 'data:image/png;base64,iVBORw0KGgo=', signerName: 'Juan Dela Cruz' }),
    });
    expect(acceptRes.status).toBe(200);
    const body = await acceptRes.json() as any;
    expect(body.consentFormId).toBeDefined();
    expect(body.plan.status).toBe('approved');
    // FIX-006: the returned plan carries the item-derived total (500000+2000000).
    expect(body.plan.totalEstimateCents).toBe(2500000);
  });

  // FIX-006: the accept path is a THIRD linkPendingTreatments caller. When items
  // are bound at accept (not at present), the header total MUST still derive — else
  // the plans-sheet estimate drifts from the case grandTotalCents. This pins the
  // accept-path recompute specifically: present happens with ZERO items (derives
  // nothing), items appear afterwards, and accept claims + re-derives them.
  test('FIX-006: accept that binds items late re-derives the plan total', async () => {
    const app = buildTestApp();
    const { dentalTreatmentPlans } = await import('./repos/treatment-plan.schema');
    const { dentalTreatments } = await import('@/handlers/dental-visit/repos/treatment.schema');

    // Draft plan with a manual estimate, no items yet.
    const [plan] = await db.insert(dentalTreatmentPlans).values({
      patientId: PATIENT_ID, providerId: TEST_USER.id, status: 'draft',
      totalEstimateCents: 12345, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
    }).returning();

    // Present with NO items → links nothing, total stays the manual 12345.
    await presentPlan(app, plan!.id);
    const presentation = await createPresentation(app, plan!.id);

    // Items appear AFTER present (unlinked) — only the accept link will claim them.
    await db.insert(dentalTreatments).values([
      { visitId: VISIT_ID, patientId: PATIENT_ID, toothNumber: 14, cdtCode: 'D2391',
        description: 'Filling', conditionCode: 'caries', status: 'planned', priceCents: 300000,
        phase: 'disease_control', createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
      { visitId: VISIT_ID, patientId: PATIENT_ID, toothNumber: 30, cdtCode: 'D2740',
        description: 'Crown', conditionCode: 'fracture', status: 'diagnosed', priceCents: 700000,
        phase: 'definitive', createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
    ]);

    const acceptRes = await app.request(`/dental/patients/${PATIENT_ID}/case-presentations/${presentation.id}/accept`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signatureData: 'data:image/png;base64,iVBORw0KGgo=', signerName: 'Juan Dela Cruz' }),
    });
    expect(acceptRes.status).toBe(200);
    const body = await acceptRes.json() as any;
    expect(body.plan.status).toBe('approved');
    // 300000 + 700000 — derived at accept, NOT the manual 12345.
    expect(body.plan.totalEstimateCents).toBe(1000000);
  });

  test('G3: after accept, the plan has linked items AND a TreatmentPlanApproval record', async () => {
    const app = buildTestApp();
    const plan = await seedDraftPlanWithUnlinkedTreatments();
    await presentPlan(app, plan.id);
    const presentation = await createPresentation(app, plan.id);
    await app.request(`/dental/patients/${PATIENT_ID}/case-presentations/${presentation.id}/accept`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signatureData: 'data:image/png;base64,iVBORw0KGgo=', signerName: 'Juan Dela Cruz' }),
    });

    const repo = new TreatmentPlanRepository(db);
    // Items linked to the plan (parity with approveTreatmentPlan).
    const { dentalTreatments } = await import('@/handlers/dental-visit/repos/treatment.schema');
    const linked = await db.select().from(dentalTreatments).where(eq(dentalTreatments.treatmentPlanId, plan.id));
    expect(linked.length).toBe(2);
    // Approval record written (the divergent accept path used to skip this).
    const approvals = await repo.findApprovalsByPlanId(plan.id);
    expect(approvals.length).toBe(1);
    expect(approvals[0]!.method).toBe('signature');
  });

  // dental-audit P1-B: accepting a presented case is a sensitive clinical approval
  // and must be written to the audit log.
  test('[P1-B] accept writes a case_presentation.accepted audit row', async () => {
    const app = buildTestApp();
    const plan = await seedDraftPlanWithUnlinkedTreatments();
    await presentPlan(app, plan.id);
    const presentation = await createPresentation(app, plan.id);
    await app.request(`/dental/patients/${PATIENT_ID}/case-presentations/${presentation.id}/accept`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signatureData: 'data:image/png;base64,iVBORw0KGgo=', signerName: 'Juan Dela Cruz' }),
    });

    const [row] = await db
      .select()
      .from(dentalAuditLog)
      .where(and(eq(dentalAuditLog.targetId, presentation.id), eq(dentalAuditLog.action, 'case_presentation.accepted')));
    expect(row).toBeTruthy();
    expect(row!.actorId).toBe(TEST_USER.id);
    expect(row!.targetType).toBe('dental_case_presentation');
    expect((row!.afterSnapshot as any)?.planStatus).toBe('approved');
  });
});
