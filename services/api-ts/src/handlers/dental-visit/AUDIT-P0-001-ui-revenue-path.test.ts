/**
 * AUDIT ARTIFACT — P0-001 (Workspace Clinical Workflow Audit, 2026-05-19)
 * STATUS: FIXED — harness false-positive corrected 2026-05-19.
 *
 * Original root cause chain (items 2 and 3 are FIXED):
 *   1. `status` is NOT an accepted field on CreateDentalTreatmentRequest —
 *      treatment is always created at 'diagnosed' regardless of client intent.
 *      use-save-treatment.ts no longer sends `status` at all (this is correct).
 *   2. [FIXED] use-mark-treatment-done.ts now performs the two-step transition:
 *      diagnosed→planned (PATCH#1) then planned→performed (PATCH#2).
 *      The single-step diagnosed→performed PATCH no longer occurs in the UI.
 *   3. TREATMENT_TRANSITIONS still correctly rejects single-step diagnosed→performed
 *      (422). This is the right server behavior — not a bug.
 *   4. [NEW] Server now enforces a signed consent form before marking performed
 *      (TREATMENT_CONSENT_REQUIRED — implemented 2026-05-19, see B1 in plan).
 *
 * The backend API is SOUND. The UI revenue chain is now also SOUND (two-step).
 * Tests below document the current contract.
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  CreateDentalTreatmentBody, CreateDentalTreatmentParams,
  UpdateDentalTreatmentBody, UpdateDentalTreatmentParams,
} from '@/generated/openapi/validators';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { consentForms } from '@/handlers/dental-clinical/repos/consent-form.schema';
import { VisitRepository } from './repos/visit.repo';
import { createDentalTreatment } from './createDentalTreatment';
import { listDentalTreatments } from './listDentalTreatments';
import { updateDentalTreatment } from './updateDentalTreatment';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: '00000000-0000-0000-0000-0000000000a1', email: 'audit-p0001@clinic.com' };
const PATIENT_ID = 'a0000000-0000-1000-8000-0000000000a1';
const PERSON_ID  = 'e0000000-0000-1000-8000-0000000000a1';
const BRANCH_ID  = 'b0000000-0000-1000-8000-0000000000a2';
const ORG_ID     = 'db000000-0000-1000-8000-0000000000a2';
const DENTIST_MEMBER_ID = 'c0000000-0000-1000-8000-0000000000a3';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'Audit P0001 Clinic', tier: 'solo', ownerPersonId: TEST_USER.id, countryCode: 'PH', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch', timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.execute(sql`DELETE FROM dental_membership WHERE person_id = ${TEST_USER.id} AND branch_id = ${BRANCH_ID} AND id != ${DENTIST_MEMBER_ID}`);
  await db.insert(dentalMemberships).values({ id: DENTIST_MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id, displayName: 'Audit Dentist', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'Audit', lastName: 'Patient', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
});

const ve = (result: any, c: any) => {
  if (!result.success) return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
};

const TreatmentBodyOnly = CreateDentalTreatmentBody.omit({ visitId: true });

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
    if (user) { ctx.set('user', user); ctx.set('session', { id: 'test-session' }); }
    await next();
  });
  app.post('/dental/visits/:visitId/treatments', zValidator('param', CreateDentalTreatmentParams, ve), zValidator('json', TreatmentBodyOnly, ve), createDentalTreatment as any);
  app.get('/dental/visits/:visitId/treatments', listDentalTreatments as any);
  app.patch('/dental/visits/:visitId/treatments/:treatmentId', zValidator('param', UpdateDentalTreatmentParams, ve), zValidator('json', UpdateDentalTreatmentBody, ve), updateDentalTreatment as any);
  return app;
}

async function seedVisit() {
  return new VisitRepository(db).createOne({ patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: DENTIST_MEMBER_ID });
}

async function createTreatment(app: any, visitId: string, body: Record<string, unknown>) {
  const res = await app.request(`/dental/visits/${visitId}/treatments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res;
}

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE dental_treatment, dental_chart, visit_notes, dental_visit CASCADE`);
});

describe('AUDIT P0-001 — broken UI revenue path', () => {
  test('create-time client status:"planned" is silently discarded → persists "diagnosed"', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);
    // This is exactly what use-save-treatment.ts sends (status:'planned').
    const res = await createTreatment(app, visit.id, {
      patientId: PATIENT_ID, cdtCode: 'D2391', description: 'Resin restoration',
      priceCents: 12000, toothNumber: 14, status: 'planned',
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    // DEFECT: client asked for 'planned'; contract has no status field; default wins.
    expect(body.status).toBe('diagnosed');
  });

  test('server correctly rejects single-step diagnosed→performed (invalid transition)', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);
    const created = await (await createTreatment(app, visit.id, {
      patientId: PATIENT_ID, cdtCode: 'D2391', description: 'Resin restoration', priceCents: 12000,
    })).json();
    expect(created.status).toBe('diagnosed');

    // Server correctly enforces the state machine: diagnosed→performed skips 'planned'.
    // NOTE: use-mark-treatment-done.ts now does the two-step (diagnosed→planned→performed)
    // so the UI never sends this single-step PATCH anymore.
    const singleStep = await app.request(`/dental/visits/${visit.id}/treatments/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'performed' }),
    });
    expect(singleStep.status).toBe(422);
  });

  test('backend is sound: two-step diagnosed→planned→performed with consent succeeds', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);
    // Seed signed consent — required by the server gate before →performed (B1 fix)
    await db.insert(consentForms).values({
      id: crypto.randomUUID(), visitId: visit.id, patientId: PATIENT_ID,
      templateId: 'general-v1', templateName: 'General Consent', signed: true,
      signedAt: new Date(), signatureData: 'data:image/png;base64,test',
      createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
    });
    const created = await (await createTreatment(app, visit.id, {
      patientId: PATIENT_ID, cdtCode: 'D2391', description: 'Resin restoration', priceCents: 12000,
    })).json();

    const toPlanned = await app.request(`/dental/visits/${visit.id}/treatments/${created.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'planned' }),
    });
    expect(toPlanned.status).toBe(200);
    expect((await toPlanned.json() as any).status).toBe('planned');

    const toPerformed = await app.request(`/dental/visits/${visit.id}/treatments/${created.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'performed' }),
    });
    expect(toPerformed.status).toBe(200);
    expect((await toPerformed.json() as any).status).toBe('performed');
    // Conclusion: API + UI are now both SOUND. use-mark-treatment-done.ts
    // sends both PATCHes (diagnosed→planned, planned→performed).
    // The consent gate (TREATMENT_CONSENT_REQUIRED) is enforced server-side.
  });
});
