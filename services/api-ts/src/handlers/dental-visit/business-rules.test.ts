/**
 * business-rules.test.ts — BR-005: Auto-discard empty visit on session end
 *
 * BR-005: When a visit is transitioned to 'completed' (session ends) and has
 *   no treatments, no visit notes, and no attachments, the server MUST
 *   automatically set the visit status to 'discarded' instead of 'completed'.
 *
 * Fixture namespace: a06 — unique across all dental suites:
 *   module1 (a02), module2 (bb/cc), module3 (f1/a1/e1), module4 (b400/a4/f4),
 *   audit (a03/a01/e0), treatment (e5/f5/b5xx), a06 = this suite
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  UpdateDentalVisitBody,
  UpdateDentalVisitParams,
} from '@/generated/openapi/validators';
import { VisitRepository } from './repos/visit.repo';
import { updateDentalVisit } from './visits/updateDentalVisit';
import { consentForms } from '@/handlers/dental-clinical/repos/consent-form.schema';
import { visitNotes } from './repos/treatment.schema';
import { dentalAttachments } from '@/handlers/dental-clinical/repos/attachment.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// ─── Fixture IDs (a06 namespace) ─────────────────────────────────────────────
const TEST_USER   = { id: 'e6000000-0000-1000-8000-000000000001', email: 'dentist6@clinic.com' };
const PATIENT_ID  = 'f6000000-0000-1000-8000-000000000001';
const PERSON_ID   = 'f6000000-0000-1000-8000-000000000002';
const BRANCH_ID   = '7b600000-0000-4000-8000-000000000006';
const ORG_ID      = 'a6000000-0000-1000-8000-000000000003';
const MEMBER_ID   = '7c600000-0000-4000-8000-000000000006';

// ─── DB setup ────────────────────────────────────────────────────────────────

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'BR005 Clinic', tier: 'solo',
    ownerPersonId: TEST_USER.id, countryCode: 'PH',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'BR005 Branch',
    timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id,
    displayName: 'BR005 Dentist', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'BR005', lastName: 'Patient',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
});

// ─── App builder ──────────────────────────────────────────────────────────────

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

  const ve = (result: any, c: any) => {
    if (!result.success) return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
  };

  app.patch(
    '/dental/visits/:visitId',
    zValidator('param', UpdateDentalVisitParams, ve),
    zValidator('json', UpdateDentalVisitBody, ve),
    updateDentalVisit as any,
  );

  return app;
}

// ─── Teardown ─────────────────────────────────────────────────────────────────

async function truncate() {
  await db.execute(sql`TRUNCATE TABLE visit_notes, dental_treatment, consent_form, dental_attachment CASCADE`);
  await db.execute(sql`TRUNCATE TABLE dental_visit CASCADE`);
}

// ─── Seed helpers ─────────────────────────────────────────────────────────────

async function seedVisit(status = 'active') {
  const { dentalVisits } = await import('./repos/visit.schema');
  const [visit] = await db.insert(dentalVisits).values({
    id: crypto.randomUUID(), patientId: PATIENT_ID, branchId: BRANCH_ID,
    dentistMemberId: MEMBER_ID, status: status as any,
    ...(status === 'active' ? { activatedAt: new Date() } : {}),
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).returning();
  return visit!;
}

async function seedTreatment(visitId: string) {
  const { dentalTreatments } = await import('./repos/treatment.schema');
  const [t] = await db.insert(dentalTreatments).values({
    id: crypto.randomUUID(), visitId, patientId: PATIENT_ID,
    cdtCode: 'D0120', description: 'Periodic eval',
    priceCents: 100000, status: 'performed', carriedOver: false,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
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

// Mirrors createDentalVisit auto-seed: an empty notes row with no SOAP content.
// BR-005 must treat this as "no notes" (hasNoNotes = true).
async function seedEmptyNotes(visitId: string) {
  const [n] = await db.insert(visitNotes).values({
    id: crypto.randomUUID(), visitId, authorMemberId: MEMBER_ID,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).returning();
  return n!;
}

async function seedNotes(visitId: string) {
  const [n] = await db.insert(visitNotes).values({
    id: crypto.randomUUID(), visitId, authorMemberId: MEMBER_ID,
    subjective: 'Patient reports pain', notes: 'SOAP completed',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).returning();
  return n!;
}

async function seedAttachment(visitId: string) {
  const [a] = await db.insert(dentalAttachments).values({
    id: crypto.randomUUID(), visitId, patientId: PATIENT_ID,
    imageType: 'xray', fileName: 'xray.jpg', filePath: '/uploads/xray.jpg',
    fileSizeBytes: 12345, mimeType: 'image/jpeg',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).returning();
  return a!;
}

// =============================================================================
// BR-005 — Auto-discard empty visit when session ends
// =============================================================================

describe('BR-005 — auto-discard empty visit on session end', () => {
  afterEach(truncate);

  // ── RED tests (fail before implementation) ──

  test('BR-005: active→completed with no treatments/notes/attachments → status becomes discarded', async () => {
    // createDentalVisit always seeds an empty notes row; mirror that here so
    // the test is realistic. BR-005 must still auto-discard (empty SOAP = empty).
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('active');
    await seedEmptyNotes(visit.id);

    const res = await app.request(`/dental/visits/${visit.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });

    // Server MUST auto-discard — response is 200 with status='discarded'
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('discarded');
  });

  test('BR-005: active→completed with notes only (no treatments/attachments) → NOT discarded (notes = clinical content)', async () => {
    // A visit with notes is NOT empty — it goes through normal completion path.
    // Without consent + performed treatments, normal guards fire (422).
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('active');
    await seedNotes(visit.id);

    const res = await app.request(`/dental/visits/${visit.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });

    // Has notes → not empty → normal path → fails consent guard
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('VISIT_CONSENT_REQUIRED');
  });

  test('BR-005: active→completed with attachments only (no treatments/notes) → NOT discarded (attachments = clinical content)', async () => {
    // A visit with attachments is NOT empty — normal guards apply.
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('active');
    await seedAttachment(visit.id);

    const res = await app.request(`/dental/visits/${visit.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });

    // Has attachments → not empty → normal path → fails consent guard
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('VISIT_CONSENT_REQUIRED');
  });

  test('BR-005: active→completed WITH treatments (performed) → NOT discarded, requires consent+notes', async () => {
    // A visit with treatments is NOT empty — normal completion guards apply
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('active');
    await seedTreatment(visit.id);
    await seedSignedConsent(visit.id);
    await seedNotes(visit.id);

    const res = await app.request(`/dental/visits/${visit.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    // Has treatments + consent + notes → completes normally, NOT discarded
    expect(body.status).toBe('completed');
  });

  test('BR-005: discarded visit is persisted (DB check via VisitRepository)', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit('active');

    await app.request(`/dental/visits/${visit.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });

    // Confirm DB state
    const repo = new VisitRepository(db);
    const updated = await repo.findOneById(visit.id);
    expect(updated?.status).toBe('discarded');
  });
});
