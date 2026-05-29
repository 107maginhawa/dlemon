/**
 * clinical-consent-lab handler tests
 *
 * Covers:
 *   - createConsentForm  POST /dental/visits/:visitId/consents
 *   - listConsentForms   GET  /dental/visits/:visitId/consents
 *   - signConsentForm    POST /dental/visits/:visitId/consents/:consentId/sign
 *   - createLabOrder     POST /dental/visits/:visitId/lab-orders
 *   - listLabOrders      GET  /dental/visits/:visitId/lab-orders
 *   - updateLabOrder     PATCH /dental/visits/:visitId/lab-orders/:orderId
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
  CreateLabOrderBody, CreateLabOrderParams,
  UpdateLabOrderBody, UpdateLabOrderParams,
} from '@/generated/openapi/validators';
import { createConsentForm } from './consent/createConsentForm';
import { listConsentForms } from './consent/listConsentForms';
import { signConsentForm } from './consent/signConsentForm';
import { revokeConsentForm } from './consent/revokeConsentForm';
import { createLabOrder } from './lab-orders/createLabOrder';
import { listLabOrders } from './lab-orders/listLabOrders';
import { updateLabOrder } from './lab-orders/updateLabOrder';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: '00000000-0000-0000-0000-000000000001', email: 'test@clinic.com' };
const PERSON_ID  = 'e0000000-0000-1000-8000-000000000003';
const PATIENT_ID = 'a0000000-0000-1000-8000-000000000001';
const BRANCH_ID  = 'b0000000-0000-1000-8000-000000000002';
const ORG_ID     = 'd1000000-0000-1000-8000-000000000002';
const MEMBER_ID  = 'c0000000-0000-1000-8000-000000000003';
const NONEXISTENT_ID = 'ffffffff-ffff-4000-8000-ffffffffffff';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'ConsentLab Clinic', tier: 'solo',
    ownerPersonId: TEST_USER.id, countryCode: 'PH',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch',
    timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.execute(
    sql`DELETE FROM dental_membership WHERE branch_id = ${BRANCH_ID} AND id != ${MEMBER_ID}`,
  );
  await db.insert(dentalMemberships).values({
    id: MEMBER_ID, branchId: BRANCH_ID,
    personId: TEST_USER.id, displayName: 'Test User', role: 'dentist_owner',
    status: 'active', pinFailedAttempts: 0,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');
  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'Test', lastName: 'Patient',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
});

const ve = (result: any, c: any) => {
  if (!result.success) return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
};

const ConsentBodyOnly = CreateConsentFormBody.omit({ visitId: true });
const LabOrderBodyOnly = CreateLabOrderBody.omit({ visitId: true });

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
    if (user) {
      ctx.set('user', user);
      ctx.set('session', { id: 'test-session' });
    }
    await next();
  });

  app.post('/dental/visits/:visitId/consents',
    zValidator('param', CreateConsentFormParams, ve),
    zValidator('json', ConsentBodyOnly, ve),
    createConsentForm as any,
  );
  app.get('/dental/visits/:visitId/consents', listConsentForms);
  app.post('/dental/visits/:visitId/consents/:consentId/sign',
    zValidator('param', SignConsentFormParams, ve),
    zValidator('json', SignConsentFormBody, ve),
    signConsentForm as any,
  );
  app.patch('/dental/visits/:visitId/consents/:cid/revoke', revokeConsentForm as any);
  app.post('/dental/visits/:visitId/lab-orders',
    zValidator('param', CreateLabOrderParams, ve),
    zValidator('json', LabOrderBodyOnly, ve),
    createLabOrder as any,
  );
  app.get('/dental/visits/:visitId/lab-orders', listLabOrders);
  app.patch('/dental/visits/:visitId/lab-orders/:orderId',
    zValidator('param', UpdateLabOrderParams, ve),
    zValidator('json', UpdateLabOrderBody, ve),
    updateLabOrder as any,
  );

  return app;
}

async function seedVisit() {
  const { VisitRepository } = await import('@/handlers/dental-visit/repos/visit.repo');
  const visitRepo = new VisitRepository(db);
  const visit = await visitRepo.createOne({
    patientId: PATIENT_ID,
    branchId: BRANCH_ID,
    dentistMemberId: MEMBER_ID,
  });
  return visit;
}

afterEach(async () => {
  // Scoped deletes (visit-children first, then visits, then patient-direct) to avoid
  // racing with other test files that use a global TRUNCATE — TRUNCATE wipes ALL
  // patients' rows and breaks parallel suites sharing the same tables.
  const visitIds = sql`(SELECT id FROM dental_visit WHERE patient_id = ${PATIENT_ID})`;
  await db.execute(sql`DELETE FROM amendment        WHERE visit_id IN ${visitIds}`);
  await db.execute(sql`DELETE FROM consent_form     WHERE visit_id IN ${visitIds}`);
  await db.execute(sql`DELETE FROM dental_attachment WHERE visit_id IN ${visitIds}`);
  await db.execute(sql`DELETE FROM lab_order        WHERE visit_id IN ${visitIds}`);
  await db.execute(sql`DELETE FROM prescription     WHERE visit_id IN ${visitIds}`);
  await db.execute(sql`DELETE FROM dental_treatment WHERE visit_id IN ${visitIds}`);
  await db.execute(sql`DELETE FROM medical_history_entry WHERE patient_id = ${PATIENT_ID}`);
  await db.execute(sql`DELETE FROM dental_visit     WHERE patient_id = ${PATIENT_ID}`);
  // Note: dental_membership, dental_branch, dental_organization are seeded once in beforeAll and NOT cleaned here
});

// ---------------------------------------------------------------------------
// createConsentForm
// ---------------------------------------------------------------------------

describe('createConsentForm handler', () => {
  test('returns 401 when user is not authenticated', async () => {
    const app = buildTestApp(undefined);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/consents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        templateId: 'tpl-001',
        templateName: 'General Treatment Consent',
      }),
    });

    expect(res.status).toBe(401);
  });

  test('returns 400 when patientId is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/consents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateId: 'tpl-001',
        templateName: 'General Treatment Consent',
      }),
    });

    expect(res.status).toBe(400);
  });

  test('returns 400 when templateId is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/consents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        templateName: 'General Treatment Consent',
      }),
    });

    expect(res.status).toBe(400);
  });

  test('returns 400 when templateName is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/consents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        templateId: 'tpl-001',
      }),
    });

    expect(res.status).toBe(400);
  });

  test('returns 201 with created consent form on valid input', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/consents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        templateId: 'tpl-extraction-001',
        templateName: 'Tooth Extraction Consent',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeTruthy();
    expect(body.visitId).toBe(visit.id);
    expect(body.templateId).toBe('tpl-extraction-001');
    expect(body.templateName).toBe('Tooth Extraction Consent');
    expect(body.signed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// listConsentForms
// ---------------------------------------------------------------------------

describe('listConsentForms handler', () => {
  test('returns 401 when user is not authenticated', async () => {
    const app = buildTestApp(undefined);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/consents`);

    expect(res.status).toBe(401);
  });

  test('returns 200 with empty items array for a new visit', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/consents`);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(0);
  });

  test('returns 200 with seeded consent forms', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    await app.request(`/dental/visits/${visit.id}/consents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        templateId: 'tpl-anesthesia-001',
        templateName: 'Anesthesia Consent',
      }),
    });

    const res = await app.request(`/dental/visits/${visit.id}/consents`);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toHaveLength(1);
    expect(body.pagination.totalCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// signConsentForm
// ---------------------------------------------------------------------------

describe('signConsentForm handler', () => {
  test('returns 401 when user is not authenticated', async () => {
    const app = buildTestApp(undefined);
    const visit = await seedVisit();

    const res = await app.request(
      `/dental/visits/${visit.id}/consents/${NONEXISTENT_ID}/sign`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureData: 'data:image/png;base64,abc123' }),
      },
    );

    expect(res.status).toBe(401);
  });

  test('returns 404 when consent form does not exist', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(
      `/dental/visits/${visit.id}/consents/${NONEXISTENT_ID}/sign`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureData: 'data:image/png;base64,abc123' }),
      },
    );

    expect(res.status).toBe(404);
  });

  test('returns 400 when signatureData is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    // Create a consent form first
    const createRes = await app.request(`/dental/visits/${visit.id}/consents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        templateId: 'tpl-001',
        templateName: 'Treatment Consent',
      }),
    });
    const created = await createRes.json() as any;

    const res = await app.request(
      `/dental/visits/${visit.id}/consents/${created.id}/sign`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
    );

    expect(res.status).toBe(400);
  });

  test('returns 200 with signed consent form on valid input', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const createRes = await app.request(`/dental/visits/${visit.id}/consents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        templateId: 'tpl-implant-001',
        templateName: 'Implant Surgery Consent',
      }),
    });
    const created = await createRes.json() as any;

    const signRes = await app.request(
      `/dental/visits/${visit.id}/consents/${created.id}/sign`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureData: 'data:image/png;base64,SIGNATUREHERE' }),
      },
    );

    expect(signRes.status).toBe(200);
    const body = await signRes.json() as any;
    expect(body.id).toBe(created.id);
    expect(body.signed).toBe(true);
    expect(body.signatureData).toBe('data:image/png;base64,SIGNATUREHERE');
    expect(body.signedAt).not.toBeNull();
  });

  test('returns 400 when trying to sign an already-signed consent form', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const createRes = await app.request(`/dental/visits/${visit.id}/consents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        templateId: 'tpl-001',
        templateName: 'General Consent',
      }),
    });
    const created = await createRes.json() as any;

    // Sign once
    await app.request(
      `/dental/visits/${visit.id}/consents/${created.id}/sign`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureData: 'data:image/png;base64,FIRSTSIGNATURE' }),
      },
    );

    // Sign again — should fail
    const secondSign = await app.request(
      `/dental/visits/${visit.id}/consents/${created.id}/sign`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureData: 'data:image/png;base64,SECONDSIGNATURE' }),
      },
    );

    expect(secondSign.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// createLabOrder
// ---------------------------------------------------------------------------

describe('createLabOrder handler', () => {
  test('returns 401 when user is not authenticated', async () => {
    const app = buildTestApp(undefined);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/lab-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        labName: 'Precision Dental Lab',
        description: 'Full porcelain crown #14',
      }),
    });

    expect(res.status).toBe(401);
  });

  test('returns 400 when patientId is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/lab-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        labName: 'Precision Dental Lab',
        description: 'Full porcelain crown #14',
      }),
    });

    expect(res.status).toBe(400);
  });

  test('returns 400 when labName is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/lab-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        description: 'Full porcelain crown #14',
      }),
    });

    expect(res.status).toBe(400);
  });

  test('returns 400 when description is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/lab-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        labName: 'Precision Dental Lab',
      }),
    });

    expect(res.status).toBe(400);
  });

  test('returns 201 with created lab order on valid input', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/lab-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        labName: 'Elite Ceramics Lab',
        description: 'Zirconia crown tooth #36',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeTruthy();
    expect(body.visitId).toBe(visit.id);
    expect(body.labName).toBe('Elite Ceramics Lab');
    expect(body.status).toBe('ordered');
  });
});

// ---------------------------------------------------------------------------
// listLabOrders
// ---------------------------------------------------------------------------

describe('listLabOrders handler', () => {
  test('returns 401 when user is not authenticated', async () => {
    const app = buildTestApp(undefined);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/lab-orders`);

    expect(res.status).toBe(401);
  });

  test('returns 200 with empty items array for a new visit', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/lab-orders`);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(0);
  });

  test('returns 200 with seeded lab orders', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    await app.request(`/dental/visits/${visit.id}/lab-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        labName: 'Smile Lab Co',
        description: 'Partial denture',
      }),
    });

    const res = await app.request(`/dental/visits/${visit.id}/lab-orders`);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toHaveLength(1);
    expect(body.pagination.totalCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// updateLabOrder
// ---------------------------------------------------------------------------

describe('updateLabOrder handler', () => {
  test('returns 401 when user is not authenticated', async () => {
    const app = buildTestApp(undefined);
    const visit = await seedVisit();

    const res = await app.request(
      `/dental/visits/${visit.id}/lab-orders/${NONEXISTENT_ID}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_fabrication' }),
      },
    );

    expect(res.status).toBe(401);
  });

  test('returns 404 when lab order does not exist', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(
      `/dental/visits/${visit.id}/lab-orders/${NONEXISTENT_ID}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_fabrication' }),
      },
    );

    expect(res.status).toBe(404);
  });

  test('returns 400 when status transition is invalid', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    // Create a lab order (starts as 'ordered')
    const createRes = await app.request(`/dental/visits/${visit.id}/lab-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        labName: 'Crown Lab',
        description: 'PFM crown',
      }),
    });
    const created = await createRes.json() as any;

    // Cannot jump from 'ordered' to 'fitted'
    const res = await app.request(
      `/dental/visits/${visit.id}/lab-orders/${created.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'fitted' }),
      },
    );

    expect(res.status).toBe(400);
  });

  test('returns 400 when status value is unknown', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const createRes = await app.request(`/dental/visits/${visit.id}/lab-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        labName: 'Crown Lab',
        description: 'PFM crown',
      }),
    });
    const created = await createRes.json() as any;

    const res = await app.request(
      `/dental/visits/${visit.id}/lab-orders/${created.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'shipped' }),
      },
    );

    expect(res.status).toBe(400);
  });

  test('returns 200 with updated lab order on valid status transition', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const createRes = await app.request(`/dental/visits/${visit.id}/lab-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        labName: 'Crown Lab',
        description: 'Emax crown tooth #21',
      }),
    });
    const created = await createRes.json() as any;

    const res = await app.request(
      `/dental/visits/${visit.id}/lab-orders/${created.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_fabrication' }),
      },
    );

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(created.id);
    expect(body.status).toBe('in_fabrication');
  });

  test('returns 200 when updating non-status fields', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const createRes = await app.request(`/dental/visits/${visit.id}/lab-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        labName: 'Crown Lab',
        description: 'Emax crown',
      }),
    });
    const created = await createRes.json() as any;

    const res = await app.request(
      `/dental/visits/${visit.id}/lab-orders/${created.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefective: true }),
      },
    );

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.isDefective).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// revokeConsentForm (EM-CLI-001)
// ---------------------------------------------------------------------------

describe('revokeConsentForm handler', () => {
  test('returns 401 when user is not authenticated', async () => {
    const app = buildTestApp(undefined);
    const visit = await seedVisit();

    const res = await app.request(
      `/dental/visits/${visit.id}/consents/${NONEXISTENT_ID}/revoke`,
      { method: 'PATCH' },
    );

    expect(res.status).toBe(401);
  });

  test('returns 404 when consent form does not exist', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(
      `/dental/visits/${visit.id}/consents/${NONEXISTENT_ID}/revoke`,
      { method: 'PATCH' },
    );

    expect(res.status).toBe(404);
  });

  test('returns 200 with revoked consent form on valid request', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    // Create a consent form first
    const createRes = await app.request(`/dental/visits/${visit.id}/consents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        templateId: 'tpl-revoke-001',
        templateName: 'Revocable Consent',
      }),
    });
    const created = await createRes.json() as any;
    expect(createRes.status).toBe(201);

    const revokeRes = await app.request(
      `/dental/visits/${visit.id}/consents/${created.id}/revoke`,
      { method: 'PATCH' },
    );

    expect(revokeRes.status).toBe(200);
    const body = await revokeRes.json() as any;
    expect(body.id).toBe(created.id);
    expect(body.revoked).toBe(true);
    expect(body.revokedAt).not.toBeNull();
    expect(body.revokedBy).toBe(TEST_USER.id);
  });

  test('returns 409 when consent form is already revoked', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    // Create and revoke once
    const createRes = await app.request(`/dental/visits/${visit.id}/consents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        templateId: 'tpl-revoke-002',
        templateName: 'Revocable Consent 2',
      }),
    });
    const created = await createRes.json() as any;

    // Revoke once
    await app.request(
      `/dental/visits/${visit.id}/consents/${created.id}/revoke`,
      { method: 'PATCH' },
    );

    // Revoke again — should conflict
    const secondRevoke = await app.request(
      `/dental/visits/${visit.id}/consents/${created.id}/revoke`,
      { method: 'PATCH' },
    );

    expect(secondRevoke.status).toBe(409);
  });
});
