/**
 * PMD generation trigger (AHA FIX-001).
 *
 * GAP-1 / FAIL root: nothing ever created a PMD — generatePMD had no caller on
 * the visit-completion path, so the portability promise produced zero documents.
 * WF-021/FR12.1 mandates auto-generation on visit completion. These tests pin
 * that completing a visit through the real handler produces a PMD, and that the
 * trigger is idempotent (re-completion supersedes, never duplicates).
 *
 * Run via scripts/test-with-db.ts (clones monobase_test).
 */
import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { updateDentalVisit } from '@/handlers/dental-visit/visits/updateDentalVisit';
import { UpdateDentalVisitParams, UpdateDentalVisitBody } from '@/generated/openapi/validators';
import { PMDDocumentRepository } from './repos/pmd-document.repo';
import { consentForms } from '@/handlers/dental-clinical/repos/consent-form.schema';
import { visitNotes } from '@/handlers/dental-visit/repos/treatment.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: '00000000-0000-0000-0000-0000000ad017', email: 'pmd-trigger@clinic.com' };
const ORG_ID = 'ef000000-0000-1000-8000-0000000ad017';
const BRANCH_ID = '7b000000-0000-4000-8000-0000000ad017';
const MEMBER_ID = '7c000000-0000-4000-8000-0000000ad017';
const PERSON_ID = 'f1000000-0000-1000-8000-0000000ad017';
const PATIENT_ID = 'a0000000-0000-1000-8000-0000000ad017';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');
  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'PMD Trigger Clinic', tier: 'solo', ownerPersonId: TEST_USER.id, countryCode: 'PH', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Main', timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id, displayName: 'Dr. Test', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'Test', lastName: 'Patient', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE pmd_document, visit_notes, dental_treatment, consent_form, dental_attachment CASCADE`);
  await db.execute(sql`TRUNCATE TABLE dental_visit CASCADE`);
});

function buildApp() {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String((err as Error).message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    ctx.set('user', TEST_USER);
    ctx.set('session', { id: 'test-session' });
    await next();
  });
  const ve = (result: any, c: any) => { if (!result.success) return c.json({ error: 'bad' }, 400); };
  app.patch('/dental/visits/:visitId',
    zValidator('param', UpdateDentalVisitParams, ve),
    zValidator('json', UpdateDentalVisitBody, ve),
    updateDentalVisit as any);
  return app;
}

async function seedCompletableVisit() {
  const { dentalVisits } = await import('@/handlers/dental-visit/repos/visit.schema');
  const { dentalTreatments } = await import('@/handlers/dental-visit/repos/treatment.schema');
  const [visit] = await db.insert(dentalVisits).values({
    id: crypto.randomUUID(), patientId: PATIENT_ID, branchId: BRANCH_ID,
    dentistMemberId: MEMBER_ID, status: 'active', activatedAt: new Date(),
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).returning();
  await db.insert(dentalTreatments).values({
    id: crypto.randomUUID(), visitId: visit!.id, patientId: PATIENT_ID,
    cdtCode: 'D0120', description: 'Periodic eval', priceCents: 100000,
    status: 'performed', carriedOver: false, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  });
  await db.insert(consentForms).values({
    id: crypto.randomUUID(), visitId: visit!.id, patientId: PATIENT_ID,
    templateId: 'general-consent-v1', templateName: 'General Treatment Consent',
    signed: true, signedAt: new Date(), signatureData: 'data:image/png;base64,test',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  });
  await db.insert(visitNotes).values({
    id: crypto.randomUUID(), visitId: visit!.id, authorMemberId: MEMBER_ID,
    subjective: 'Patient reports pain', notes: 'SOAP completed',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  });
  return visit!;
}

async function completeVisit(app: ReturnType<typeof buildApp>, visitId: string) {
  return app.request(`/dental/visits/${visitId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'completed' }),
  });
}

describe('PMD auto-generation on visit completion (FIX-001)', () => {
  test('completing a visit produces a PMD for that visit', async () => {
    const app = buildApp();
    const visit = await seedCompletableVisit();

    const res = await completeVisit(app, visit.id);
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).status).toBe('completed');

    const pmdRepo = new PMDDocumentRepository(db);
    const pmd = await pmdRepo.findByVisit(visit.id);
    expect(pmd).not.toBeNull();
    expect(pmd!.visitId).toBe(visit.id);
    expect(pmd!.patientId).toBe(PATIENT_ID);
  });

  test('re-completing the visit supersedes — never duplicates — the PMD (idempotent, BR-021)', async () => {
    const app = buildApp();
    const visit = await seedCompletableVisit();

    await completeVisit(app, visit.id);
    await completeVisit(app, visit.id); // re-trigger

    // Exactly one CURRENT (status='generated') pmd row for the visit — the
    // re-trigger superseded the first rather than creating a duplicate.
    const rows = await db.execute(
      sql`SELECT count(*)::int AS n FROM pmd_document WHERE visit_id = ${visit.id} AND status = 'generated'`,
    );
    const n = (rows.rows?.[0] as any)?.n ?? (rows as any)[0]?.n;
    expect(Number(n)).toBe(1);
  });
});
