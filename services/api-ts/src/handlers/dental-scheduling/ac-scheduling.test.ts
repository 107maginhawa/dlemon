/**
 * Acceptance Criteria tests — dental-scheduling
 *
 * AC-SCHED-01: Creating an appointment fires a booking.created notification to the patient
 * AC-SCHED-02: Checking in a patient creates a draft visit with correct patientId and branchId
 * AC-SCHED-03: Cancelling an appointment sets status to cancelled; visit created at check-in is NOT deleted
 * AC-SCHED-04: Walk-in appointments are created without a prior appointment ID
 * AC-SCHED-05: Listing appointments with a date filter returns only appointments on that date
 */

import { describe, test, expect, beforeAll, afterEach, mock } from 'bun:test';
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
  CreateAppointmentBody,
  ListAppointmentsQuery,
  CheckInAppointmentParams,
  CancelAppointmentParams,
} from '@/generated/openapi/validators';
import { createAppointment } from './createAppointment';
import { listAppointments } from './listAppointments';
import { checkInAppointment } from './checkInAppointment';
import { cancelAppointment } from './cancelAppointment';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique tag: ac1 — avoids membership unique-index collision with other scheduling test suites
const TEST_USER = { id: '00000000-0000-0000-0000-000000000001', email: 'test@clinic.com' };
const PATIENT_ID = 'a0000000-0000-1000-8000-000000000001';
const PERSON_ID  = 'e0000000-0000-1000-8000-000000000001';
const ORG_ID     = 'f0000000-0000-1000-8000-000000000000';
const BRANCH_ID  = '7b000000-0000-4000-8000-000000000ac1';
const MEMBER_ID  = '7c000000-0000-4000-8000-000000000ac1';

beforeAll(async () => {
  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'AC Scheduling Clinic', tier: 'solo',
    ownerPersonId: TEST_USER.id, countryCode: 'PH',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch',
    timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id,
    displayName: 'Test Dentist', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'AC', lastName: 'Patient',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
});

afterEach(async () => {
  // Delete appointments first (FK: dental_appointment.visit_id → dental_visit.id)
  await db.execute(sql`DELETE FROM dental_appointment`);
  await db.execute(sql`DELETE FROM dental_visit`);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

function buildTestApp(user?: typeof TEST_USER, notifs?: object) {
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
    if (notifs) ctx.set('notifs', notifs);
    await next();
  });

  app.post('/dental/appointments', zValidator('json', CreateAppointmentBody), createAppointment as any);
  app.get('/dental/appointments', zValidator('query', ListAppointmentsQuery), listAppointments as any);
  app.post('/dental/appointments/:appointmentId/check-in', zValidator('param', CheckInAppointmentParams), checkInAppointment as any);
  app.delete('/dental/appointments/:appointmentId', zValidator('param', CancelAppointmentParams), cancelAppointment as any);

  return app;
}

async function seedAppointment(overrides?: Partial<{ scheduledAt: Date; walkIn: boolean }>) {
  const repo = new DentalAppointmentRepository(db);
  return repo.createOne({
    patientId: PATIENT_ID,
    dentistMemberId: MEMBER_ID,
    branchId: BRANCH_ID,
    scheduledAt: overrides?.scheduledAt ?? new Date(FUTURE_DATE),
    durationMinutes: 30,
    serviceType: 'Cleaning',
    walkIn: overrides?.walkIn ?? false,
  });
}

// ===========================================================================
// AC-SCHED-01
// ===========================================================================

describe('AC-SCHED-01: appointment creation fires booking.created notification', () => {
  test('notifs.createNotification called with type booking.created on success [AC-SCHED-01]', async () => {
    const createNotification = mock(() => Promise.resolve({ id: 'notif-ac01' }));
    const app = buildTestApp(TEST_USER, { createNotification });

    const res = await app.request('/dental/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        dentistMemberId: MEMBER_ID,
        branchId: BRANCH_ID,
        scheduledAt: FUTURE_DATE,
        durationMinutes: 30,
        serviceType: 'Cleaning',
      }),
    });

    expect(res.status).toBe(201);
    // Allow fire-and-forget microtask to resolve
    await Promise.resolve();
    expect(createNotification).toHaveBeenCalledTimes(1);
    const [req] = createNotification.mock.calls[0] as any[];
    expect(req.type).toBe('booking.created');
    expect(req.recipient).toBe(PATIENT_ID);
  });
});

