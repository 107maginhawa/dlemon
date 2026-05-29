/**
 * dental-scheduling handler tests
 *
 * Tests HTTP-level behavior: auth, validation, 201/200/204 on success, 404 not found,
 * and state transitions (checkIn, cancel).
 *
 * Handlers use ctx.req.valid() so the test app wires zValidator middleware
 * matching the generated route registration.
 */

import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AppError } from '@/core/errors';
import { DentalAuditRepository } from '@/db/audit.repo';
import { createDatabase } from '@/core/database';
import { DentalAppointmentRepository } from './repos/dental-appointment.repo';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import {
  CreateAppointmentBody,
  ListAppointmentsQuery,
  GetAppointmentParams,
  UpdateAppointmentBody,
  UpdateAppointmentParams,
  CancelAppointmentParams,
  CheckInAppointmentParams,
} from '@/generated/openapi/validators';

import { createAppointment } from './createAppointment';
import { getAppointment } from './getAppointment';
import { listAppointments } from './listAppointments';
import { updateAppointment } from './updateAppointment';
import { checkInAppointment } from './checkInAppointment';
import { cancelAppointment } from './cancelAppointment';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique BRANCH_ID + membership ids (tag a03) break the cross-suite
// collision on dental_membership's (person_id, branch_id) partial unique index.
// Org/patient/person ids stay at their original deterministic values so
// onConflictDoNothing is a correct no-op against rows from prior runs.
const TEST_USER = { id: '00000000-0000-0000-0000-000000000001', email: 'test@clinic.com' };
const PATIENT_ID = 'a0000000-0000-1000-8000-000000000001';
const PERSON_ID = 'e0000000-0000-1000-8000-000000000001';
const PATIENT_2 = 'a0000000-0000-1000-8000-000000000002';
const PERSON_ID_2 = 'e0000000-0000-1000-8000-000000000002';
const ORG_ID = 'f0000000-0000-1000-8000-000000000000';
const BRANCH_ID = '7b000000-0000-4000-8000-000000000a03';
const MEMBER_ID = '7c000000-0000-4000-8000-000000000a03';
const DENTIST_2_MEMBER_ID = '7c000000-0000-4000-8000-000000000c03';
const DENTIST_2_PERSON_ID = 'e0000000-0000-1000-8000-000000000099';
const NONEXISTENT_ID = 'ffffffff-ffff-1000-8000-ffffffffffff';

