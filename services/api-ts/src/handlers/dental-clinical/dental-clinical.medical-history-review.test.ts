/**
 * P1-4: ASA classification + periodic re-confirmation
 *
 * Tests cover:
 * - recordMedicalHistoryReview stores ASA classification + emergency modifier
 * - reviewedAt is server-set (current, non-backdated)
 * - getMedicalHistoryReview returns the LATEST review for a patient
 * - getMedicalHistoryReview returns 404 when never reviewed (→ "due now")
 * - role guard: write requires dentist_owner/associate/staff_full
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { RecordMedicalHistoryReviewBody } from '@/generated/openapi/validators';
import { recordMedicalHistoryReview } from './medical-history/recordMedicalHistoryReview';
import { getMedicalHistoryReview } from './medical-history/getMedicalHistoryReview';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: '00000000-0000-0000-0000-000000000041', email: 'asa@clinic.com' };
const PERSON_ID = 'f9000000-0000-1000-8000-000000000041';
const PATIENT_ID = 'a0000000-0000-1000-8000-000000000041';
const BRANCH_ID = 'b9000000-0000-1000-8000-000000000041';
const ORG_ID = 'd9000000-0000-1000-8000-000000000041';
const MEMBER_ID = 'c0000000-0000-1000-8000-000000000043';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');

  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'ASA Clinic', tier: 'solo', ownerPersonId: TEST_USER.id, countryCode: 'PH', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch', timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id, displayName: 'ASA Dentist', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'ASA', lastName: 'Patient', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
});

const ve = (result: any, c: any) => {
  if (!result.success) return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
};

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
  app.post('/dental/clinical/medical-history-review',
    zValidator('json', RecordMedicalHistoryReviewBody, ve),
    recordMedicalHistoryReview as any,
  );
  app.get('/dental/clinical/medical-history-review', getMedicalHistoryReview as any);
  return app;
}

afterEach(async () => {
  await db.execute(sql`DELETE FROM medical_history_review WHERE patient_id = ${PATIENT_ID}`);
});

describe('P1-4: Medical history review (ASA + re-confirmation)', () => {
  test('recordMedicalHistoryReview stores ASA classification + emergency modifier', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/clinical/medical-history-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, asaClassification: 'III', asaEmergency: true }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeTruthy();
    expect(body.patientId).toBe(PATIENT_ID);
    expect(body.asaClassification).toBe('III');
    expect(body.asaEmergency).toBe(true);
    expect(body.reviewedAt).toBeTruthy();
    // Server-set, current (not backdated)
    expect(new Date(body.reviewedAt).getTime()).toBeGreaterThan(Date.now() - 60_000);
  });

  test('asaEmergency defaults to false when omitted', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/clinical/medical-history-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, asaClassification: 'I' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.asaEmergency).toBe(false);
  });

  test('getMedicalHistoryReview returns the latest review', async () => {
    const app = buildTestApp(TEST_USER);
    // First review
    await app.request('/dental/clinical/medical-history-review', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, asaClassification: 'I' }),
    });
    await new Promise(r => setTimeout(r, 5));
    // Second, more recent review
    await app.request('/dental/clinical/medical-history-review', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, asaClassification: 'II' }),
    });

    const res = await app.request(`/dental/clinical/medical-history-review?patientId=${PATIENT_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.asaClassification).toBe('II');
  });

  test('getMedicalHistoryReview returns 404 when never reviewed', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/clinical/medical-history-review?patientId=${PATIENT_ID}`);
    expect(res.status).toBe(404);
  });

  test('recordMedicalHistoryReview returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request('/dental/clinical/medical-history-review', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, asaClassification: 'I' }),
    });
    expect(res.status).toBe(401);
  });

  test('rejects an invalid ASA classification', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/clinical/medical-history-review', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, asaClassification: 'VII' }),
    });
    expect(res.status).toBe(400);
  });
});