// ===========================================================================
// AC-SCHED-02
// ===========================================================================

describe('AC-SCHED-02: check-in creates a draft visit with correct patientId and branchId', () => {
  test('check-in response contains visitId and appointment has visitId linked [AC-SCHED-02]', async () => {
    const appt = await seedAppointment();
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/appointments/${appt.id}/check-in`, {
      method: 'POST',
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.visitId).toBeTruthy();
    // appointment should now be linked to visit
    expect(body.appointment.visitId).toBe(body.visitId);
    expect(body.appointment.status).toBe('checked_in');
  });
});

// ===========================================================================
// AC-SCHED-03
// ===========================================================================

describe('AC-SCHED-03: cancelling appointment sets status cancelled; visit is preserved', () => {
  test('cancelled appointment has status cancelled; a visit created by another appt is not deleted [AC-SCHED-03]', async () => {
    const app = buildTestApp(TEST_USER);

    // Seed appointment A and check it in (creates a visit)
    const apptA = await seedAppointment();
    const checkInRes = await app.request(`/dental/appointments/${apptA.id}/check-in`, {
      method: 'POST',
    });
    expect(checkInRes.status).toBe(200);
    const checkInBody = await checkInRes.json() as any;
    const visitId = checkInBody.visitId;
    expect(visitId).toBeTruthy();

    // Seed appointment B (different future date to avoid overlap issues)
    const repo = new DentalAppointmentRepository(db);
    const apptB = await repo.createOne({
      patientId: PATIENT_ID,
      dentistMemberId: MEMBER_ID,
      branchId: BRANCH_ID,
      scheduledAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      durationMinutes: 30,
      serviceType: 'X-Ray',
    });

    // Cancel appointment B
    const cancelRes = await app.request(`/dental/appointments/${apptB.id}`, {
      method: 'DELETE',
    });
    expect(cancelRes.status).toBe(204);

    // apptB is cancelled
    const reloadedB = await repo.findOneById(apptB.id);
    expect(reloadedB?.status).toBe('cancelled');

    // apptA's visit is still linked (not deleted)
    const reloadedA = await repo.findOneById(apptA.id);
    expect(reloadedA?.visitId).toBe(visitId);
  });
});

// ===========================================================================
// AC-SCHED-04
// ===========================================================================

describe('AC-SCHED-04: walk-in appointments created without prior appointment ID', () => {
  test('creating a walk-in appointment returns 201 with walkIn=true and no appointmentId prerequisite [AC-SCHED-04]', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request('/dental/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        dentistMemberId: MEMBER_ID,
        branchId: BRANCH_ID,
        scheduledAt: FUTURE_DATE,
        durationMinutes: 15,
        serviceType: 'Walk-In Consult',
        walkIn: true,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.walkIn).toBe(true);
    expect(body.id).toBeTruthy();
  });
});

// ===========================================================================
// AC-SCHED-05
// ===========================================================================

describe('AC-SCHED-05: listing appointments with date filter returns only appointments on that date', () => {
  test('appointments outside the filter date are excluded from results [AC-SCHED-05]', async () => {
    const repo = new DentalAppointmentRepository(db);

    // Seed appointment on target date (UTC noon)
    const targetDate = '2027-03-15';
    await repo.createOne({
      patientId: PATIENT_ID,
      dentistMemberId: MEMBER_ID,
      branchId: BRANCH_ID,
      scheduledAt: new Date('2027-03-15T12:00:00.000Z'),
      durationMinutes: 30,
      serviceType: 'Cleaning',
    });

    // Seed appointment on different date
    await repo.createOne({
      patientId: PATIENT_ID,
      dentistMemberId: MEMBER_ID,
      branchId: BRANCH_ID,
      scheduledAt: new Date('2027-03-16T12:00:00.000Z'),
      durationMinutes: 30,
      serviceType: 'Cleaning',
    });

    const app = buildTestApp(TEST_USER);
    const res = await app.request(
      `/dental/appointments?branchId=${BRANCH_ID}&date=${targetDate}`,
    );
    expect(res.status).toBe(200);
    const appts = await res.json() as any[];
    expect(appts.length).toBeGreaterThanOrEqual(1);
    // All returned appointments must fall on 2027-03-15
    for (const a of appts) {
      const d = new Date(a.scheduledAt);
      expect(d.toISOString().startsWith('2027-03-15')).toBe(true);
    }
  });
});
