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

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { createConsentForm } from './createConsentForm';
import { listConsentForms } from './listConsentForms';
import { signConsentForm } from './signConsentForm';
import { createLabOrder } from './createLabOrder';
import { listLabOrders } from './listLabOrders';
import { updateLabOrder } from './updateLabOrder';

const db = createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' });

const TEST_USER = { id: '00000000-0000-0000-0000-000000000001', email: 'test@clinic.com' };
const PATIENT_ID = 'a0000000-0000-1000-8000-000000000001';
const BRANCH_ID = 'b0000000-0000-1000-8000-000000000002';
const MEMBER_ID = 'c0000000-0000-1000-8000-000000000003';
const NONEXISTENT_ID = 'ffffffff-ffff-4000-8000-ffffffffffff';

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

  app.post('/dental/visits/:visitId/consents', createConsentForm);
  app.get('/dental/visits/:visitId/consents', listConsentForms);
  app.post('/dental/visits/:visitId/consents/:consentId/sign', signConsentForm);
  app.post('/dental/visits/:visitId/lab-orders', createLabOrder);
  app.get('/dental/visits/:visitId/lab-orders', listLabOrders);
  app.patch('/dental/visits/:visitId/lab-orders/:orderId', updateLabOrder);

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
  await db.execute(
    sql`TRUNCATE TABLE amendment, consent_form, dental_attachment, lab_order, medical_history_entry, prescription, dental_treatment, dental_visit CASCADE`,
  );
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
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items).toHaveLength(0);
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
    expect(body.items).toHaveLength(1);
    expect(body.total).toBe(1);
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
    expect(body.signedAt).toBeTruthy();
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
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items).toHaveLength(0);
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
    expect(body.items).toHaveLength(1);
    expect(body.total).toBe(1);
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
        body: JSON.stringify({ status: 'inFabrication' }),
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
        body: JSON.stringify({ status: 'inFabrication' }),
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
        body: JSON.stringify({ status: 'inFabrication' }),
      },
    );

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(created.id);
    expect(body.status).toBe('inFabrication');
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
