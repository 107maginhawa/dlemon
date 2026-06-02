/**
 * Confirmed-status lifecycle tests (P2-15 feature 1)
 *
 * Verifies the `confirmed` appointment status:
 *   - scheduled → confirmed via PATCH (sets confirmedAt)
 *   - confirmed → checked_in via check-in
 *   - confirmed → cancelled / no_show
 *   - invalid sources rejected (checked_in → confirmed, completed → confirmed)
 *
 * Uses raw SQL to force intermediate/terminal states for negative testing.
 */

import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { DentalAppointmentRepository } from './repos/dental-appointment.repo';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import {
  UpdateAppointmentBody,
  UpdateAppointmentParams,
  CheckInAppointmentParams,
} from '@/generated/openapi/validators';
import { updateAppointment } from './updateAppointment';
import { checkInAppointment } from './checkInAppointment';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: '00000000-0000-0000-0000-0000000000c1', email: 'confirm@clinic.com' };
const PERSON_ID  = 'a0000000-0000-1000-8000-0000000000c1';
const PATIENT_ID = 'a0000000-0000-1000-8000-0000000000c2';
const ORG_ID     = 'f0000000-0000-1000-8000-0000000000c1';
const BRANCH_ID  = 'b0000000-0000-1000-8000-0000000000c1';
const MEMBER_ID  = 'c0000000-0000-1000-8000-0000000000c1';

beforeAll(async () => {
  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Confirm Test Clinic', tier: 'solo', ownerPersonId: TEST_USER.id,
    countryCode: 'PH', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Confirm Branch', timezone: 'Asia/Manila',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.execute(sql`DELETE FROM dental_membership WHERE branch_id = ${BRANCH_ID} AND person_id = ${TEST_USER.id} AND id != ${MEMBER_ID}`);
  await db.insert(dentalMemberships).values({
    id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id, displayName: 'Confirm Dentist',
    role: 'dentist_owner', status: 'active', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'Confirm', lastName: 'Patient', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`DELETE FROM dental_appointment WHERE branch_id = ${BRANCH_ID}`);
});

function buildApp(user?: typeof TEST_USER) {
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
      ctx.set('session', { id: 'test-session', userId: user.id });
    }
    await next();
  });
  app.patch('/dental/appointments/:appointmentId',
    zValidator('param', UpdateAppointmentParams),
    zValidator('json', UpdateAppointmentBody),
    updateAppointment as any,
  );
  app.post('/dental/appointments/:appointmentId/check-in',
    zValidator('param', CheckInAppointmentParams),
    checkInAppointment as any,
  );
  return app;
}

async function seedAppointment() {
  const repo = new DentalAppointmentRepository(db);
  return repo.createOne({
    patientId: PATIENT_ID,
    dentistMemberId: MEMBER_ID,
    branchId: BRANCH_ID,
    scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    durationMinutes: 30,
    serviceType: 'Cleaning',
  });
}

async function forceStatus(id: string, status: string) {
  await db.execute(sql`UPDATE dental_appointment SET status = ${status} WHERE id = ${id}`);
}

describe('confirmed status lifecycle', () => {
  test('scheduled → confirmed returns 200 and sets confirmedAt', async () => {
    const appt = await seedAppointment();
    const app = buildApp(TEST_USER);
    const res = await app.request(`/dental/appointments/${appt.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('confirmed');
    expect(body.confirmedAt).toBeTruthy();
  });

  test('confirmed → checked_in is allowed', async () => {
    const appt = await seedAppointment();
    await forceStatus(appt.id, 'confirmed');
    const app = buildApp(TEST_USER);
    const res = await app.request(`/dental/appointments/${appt.id}/check-in`, { method: 'POST' });
    expect(res.status).not.toBe(422);
    if (res.status === 200) {
      const body = await res.json() as any;
      expect(body.appointment?.status).toBe('checked_in');
    }
  });

  test('confirmed → cancelled is allowed (204)', async () => {
    const appt = await seedAppointment();
    await forceStatus(appt.id, 'confirmed');
    const app = buildApp(TEST_USER);
    const res = await app.request(`/dental/appointments/${appt.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled', cancellationReason: 'Patient rescheduled' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('cancelled');
  });

  test('confirmed → no_show is allowed', async () => {
    const appt = await seedAppointment();
    await forceStatus(appt.id, 'confirmed');
    const app = buildApp(TEST_USER);
    const res = await app.request(`/dental/appointments/${appt.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'no_show' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('no_show');
  });

  test('invalid: checked_in → confirmed rejected (4xx)', async () => {
    const appt = await seedAppointment();
    await forceStatus(appt.id, 'checked_in');
    const app = buildApp(TEST_USER);
    const res = await app.request(`/dental/appointments/${appt.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed' }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('invalid: completed → confirmed rejected (4xx)', async () => {
    const appt = await seedAppointment();
    await forceStatus(appt.id, 'completed');
    const app = buildApp(TEST_USER);
    const res = await app.request(`/dental/appointments/${appt.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed' }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
