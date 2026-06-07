/**
 * case-presentation.test.ts — P1-20 patient-facing case presentation (Phase 1, staff bearerAuth)
 *
 * P1-20-AC1  create mints a presentation in 'draft' bound to the presented plan
 * P1-20-AC2  getCasePresentation returns the patient-readable aggregate
 *              (phases + per-phase + grand ₱ totals, alternates, image refs, first name)
 * P1-20-AC3  get records engagement telemetry (firstViewedAt set once; status draft→viewed)
 * P1-20-AC4  accept writes an immutable consent e-sig, plan presented → approved,
 *              status-history row appended, presentation decision=accepted (terminal)
 * P1-20-AC5  second accept (or reject) on a decided presentation → 422 PRESENTATION_DECIDED
 * P1-20-AC6  reject drives plan presented → rejected (terminal), reason persisted
 * P1-20-AC7  accept/reject only legal from 'presented' → else 422 PLAN_INVALID_TRANSITION
 * P1-20-AC8  archived-patient blocks create/accept/reject (EF-PAT-001 → 403 PATIENT_ARCHIVED)
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  CreateCasePresentationParams,
  CreateCasePresentationBody,
  GetCasePresentationParams,
  ListCasePresentationsParams,
  AcceptCasePresentationParams,
  AcceptCasePresentationBody,
  RejectCasePresentationParams,
  RejectCasePresentationBody,
} from '@/generated/openapi/validators';
import { createCasePresentation } from './case-presentation/createCasePresentation';
import { getCasePresentation } from './case-presentation/getCasePresentation';
import { listCasePresentations } from './case-presentation/listCasePresentations';
import { acceptCasePresentation } from './case-presentation/acceptCasePresentation';
import { rejectCasePresentation } from './case-presentation/rejectCasePresentation';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: 'a0000000-0000-1000-8000-0000000000c5', email: 'staff@clinic.com' };
const BRANCH_ID = 'b0000000-0000-1000-8000-0000000000c5';
const ORG_ID = 'c0000000-0000-1000-8000-0000000000c5';
const PATIENT_ID = 'd0000000-0000-1000-8000-0000000000c5';
const PERSON_ID = 'e0000000-0000-1000-8000-0000000000c5';
const VISIT_ID = 'f0000000-0000-1000-8000-0000000000c5';

// E1: role-gating fixtures — extra branch members with distinct roles.
const COORDINATOR_USER = { id: 'a2000000-0000-1000-8000-0000000000c5', email: 'coord@clinic.com' };
const SCHEDULER_USER = { id: 'a3000000-0000-1000-8000-0000000000c5', email: 'sched@clinic.com' };
const FRONTDESK_USER = { id: 'a4000000-0000-1000-8000-0000000000c5', email: 'fd@clinic.com' };

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
    id: ORG_ID, name: 'CP Clinic', tier: 'solo',
    ownerPersonId: TEST_USER.id, countryCode: 'PH',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID,
    name: 'Main Branch', timezone: 'Asia/Manila',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: 'a1000000-0000-1000-8000-0000000000c5',
    branchId: BRANCH_ID, personId: TEST_USER.id,
    displayName: 'Dentist', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  // E1 role-gating fixtures
  await db.insert(dentalMemberships).values({
    id: 'a2100000-0000-1000-8000-0000000000c5',
    branchId: BRANCH_ID, personId: COORDINATOR_USER.id,
    displayName: 'Coordinator', role: 'treatment_coordinator', status: 'active',
    pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: 'a3100000-0000-1000-8000-0000000000c5',
    branchId: BRANCH_ID, personId: SCHEDULER_USER.id,
    displayName: 'Scheduler', role: 'staff_scheduling', status: 'active',
    pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: 'a4100000-0000-1000-8000-0000000000c5',
    branchId: BRANCH_ID, personId: FRONTDESK_USER.id,
    displayName: 'Front Desk', role: 'front_desk', status: 'active',
    pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'Maria', lastName: 'Santos',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID,
    preferredBranchId: BRANCH_ID, status: 'active',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalVisits).values({
    id: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID,
    dentistMemberId: 'a1000000-0000-1000-8000-0000000000c5', status: 'active',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
});

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
    if (user) { ctx.set('user', user); ctx.set('session', { user }); }
    await next();
  });
  app.post('/dental/patients/:patientId/case-presentations',
    zValidator('param', CreateCasePresentationParams, ve), zValidator('json', CreateCasePresentationBody, ve), createCasePresentation as any);
  app.get('/dental/patients/:patientId/case-presentations',
    zValidator('param', ListCasePresentationsParams, ve), listCasePresentations as any);
  app.get('/dental/patients/:patientId/case-presentations/:presentationId',
    zValidator('param', GetCasePresentationParams, ve), getCasePresentation as any);
  app.post('/dental/patients/:patientId/case-presentations/:presentationId/accept',
    zValidator('param', AcceptCasePresentationParams, ve), zValidator('json', AcceptCasePresentationBody, ve), acceptCasePresentation as any);
  app.post('/dental/patients/:patientId/case-presentations/:presentationId/reject',
    zValidator('param', RejectCasePresentationParams, ve), zValidator('json', RejectCasePresentationBody, ve), rejectCasePresentation as any);
  return app;
}

// Seed a presented plan with two phased items + an alternate pair.
async function seedPresentedPlan() {
  const { dentalTreatmentPlans, dentalTreatmentPlanStatusHistory } = await import('./repos/treatment-plan.schema');
  const { dentalTreatments } = await import('@/handlers/dental-visit/repos/treatment.schema');
  const [plan] = await db.insert(dentalTreatmentPlans).values({
    patientId: PATIENT_ID, providerId: TEST_USER.id, status: 'presented',
    totalEstimateCents: 0, presentedAt: new Date(),
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).returning();
  await db.insert(dentalTreatmentPlanStatusHistory).values({
    treatmentPlanId: plan!.id, fromStatus: 'draft', toStatus: 'presented',
    changedByPersonId: TEST_USER.id, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  });
  // Phase 1 — disease_control item (₱5,000)
  await db.insert(dentalTreatments).values({
    visitId: VISIT_ID, patientId: PATIENT_ID, treatmentPlanId: plan!.id,
    toothNumber: 14, cdtCode: 'D2391', description: 'Filling', conditionCode: 'caries',
    status: 'planned', priceCents: 500000, phase: 'disease_control',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  });
  // Phase 2 — definitive item (₱20,000)
  await db.insert(dentalTreatments).values({
    visitId: VISIT_ID, patientId: PATIENT_ID, treatmentPlanId: plan!.id,
    toothNumber: 30, cdtCode: 'D2740', description: 'Crown', conditionCode: 'fracture',
    status: 'planned', priceCents: 2000000, phase: 'definitive',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  });
  // Alternate pair (implant recommended vs bridge) in one option group, unphased.
  const optionGroupId = 'aa000000-0000-1000-8000-0000000000c5';
  await db.insert(dentalTreatments).values({
    visitId: VISIT_ID, patientId: PATIENT_ID, treatmentPlanId: plan!.id,
    toothNumber: 19, cdtCode: 'D6010', description: 'Implant', status: 'diagnosed',
    priceCents: 4000000, optionGroupId, recommended: true,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  });
  await db.insert(dentalTreatments).values({
    visitId: VISIT_ID, patientId: PATIENT_ID, treatmentPlanId: plan!.id,
    toothNumber: 19, cdtCode: 'D6240', description: 'Bridge', status: 'diagnosed',
    priceCents: 3000000, optionGroupId, recommended: false,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  });
  return plan!;
}

async function createPresentation(app: Hono, planId: string) {
  const res = await app.request(`/dental/patients/${PATIENT_ID}/case-presentations`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ treatmentPlanId: planId }),
  });
  return { res, body: (await res.json()) as any };
}

afterEach(async () => {
  const { dentalCasePresentations } = await import('./repos/case-presentation.schema');
  const { dentalTreatmentPlans } = await import('./repos/treatment-plan.schema');
  const { dentalTreatments } = await import('@/handlers/dental-visit/repos/treatment.schema');
  const { consentForms } = await import('@/handlers/dental-clinical/repos/consent-form.schema');
  await db.delete(dentalCasePresentations).where(eq(dentalCasePresentations.patientId, PATIENT_ID));
  await db.delete(consentForms).where(eq(consentForms.patientId, PATIENT_ID));
  await db.delete(dentalTreatments).where(eq(dentalTreatments.patientId, PATIENT_ID));
  await db.delete(dentalTreatmentPlans).where(eq(dentalTreatmentPlans.patientId, PATIENT_ID));
});

describe('P1-20 — create + list', () => {
  test('P1-20-AC1: create mints a draft presentation bound to the plan', async () => {
    const app = buildTestApp(TEST_USER);
    const plan = await seedPresentedPlan();
    const { res, body } = await createPresentation(app, plan.id);
    expect(res.status).toBe(201);
    expect(body.status).toBe('draft');
    expect(body.treatmentPlanId).toBe(plan.id);
    expect(body.patientId).toBe(PATIENT_ID);
    expect(body.decision).toBeNull();

    const list = await app.request(`/dental/patients/${PATIENT_ID}/case-presentations`);
    expect(list.status).toBe(200);
    expect(((await list.json()) as any[]).length).toBe(1);
  });

  test('create requires a presented plan (draft → 422 PLAN_NOT_PRESENTED)', async () => {
    const app = buildTestApp(TEST_USER);
    const { dentalTreatmentPlans } = await import('./repos/treatment-plan.schema');
    const [plan] = await db.insert(dentalTreatmentPlans).values({
      patientId: PATIENT_ID, providerId: TEST_USER.id, status: 'draft',
      totalEstimateCents: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
    }).returning();
    const { res } = await createPresentation(app, plan!.id);
    expect(res.status).toBe(422);
  });
});

describe('P1-20 — aggregate', () => {
  test('P1-20-AC2: aggregate returns phases, ₱ totals, alternates, image refs, first name', async () => {
    const app = buildTestApp(TEST_USER);
    const plan = await seedPresentedPlan();
    const { body: created } = await createPresentation(app, plan.id);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/case-presentations/${created.id}`);
    expect(res.status).toBe(200);
    const agg = (await res.json()) as any;

    expect(agg.patientFirstName).toBe('Maria');
    expect(agg.grandTotalCents).toBe(500000 + 2000000 + 4000000 + 3000000);
    // phases grouped: disease_control, definitive, and an unphased (null) bucket for alternates
    const phaseKeys = agg.phases.map((p: any) => p.phase);
    expect(phaseKeys).toContain('disease_control');
    expect(phaseKeys).toContain('definitive');
    const dc = agg.phases.find((p: any) => p.phase === 'disease_control');
    expect(dc.subtotalCents).toBe(500000);
    // alternates surfaced with the recommended option flagged
    expect(agg.optionGroups.length).toBe(1);
    const recs = agg.optionGroups[0].options.filter((o: any) => o.recommended);
    expect(recs.length).toBe(1);
    expect(recs[0].description).toBe('Implant');
    // image refs present (empty here — no findings seeded — but the field exists)
    expect(Array.isArray(agg.images)).toBe(true);
  });

  test('P1-20-AC3: get records engagement telemetry (draft → viewed, firstViewedAt set)', async () => {
    const app = buildTestApp(TEST_USER);
    const plan = await seedPresentedPlan();
    const { body: created } = await createPresentation(app, plan.id);
    await app.request(`/dental/patients/${PATIENT_ID}/case-presentations/${created.id}`);

    const list = await app.request(`/dental/patients/${PATIENT_ID}/case-presentations`);
    const [row] = (await list.json()) as any[];
    expect(row.status).toBe('viewed');
    expect(row.firstViewedAt).not.toBeNull();
  });
});

describe('P1-20 — accept (e-sign)', () => {
  test('P1-20-AC4: accept writes consent e-sig, plan → approved, decision terminal', async () => {
    const app = buildTestApp(TEST_USER);
    const plan = await seedPresentedPlan();
    const { body: created } = await createPresentation(app, plan.id);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/case-presentations/${created.id}/accept`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signerName: 'Maria Santos', signatureData: 'data:image/png;base64,AAAA' }),
    });
    expect(res.status).toBe(200);
    const out = (await res.json()) as any;
    expect(out.plan.status).toBe('approved');
    expect(out.presentation.decision).toBe('accepted');
    expect(out.consentFormId).toBeTruthy();

    // immutable consent e-sig was written + signed
    const { consentForms } = await import('@/handlers/dental-clinical/repos/consent-form.schema');
    const [cf] = await db.select().from(consentForms).where(eq(consentForms.id, out.consentFormId));
    expect(cf?.signed).toBe(true);
    expect(cf?.signatureData).toBe('data:image/png;base64,AAAA');

    // status-history row appended for presented → approved
    const { dentalTreatmentPlanStatusHistory } = await import('./repos/treatment-plan.schema');
    const hist = await db.select().from(dentalTreatmentPlanStatusHistory)
      .where(eq(dentalTreatmentPlanStatusHistory.treatmentPlanId, plan.id));
    expect(hist.some((h) => h.toStatus === 'approved')).toBe(true);
  });

  test('P1-20-AC5: second decision on a decided presentation → 422 PRESENTATION_DECIDED', async () => {
    const app = buildTestApp(TEST_USER);
    const plan = await seedPresentedPlan();
    const { body: created } = await createPresentation(app, plan.id);
    await app.request(`/dental/patients/${PATIENT_ID}/case-presentations/${created.id}/accept`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signerName: 'Maria', signatureData: 'sig' }),
    });
    const second = await app.request(`/dental/patients/${PATIENT_ID}/case-presentations/${created.id}/reject`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejectionReason: 'changed mind' }),
    });
    expect(second.status).toBe(422);
    expect(((await second.json()) as any).code).toBe('PRESENTATION_DECIDED');
  });
});

describe('P1-20 — reject', () => {
  test('P1-20-AC6: reject drives plan presented → rejected, reason persisted', async () => {
    const app = buildTestApp(TEST_USER);
    const plan = await seedPresentedPlan();
    const { body: created } = await createPresentation(app, plan.id);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/case-presentations/${created.id}/reject`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejectionReason: 'Too expensive' }),
    });
    expect(res.status).toBe(200);
    const out = (await res.json()) as any;
    expect(out.plan.status).toBe('rejected');
    expect(out.presentation.decision).toBe('rejected');
    expect(out.presentation.rejectionReason).toBe('Too expensive');
  });
});

describe('P1-20 — FSM + guards', () => {
  test('P1-20-AC7: accept from a non-presented plan → 422 PLAN_INVALID_TRANSITION', async () => {
    const app = buildTestApp(TEST_USER);
    const plan = await seedPresentedPlan();
    const { body: created } = await createPresentation(app, plan.id);
    // Move plan out of 'presented' (presented → approved) behind the presentation's back.
    const { dentalTreatmentPlans } = await import('./repos/treatment-plan.schema');
    await db.update(dentalTreatmentPlans).set({ status: 'approved' }).where(eq(dentalTreatmentPlans.id, plan.id));

    const res = await app.request(`/dental/patients/${PATIENT_ID}/case-presentations/${created.id}/accept`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signerName: 'Maria', signatureData: 'sig' }),
    });
    expect(res.status).toBe(422);
    expect(((await res.json()) as any).code).toBe('PLAN_INVALID_TRANSITION');
  });

  test('P1-20-AC8: archived patient blocks create (403 PATIENT_ARCHIVED)', async () => {
    const app = buildTestApp(TEST_USER);
    const plan = await seedPresentedPlan();
    const { patients } = await import('@/handlers/patient/repos/patient.schema');
    await db.update(patients).set({ status: 'archived' }).where(eq(patients.id, PATIENT_ID));
    try {
      const { res, body } = await createPresentation(app, plan.id);
      expect(res.status).toBe(403);
      expect(body.code).toBe('PATIENT_ARCHIVED');
    } finally {
      await db.update(patients).set({ status: 'active' }).where(eq(patients.id, PATIENT_ID));
    }
  });
});

describe('E1 — treatment_coordinator role gating', () => {
  test('create: treatment_coordinator is allowed (201)', async () => {
    const app = buildTestApp(COORDINATOR_USER);
    const plan = await seedPresentedPlan();
    const { res, body } = await createPresentation(app, plan.id);
    expect(res.status).toBe(201);
    expect(body.status).toBe('draft');
  });

  test('create: dentist_owner is allowed (201)', async () => {
    const app = buildTestApp(TEST_USER);
    const plan = await seedPresentedPlan();
    const { res } = await createPresentation(app, plan.id);
    expect(res.status).toBe(201);
  });

  test('create: staff_scheduling is denied (403)', async () => {
    const app = buildTestApp(SCHEDULER_USER);
    const plan = await seedPresentedPlan();
    const { res } = await createPresentation(app, plan.id);
    expect(res.status).toBe(403);
  });

  test('accept: chairside front_desk can capture signature (200)', async () => {
    // create as a presenter, accept as chairside front_desk.
    const presenterApp = buildTestApp(COORDINATOR_USER);
    const plan = await seedPresentedPlan();
    const { body: created } = await createPresentation(presenterApp, plan.id);

    const fdApp = buildTestApp(FRONTDESK_USER);
    const res = await fdApp.request(`/dental/patients/${PATIENT_ID}/case-presentations/${created.id}/accept`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signerName: 'Maria', signatureData: 'sig' }),
    });
    expect(res.status).toBe(200);
  });

  test('reject: chairside front_desk can capture decline (200)', async () => {
    const presenterApp = buildTestApp(COORDINATOR_USER);
    const plan = await seedPresentedPlan();
    const { body: created } = await createPresentation(presenterApp, plan.id);

    const fdApp = buildTestApp(FRONTDESK_USER);
    const res = await fdApp.request(`/dental/patients/${PATIENT_ID}/case-presentations/${created.id}/reject`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejectionReason: 'Too expensive' }),
    });
    expect(res.status).toBe(200);
  });

  test('list: front_desk (chairside read set) can read (200)', async () => {
    const presenterApp = buildTestApp(COORDINATOR_USER);
    const plan = await seedPresentedPlan();
    await createPresentation(presenterApp, plan.id);

    const fdApp = buildTestApp(FRONTDESK_USER);
    const res = await fdApp.request(`/dental/patients/${PATIENT_ID}/case-presentations`);
    expect(res.status).toBe(200);
  });

  test('get: treatment_coordinator can read the aggregate (200)', async () => {
    const app = buildTestApp(COORDINATOR_USER);
    const plan = await seedPresentedPlan();
    const { body: created } = await createPresentation(app, plan.id);
    const res = await app.request(`/dental/patients/${PATIENT_ID}/case-presentations/${created.id}`);
    expect(res.status).toBe(200);
  });
});
