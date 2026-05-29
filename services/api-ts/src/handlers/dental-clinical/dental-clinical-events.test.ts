/**
 * dental-clinical domain-event audit-trace tests
 *
 * Per ADR-006, clinical domain events are AUDIT-LOG-ONLY semantic markers — there is
 * no event bus. A "publish" is satisfied by the producer writing a synchronous
 * dental_audit_log row via logAuditEvent. A publisher test triggers the producing
 * HTTP action and asserts the audit row exists with the expected action / target /
 * actor. Consumer / idempotency tests are out of scope (no bus, per ADR-006).
 *
 * Events covered (previously untraced — TRACE_REPORT TR-P1-04):
 *   DE-012 ConsentSigned       → action 'consent.signed'      / target dental_consent_form
 *   DE-013 ConsentRevoked      → action 'consent.revoked'     / target dental_consent_form
 *   DE-016 PrescriptionWritten → action 'prescription.created'/ target dental_prescription
 *
 * (DE-014 LabOrderCreated / DE-015 LabOrderCompleted are already traced in
 * clinical-consent-lab.test.ts.)
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql, eq, and } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  CreateConsentFormParams, CreateConsentFormBody,
  SignConsentFormParams, SignConsentFormBody,
  CreatePrescriptionParams, CreatePrescriptionBody,
} from '@/generated/openapi/validators';
import { createConsentForm } from './consent/createConsentForm';
import { signConsentForm } from './consent/signConsentForm';
import { revokeConsentForm } from './consent/revokeConsentForm';
import { createPrescription } from './prescriptions/createPrescription';
import { dentalAuditLog } from '@/handlers/dental-audit/repos/audit-log.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: '00000000-0000-0000-0000-000000000001', email: 'clinical-de@clinic.com' };
const PERSON_ID  = 'ee000000-0000-1000-8000-0000000ce001';
const PATIENT_ID = 'aa000000-0000-1000-8000-0000000ce001';
const BRANCH_ID  = 'bb000000-0000-1000-8000-0000000ce002';
const MEMBER_ID  = 'cc000000-0000-1000-8000-0000000ce003';
const ORG_ID     = 'ec000000-0000-1000-8000-0000000ce001';
const NONEXISTENT = 'ffffffff-ffff-4000-8000-ffffffffffff';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Clinical-DE Clinic', tier: 'solo', ownerPersonId: TEST_USER.id,
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
    id: PERSON_ID, firstName: 'Clinical', lastName: 'Patient',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
});

afterEach(async () => {
  const visitIds = sql`(SELECT id FROM dental_visit WHERE patient_id = ${PATIENT_ID})`;
  await db.execute(sql`DELETE FROM dental_audit_log WHERE branch_id = ${BRANCH_ID}`);
  await db.execute(sql`DELETE FROM prescription WHERE visit_id IN ${visitIds}`);
  await db.execute(sql`DELETE FROM consent_form WHERE visit_id IN ${visitIds}`);
  await db.execute(sql`DELETE FROM dental_visit WHERE patient_id = ${PATIENT_ID}`);
});

const ve = (result: any, c: any) => {
  if (!result.success) return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
};

const ConsentBodyOnly = CreateConsentFormBody.omit({ visitId: true });

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
  app.post('/dental/visits/:visitId/consents',
    zValidator('param', CreateConsentFormParams, ve), zValidator('json', ConsentBodyOnly, ve), createConsentForm as any);
  app.post('/dental/visits/:visitId/consents/:consentId/sign',
    zValidator('param', SignConsentFormParams, ve), zValidator('json', SignConsentFormBody, ve), signConsentForm as any);
  app.patch('/dental/visits/:visitId/consents/:cid/revoke', revokeConsentForm as any);
  app.post('/dental/visits/:visitId/prescriptions',
    zValidator('param', CreatePrescriptionParams, ve), zValidator('json', CreatePrescriptionBody, ve), createPrescription as any);
  return app;
}

async function seedVisit() {
  const { VisitRepository } = await import('@/handlers/dental-visit/repos/visit.repo');
  return new VisitRepository(db).createOne({ patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID });
}

async function createConsentViaApi(app: ReturnType<typeof buildTestApp>, visitId: string) {
  const res = await app.request(`/dental/visits/${visitId}/consents`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patientId: PATIENT_ID, templateId: 'tpl-de', templateName: 'Treatment Consent' }),
  });
  return res.json() as Promise<any>;
}

async function auditRows(action: string, targetId: string) {
  return db.select().from(dentalAuditLog)
    .where(and(eq(dentalAuditLog.action, action), eq(dentalAuditLog.targetId, targetId)));
}

// ---------------------------------------------------------------------------
// DE-012 ConsentSigned
// ---------------------------------------------------------------------------

describe('DE-012 ConsentSigned — audit-row marker on consent sign', () => {
  test('writes a dental_audit_log row (consent.signed) referencing the consent form', async () => {
    const app = buildTestApp();
    const visit = await seedVisit();
    const consent = await createConsentViaApi(app, visit.id);

    const signRes = await app.request(`/dental/visits/${visit.id}/consents/${consent.id}/sign`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signatureData: 'data:image/png;base64,SIG' }),
    });
    expect(signRes.status).toBe(200);

    const rows = await auditRows('consent.signed', consent.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.targetType).toBe('dental_consent_form');
    expect(rows[0]?.actorId).toBe(TEST_USER.id);
    expect(rows[0]?.branchId).toBe(BRANCH_ID);
  });

  test('does NOT write consent.signed when sign fails (422 already signed)', async () => {
    const app = buildTestApp();
    const visit = await seedVisit();
    const consent = await createConsentViaApi(app, visit.id);

    await app.request(`/dental/visits/${visit.id}/consents/${consent.id}/sign`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signatureData: 'data:image/png;base64,FIRST' }),
    });
    // second sign rejected — must not add a second marker
    const second = await app.request(`/dental/visits/${visit.id}/consents/${consent.id}/sign`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signatureData: 'data:image/png;base64,SECOND' }),
    });
    expect(second.status).toBe(422);

    expect(await auditRows('consent.signed', consent.id)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// DE-013 ConsentRevoked
// ---------------------------------------------------------------------------

describe('DE-013 ConsentRevoked — audit-row marker on consent revoke', () => {
  test('writes a dental_audit_log row (consent.revoked) referencing the consent form', async () => {
    const app = buildTestApp();
    const visit = await seedVisit();
    const consent = await createConsentViaApi(app, visit.id);

    const revokeRes = await app.request(`/dental/visits/${visit.id}/consents/${consent.id}/revoke`, { method: 'PATCH' });
    expect(revokeRes.status).toBe(200);

    const rows = await auditRows('consent.revoked', consent.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.targetType).toBe('dental_consent_form');
    expect(rows[0]?.actorId).toBe(TEST_USER.id);
  });

  test('does NOT write consent.revoked when revoke fails (404 unknown form)', async () => {
    const app = buildTestApp();
    const visit = await seedVisit();
    const res = await app.request(`/dental/visits/${visit.id}/consents/${NONEXISTENT}/revoke`, { method: 'PATCH' });
    expect(res.status).toBe(404);
    expect(await auditRows('consent.revoked', NONEXISTENT)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// DE-016 PrescriptionWritten
// ---------------------------------------------------------------------------

describe('DE-016 PrescriptionWritten — audit-row marker on prescription create', () => {
  test('writes a dental_audit_log row (prescription.created) referencing the prescription', async () => {
    const app = buildTestApp();
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/prescriptions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitId: visit.id, patientId: PATIENT_ID, prescriberMemberId: MEMBER_ID,
        drugName: 'Amoxicillin', dosage: '500mg', frequency: 'TID',
      }),
    });
    expect(res.status).toBe(201);
    const rx = await res.json() as any;

    const rows = await auditRows('prescription.created', rx.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.targetType).toBe('dental_prescription');
    expect(rows[0]?.actorId).toBe(TEST_USER.id);
    expect(rows[0]?.branchId).toBe(BRANCH_ID);
  });

  test('does NOT write prescription.created when create fails (403 prescriber not in branch)', async () => {
    const app = buildTestApp();
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/prescriptions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitId: visit.id, patientId: PATIENT_ID, prescriberMemberId: NONEXISTENT,
        drugName: 'Ibuprofen', dosage: '400mg', frequency: 'BID',
      }),
    });
    expect(res.status).toBe(403);

    const rows = await db.select().from(dentalAuditLog)
      .where(and(eq(dentalAuditLog.action, 'prescription.created'), eq(dentalAuditLog.branchId, BRANCH_ID)));
    expect(rows).toHaveLength(0);
  });
});
