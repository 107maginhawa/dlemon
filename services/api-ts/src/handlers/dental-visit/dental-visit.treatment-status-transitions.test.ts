/**
 * dental-visit-module4.test.ts — Module 4: Treatment & Visit Updates (FR1.x)
 *
 * FRs covered (planned):
 *   FR1.x   updateDentalTreatment — status transitions, immutability guards
 *   FR1.x   updateDentalVisit — status promotion, field updates
 *   FR1.x   carryOverTreatments — carry-over from prior visit
 *   FR1.x   getToothHistory — per-tooth treatment history
 *   FR1.x   upsertVisitNotes — create/update visit notes
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  CreateDentalVisitBody,
  CreateDentalTreatmentBody,
  CreateDentalTreatmentParams,
  UpdateDentalVisitBody,
  UpdateDentalVisitParams,
  UpdateDentalTreatmentBody,
  UpdateDentalTreatmentParams,
  CarryOverTreatmentsBody,
  CarryOverTreatmentsParams,
  GetToothHistoryParams,
  UpsertVisitNotesBody,
  UpsertVisitNotesParams,
} from '@/generated/openapi/validators';
import { updateDentalTreatment } from './treatments/updateDentalTreatment';
import { updateDentalVisit } from './visits/updateDentalVisit';
import { carryOverTreatments } from './treatments/carryOverTreatments';
import { getToothHistory } from './chart/getToothHistory';
import { upsertVisitNotes } from './notes/upsertVisitNotes';
import { createDentalVisit } from './visits/createDentalVisit';
import { createDentalTreatment } from './treatments/createDentalTreatment';
import { consentForms } from '@/handlers/dental-clinical/repos/consent-form.schema';
import { visitNotes } from './repos/treatment.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique IDs — b400 namespace for branch+member; reuse existing org owned by TEST_USER
const TEST_USER    = { id: 'e4000000-0000-1000-8000-000000000001', email: 'dentist4@clinic.com' };
const PATIENT_ID   = 'f4000000-0000-1000-8000-000000000001';
const PERSON_ID    = 'f4000000-0000-1000-8000-000000000002';
const BRANCH_ID    = '7b400000-0000-4000-8000-000000000004';  // TAG b400 — fresh
const ORG_ID       = 'a4000000-0000-1000-8000-000000000003';  // existing org owned by TEST_USER
const MEMBER_ID    = '7c400000-0000-4000-8000-000000000004';  // TAG b400 — fresh
const NONEXISTENT_ID = 'ffffffff-ffff-4000-8000-ffffffffffff';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Module4 Clinic', tier: 'solo',
    ownerPersonId: TEST_USER.id, countryCode: 'PH',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Module4 Branch',
    timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id,
    displayName: 'Module4 Dentist', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'Module4', lastName: 'Patient',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
});

// ─── Validator error handler ──────────────────────────────────────────────────

const ve = (result: any, c: any) => {
  if (!result.success) return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
};

const TreatmentBodyOnly = CreateDentalTreatmentBody.omit({ visitId: true });

// ─── App builder ─────────────────────────────────────────────────────────────

function buildTestApp(user?: typeof TEST_USER) {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
    if (err instanceof z.ZodError) {
      return c.json({ error: err.issues.map((i: any) => i.message).join('; ') }, 400);
    }
    console.error('Unhandled test error:', err);
    return c.json({ error: 'Internal server error' }, 500);
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
  app.post('/dental/visits', zValidator('json', CreateDentalVisitBody, ve), createDentalVisit as any);
  app.patch('/dental/visits/:visitId', zValidator('param', UpdateDentalVisitParams, ve), zValidator('json', UpdateDentalVisitBody, ve), updateDentalVisit as any);

  // Treatment routes
  app.post('/dental/visits/:visitId/treatments', zValidator('param', CreateDentalTreatmentParams, ve), zValidator('json', TreatmentBodyOnly, ve), createDentalTreatment as any);
  app.patch('/dental/visits/:visitId/treatments/:treatmentId', zValidator('param', UpdateDentalTreatmentParams, ve), zValidator('json', UpdateDentalTreatmentBody, ve), updateDentalTreatment as any);

  // Carry-over
  app.post('/dental/visits/:visitId/carry-over', carryOverTreatments as any);

  // Tooth history
  app.get('/dental/visits/history/:patientId/teeth/:toothNumber', zValidator('param', GetToothHistoryParams, ve), getToothHistory as any);

  // Visit notes
  app.post('/dental/visits/:visitId/notes', zValidator('param', UpsertVisitNotesParams, ve), zValidator('json', UpsertVisitNotesBody, ve), upsertVisitNotes as any);

  return app;
}

// ─── Teardown ────────────────────────────────────────────────────────────────

async function truncate() {
  await db.execute(sql`TRUNCATE TABLE visit_notes, dental_treatment CASCADE`);
  await db.execute(sql`TRUNCATE TABLE dental_visit CASCADE`);
}

// ─── Seed helpers ─────────────────────────────────────────────────────────────

async function seedVisit(status = 'draft') {
  const { dentalVisits } = await import('./repos/visit.schema');
  const [visit] = await db.insert(dentalVisits).values({
    id: crypto.randomUUID(), patientId: PATIENT_ID, branchId: BRANCH_ID,
    dentistMemberId: MEMBER_ID, status: status as any,
    ...(status === 'completed' ? { completedAt: new Date() } : {}),
    ...(status === 'locked' ? { completedAt: new Date(), lockedAt: new Date() } : {}),
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).returning();
  return visit!;
}

async function seedTreatment(visitId: string, status = 'diagnosed', overrides?: Record<string, any>) {
  const { dentalTreatments } = await import('./repos/treatment.schema');
  const [t] = await db.insert(dentalTreatments).values({
    id: crypto.randomUUID(), visitId, patientId: PATIENT_ID,
    cdtCode: 'D0120', description: 'Periodic eval',
    priceCents: 100000, status: status as any, carriedOver: false,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
    ...overrides,
  }).returning();
  return t!;
}

async function seedSignedConsent(visitId: string) {
  const [cf] = await db.insert(consentForms).values({
    id: crypto.randomUUID(), visitId, patientId: PATIENT_ID,
    templateId: 'general-consent-v1', templateName: 'General Treatment Consent',
    signed: true, signedAt: new Date(), signatureData: 'data:image/png;base64,test',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).returning();
  return cf!;
}

async function seedNotes(visitId: string) {
  const [n] = await db.insert(visitNotes).values({
    id: crypto.randomUUID(), visitId, authorMemberId: MEMBER_ID,
    subjective: 'Patient reports pain', notes: 'SOAP completed',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).returning();
  return n!;
}

// =============================================================================
// updateDentalTreatment — status transitions & immutability guards
// =============================================================================

describe('updateDentalTreatment', () => {
  afterEach(truncate);

  test('verified treatment — field edit rejected', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('active');
    const treatment = await seedTreatment(visit.id, 'verified');

    const res = await app.request(`/dental/visits/${visit.id}/treatments/${treatment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cdtCode: 'D0150' }),
    });

    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('TREATMENT_IMMUTABLE');
  });

  test('performed→planned (undo) when NOT invoiced → 200, status planned, performedAt cleared', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('active');
    const treatment = await seedTreatment(visit.id, 'performed', { performedAt: new Date() });

    const res = await app.request(`/dental/visits/${visit.id}/treatments/${treatment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'planned' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('planned');
    expect(body.performedAt ?? null).toBeNull();
  });

  test('performed→planned (undo) when already invoiced → 422 TREATMENT_ALREADY_INVOICED', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('active');
    const treatment = await seedTreatment(visit.id, 'performed', {
      performedAt: new Date(),
      billedInvoiceId: crypto.randomUUID(),
    });

    const res = await app.request(`/dental/visits/${visit.id}/treatments/${treatment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'planned' }),
    });

    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('TREATMENT_ALREADY_INVOICED');
  });

  // AC-VIS-003 / BR-007: field-immutability begins at `performed` (not `verified`).
  // Canonical ruling V-VIS-101 — MODULE_SPEC + code are authoritative; a PATCH
  // changing cdt_code/tooth/surface on a performed treatment must return 422.
  test('performed treatment — field edit rejected', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('active');
    const treatment = await seedTreatment(visit.id, 'performed');

    const res = await app.request(`/dental/visits/${visit.id}/treatments/${treatment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cdtCode: 'D0150' }),
    });

    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('TREATMENT_IMMUTABLE');
  });

  test('performed treatment — status→verified allowed (immutability blocks fields, not transitions)', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('active');
    const treatment = await seedTreatment(visit.id, 'performed');

    const res = await app.request(`/dental/visits/${visit.id}/treatments/${treatment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'verified' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('verified');
  });

  test('verified treatment — status→dismissed allowed', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('active');
    const treatment = await seedTreatment(visit.id, 'verified');

    const res = await app.request(`/dental/visits/${visit.id}/treatments/${treatment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'dismissed' }),
    });

    expect(res.status).toBe(200);
  });

  test('invalid transition from planned — status→verified rejected', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('active');
    const treatment = await seedTreatment(visit.id, 'planned');

    const res = await app.request(`/dental/visits/${visit.id}/treatments/${treatment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'verified' }),
    });

    expect(res.status).toBe(422);
  });

  // B1 — server-side consent gate on treatment→performed (P0-003)
  test('planned→performed without signed consent → 422 TREATMENT_CONSENT_REQUIRED', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('active');
    const treatment = await seedTreatment(visit.id, 'planned');

    const res = await app.request(`/dental/visits/${visit.id}/treatments/${treatment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'performed' }),
    });

    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('TREATMENT_CONSENT_REQUIRED');
  });

  test('planned→performed WITH signed consent → 200', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('active');
    const treatment = await seedTreatment(visit.id, 'planned');
    await seedSignedConsent(visit.id);

    const res = await app.request(`/dental/visits/${visit.id}/treatments/${treatment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'performed' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('performed');
  });
});

// =============================================================================
// updateDentalVisit — status promotion & field updates
// =============================================================================

describe('updateDentalVisit', () => {
  afterEach(truncate);

  test('locked visit — any edit rejected', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('locked');

    const res = await app.request(`/dental/visits/${visit.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chiefComplaint: 'x' }),
    });

    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('VISIT_IMMUTABLE');
  });

  test('completed visit — chiefComplaint-only edit rejected', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('completed');

    const res = await app.request(`/dental/visits/${visit.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chiefComplaint: 'x' }),
    });

    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('VISIT_IMMUTABLE');
  });

  test('draft→active with chiefComplaint', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('draft');

    const res = await app.request(`/dental/visits/${visit.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active', chiefComplaint: 'Toothache' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('active');
  });

  test('active→completed with signed consent + notes succeeds', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('active');
    await seedSignedConsent(visit.id);
    await seedNotes(visit.id);

    const res = await app.request(`/dental/visits/${visit.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed', chiefComplaint: 'Done' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('completed');
  });

  test('active→completed without signed consent → 422 VISIT_CONSENT_REQUIRED', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('active');
    // BR-005: seed a performed treatment so visit is non-empty (empty visits auto-discard)
    await seedTreatment(visit.id, 'performed');

    const res = await app.request(`/dental/visits/${visit.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });

    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('VISIT_CONSENT_REQUIRED');
  });
});

// =============================================================================
// carryOverTreatments — carry-over from prior visit
// =============================================================================

describe('carryOverTreatments', () => {
  afterEach(truncate);

  test('no previous visit → 200 with empty arrays and message', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('draft');

    const res = await app.request(`/dental/visits/${visit.id}/carry-over`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.carriedOver).toEqual([]);
    expect(body.restoredDismissed).toEqual([]);
    expect(body.message).toContain('No previous visits');
  });

  test('restore-dismissed → copies dismissed treatments into restoredDismissed', async () => {
    const app = buildTestApp(TEST_USER);
    const prevVisit = await seedVisit('completed');
    const dismissed = await seedTreatment(prevVisit.id, 'dismissed', { cdtCode: 'D1110' });
    const currentVisit = await seedVisit('draft');

    const res = await app.request(`/dental/visits/${currentVisit.id}/carry-over`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restoreDismissedIds: [dismissed.id] }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.restoredDismissed).toHaveLength(1);
    expect(body.restoredDismissed[0].cdtCode).toBe('D1110');
  });

  test('carry-over from prev visit → copies pending treatments', async () => {
    const app = buildTestApp(TEST_USER);
    const prevVisit = await seedVisit('completed');
    await seedTreatment(prevVisit.id, 'diagnosed', { cdtCode: 'D0220' });
    const currentVisit = await seedVisit('draft');

    const res = await app.request(`/dental/visits/${currentVisit.id}/carry-over`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.carriedOver).toHaveLength(1);
    expect(body.carriedOver[0].cdtCode).toBe('D0220');
  });
});

// =============================================================================
// getToothHistory — per-tooth treatment history
// =============================================================================

async function seedChart(visitId: string, teeth: Array<{ toothNumber: number; state: string; conditionCode?: string }>) {
  const { DentalChartRepository } = await import('./repos/dental-chart.repo');
  const chartRepo = new DentalChartRepository(db);
  return chartRepo.upsert({ visitId, patientId: PATIENT_ID, teeth });
}

async function truncateWithCharts() {
  await db.execute(sql`TRUNCATE TABLE visit_notes, dental_treatment CASCADE`);
  await db.execute(sql`TRUNCATE TABLE dental_chart CASCADE`);
  await db.execute(sql`TRUNCATE TABLE dental_visit CASCADE`);
}

// =============================================================================
// upsertVisitNotes — create/update visit notes
// =============================================================================

const NO_MEMBER_USER = { id: 'e4000000-0000-1000-8000-000000000099', email: 'nomember4@clinic.com' };

describe('upsertVisitNotes', () => {
  afterEach(truncate);

  test('user with no active membership → 403', async () => {
    const app = buildTestApp(NO_MEMBER_USER);
    const visit = await seedVisit('draft');

    const res = await app.request(`/dental/visits/${visit.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitId: visit.id,
        subjective: 'Patient reports pain',
        objective: 'Swelling visible',
        assessment: 'Possible infection',
        plan: 'Antibiotic prescribed',
        notes: 'Follow up in 1 week',
      }),
    });

    expect(res.status).toBe(403);
  });

  test('valid request with active membership → 201', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('draft');

    const res = await app.request(`/dental/visits/${visit.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitId: visit.id,
        subjective: 'Patient reports pain',
        objective: 'Swelling visible',
        assessment: 'Possible infection',
        plan: 'Antibiotic prescribed',
        notes: 'Follow up in 1 week',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.visitId).toBe(visit.id);
    expect(body.subjective).toBe('Patient reports pain');
  });

  // B2 — visit-lock guard in notes upsert.
  // upsertVisitNotes (EM-VIS-007) returns VISIT_IMMUTABLE for both completed
  // and locked visits — see the authoritative "upsertVisitNotes — EM-VIS-007
  // lock gate" block in dental-visit.test.ts. (VISIT_IMMUTABLE is updateDentalVisit's
  // code for the locked-visit PATCH guard, a different endpoint.)
  test('locked visit → 422 VISIT_IMMUTABLE', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('locked');

    const res = await app.request(`/dental/visits/${visit.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitId: visit.id,
        subjective: 'Attempted note on locked visit',
        notes: 'Should be rejected',
      }),
    });

    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('VISIT_IMMUTABLE');
  });
});

// =============================================================================
// getToothHistory — per-tooth treatment history
// =============================================================================

describe('getToothHistory', () => {
  afterEach(truncateWithCharts);

  test('dismissed treatment excluded from tooth history', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('completed');
    await seedChart(visit.id, [{ toothNumber: 11, state: 'caries', conditionCode: 'K02.9' }]);
    await seedTreatment(visit.id, 'dismissed', { toothNumber: 11, cdtCode: 'D2140' });
    const active = await seedTreatment(visit.id, 'verified', { toothNumber: 11, cdtCode: 'D2150' });

    const res = await app.request(`/dental/visits/history/${PATIENT_ID}/teeth/11`);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].treatmentCdtCode).toBe('D2150');
  });

  test('no visits → empty history without auth check', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/visits/history/${PATIENT_ID}/teeth/11`);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toEqual([]);
    expect(body.pagination).not.toBeNull();
  });

  test('pagination — limit=1 returns page with correct total', async () => {
    const app = buildTestApp(TEST_USER);
    const visit1 = await seedVisit('completed');
    await seedChart(visit1.id, [{ toothNumber: 11, state: 'caries' }]);
    const visit2 = await seedVisit('completed');
    await seedChart(visit2.id, [{ toothNumber: 11, state: 'filled' }]);

    const res = await app.request(`/dental/visits/history/${PATIENT_ID}/teeth/11?limit=1`);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toHaveLength(1);
    expect(body.pagination.totalCount).toBe(2);
  });
});
