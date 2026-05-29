/**
 * EF-SCH-001 — DE-010/DE-011 domain event emission tests
 *
 * Verifies that:
 *   - createAppointment enqueues DE-010 AppointmentBooked after a successful booking
 *   - cancelAppointment enqueues DE-011 AppointmentCancelled after a successful cancellation
 *
 * Strategy: inject a mock JobScheduler via ctx.get('jobs') and assert that
 * scheduler.trigger() is called with the expected queue name and payload shape.
 * No real pg-boss or database job infrastructure is required — only DB writes.
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
  CreateAppointmentBody,
  CancelAppointmentParams,
} from '@/generated/openapi/validators';

import { createAppointment } from './createAppointment';
import { cancelAppointment } from './cancelAppointment';
import {
  DENTAL_SCHEDULING_EVENTS_QUEUE,
  DENTAL_SCHEDULING_EVENT_TYPES,
} from './domain-events';
import type { JobScheduler } from '@/core/jobs';

const db = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test',
});

// Suite-unique IDs (tag de0) to avoid collision with other test suites
const TEST_USER = { id: '00000000-0000-0000-0000-000000000001', email: 'test@clinic.com' };
const PATIENT_ID = 'a0000000-0000-1000-8000-000000de0001';
const PERSON_ID  = 'e0000000-0000-1000-8000-000000de0001';
const ORG_ID     = 'f0000000-0000-1000-8000-000000de0000';
const BRANCH_ID  = '7b000000-0000-4000-8000-000000de0001';
const MEMBER_ID  = '7c000000-0000-4000-8000-000000de0001';

beforeAll(async () => {
  await db.insert(dentalOrganizations).values({
    id: ORG_ID,
    name: 'DE-010/011 Test Clinic',
    tier: 'solo',
    ownerPersonId: TEST_USER.id,
    countryCode: 'PH',
    createdBy: TEST_USER.id,
    updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalBranches).values({
    id: BRANCH_ID,
    organizationId: ORG_ID,
    name: 'DE-010/011 Branch',
    timezone: 'Asia/Manila',
    createdBy: TEST_USER.id,
    updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalMemberships).values({
    id: MEMBER_ID,
    branchId: BRANCH_ID,
    personId: TEST_USER.id,
    displayName: 'DE Test Dentist',
    role: 'dentist_owner',
    status: 'active',
    createdBy: TEST_USER.id,
    updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(persons).values({
    id: PERSON_ID,
    firstName: 'DE',
    lastName: 'Patient',
    createdBy: TEST_USER.id,
    updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(patients).values({
    id: PATIENT_ID,
    person: PERSON_ID,
    preferredBranchId: BRANCH_ID,
    createdBy: TEST_USER.id,
    updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`DELETE FROM dental_appointment WHERE branch_id = ${BRANCH_ID}`);
  await db.execute(sql`DELETE FROM dental_visit WHERE branch_id = ${BRANCH_ID}`);
});

// ---------------------------------------------------------------------------
// Mock scheduler factory
// ---------------------------------------------------------------------------

interface MockScheduler extends JobScheduler {
  calls: Array<{ name: string; data: unknown }>;
}

function buildMockScheduler(): MockScheduler {
  const calls: Array<{ name: string; data: unknown }> = [];
  const mock: MockScheduler = {
    calls,
    registerCron: () => {},
    registerInterval: () => {},
    registerDelayed: () => {},
    start: async () => {},
    shutdown: async () => {},
    trigger: async (name: string, data?: unknown) => {
      calls.push({ name, data });
      return 'mock-job-id';
    },
    cancel: async () => {},
    getHealth: async () => ({ healthy: true }),
    getQueueSize: async () => 0,
  };
  return mock;
}

// ---------------------------------------------------------------------------
// Test app builder
// ---------------------------------------------------------------------------

const FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

const VALID_APPOINTMENT_BODY = {
  patientId: PATIENT_ID,
  dentistMemberId: MEMBER_ID,
  branchId: BRANCH_ID,
  scheduledAt: FUTURE_DATE,
  durationMinutes: 30,
  serviceType: 'Cleaning',
};

function buildTestApp(scheduler?: MockScheduler) {
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
    ctx.set('user', TEST_USER);
    ctx.set('session', { id: 'test-session', userId: TEST_USER.id });
    if (scheduler) ctx.set('jobs', scheduler);
    await next();
  });

  app.post('/dental/appointments', zValidator('json', CreateAppointmentBody), createAppointment as any);
  app.delete('/dental/appointments/:appointmentId', zValidator('param', CancelAppointmentParams), cancelAppointment as any);

  return app;
}

// ---------------------------------------------------------------------------
// DE-010: AppointmentBooked
// ---------------------------------------------------------------------------

describe('DE-010: AppointmentBooked emitted after successful booking', () => {
  test('scheduler.trigger is called with DENTAL_SCHEDULING_EVENTS_QUEUE after 201', async () => {
    const scheduler = buildMockScheduler();
    const app = buildTestApp(scheduler);

    const res = await app.request('/dental/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_APPOINTMENT_BODY),
    });

    expect(res.status).toBe(201);
    // Allow the non-blocking promise to settle
    await new Promise(resolve => setTimeout(resolve, 10));

    const bookedCalls = scheduler.calls.filter(c => c.name === DENTAL_SCHEDULING_EVENTS_QUEUE);
    expect(bookedCalls.length).toBeGreaterThanOrEqual(1);
  });

  test('DE-010 payload contains event=AppointmentBooked, appointmentId, patientId, branchId', async () => {
    const scheduler = buildMockScheduler();
    const app = buildTestApp(scheduler);

    const res = await app.request('/dental/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_APPOINTMENT_BODY),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    await new Promise(resolve => setTimeout(resolve, 10));

    const call = scheduler.calls.find(
      c => c.name === DENTAL_SCHEDULING_EVENTS_QUEUE &&
           (c.data as any)?.event === DENTAL_SCHEDULING_EVENT_TYPES.APPOINTMENT_BOOKED,
    );
    expect(call).not.toBeUndefined();

    const payload = call!.data as any;
    expect(payload.event).toBe(DENTAL_SCHEDULING_EVENT_TYPES.APPOINTMENT_BOOKED);
    expect(payload.appointmentId).toBe(body.id);
    expect(payload.patientId).toBe(PATIENT_ID);
    expect(payload.branchId).toBe(BRANCH_ID);
  });

  test('DE-010 is not emitted when booking fails (400 bad request)', async () => {
    const scheduler = buildMockScheduler();
    const app = buildTestApp(scheduler);

    const res = await app.request('/dental/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_APPOINTMENT_BODY, patientId: undefined }),
    });

    expect(res.status).toBe(400);
    await new Promise(resolve => setTimeout(resolve, 10));

    const bookedCalls = scheduler.calls.filter(
      c => (c.data as any)?.event === DENTAL_SCHEDULING_EVENT_TYPES.APPOINTMENT_BOOKED,
    );
    expect(bookedCalls.length).toBe(0);
  });

  test('DE-010 is not emitted when no scheduler is injected (graceful degradation)', async () => {
    // Build app without scheduler (simulates missing ctx.get('jobs'))
    const app = buildTestApp(undefined);

    const res = await app.request('/dental/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_APPOINTMENT_BODY),
    });

    // Should still return 201 — event emission is non-blocking
    expect(res.status).toBe(201);
  });
});

// ---------------------------------------------------------------------------
// DE-011: AppointmentCancelled
// ---------------------------------------------------------------------------

describe('DE-011: AppointmentCancelled emitted after successful cancellation', () => {
  async function seedAppointment() {
    const repo = new DentalAppointmentRepository(db);
    return repo.createOne({
      patientId: PATIENT_ID,
      dentistMemberId: MEMBER_ID,
      branchId: BRANCH_ID,
      scheduledAt: new Date(FUTURE_DATE),
      durationMinutes: 30,
      serviceType: 'Cleaning',
    });
  }

  test('scheduler.trigger is called with DENTAL_SCHEDULING_EVENTS_QUEUE after 204', async () => {
    const scheduler = buildMockScheduler();
    const app = buildTestApp(scheduler);
    const appt = await seedAppointment();

    const res = await app.request(`/dental/appointments/${appt.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cancellationReason: 'Patient request' }),
    });

    expect(res.status).toBe(204);
    await new Promise(resolve => setTimeout(resolve, 10));

    const cancelledCalls = scheduler.calls.filter(c => c.name === DENTAL_SCHEDULING_EVENTS_QUEUE);
    expect(cancelledCalls.length).toBeGreaterThanOrEqual(1);
  });

  test('DE-011 payload contains event=AppointmentCancelled, appointmentId, patientId, branchId', async () => {
    const scheduler = buildMockScheduler();
    const app = buildTestApp(scheduler);
    const appt = await seedAppointment();

    const res = await app.request(`/dental/appointments/${appt.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cancellationReason: 'Rescheduling' }),
    });

    expect(res.status).toBe(204);
    await new Promise(resolve => setTimeout(resolve, 10));

    const call = scheduler.calls.find(
      c => c.name === DENTAL_SCHEDULING_EVENTS_QUEUE &&
           (c.data as any)?.event === DENTAL_SCHEDULING_EVENT_TYPES.APPOINTMENT_CANCELLED,
    );
    expect(call).not.toBeUndefined();

    const payload = call!.data as any;
    expect(payload.event).toBe(DENTAL_SCHEDULING_EVENT_TYPES.APPOINTMENT_CANCELLED);
    expect(payload.appointmentId).toBe(appt.id);
    expect(payload.patientId).toBe(PATIENT_ID);
    expect(payload.branchId).toBe(BRANCH_ID);
  });

  test('DE-011 is not emitted when appointment not found (404)', async () => {
    const scheduler = buildMockScheduler();
    const app = buildTestApp(scheduler);
    const NONEXISTENT = 'ffffffff-ffff-1000-8000-ffffffffffff';

    const res = await app.request(`/dental/appointments/${NONEXISTENT}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cancellationReason: 'Test' }),
    });

    expect(res.status).toBe(404);
    await new Promise(resolve => setTimeout(resolve, 10));

    const cancelledCalls = scheduler.calls.filter(
      c => (c.data as any)?.event === DENTAL_SCHEDULING_EVENT_TYPES.APPOINTMENT_CANCELLED,
    );
    expect(cancelledCalls.length).toBe(0);
  });

  test('DE-011 is not emitted when no scheduler is injected (graceful degradation)', async () => {
    const app = buildTestApp(undefined);
    const appt = await seedAppointment();

    const res = await app.request(`/dental/appointments/${appt.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cancellationReason: 'Patient request' }),
    });

    // Should still return 204 — event emission is non-blocking
    expect(res.status).toBe(204);
  });
});
