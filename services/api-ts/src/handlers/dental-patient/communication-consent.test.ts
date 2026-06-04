/**
 * communication-consent.test.ts — P1-28 per-channel communication consent
 *
 * P1-28-AC1  GET returns default (no channels) consent for a fresh patient
 * P1-28-AC2  PATCH sets per-channel consent (partial); GET reflects it
 * P1-28-AC3  PATCH is partial — omitted channels are preserved
 * P1-28-AC4  registration consent is preserved across channel updates
 * P1-28-AC5  404 for unknown patient
 */

import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { getPatientCommunicationConsent } from './consent/getPatientCommunicationConsent';
import { updatePatientCommunicationConsent } from './consent/updatePatientCommunicationConsent';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: 'a0000000-0000-1000-8000-0000000000c9', email: 'staff@clinic.com' };
const BRANCH_ID = 'b0000000-0000-1000-8000-0000000000c9';
const ORG_ID = 'c0000000-0000-1000-8000-0000000000c9';
const PATIENT_ID = 'd0000000-0000-1000-8000-0000000000c9';
const PERSON_ID = 'e0000000-0000-1000-8000-0000000000c9';
const MISSING_PATIENT_ID = 'd9000000-0000-1000-8000-0000000000c9';

const ve = (result: any, c: any) => {
  if (!result.success) return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
};
const Params = z.object({ patientId: z.string().uuid() });
const Body = z.object({
  sms: z.boolean().optional(),
  email: z.boolean().optional(),
  phone: z.boolean().optional(),
  marketing: z.boolean().optional(),
});

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Consent Clinic', tier: 'solo', ownerPersonId: TEST_USER.id, countryCode: 'PH',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main', timezone: 'Asia/Manila',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: 'a1000000-0000-1000-8000-0000000000c9', branchId: BRANCH_ID, personId: TEST_USER.id,
    displayName: 'Dentist', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'Consent', lastName: 'Patient',
    consent: { registrationConsent: true, capturedAt: new Date().toISOString() },
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, status: 'active',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
});

afterEach(async () => {
  // Reset consent to the registration-only baseline between tests.
  const { persons } = await import('@/handlers/person/repos/person.schema');
  await db.update(persons)
    .set({ consent: { registrationConsent: true, capturedAt: new Date().toISOString() } })
    .where(eq(persons.id, PERSON_ID));
});

function buildApp() {
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
    await next();
  });
  app.get('/dental/patients/:patientId/communication-consent',
    zValidator('param', Params, ve), getPatientCommunicationConsent as any);
  app.patch('/dental/patients/:patientId/communication-consent',
    zValidator('param', Params, ve), zValidator('json', Body, ve), updatePatientCommunicationConsent as any);
  return app;
}

describe('P1-28 — per-channel communication consent', () => {
  test('P1-28-AC1: GET returns empty channels for fresh patient', async () => {
    const app = buildApp();
    const res = await app.request(`/dental/patients/${PATIENT_ID}/communication-consent`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.registrationConsent).toBe(true);
    expect(body.channels).toEqual({});
  });

  test('P1-28-AC2: PATCH sets channels; GET reflects', async () => {
    const app = buildApp();
    const patch = await app.request(`/dental/patients/${PATIENT_ID}/communication-consent`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sms: true, marketing: false }),
    });
    expect(patch.status).toBe(200);
    const res = await app.request(`/dental/patients/${PATIENT_ID}/communication-consent`);
    const body = (await res.json()) as any;
    expect(body.channels.sms).toBe(true);
    expect(body.channels.marketing).toBe(false);
    expect(body.channelsUpdatedAt).not.toBeNull();
  });

  test('P1-28-AC3: PATCH is partial — omitted channels preserved', async () => {
    const app = buildApp();
    await app.request(`/dental/patients/${PATIENT_ID}/communication-consent`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sms: true, email: true }),
    });
    await app.request(`/dental/patients/${PATIENT_ID}/communication-consent`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ marketing: true }),
    });
    const res = await app.request(`/dental/patients/${PATIENT_ID}/communication-consent`);
    const body = (await res.json()) as any;
    expect(body.channels.sms).toBe(true);
    expect(body.channels.email).toBe(true);
    expect(body.channels.marketing).toBe(true);
  });

  test('P1-28-AC4: registration consent preserved', async () => {
    const app = buildApp();
    await app.request(`/dental/patients/${PATIENT_ID}/communication-consent`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sms: true }),
    });
    const res = await app.request(`/dental/patients/${PATIENT_ID}/communication-consent`);
    expect((await res.json() as any).registrationConsent).toBe(true);
  });

  test('P1-28-AC5: unknown patient → 404', async () => {
    const app = buildApp();
    const res = await app.request(`/dental/patients/${MISSING_PATIENT_ID}/communication-consent`);
    expect(res.status).toBe(404);
  });
});