// Seed org + branch + membership once so assertBranchAccess passes for TEST_USER + BRANCH_ID
beforeAll(async () => {
  await db.insert(dentalOrganizations).values({
    id: ORG_ID,
    name: 'DentalScheduling Clinic',
    tier: 'solo',
    ownerPersonId: TEST_USER.id,
    countryCode: 'PH',
    createdBy: TEST_USER.id,
    updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalBranches).values({
    id: BRANCH_ID,
    organizationId: ORG_ID,
    name: 'Main Branch',
    timezone: 'Asia/Manila',
    createdBy: TEST_USER.id,
    updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalMemberships).values({
    id: MEMBER_ID,
    branchId: BRANCH_ID,
    personId: TEST_USER.id,
    displayName: 'Test Dentist',
    role: 'dentist_owner',
    status: 'active',
    createdBy: TEST_USER.id,
    updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(persons).values({ id: PERSON_ID, firstName: 'Test', lastName: 'Patient', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID_2, firstName: 'Test', lastName: 'Patient2', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_2, person: PERSON_ID_2, preferredBranchId: BRANCH_ID, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();

  // Second dentist for FR3.7 double-booking test
  await db.insert(persons).values({ id: DENTIST_2_PERSON_ID, firstName: 'Dentist', lastName: 'Two', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: DENTIST_2_MEMBER_ID,
    branchId: BRANCH_ID,
    personId: DENTIST_2_PERSON_ID,
    displayName: 'Dentist Two',
    role: 'dentist_associate',
    status: 'active',
    createdBy: TEST_USER.id,
    updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
});

function buildTestApp(user?: typeof TEST_USER) {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
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

  // Wire zValidator to match generated route registration (handlers use ctx.req.valid())
  app.post('/dental/appointments', zValidator('json', CreateAppointmentBody), createAppointment as any);
  app.get('/dental/appointments', zValidator('query', ListAppointmentsQuery), listAppointments as any);
  app.get('/dental/appointments/:appointmentId', zValidator('param', GetAppointmentParams), getAppointment as any);
  app.patch('/dental/appointments/:appointmentId',
    zValidator('param', UpdateAppointmentParams),
    zValidator('json', UpdateAppointmentBody),
    updateAppointment as any,
  );
  app.delete('/dental/appointments/:appointmentId', zValidator('param', CancelAppointmentParams), cancelAppointment as any);
  app.post('/dental/appointments/:appointmentId/check-in', zValidator('param', CheckInAppointmentParams), checkInAppointment as any);

  return app;
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

const FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const FUTURE_END = new Date(new Date(FUTURE_DATE).getTime() + 30 * 60 * 1000).toISOString();

// Canonical wire request shape (V-SCH-006/007): providerId/startAt/endAt/visitType.
const VALID_APPOINTMENT_BODY = {
  patientId: PATIENT_ID,
  providerId: MEMBER_ID,
  branchId: BRANCH_ID,
  startAt: FUTURE_DATE,
  endAt: FUTURE_END,
  visitType: 'checkup',
};

async function seedAppointment() {
  const repo = new DentalAppointmentRepository(db);
  const appt = await repo.createOne({
    patientId: PATIENT_ID,
    dentistMemberId: MEMBER_ID,
    branchId: BRANCH_ID,
    scheduledAt: new Date(FUTURE_DATE),
    durationMinutes: 30,
    serviceType: 'Cleaning',
  });
  return appt;
}

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

afterEach(async () => {
  await db.execute(sql`DELETE FROM dental_appointment`);
  await db.execute(sql`DELETE FROM dental_visit`);
});

// ===========================================================================
// createAppointment
// ===========================================================================

describe('createAppointment handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request('/dental/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_APPOINTMENT_BODY),
    });
    expect(res.status).toBe(401);
  });

  test('returns 400 when patientId is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const { patientId: _omit, ...withoutPatient } = VALID_APPOINTMENT_BODY;
    const res = await app.request('/dental/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withoutPatient),
    });
    expect(res.status).toBe(400);
  });

  test('returns 400 when providerId is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const { providerId: _omit, ...withoutDentist } = VALID_APPOINTMENT_BODY;
    const res = await app.request('/dental/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withoutDentist),
    });
    expect(res.status).toBe(400);
  });

  test('returns 400 when branchId is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const { branchId: _omit, ...withoutBranch } = VALID_APPOINTMENT_BODY;
    const res = await app.request('/dental/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withoutBranch),
    });
    expect(res.status).toBe(400);
  });

  test('returns 400 when startAt is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const { startAt: _omit, ...withoutDate } = VALID_APPOINTMENT_BODY;
    const res = await app.request('/dental/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withoutDate),
    });
    expect(res.status).toBe(400);
  });

  test('returns 400 when endAt is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const { endAt: _omit, ...withoutEnd } = VALID_APPOINTMENT_BODY;
    const res = await app.request('/dental/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withoutEnd),
    });
    expect(res.status).toBe(400);
  });

  test('returns 400 when visitType is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const { visitType: _omit, ...withoutProcedure } = VALID_APPOINTMENT_BODY;
    const res = await app.request('/dental/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withoutProcedure),
    });
    expect(res.status).toBe(400);
  });

  test('V-SCH-008: returns 400 when endAt is not after startAt', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_APPOINTMENT_BODY, endAt: VALID_APPOINTMENT_BODY.startAt }),
    });
    expect(res.status).toBe(400);
  });

  test('V-SCH-007: returns 400 when visitType is not in enum', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_APPOINTMENT_BODY, visitType: 'not-a-real-type' }),
    });
    expect(res.status).toBe(400);
  });

  test('returns 201 with created appointment on valid input', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_APPOINTMENT_BODY),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeTruthy();
    expect(body.patientId).toBe(PATIENT_ID);
    expect(body.providerId).toBe(MEMBER_ID);
    expect(body.branchId).toBe(BRANCH_ID);
    expect(body.status).toBe('scheduled');
    expect(body.visitType).toBe('checkup');
    expect(body.startAt).toBeTruthy();
    expect(body.endAt).toBeTruthy();
  });

  test('returns 201 with walkIn flag when walkIn is true', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_APPOINTMENT_BODY, walkIn: true }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.walkIn).toBe(true);
  });
});

