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
import { createDatabase } from '@/core/database';
import { DentalAppointmentRepository } from './repos/dental-appointment.repo';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
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

const db = createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' });

const TEST_USER = { id: '00000000-0000-0000-0000-000000000001', email: 'test@clinic.com' };
const PATIENT_ID = 'a0000000-0000-1000-8000-000000000001';
const ORG_ID = 'f0000000-0000-1000-8000-000000000000';
const BRANCH_ID = 'b0000000-0000-1000-8000-000000000002';
const MEMBER_ID = 'c0000000-0000-1000-8000-000000000003';
const NONEXISTENT_ID = 'ffffffff-ffff-1000-8000-ffffffffffff';

// Seed org + branch + membership once so assertBranchAccess passes for TEST_USER + BRANCH_ID
beforeAll(async () => {
  await db.insert(dentalOrganizations).values({
    id: ORG_ID,
    name: 'Test Clinic',
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
    branchId: BRANCH_ID,
    personId: TEST_USER.id,
    displayName: 'Test Dentist',
    role: 'dentist_owner',
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

const VALID_APPOINTMENT_BODY = {
  patientId: PATIENT_ID,
  dentistMemberId: MEMBER_ID,
  branchId: BRANCH_ID,
  scheduledAt: FUTURE_DATE,
  durationMinutes: 30,
  procedureType: 'Cleaning',
};

async function seedAppointment() {
  const repo = new DentalAppointmentRepository(db);
  const appt = await repo.createOne({
    patientId: PATIENT_ID,
    dentistMemberId: MEMBER_ID,
    branchId: BRANCH_ID,
    scheduledAt: new Date(FUTURE_DATE),
    durationMinutes: 30,
    procedureType: 'Cleaning',
  });
  return appt;
}

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE dental_appointment, dental_visit CASCADE`);
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

  test('returns 400 when dentistMemberId is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const { dentistMemberId: _omit, ...withoutDentist } = VALID_APPOINTMENT_BODY;
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

  test('returns 400 when scheduledAt is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const { scheduledAt: _omit, ...withoutDate } = VALID_APPOINTMENT_BODY;
    const res = await app.request('/dental/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withoutDate),
    });
    expect(res.status).toBe(400);
  });

  test('returns 400 when durationMinutes is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const { durationMinutes: _omit, ...withoutDuration } = VALID_APPOINTMENT_BODY;
    const res = await app.request('/dental/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withoutDuration),
    });
    expect(res.status).toBe(400);
  });

  test('returns 400 when procedureType is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const { procedureType: _omit, ...withoutProcedure } = VALID_APPOINTMENT_BODY;
    const res = await app.request('/dental/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withoutProcedure),
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
    expect(body.dentistMemberId).toBe(MEMBER_ID);
    expect(body.branchId).toBe(BRANCH_ID);
    expect(body.status).toBe('scheduled');
    expect(body.procedureType).toBe('Cleaning');
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
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request('/dental/appointments');
    expect(res.status).toBe(401);
  });

  test('returns 200 with empty array when no appointments', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/appointments');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(0);
  });

  test('returns 200 with list of appointments', async () => {
    await seedAppointment();
    const app = buildTestApp(TEST_USER);

    const res = await app.request('/dental/appointments');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  test('filters appointments by branchId', async () => {
    await seedAppointment();
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/appointments?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.every((a: any) => a.branchId === BRANCH_ID)).toBe(true);
  });

  test('filters appointments by status', async () => {
    await seedAppointment();
    const app = buildTestApp(TEST_USER);

    const res = await app.request('/dental/appointments?status=scheduled');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.every((a: any) => a.status === 'scheduled')).toBe(true);
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
      body: JSON.stringify({ status: 'noShow' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('noShow');
    expect(body.noShowAt).toBeTruthy();
  });

  test('updates procedureType', async () => {
    const appt = await seedAppointment();
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/appointments/${appt.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ procedureType: 'Root Canal' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.procedureType).toBe('Root Canal');
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
    expect(body.appointment).toBeTruthy();
    expect(body.appointment.status).toBe('checkedIn');
    expect(body.appointment.checkInTime).toBeTruthy();
    expect(body.visitId).toBeTruthy();
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

    const res = await app.request(`/dental/appointments/${appt.id}`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(204);

    // Verify appointment is now cancelled
    const repo = new DentalAppointmentRepository(db);
    const updated = await repo.findOneById(appt.id);
    expect(updated!.status).toBe('cancelled');
    expect(updated!.cancelledAt).toBeTruthy();
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

    const DIFFERENT_DENTIST_ID = 'd0000000-0000-1000-8000-000000000099';
    const res = await app.request('/dental/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_APPOINTMENT_BODY, dentistMemberId: DIFFERENT_DENTIST_ID }),
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
      procedureType: 'Follow-Up',
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
      procedureType: 'Follow-Up',
    });

    // Second check-in should fail
    const res = await app.request(`/dental/appointments/${appt2.id}/check-in`, { method: 'POST' });
    expect(res.status).toBe(409);

    // Verify appt2 is still 'scheduled', NOT stuck in 'checkedIn' (race condition fix)
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
    await app.request(`/dental/appointments/${appt.id}`, { method: 'DELETE' });

    // Now attempt noShow
    const res = await app.request(`/dental/appointments/${appt.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'noShow' }),
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
      body: JSON.stringify({ status: 'noShow' }),
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

    // Attempt to set to 'checkedIn' directly via notes+status patch
    // Since 'checkedIn' doesn't match any transition branch in the handler,
    // it falls through to generic patch which no longer passes status
    const res = await app.request(`/dental/appointments/${appt.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'test', status: 'checkedIn' }),
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
  test('stores cancellationReason when cancelled via DELETE with body', async () => {
    const appt = await seedAppointment();
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/appointments/${appt.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cancellationReason: 'Patient request' }),
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

    await app.request(`/dental/appointments/${appt.id}`, { method: 'DELETE' });

    const repo = new DentalAppointmentRepository(db);
    const updated = await repo.findOneById(appt.id);
    expect(updated!.updatedBy).toBe(TEST_USER.id);
  });
});

// ===========================================================================
// Pagination
// ===========================================================================

describe('pagination on listAppointments', () => {
  test('returns at most limit appointments', async () => {
    const repo = new DentalAppointmentRepository(db);
    // Seed 3 appointments
    for (let i = 0; i < 3; i++) {
      await repo.createOne({
        patientId: PATIENT_ID,
        dentistMemberId: MEMBER_ID,
        branchId: BRANCH_ID,
        scheduledAt: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000),
        durationMinutes: 30,
        procedureType: 'Cleaning',
      });
    }

    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/appointments?limit=2');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.length).toBeLessThanOrEqual(2);
  });

  test('offset skips earlier results', async () => {
    const repo = new DentalAppointmentRepository(db);
    for (let i = 0; i < 3; i++) {
      await repo.createOne({
        patientId: PATIENT_ID,
        dentistMemberId: MEMBER_ID,
        branchId: BRANCH_ID,
        scheduledAt: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000),
        durationMinutes: 30,
        procedureType: 'Cleaning',
      });
    }

    const app = buildTestApp(TEST_USER);
    const res1 = await app.request('/dental/appointments?limit=2&offset=0');
    const res2 = await app.request('/dental/appointments?limit=2&offset=2');
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    const page1 = await res1.json() as any[];
    const page2 = await res2.json() as any[];
    // IDs should not overlap
    const ids1 = new Set(page1.map((a: any) => a.id));
    const ids2 = new Set(page2.map((a: any) => a.id));
    const overlap = [...ids1].filter(id => ids2.has(id));
    expect(overlap.length).toBe(0);
  });
});
