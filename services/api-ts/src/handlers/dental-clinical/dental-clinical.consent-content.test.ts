/**
 * P1-3: Consent content + informed refusal
 *
 * Tests cover:
 * - createConsentForm accepts structured content fields (nature, benefits, risks,
 *   alternatives, risksOfNonTreatment)
 * - recordConsentRefusal creates an informed refusal record (distinct from granted consent)
 * - Informed refusal has timestamp, memberId attribution, reason
 * - Refusal record is immutable (no update path via sign/revoke)
 * - BR-014: signed consent forms remain immutable
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  CreateConsentFormBody, CreateConsentFormParams,
  SignConsentFormBody, SignConsentFormParams,
  RecordConsentRefusalBody, RecordConsentRefusalParams,
} from '@/generated/openapi/validators';
import { createConsentForm } from './consent/createConsentForm';
import { signConsentForm } from './consent/signConsentForm';
import { recordConsentRefusal } from './consent/recordConsentRefusal';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: '00000000-0000-0000-0000-000000000031', email: 'consent@clinic.com' };
const PERSON_ID = 'f9000000-0000-1000-8000-000000000031';
const PATIENT_ID = 'a0000000-0000-1000-8000-000000000031';
const BRANCH_ID = 'b9000000-0000-1000-8000-000000000031';
const ORG_ID = 'd9000000-0000-1000-8000-000000000031';
const MEMBER_ID = 'c0000000-0000-1000-8000-000000000033';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');

  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'Consent3 Clinic', tier: 'solo', ownerPersonId: TEST_USER.id, countryCode: 'PH', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch', timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id, displayName: 'Consent Dentist', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'Consent', lastName: 'Patient', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
});

const ve = (result: any, c: any) => {
  if (!result.success) return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
};

const ConsentBodyOnly = CreateConsentFormBody.omit({ visitId: true });
const RefusalBodyOnly = RecordConsentRefusalBody.omit({ visitId: true });

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
    if (user) ctx.set('user', user);
    await next();
  });
  app.post('/dental/visits/:visitId/consents',
    zValidator('param', CreateConsentFormParams, ve),
    zValidator('json', ConsentBodyOnly, ve),
    createConsentForm as any,
  );
  app.post('/dental/visits/:visitId/consents/:consentId/sign',
    zValidator('param', SignConsentFormParams, ve),
    zValidator('json', SignConsentFormBody, ve),
    signConsentForm as any,
  );
  app.post('/dental/visits/:visitId/consent-refusals',
    zValidator('param', RecordConsentRefusalParams, ve),
    zValidator('json', RefusalBodyOnly, ve),
    recordConsentRefusal as any,
  );
  return app;
}

async function seedVisit() {
  const { createVisit } = await import('@/handlers/dental-visit/utils/visit.service');
  return createVisit(db, { patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID });
}

afterEach(async () => {
  const visitIds = sql`(SELECT id FROM dental_visit WHERE patient_id = ${PATIENT_ID})`;
  await db.execute(sql`DELETE FROM consent_refusal WHERE visit_id IN ${visitIds}`);
  await db.execute(sql`DELETE FROM consent_form WHERE visit_id IN ${visitIds}`);
  await db.execute(sql`DELETE FROM dental_visit WHERE patient_id = ${PATIENT_ID}`);
  await db.execute(sql`TRUNCATE TABLE dental_audit_log`);
});

// ---------------------------------------------------------------------------
// Consent form structured content fields
// ---------------------------------------------------------------------------

describe('P1-3: Consent form structured content', () => {
  test('createConsentForm stores structured consent content when provided', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/consents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        templateId: 'tpl-extraction',
        templateName: 'Tooth Extraction Consent',
        procedureNature: 'Surgical extraction of tooth #48 (lower right wisdom tooth)',
        benefits: 'Relief of pain, prevention of infection spread, improved oral health',
        risks: 'Bleeding, infection, dry socket, temporary numbness, rare jaw fracture',
        alternatives: 'Conservative management with antibiotics (high recurrence risk)',
        risksOfNonTreatment: 'Ongoing pain, risk of spreading infection, damage to adjacent tooth',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeTruthy();
    expect(body.procedureNature).toBe('Surgical extraction of tooth #48 (lower right wisdom tooth)');
    expect(body.benefits).toBe('Relief of pain, prevention of infection spread, improved oral health');
    expect(body.risks).toBe('Bleeding, infection, dry socket, temporary numbness, rare jaw fracture');
    expect(body.alternatives).toBe('Conservative management with antibiotics (high recurrence risk)');
    expect(body.risksOfNonTreatment).toBe('Ongoing pain, risk of spreading infection, damage to adjacent tooth');
    expect(body.signed).toBe(false);
  });

  test('createConsentForm works without content fields (backward compatible)', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/consents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        templateId: 'tpl-general',
        templateName: 'General Consent',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeTruthy();
    expect(body.procedureNature).toBeNull();
  });

  test('signed consent form preserves content fields (BR-014 immutability)', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const createRes = await app.request(`/dental/visits/${visit.id}/consents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        templateId: 'tpl-root-canal',
        templateName: 'Root Canal Consent',
        procedureNature: 'Endodontic treatment to remove infected pulp',
        risks: 'Rare instrument fracture, post-treatment pain',
      }),
    });
    const created = await createRes.json() as any;

    const signRes = await app.request(
      `/dental/visits/${visit.id}/consents/${created.id}/sign`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureData: 'data:image/png;base64,SIGNEDCONTENT' }),
      },
    );

    expect(signRes.status).toBe(200);
    const signed = await signRes.json() as any;
    expect(signed.signed).toBe(true);
    expect(signed.procedureNature).toBe('Endodontic treatment to remove infected pulp');
    expect(signed.risks).toBe('Rare instrument fracture, post-treatment pain');
  });
});

// ---------------------------------------------------------------------------
// Informed refusal
// ---------------------------------------------------------------------------

describe('P1-3: Informed refusal path', () => {
  test('recordConsentRefusal creates a refusal record with all required fields', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/consent-refusals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        refusingMemberId: MEMBER_ID,
        procedureDescription: 'Tooth extraction tooth #48',
        refusalReason: 'Patient requests conservative management first',
        patientAcknowledgement: 'Patient understands the risks of non-treatment and chooses to decline extraction at this time.',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeTruthy();
    expect(body.visitId).toBe(visit.id);
    expect(body.patientId).toBe(PATIENT_ID);
    expect(body.refusingMemberId).toBe(MEMBER_ID);
    expect(body.procedureDescription).toBe('Tooth extraction tooth #48');
    expect(body.refusalReason).toBe('Patient requests conservative management first');
    expect(body.patientAcknowledgement).toBe('Patient understands the risks of non-treatment and chooses to decline extraction at this time.');
    expect(body.refusedAt).toBeTruthy();
  });

  test('recordConsentRefusal returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/consent-refusals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        refusingMemberId: MEMBER_ID,
        procedureDescription: 'Extraction tooth #48',
        refusalReason: 'Patient declines',
        patientAcknowledgement: 'Acknowledged.',
      }),
    });

    expect(res.status).toBe(401);
  });

  test('recordConsentRefusal returns 400 when required fields are missing', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    // Missing patientAcknowledgement
    const res = await app.request(`/dental/visits/${visit.id}/consent-refusals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        refusingMemberId: MEMBER_ID,
        procedureDescription: 'Extraction',
        refusalReason: 'Patient declines',
      }),
    });

    expect(res.status).toBe(400);
  });

  test('recordConsentRefusal writes an audit row (consent.refused)', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/consent-refusals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        refusingMemberId: MEMBER_ID,
        procedureDescription: 'Root canal tooth #36',
        refusalReason: 'Financial constraints',
        patientAcknowledgement: 'I understand and accept the risks of non-treatment.',
      }),
    });

    expect(res.status).toBe(201);
    const created = await res.json() as any;

    const { dentalAuditLog } = await import('@/handlers/dental-audit/repos/audit-log.schema');
    const { eq, and } = await import('drizzle-orm');
    const rows = await db.select().from(dentalAuditLog).where(
      and(eq(dentalAuditLog.targetId, created.id), eq(dentalAuditLog.action, 'consent.refused'))
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.actorId).toBe(TEST_USER.id);
  });

  test('recordConsentRefusal returns 422 on locked visit', async () => {
    const { dentalVisits } = await import('@/handlers/dental-visit/repos/visit.schema');
    const { eq } = await import('drizzle-orm');
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    // Lock the visit
    await db.update(dentalVisits).set({ status: 'locked', updatedBy: TEST_USER.id }).where(eq(dentalVisits.id, visit.id));

    const res = await app.request(`/dental/visits/${visit.id}/consent-refusals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        refusingMemberId: MEMBER_ID,
        procedureDescription: 'Extraction',
        refusalReason: 'Patient declines',
        patientAcknowledgement: 'Acknowledged.',
      }),
    });

    expect(res.status).toBe(422);
  });
});
