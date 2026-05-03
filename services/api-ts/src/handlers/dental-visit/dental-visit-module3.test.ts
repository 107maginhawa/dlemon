/**
 * dental-visit-module3.test.ts — Module 3: Workspace/Visit (FR1.x)
 *
 * FRs covered:
 *   FR1.8   Treatment Templates CRUD + apply
 *   FR1.11  Auto carry-over + restore dismissed
 *   FR1.16  Immutability enforcement on completed/locked visits
 *   FR1.17  Auto-discard empty drafts + 48h auto-lock
 *   FR1.19  Dentition Management (deciduous auto-populate)
 *   FR1.22  Treatment Plan Presentation endpoint
 *   EC2     Pending treatments on extracted tooth (blocked)
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { VisitRepository } from './repos/visit.repo';
import { TreatmentRepository } from './repos/treatment.repo';
import { DentalChartRepository } from './repos/dental-chart.repo';
import { dentalVisits } from './repos/visit.schema';
import { dentalTreatments } from './repos/treatment.schema';
import { dentalTreatmentTemplates } from './repos/treatment-template.schema';
import { createDentalVisit } from './createDentalVisit';
import { updateDentalVisit } from './updateDentalVisit';
import { createDentalTreatment } from './createDentalTreatment';
import {
  listTreatmentTemplates,
  createTreatmentTemplate,
  updateTreatmentTemplate,
  deleteTreatmentTemplate,
  applyTemplate,
} from './treatmentTemplates';
import { carryOverTreatments } from './carryOverTreatments';
import { getTreatmentPlan } from './getTreatmentPlan';
import { initializeDentition } from './initializeDentition';

const db = createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' });

const TEST_USER = { id: 'e1000000-0000-1000-8000-000000000001', email: 'dentist@clinic.com' };
const PATIENT_ID = 'f1000000-0000-1000-8000-000000000001';
const BRANCH_ID  = 'f1000000-0000-1000-8000-000000000002';
const MEMBER_ID  = 'f1000000-0000-1000-8000-000000000003';
const NONEXISTENT_ID = 'ffffffff-ffff-1000-8000-ffffffffffff';

// ─── App builder ─────────────────────────────────────────────────────────────

function buildTestApp(user?: typeof TEST_USER) {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
    return c.json({ error: String(err.message) }, 500);
  });

  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    if (user) {
      ctx.set('user', user);
      ctx.set('session', { id: 'test-session' });
    }
    await next();
  });

  // Visit routes
  app.post('/dental/visits', createDentalVisit as any);
  app.patch('/dental/visits/:visitId', updateDentalVisit as any);
  app.post('/dental/visits/:visitId/treatments', createDentalTreatment as any);
  app.post('/dental/visits/:visitId/carry-over', carryOverTreatments as any);
  app.post('/dental/visits/:visitId/apply-template/:templateId', applyTemplate as any);

  // Template routes
  app.get('/dental/treatment-templates', listTreatmentTemplates as any);
  app.post('/dental/treatment-templates', createTreatmentTemplate as any);
  app.patch('/dental/treatment-templates/:id', updateTreatmentTemplate as any);
  app.delete('/dental/treatment-templates/:id', deleteTreatmentTemplate as any);

  // Treatment plan
  app.get('/dental/patients/:patientId/treatment-plan', getTreatmentPlan as any);

  // FR1.19: Dentition management
  app.post('/dental/patients/:patientId/dentition', initializeDentition as any);

  return app;
}

// ─── Seed helpers ─────────────────────────────────────────────────────────────

async function seedVisit(status = 'draft'): Promise<any> {
  const [visit] = await db.insert(dentalVisits).values({
    id: crypto.randomUUID(),
    patientId: PATIENT_ID,
    branchId: BRANCH_ID,
    dentistMemberId: MEMBER_ID,
    status: status as any,
    ...(status === 'completed' ? { completedAt: new Date() } : {}),
    ...(status === 'locked' ? { completedAt: new Date(), lockedAt: new Date() } : {}),
    createdBy: TEST_USER.id,
    updatedBy: TEST_USER.id,
  }).returning();
  return visit!;
}

async function seedTreatment(visitId: string, status = 'diagnosed') {
  const [t] = await db.insert(dentalTreatments).values({
    id: crypto.randomUUID(),
    visitId,
    patientId: PATIENT_ID,
    cdtCode: 'D0120',
    description: 'Periodic oral evaluation',
    priceCents: 100000,
    status: status as any,
    carriedOver: false,
    createdBy: TEST_USER.id,
    updatedBy: TEST_USER.id,
  }).returning();
  return t!;
}

async function truncate() {
  await db.execute(sql`TRUNCATE TABLE dental_treatment_template, dental_treatment CASCADE`);
  await db.execute(sql`TRUNCATE TABLE dental_visit CASCADE`);
}

// =============================================================================
// FR1.8: Treatment Templates CRUD + apply
// =============================================================================

describe('FR1.8: treatment templates CRUD', () => {
  afterEach(truncate);

  test('creates a treatment template', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request('/dental/treatment-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branchId: BRANCH_ID,
        name: 'New Patient Exam',
        items: [
          { cdtCode: 'D0120', description: 'Periodic exam', priceCents: 100000 },
          { cdtCode: 'D1110', description: 'Prophylaxis', priceCents: 250000 },
        ],
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.name).toBe('New Patient Exam');
    expect(body.items.length).toBe(2);
    expect(body.active).toBe(true);
  });

  test('lists active templates for a branch', async () => {
    const app = buildTestApp(TEST_USER);
    await app.request('/dental/treatment-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId: BRANCH_ID, name: 'Cleaning', items: [{ cdtCode: 'D1110', description: 'Cleaning', priceCents: 200000 }] }),
    });

    const res = await app.request(`/dental/treatment-templates?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.templates.length).toBeGreaterThanOrEqual(1);
    expect(body.templates.every((t: any) => t.active)).toBe(true);
  });

  test('updates a treatment template', async () => {
    const app = buildTestApp(TEST_USER);
    const createRes = await app.request('/dental/treatment-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId: BRANCH_ID, name: 'Old Name', items: [{ cdtCode: 'D0120', description: 'Exam', priceCents: 100000 }] }),
    });
    const template = await createRes.json() as any;

    const patchRes = await app.request(`/dental/treatment-templates/${template.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Name' }),
    });
    expect(patchRes.status).toBe(200);
    const updated = await patchRes.json() as any;
    expect(updated.name).toBe('Updated Name');
  });

  test('deactivates a treatment template', async () => {
    const app = buildTestApp(TEST_USER);
    const createRes = await app.request('/dental/treatment-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId: BRANCH_ID, name: 'Delete Me', items: [{ cdtCode: 'D0120', description: 'Exam', priceCents: 100000 }] }),
    });
    const template = await createRes.json() as any;

    const delRes = await app.request(`/dental/treatment-templates/${template.id}`, { method: 'DELETE' });
    expect(delRes.status).toBe(200);

    // Should not appear in list anymore
    const listRes = await app.request(`/dental/treatment-templates?branchId=${BRANCH_ID}`);
    const list = await listRes.json() as any;
    expect(list.templates.find((t: any) => t.id === template.id)).toBeUndefined();
  });

  test('applies template to visit, creating treatments', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('active');

    const createTplRes = await app.request('/dental/treatment-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branchId: BRANCH_ID,
        name: 'Recall Package',
        items: [
          { cdtCode: 'D0120', description: 'Periodic exam', priceCents: 100000 },
          { cdtCode: 'D1110', description: 'Prophylaxis', priceCents: 250000 },
        ],
      }),
    });
    const template = await createTplRes.json() as any;

    const applyRes = await app.request(`/dental/visits/${visit.id}/apply-template/${template.id}`, { method: 'POST' });
    expect(applyRes.status).toBe(201);
    const body = await applyRes.json() as any;
    expect(body.count).toBe(2);
    expect(body.applied.length).toBe(2);
  });

  test('returns 400 when name is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/treatment-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId: BRANCH_ID, items: [] }),
    });
    expect(res.status).toBe(400);
  });
});

// =============================================================================
// FR1.11: Auto carry-over + restore dismissed
// =============================================================================

describe('FR1.11: auto carry-over treatments', () => {
  afterEach(truncate);

  test('carries over pending treatments from previous visit', async () => {
    const app = buildTestApp(TEST_USER);

    // Previous visit with a pending treatment
    const prevVisit = await seedVisit('completed');
    await seedTreatment(prevVisit.id, 'diagnosed');

    // New (current) visit
    const newVisit = await seedVisit('active');

    const res = await app.request(`/dental/visits/${newVisit.id}/carry-over`, { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.carriedOver.length).toBeGreaterThanOrEqual(1);
    expect(body.carriedOver[0].carriedOver).toBe(true);
    expect(body.carriedOver[0].visitId).toBe(newVisit.id);
  });

  test('restores dismissed treatments when ids provided', async () => {
    const app = buildTestApp(TEST_USER);

    const prevVisit = await seedVisit('completed');
    const dismissed = await seedTreatment(prevVisit.id, 'dismissed');

    const newVisit = await seedVisit('active');

    const res = await app.request(`/dental/visits/${newVisit.id}/carry-over`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restoreDismissedIds: [dismissed.id] }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.restoredDismissed.length).toBe(1);
    expect(body.restoredDismissed[0].status).toBe('planned');
  });

  test('returns error when carrying over to completed visit', async () => {
    const app = buildTestApp(TEST_USER);
    const completedVisit = await seedVisit('completed');

    const res = await app.request(`/dental/visits/${completedVisit.id}/carry-over`, { method: 'POST' });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('VISIT_IMMUTABLE');
  });
});

// =============================================================================
// FR1.16: Immutability enforcement
// =============================================================================

describe('FR1.16: immutability on completed/locked visits', () => {
  afterEach(truncate);

  test('cannot update chiefComplaint on completed visit', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('completed');

    const res = await app.request(`/dental/visits/${visit.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chiefComplaint: 'Changed after completion' }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('VISIT_IMMUTABLE');
  });

  test('cannot add treatment to completed visit', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('completed');

    const res = await app.request(`/dental/visits/${visit.id}/treatments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID, cdtCode: 'D0120', description: 'Exam', priceCents: 100000,
      }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('VISIT_IMMUTABLE');
  });

  test('cannot update locked visit at all', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('locked');

    const res = await app.request(`/dental/visits/${visit.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chiefComplaint: 'Trying to edit locked' }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('VISIT_LOCKED');
  });

  test('cannot add treatment to locked visit', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('locked');

    const res = await app.request(`/dental/visits/${visit.id}/treatments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID, cdtCode: 'D0120', description: 'Exam', priceCents: 100000,
      }),
    });
    expect(res.status).toBe(422);
  });

  test('completed visit CAN be transitioned to locked', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('completed');

    const res = await app.request(`/dental/visits/${visit.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'locked' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('locked');
  });

  test('template apply blocked on completed visit', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('completed');

    // Create a template
    const [tpl] = await db.insert(dentalTreatmentTemplates).values({
      id: crypto.randomUUID(),
      branchId: BRANCH_ID,
      name: 'Test Template',
      items: [{ cdtCode: 'D0120', description: 'Exam', priceCents: 100000 }],
      active: true,
      createdBy: TEST_USER.id,
      updatedBy: TEST_USER.id,
    }).returning();

    const res = await app.request(`/dental/visits/${visit.id}/apply-template/${tpl!.id}`, { method: 'POST' });
    expect(res.status).toBe(422);
  });
});

// =============================================================================
// FR1.17: Auto-discard empty drafts + 48h auto-lock
// =============================================================================

describe('FR1.17: auto-discard empty drafts + 48h auto-lock', () => {
  afterEach(truncate);

  test('discardEmptyDrafts removes draft visits with no treatments', async () => {
    const emptyDraft = await seedVisit('draft');
    const visitRepo = new VisitRepository(db);

    const discarded = await visitRepo.discardEmptyDrafts(PATIENT_ID);

    expect(discarded).toContain(emptyDraft.id);
    const found = await visitRepo.findOneById(emptyDraft.id);
    expect(found).toBeNull();
  });

  test('discardEmptyDrafts preserves drafts WITH treatments', async () => {
    const draftWithTreatments = await seedVisit('draft');
    await seedTreatment(draftWithTreatments.id);

    const visitRepo = new VisitRepository(db);
    const discarded = await visitRepo.discardEmptyDrafts(PATIENT_ID);

    expect(discarded).not.toContain(draftWithTreatments.id);
    const found = await visitRepo.findOneById(draftWithTreatments.id);
    expect(found).not.toBeNull();
  });

  test('autoLockCompletedVisits locks visits older than threshold', async () => {
    // Seed a completed visit with completedAt 49h ago
    const [oldVisit] = await db.insert(dentalVisits).values({
      id: crypto.randomUUID(),
      patientId: PATIENT_ID,
      branchId: BRANCH_ID,
      dentistMemberId: MEMBER_ID,
      status: 'completed',
      completedAt: new Date(Date.now() - 49 * 60 * 60 * 1000),
      createdBy: TEST_USER.id,
      updatedBy: TEST_USER.id,
    }).returning();

    const visitRepo = new VisitRepository(db);
    const lockedCount = await visitRepo.autoLockCompletedVisits(48);

    expect(lockedCount).toBeGreaterThanOrEqual(1);
    const updated = await visitRepo.findOneById(oldVisit!.id);
    expect(updated!.status).toBe('locked');
  });

  test('autoLockCompletedVisits does NOT lock visits within threshold', async () => {
    const recentVisit = await seedVisit('completed'); // just now

    const visitRepo = new VisitRepository(db);
    await visitRepo.autoLockCompletedVisits(48);

    const found = await visitRepo.findOneById(recentVisit.id);
    expect(found!.status).toBe('completed'); // unchanged
  });
});

// =============================================================================
// FR1.22: Treatment Plan Presentation
// =============================================================================

describe('FR1.22: treatment plan presentation', () => {
  afterEach(truncate);

  test('returns empty plan for patient with no pending treatments', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/patients/${PATIENT_ID}/treatment-plan`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.patientId).toBe(PATIENT_ID);
    expect(body.treatments).toEqual([]);
    expect(body.totalEstimateCents).toBe(0);
  });

  test('returns aggregated pending treatments from all visits', async () => {
    const app = buildTestApp(TEST_USER);
    const v1 = await seedVisit('active');
    const v2 = await seedVisit('completed');

    await seedTreatment(v1.id, 'diagnosed');
    await seedTreatment(v2.id, 'planned');
    await seedTreatment(v2.id, 'performed'); // should NOT appear (not pending)

    const res = await app.request(`/dental/patients/${PATIENT_ID}/treatment-plan`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.treatmentCount).toBe(2); // only diagnosed + planned
    expect(body.totalEstimateCents).toBe(200000); // 2 × 100000
    expect(Array.isArray(body.treatments)).toBe(true);
  });

  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/patients/${PATIENT_ID}/treatment-plan`);
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// EC2: Pending treatments on extracted tooth
// =============================================================================

describe('EC2: pending treatment on extracted tooth is blocked', () => {
  afterEach(truncate);

  test('EC2: blocks adding treatment to extracted tooth', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('active');

    // Seed a chart with tooth 16 as extracted
    const chartRepo = new DentalChartRepository(db);
    await chartRepo.upsert({
      visitId: visit.id,
      patientId: PATIENT_ID,
      teeth: [{ toothNumber: 16, state: 'extracted' }],
      createdBy: TEST_USER.id,
      updatedBy: TEST_USER.id,
    });

    const res = await app.request(`/dental/visits/${visit.id}/treatments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        cdtCode: 'D2391',
        description: 'Composite — 1 surface',
        priceCents: 400000,
        toothNumber: 16, // extracted!
      }),
    });

    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('TOOTH_EXTRACTED');
  });

  test('allows treatment on healthy tooth', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('active');

    // Chart with tooth 16 healthy
    const chartRepo = new DentalChartRepository(db);
    await chartRepo.upsert({
      visitId: visit.id,
      patientId: PATIENT_ID,
      teeth: [{ toothNumber: 16, state: 'caries' }],
      createdBy: TEST_USER.id,
      updatedBy: TEST_USER.id,
    });

    const res = await app.request(`/dental/visits/${visit.id}/treatments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        cdtCode: 'D2391',
        description: 'Composite',
        priceCents: 400000,
        toothNumber: 16,
      }),
    });

    expect(res.status).toBe(201);
  });
});

// ─── FR1.19 Dentition Management ─────────────────────────────────────────────

describe('FR1.19 — Dentition Management (deciduous auto-populate)', () => {
  afterEach(async () => {
    await db.execute(sql`DELETE FROM dental_chart WHERE patient_id = ${PATIENT_ID}`);
  });

  test('auto-populates deciduous teeth for patient ≤5 years old', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 3);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/dentition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dateOfBirth: dob.toISOString().slice(0, 10), visitId: visit.id }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.dentitionType).toBe('deciduous');
    expect(body.toothCount).toBe(20);
    expect(body.teeth.every((t: any) => t.state === 'healthy')).toBe(true);
  });

  test('auto-populates mixed dentition for patient 6-12 years old', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 9);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/dentition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dateOfBirth: dob.toISOString().slice(0, 10), visitId: visit.id }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.dentitionType).toBe('mixed');
    expect(body.toothCount).toBe(52);
    const deciduous = body.teeth.filter((t: any) => t.note === 'primary');
    const permanent = body.teeth.filter((t: any) => t.note === 'permanent');
    expect(deciduous.length).toBe(20);
    expect(permanent.length).toBe(32);
  });

  test('auto-populates permanent teeth for patient >12 years old', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 30);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/dentition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dateOfBirth: dob.toISOString().slice(0, 10), visitId: visit.id }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.dentitionType).toBe('permanent');
    expect(body.toothCount).toBe(32);
  });

  test('returns 400 when dateOfBirth is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(`/dental/patients/${PATIENT_ID}/dentition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitId: visit.id }),
    });

    expect(res.status).toBe(400);
  });

  test('returns 401 without auth', async () => {
    const app = buildTestApp();
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 30);

    const res = await app.request(`/dental/patients/${PATIENT_ID}/dentition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dateOfBirth: dob.toISOString().slice(0, 10), visitId: 'any-id' }),
    });

    expect(res.status).toBe(401);
  });
});