// ===========================================================================
// getAppointment
// ===========================================================================

describe('getAppointment handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/appointments/${NONEXISTENT_ID}`);
    expect(res.status).toBe(401);
  });

  test('returns 404 when appointment not found', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/appointments/${NONEXISTENT_ID}`);
    expect(res.status).toBe(404);
  });

  test('returns 200 with appointment on success', async () => {
    const appt = await seedAppointment();
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/appointments/${appt.id}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(appt.id);
    expect(body.patientId).toBe(PATIENT_ID);
    expect(body.status).toBe('scheduled');
  });
});

// ===========================================================================
// listAppointments
// ===========================================================================

describe('listAppointments handler', () => {
  // V-SCH-004: branchId + date_from/date_to are required calendar-window params.
  const RANGE_FROM = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const RANGE_TO = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const LIST_QS = `branchId=${BRANCH_ID}&date_from=${RANGE_FROM}&date_to=${RANGE_TO}`;

  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/appointments?${LIST_QS}`);
    expect(res.status).toBe(401);
  });

  test('V-SCH-004: returns 400 when date_from/date_to missing', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/appointments?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(400);
  });

  test('V-SCH-004: returns 400 when range exceeds 31 days', async () => {
    const app = buildTestApp(TEST_USER);
    const farTo = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const res = await app.request(`/dental/appointments?branchId=${BRANCH_ID}&date_from=${RANGE_FROM}&date_to=${farTo}`);
    expect(res.status).toBe(400);
  });

  test('returns 200 with empty array when no appointments', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/appointments?${LIST_QS}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(0);
  });

  test('returns 200 with list of appointments', async () => {
    await seedAppointment();
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/appointments?${LIST_QS}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  test('filters appointments by branchId', async () => {
    await seedAppointment();
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/appointments?${LIST_QS}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.every((a: any) => a.branchId === BRANCH_ID)).toBe(true);
  });

  test('filters appointments by status', async () => {
    await seedAppointment();
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/appointments?${LIST_QS}&status=scheduled`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.every((a: any) => a.status === 'scheduled')).toBe(true);
  });

  test('V-SCH-004: paginates via page/per_page', async () => {
    await seedAppointment();
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/appointments?${LIST_QS}&page=1&per_page=10`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body)).toBe(true);
  });
});

// ===========================================================================
// updateAppointment
// ===========================================================================

describe('updateAppointment handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/appointments/${NONEXISTENT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'Updated' }),
    });
    expect(res.status).toBe(401);
  });

  test('returns 404 when appointment not found', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/appointments/${NONEXISTENT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'Updated' }),
    });
    expect(res.status).toBe(404);
  });

  test('returns 200 with updated notes', async () => {
    const appt = await seedAppointment();
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/appointments/${appt.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'Patient is allergic to latex' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.notes).toBe('Patient is allergic to latex');
  });

  test('marks appointment as noShow', async () => {
    const appt = await seedAppointment();
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/appointments/${appt.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'no_show' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('no_show');
    expect(body.noShowAt).not.toBeNull();
  });

  test('updates visitType', async () => {
    const appt = await seedAppointment();
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/appointments/${appt.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitType: 'treatment' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.visitType).toBe('treatment');
  });
});

