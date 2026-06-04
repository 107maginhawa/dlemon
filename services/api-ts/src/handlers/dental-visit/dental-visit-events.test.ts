/**
 * dental-visit domain-event audit-trace tests
 *
 * Per ADR-006, visit domain events are AUDIT-LOG-ONLY semantic markers — there is no
 * event bus. A "publish" is satisfied by the producer writing a synchronous
 * dental_audit_log row via logAuditEvent. A publisher test triggers the producing
 * HTTP action and asserts the audit row exists with the expected action / target /
 * actor. Consumer / idempotency tests are out of scope (no bus, per ADR-006).
 *
 * Events covered (previously untraced — TRACE_REPORT TR-P1-04):
 *   DE-003 VisitLocked        → action 'visit.locked'       / target dental_visit
 *   DE-004 TreatmentDiagnosed → action 'treatment.diagnosed'/ target dental_treatment
 *
 * (DE-001 VisitCheckedIn / DE-002 VisitCompleted / DE-005 TreatmentPerformed /
 *  DE-006 TreatmentDismissed are already traced elsewhere.)
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql, eq, and } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  CreateDentalTreatmentParams, CreateDentalTreatmentBody,
  UpdateDentalVisitParams, UpdateDentalVisitBody,
} from '@/generated/openapi/validators';
import { createDentalTreatment } from './treatments/createDentalTreatment';
import { updateDentalVisit } from './visits/updateDentalVisit';
import { dentalAuditLog } from '@/handlers/dental-audit/repos/audit-log.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: '00000000-0000-0000-0000-000000000001', email: 'visit-de@clinic.com' };
const PERSON_ID  = 'ee000000-0000-1000-8000-0000000ae001';
const PATIENT_ID = 'aa000000-0000-1000-8000-0000000ae001';
const BRANCH_ID  = 'bb000000-0000-1000-8000-0000000ae002';
const MEMBER_ID  = 'cc000000-0000-1000-8000-0000000ae003';
const ORG_ID     = 'ec000000-0000-1000-8000-0000000ae001';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Visit-DE Clinic', tier: 'solo', ownerPersonId: TEST_USER.id,
    countryCode: 'PH', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch', timezone: 'Asia/Manila',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id, displayName: 'Owner',
    role: 'dentist_owner', status: 'active', pinFailedAttempts: 0,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'Visit', lastName: 'Patient',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
});

afterEach(async () => {
  const visitIds = sql`(SELECT id FROM dental_visit WHERE patient_id = ${PATIENT_ID})`;
  // dental_audit_log is append-only (DB trigger denies row UPDATE/DELETE, V-AUD-IMM-001).
  // Reset via table-level TRUNCATE, which the BEFORE ROW trigger does not block.
  await db.execute(sql`TRUNCATE TABLE dental_audit_log`);
  await db.execute(sql`DELETE FROM consent_form WHERE visit_id IN ${visitIds}`);
  await db.execute(sql`DELETE FROM dental_treatment WHERE visit_id IN ${visitIds}`);
  await db.execute(sql`DELETE FROM visit_notes WHERE visit_id IN ${visitIds}`);
  await db.execute(sql`DELETE FROM dental_visit WHERE patient_id = ${PATIENT_ID}`);
});

const ve = (result: any, c: any) => {
  if (!result.success) return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
};

function buildTestApp() {
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
    ctx.set('session', { id: 'test-session', userId: TEST_USER.id });
    await next();
  });
  app.post('/dental/visits/:visitId/treatments',
    zValidator('param', CreateDentalTreatmentParams, ve), zValidator('json', CreateDentalTreatmentBody, ve), createDentalTreatment as any);
  app.patch('/dental/visits/:visitId',
    zValidator('param', UpdateDentalVisitParams, ve), zValidator('json', UpdateDentalVisitBody, ve), updateDentalVisit as any);
  return app;
}

async function seedActiveVisit() {
  const { VisitRepository } = await import('@/handlers/dental-visit/repos/visit.repo');
  const repo = new VisitRepository(db);
  const visit = await repo.createOne({ patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID });
  const activated = await repo.activate(visit.id);
  return activated ?? visit;
}

async function auditRows(action: string, targetId: string) {
  return db.select().from(dentalAuditLog)
    .where(and(eq(dentalAuditLog.action, action), eq(dentalAuditLog.targetId, targetId)));
}

async function patchVisit(app: ReturnType<typeof buildTestApp>, visitId: string, status: string) {
  return app.request(`/dental/visits/${visitId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
}

// ---------------------------------------------------------------------------
// DE-004 TreatmentDiagnosed
// ---------------------------------------------------------------------------

describe('DE-004 TreatmentDiagnosed — audit-row marker on treatment create', () => {
  test('writes a dental_audit_log row (treatment.diagnosed) referencing the treatment', async () => {
    const app = buildTestApp();
    const visit = await seedActiveVisit();

    const res = await app.request(`/dental/visits/${visit.id}/treatments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitId: visit.id, patientId: PATIENT_ID, cdtCode: 'D0150',
        description: 'Comprehensive exam', toothNumber: 14, priceCents: 5000,
      }),
    });
    expect(res.status).toBe(201);
    const treatment = await res.json() as any;

    const rows = await auditRows('treatment.diagnosed', treatment.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.targetType).toBe('dental_treatment');
    expect(rows[0]?.actorId).toBe(TEST_USER.id);
    expect(rows[0]?.branchId).toBe(BRANCH_ID);
  });

  test('does NOT write treatment.diagnosed when create fails (404 unknown visit)', async () => {
    const app = buildTestApp();
    const NONEXISTENT = 'ffffffff-ffff-1000-8000-ffffffffffff';
    const res = await app.request(`/dental/visits/${NONEXISTENT}/treatments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitId: NONEXISTENT, patientId: PATIENT_ID, cdtCode: 'D0150', description: 'x', priceCents: 5000 }),
    });
    expect(res.status).toBe(404);
    const rows = await db.select().from(dentalAuditLog)
      .where(and(eq(dentalAuditLog.action, 'treatment.diagnosed'), eq(dentalAuditLog.branchId, BRANCH_ID)));
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// DE-003 VisitLocked
// ---------------------------------------------------------------------------

describe('DE-003 VisitLocked — audit-row marker on visit lock', () => {
  // Build a completable visit: 1 performed treatment + signed consent + SOAP notes.
  async function seedCompletableVisit() {
    const { VisitRepository } = await import('@/handlers/dental-visit/repos/visit.repo');
    const { TreatmentRepository, VisitNotesRepository } = await import('@/handlers/dental-visit/repos/treatment.repo');
    const { ConsentFormRepository } = await import('@/handlers/dental-clinical/repos/consent-form.repo');
    const visitRepo = new VisitRepository(db);
    const treatRepo = new TreatmentRepository(db);
    const notesRepo = new VisitNotesRepository(db);
    const consentRepo = new ConsentFormRepository(db);

    const visit = await visitRepo.createOne({ patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID });
    await visitRepo.activate(visit.id);

    const t = await treatRepo.createOne({
      visitId: visit.id, patientId: PATIENT_ID, cdtCode: 'D2740', description: 'Crown',
      priceCents: 50000, carriedOver: false,
    });
    await treatRepo.updateStatus(t.id, 'performed');

    await notesRepo.upsert({
      visitId: visit.id, authorMemberId: MEMBER_ID,
      subjective: 'S', objective: 'O', assessment: 'A', plan: 'P',
      createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
    });

    const consent = await consentRepo.createOne({ visitId: visit.id, patientId: PATIENT_ID, templateId: 't', templateName: 'C' });
    await consentRepo.sign(consent.id, 'data:image/png;base64,SIG');
    return visit;
  }

  test('writes a dental_audit_log row (visit.locked) after complete → locked', async () => {
    const app = buildTestApp();
    const visit = await seedCompletableVisit();

    const completeRes = await patchVisit(app, visit.id, 'completed');
    expect(completeRes.status).toBe(200);

    const lockRes = await patchVisit(app, visit.id, 'locked');
    expect(lockRes.status).toBe(200);

    const rows = await auditRows('visit.locked', visit.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.targetType).toBe('dental_visit');
    expect(rows[0]?.actorId).toBe(TEST_USER.id);
    expect(rows[0]?.branchId).toBe(BRANCH_ID);
  });

  test('does NOT write visit.locked for a non-lock transition (complete only)', async () => {
    const app = buildTestApp();
    const visit = await seedCompletableVisit();

    const completeRes = await patchVisit(app, visit.id, 'completed');
    expect(completeRes.status).toBe(200);

    expect(await auditRows('visit.locked', visit.id)).toHaveLength(0);
  });
});