// ===========================================================================
// checkInAppointment
// ===========================================================================

describe('checkInAppointment handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/appointments/${NONEXISTENT_ID}/check-in`, {
      method: 'POST',
    });
    expect(res.status).toBe(401);
  });

  test('returns 404 when appointment not found', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/appointments/${NONEXISTENT_ID}/check-in`, {
      method: 'POST',
    });
    expect(res.status).toBe(404);
  });

  test('returns 200 with appointment status checkedIn and visitId', async () => {
    const appt = await seedAppointment();
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/appointments/${appt.id}/check-in`, {
      method: 'POST',
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.appointment).not.toBeNull();
    expect(body.appointment.status).toBe('checked_in');
    expect(body.appointment.checkInTime).not.toBeNull();
    expect(body.visitId).not.toBeNull();
  });

  test('returns error when appointment is not in scheduled status', async () => {
    const appt = await seedAppointment();
    const repo = new DentalAppointmentRepository(db);
    await repo.cancel(appt.id);

    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/appointments/${appt.id}/check-in`, {
      method: 'POST',
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('links visitId back to appointment after check-in', async () => {
    const appt = await seedAppointment();
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/appointments/${appt.id}/check-in`, {
      method: 'POST',
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;

    // Verify the appointment now has a visitId
    const repo = new DentalAppointmentRepository(db);
    const updated = await repo.findOneById(appt.id);
    expect(updated!.visitId).toBe(body.visitId);
  });
});

// ===========================================================================
// cancelAppointment
// ===========================================================================

describe('cancelAppointment handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/appointments/${NONEXISTENT_ID}`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(401);
  });

  test('returns 404 when appointment not found', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/appointments/${NONEXISTENT_ID}`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(404);
  });

  test('returns 204 and appointment is cancelled', async () => {
    const appt = await seedAppointment();
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/appointments/${appt.id}?reason=${encodeURIComponent('Test cancellation')}`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(204);

    // Verify appointment is now cancelled
    const repo = new DentalAppointmentRepository(db);
    const updated = await repo.findOneById(appt.id);
    expect(updated!.status).toBe('cancelled');
    expect(updated!.cancelledAt).not.toBeNull();
  });

  test('V-SCH-003: returns 422 when reason is missing/too short', async () => {
    const appt = await seedAppointment();
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/appointments/${appt.id}?reason=hi`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(422);
  });
});

// ===========================================================================
// FR3.7: Double-booking warning (non-blocking)
// ===========================================================================

describe('FR3.7: double-booking warning', () => {
  test('returns 201 with empty warnings when no overlap exists', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_APPOINTMENT_BODY),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(Array.isArray(body.warnings)).toBe(true);
    expect(body.warnings).toHaveLength(0);
  });

  test('returns 201 with DOUBLE_BOOKING warning when same dentist has overlapping appointment', async () => {
    // Seed an existing appointment at the same time
    await seedAppointment();

    const app = buildTestApp(TEST_USER);
    // Create another appointment at the same time for the same dentist + branch
    const res = await app.request('/dental/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_APPOINTMENT_BODY),
    });
    // Still creates (non-blocking)
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.warnings).toContain('DOUBLE_BOOKING');
  });

  test('no double-booking warning when dentist is different', async () => {
    await seedAppointment();
    const app = buildTestApp(TEST_USER);

    const res = await app.request('/dental/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_APPOINTMENT_BODY, providerId: DENTIST_2_MEMBER_ID }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.warnings).toHaveLength(0);
  });
});

// ===========================================================================
// EC7: Max 1 active visit per patient at check-in
// ===========================================================================

describe('EC7: max one active visit per patient', () => {
  test('returns 409 when patient already has an in-progress visit at check-in', async () => {
    // Create first appointment and check it in (creates draft visit)
    const appt1 = await seedAppointment();
    const app = buildTestApp(TEST_USER);

    const firstCheckIn = await app.request(`/dental/appointments/${appt1.id}/check-in`, {
      method: 'POST',
    });
    expect(firstCheckIn.status).toBe(200);

    // Seed a second appointment for the same patient
    const repo = new DentalAppointmentRepository(db);
    const appt2 = await repo.createOne({
      patientId: PATIENT_ID, // same patient
      dentistMemberId: MEMBER_ID,
      branchId: BRANCH_ID,
      scheduledAt: new Date(FUTURE_DATE),
      durationMinutes: 30,
      serviceType: 'Follow-Up',
    });

    // Try to check in the second appointment — should fail (EC7)
    const secondCheckIn = await app.request(`/dental/appointments/${appt2.id}/check-in`, {
      method: 'POST',
    });
    expect(secondCheckIn.status).toBe(409);
    const body = await secondCheckIn.json() as any;
    expect(body.error).toMatch(/visit already active/i);
  });

  test('appointment stays in scheduled status when check-in fails due to existing visit (race condition fix)', async () => {
    const appt1 = await seedAppointment();
    const app = buildTestApp(TEST_USER);

    // Check in first appointment to create an active visit
    await app.request(`/dental/appointments/${appt1.id}/check-in`, { method: 'POST' });

    const repo = new DentalAppointmentRepository(db);
    const appt2 = await repo.createOne({
      patientId: PATIENT_ID,
      dentistMemberId: MEMBER_ID,
      branchId: BRANCH_ID,
      scheduledAt: new Date(FUTURE_DATE),
      durationMinutes: 30,
      serviceType: 'Follow-Up',
    });

    // Second check-in should fail
    const res = await app.request(`/dental/appointments/${appt2.id}/check-in`, { method: 'POST' });
    expect(res.status).toBe(409);

    // Verify appt2 is still 'scheduled', NOT stuck in 'checked_in' (race condition fix)
    const updated = await repo.findOneById(appt2.id);
    expect(updated!.status).toBe('scheduled');
  });
});

// ===========================================================================
// Status transition guards
// ===========================================================================

describe('status transition guards', () => {
  test('cannot cancel a completed appointment (via PATCH status=cancelled)', async () => {
    const appt = await seedAppointment();
    const repo = new DentalAppointmentRepository(db);
    // Manually set to completed via DB (no direct endpoint for this)
    await db.execute(sql`UPDATE dental_appointment SET status = 'completed' WHERE id = ${appt.id}`);

    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/appointments/${appt.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    // cancel() guard returns null -> NotFoundError or similar non-2xx
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('cannot mark noShow on a cancelled appointment', async () => {
    const appt = await seedAppointment();
    const app = buildTestApp(TEST_USER);

    // Cancel first
    await app.request(`/dental/appointments/${appt.id}?reason=${encodeURIComponent('Test cancellation')}`, {
      method: 'DELETE',
    });

    // Now attempt noShow
    const res = await app.request(`/dental/appointments/${appt.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'no_show' }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('revertNoShow: noShow appointment can be reverted to completed', async () => {
    const appt = await seedAppointment();
    const app = buildTestApp(TEST_USER);

    // Mark as noShow first
    const noShowRes = await app.request(`/dental/appointments/${appt.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'no_show' }),
    });
    expect(noShowRes.status).toBe(200);

    // Revert to completed
    const revertRes = await app.request(`/dental/appointments/${appt.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    expect(revertRes.status).toBe(200);
    const body = await revertRes.json() as any;
    expect(body.status).toBe('completed');
    expect(body.noShowAt).toBeNull();
  });

  test('generic PATCH cannot set arbitrary status (status field is ignored)', async () => {
    const appt = await seedAppointment();
    const app = buildTestApp(TEST_USER);

    // Attempt to set to 'checked_in' directly via notes+status patch
    // Since 'checked_in' doesn't match any transition branch in the handler,
    // it falls through to generic patch which no longer passes status
    const res = await app.request(`/dental/appointments/${appt.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'test', status: 'checked_in' }),
    });
    // Should succeed (notes update) but status should NOT change to checkedIn
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('scheduled'); // unchanged
    expect(body.notes).toBe('test');
  });
});

// ===========================================================================
// Cancellation reason
// ===========================================================================

describe('cancellationReason', () => {
  test('stores reason from query param when cancelled via DELETE', async () => {
    const appt = await seedAppointment();
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/appointments/${appt.id}?reason=${encodeURIComponent('Patient request')}`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(204);

    const repo = new DentalAppointmentRepository(db);
    const updated = await repo.findOneById(appt.id);
    expect(updated!.cancellationReason).toBe('Patient request');
  });
});

// ===========================================================================
// Audit trail
// ===========================================================================

describe('audit trail', () => {
  test('createdBy is set to user.id on create', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_APPOINTMENT_BODY),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;

    const repo = new DentalAppointmentRepository(db);
    const appt = await repo.findOneById(body.id);
    expect(appt!.createdBy).toBe(TEST_USER.id);
  });

  test('updatedBy is set to user.id on cancel', async () => {
    const appt = await seedAppointment();
    const app = buildTestApp(TEST_USER);

    await app.request(`/dental/appointments/${appt.id}?reason=${encodeURIComponent('Test cancellation')}`, {
      method: 'DELETE',
    });

    const repo = new DentalAppointmentRepository(db);
    const updated = await repo.findOneById(appt.id);
    expect(updated!.updatedBy).toBe(TEST_USER.id);
  });
});

// ===========================================================================
// Pagination
// ===========================================================================

describe('pagination on listAppointments', () => {
  const RANGE_FROM = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const RANGE_TO = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const BASE_QS = `branchId=${BRANCH_ID}&date_from=${RANGE_FROM}&date_to=${RANGE_TO}`;

  function seedN(repo: DentalAppointmentRepository, n: number) {
    const work: Promise<unknown>[] = [];
    for (let i = 0; i < n; i++) {
      work.push(repo.createOne({
        patientId: PATIENT_ID,
        dentistMemberId: MEMBER_ID,
        branchId: BRANCH_ID,
        scheduledAt: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000),
        durationMinutes: 30,
        serviceType: 'checkup',
      }));
    }
    return Promise.all(work);
  }

  test('returns at most per_page appointments', async () => {
    const repo = new DentalAppointmentRepository(db);
    await seedN(repo, 3);

    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/appointments?${BASE_QS}&per_page=2`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.length).toBeLessThanOrEqual(2);
  });

  test('page skips earlier results', async () => {
    const repo = new DentalAppointmentRepository(db);
    await seedN(repo, 3);

    const app = buildTestApp(TEST_USER);
    const res1 = await app.request(`/dental/appointments?${BASE_QS}&per_page=2&page=1`);
    const res2 = await app.request(`/dental/appointments?${BASE_QS}&per_page=2&page=2`);
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    const page1 = await res1.json() as any[];
    const page2 = await res2.json() as any[];
    const ids1 = new Set(page1.map((a: any) => a.id));
    const ids2 = new Set(page2.map((a: any) => a.id));
    const overlap = [...ids1].filter(id => ids2.has(id));
    expect(overlap.length).toBe(0);
  });

  test('per_page is capped at 200 even when higher value is requested', async () => {
    const repo = new DentalAppointmentRepository(db);
    await seedN(repo, 3);

    const app = buildTestApp(TEST_USER);
    // V-SCH: per_page is bounded to <=200 at the schema layer — values above the
    // cap are rejected with 400, while the maximum allowed value returns 200.
    const tooHigh = await app.request(`/dental/appointments?${BASE_QS}&per_page=500`);
    expect(tooHigh.status).toBe(400);

    const atCap = await app.request(`/dental/appointments?${BASE_QS}&per_page=200`);
    expect(atCap.status).toBe(200);
    const body = await atCap.json() as any;
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeLessThanOrEqual(200);
  });
});

// ===========================================================================
// Auth scoping — 403 on unauthorized branch
// ===========================================================================

describe('branch authorization (assertBranchAccess)', () => {
  const UNAUTHORIZED_BRANCH = 'eeeeeeee-0000-1000-8000-000000000099';
  const OTHER_USER = { id: '00000000-0000-0000-0000-000000000099', email: 'other@clinic.com' };

  test('createAppointment returns 403 when user has no membership in branchId', async () => {
    const app = buildTestApp(OTHER_USER); // OTHER_USER has no membership seeded
    const res = await app.request('/dental/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_APPOINTMENT_BODY, branchId: BRANCH_ID }),
    });
    expect(res.status).toBe(403);
  });

  test('getAppointment returns 403 when user has no membership in appointment branch', async () => {
    const appt = await seedAppointment(); // seeded in BRANCH_ID
    const app = buildTestApp(OTHER_USER);
    const res = await app.request(`/dental/appointments/${appt.id}`);
    expect(res.status).toBe(403);
  });

  test('cancelAppointment returns 403 when user has no membership in appointment branch', async () => {
    const appt = await seedAppointment();
    const app = buildTestApp(OTHER_USER);
    const res = await app.request(`/dental/appointments/${appt.id}?reason=${encodeURIComponent('not allowed')}`, { method: 'DELETE' });
    expect(res.status).toBe(403);
  });

  test('listAppointments returns 403 when user has no membership in requested branch', async () => {
    await seedAppointment(); // in BRANCH_ID
    const app = buildTestApp(OTHER_USER); // no memberships
    const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const to = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const res = await app.request(`/dental/appointments?branchId=${BRANCH_ID}&date_from=${from}&date_to=${to}`);
    // assertBranchAccess rejects unauthorized branch access (V-SCH-004 requires branchId).
    expect(res.status).toBe(403);
  });
});

// ===========================================================================
// patientId filter on listAppointments
// ===========================================================================

describe('patientId filter on listAppointments', () => {
  test('filters appointments by patientId', async () => {
    const repo = new DentalAppointmentRepository(db);
    // Seed appointment for PATIENT_ID
    await repo.createOne({
      patientId: PATIENT_ID,
      dentistMemberId: MEMBER_ID,
      branchId: BRANCH_ID,
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      durationMinutes: 30,
      serviceType: 'checkup',
    });
    // Seed appointment for PATIENT_2
    await repo.createOne({
      patientId: PATIENT_2,
      dentistMemberId: MEMBER_ID,
      branchId: BRANCH_ID,
      scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      durationMinutes: 30,
      serviceType: 'checkup',
    });

    const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const to = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/appointments?branchId=${BRANCH_ID}&date_from=${from}&date_to=${to}&patientId=${PATIENT_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.every((a: any) => a.patientId === PATIENT_ID)).toBe(true);
    expect(body.length).toBe(1);
  });
});

// ===========================================================================
// Reschedule validation (overlap + working hours re-check on PATCH)
// ===========================================================================

describe('reschedule validation on updateAppointment', () => {
  // Branch has working hours Mon-Fri 09:00-18:00 Manila (UTC+8)
  // Monday 2026-03-02 at 17:30 Manila = 09:30 UTC → appt ends 18:30, outside close
  const OUTSIDE_HOURS_UTC = '2026-03-02T09:30:00.000Z'; // 17:30 Manila, ends 18:30
  const INSIDE_HOURS_UTC = '2026-03-02T02:00:00.000Z';  // 10:00 Manila, ends 11:00

  const WORKING_HOURS = {
    monday:    { enabled: true,  open: '09:00', close: '18:00' },
    tuesday:   { enabled: true,  open: '09:00', close: '18:00' },
    wednesday: { enabled: true,  open: '09:00', close: '18:00' },
    thursday:  { enabled: true,  open: '09:00', close: '18:00' },
    friday:    { enabled: true,  open: '09:00', close: '18:00' },
    saturday:  { enabled: false },
    sunday:    { enabled: false },
  };

  test('reschedule to outside working hours returns 422', async () => {
    // Set working hours on branch
    const { dentalBranches: branchTable } = await import('@/handlers/dental-org/repos/branch.schema');
    const { eq } = await import('drizzle-orm');
    await db.update(branchTable).set({ workingHours: JSON.stringify(WORKING_HOURS) }).where(eq(branchTable.id, BRANCH_ID));

    const appt = await seedAppointment();
    const app = buildTestApp(TEST_USER);

    const outsideEnd = new Date(new Date(OUTSIDE_HOURS_UTC).getTime() + 60 * 60 * 1000).toISOString();
    const res = await app.request(`/dental/appointments/${appt.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startAt: OUTSIDE_HOURS_UTC, endAt: outsideEnd }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('OUTSIDE_WORKING_HOURS');

    // Clean up working hours
    await db.update(branchTable).set({ workingHours: null }).where(eq(branchTable.id, BRANCH_ID));
  });

  test('reschedule to overlap with another appointment returns 409', async () => {
    const repo = new DentalAppointmentRepository(db);

    // Seed fixed appointment at INSIDE_HOURS_UTC (10:00 Manila, 60 min)
    await repo.createOne({
      patientId: PATIENT_ID,
      dentistMemberId: MEMBER_ID,
      branchId: BRANCH_ID,
      scheduledAt: new Date(INSIDE_HOURS_UTC),
      durationMinutes: 60,
      serviceType: 'checkup',
    });

    // Seed a second appointment at a non-overlapping time
    const toMove = await repo.createOne({
      patientId: PATIENT_ID,
      dentistMemberId: MEMBER_ID,
      branchId: BRANCH_ID,
      scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      durationMinutes: 30,
      serviceType: 'treatment',
    });

    const app = buildTestApp(TEST_USER);

    // Reschedule toMove to overlap with fixed (same time, same dentist)
    const insideEnd = new Date(new Date(INSIDE_HOURS_UTC).getTime() + 30 * 60 * 1000).toISOString();
    const res = await app.request(`/dental/appointments/${toMove.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startAt: INSIDE_HOURS_UTC, endAt: insideEnd }),
    });
    expect(res.status).toBe(409);
    const conflictBody = await res.json() as any;
    expect(conflictBody.code).toBe('RESCHEDULE_CONFLICT');

    // Verify the appointment hasn't moved
    const current = await repo.findOneById(toMove.id);
    expect(current!.scheduledAt.toISOString()).not.toBe(INSIDE_HOURS_UTC);
  });
});

// ===========================================================================
// AL-009: createAppointment audit trail
// ===========================================================================

describe('AL-009: createAppointment writes audit record to DB', () => {
  afterEach(async () => {
    await db.execute(sql`DELETE FROM dental_appointment`);
  });

  test('persists appointment.book audit record after successful booking', async () => {
    const app = buildTestApp(TEST_USER);
    const before = new Date();

    const res = await app.request('/dental/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_APPOINTMENT_BODY),
    });
    expect(res.status).toBe(201);
    const appt = await res.json() as any;

    const auditRepo = new DentalAuditRepository(db);
    const { entries } = await auditRepo.query(
      { personId: TEST_USER.id, action: 'appointment.book', resourceType: 'dental_appointment' },
      { limit: 10, offset: 0 },
    );
    const entry = entries.find(e => e.resourceId === appt.id);
    expect(entry).toBeDefined();
    expect(entry!.action).toBe('appointment.book');
    expect(entry!.resourceType).toBe('dental_appointment');
    expect(entry!.resourceId).toBe(appt.id);
    expect(entry!.branchId).toBe(BRANCH_ID);
    expect(entry!.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
    const meta = entry!.metadata as Record<string, unknown> | null;
    expect(meta?.['patientId']).toBe(PATIENT_ID);
    expect(meta?.['visitType']).toBe('checkup');
  });
});
