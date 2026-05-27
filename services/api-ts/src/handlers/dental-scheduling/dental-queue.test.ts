/**
 * dental-queue handler tests
 *
 * Tests HTTP-level behavior for queue board endpoints:
 *   POST /dental/appointments/:appointmentId/queue-item
 *   GET  /dental/branches/:branchId/queue-board
 *   PATCH /dental/queue-items/:itemId/status
 *
 * Uses suite-unique IDs tagged 'q01' to avoid cross-suite collisions.
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
  QueueItemAppointmentParams,
  QueueItemIdParams,
  QueueBoardParams,
  CreateQueueItemBody,
  UpdateQueueItemStatusBody,
} from './queue-item-validators';
import { createQueueItem } from './createQueueItem';
import { listQueueBoard } from './listQueueBoard';
import { updateQueueItemStatus } from './updateQueueItemStatus';
import { QueueItemRepository } from './repos/queue-item.repo';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique IDs (tag q01) to avoid collisions with other test suites
const TEST_USER = { id: '00000000-0000-0000-0000-000000000001', email: 'test@clinic.com' };
const PATIENT_ID = 'a0000000-0000-1000-8000-000000000001';
const PERSON_ID = 'e0000000-0000-1000-8000-000000000001';
const ORG_ID = 'f0000000-0000-1000-8000-000000000000';
const BRANCH_ID = '7b000000-0000-4000-8000-000000000q01';
const MEMBER_ID = '7c000000-0000-4000-8000-000000000q01';

beforeAll(async () => {
  await db.insert(dentalOrganizations).values({
    id: ORG_ID,
    name: 'DentalQueue Clinic',
    tier: 'solo',
    ownerPersonId: TEST_USER.id,
    countryCode: 'PH',
    createdBy: TEST_USER.id,
    updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalBranches).values({
    id: BRANCH_ID,
    organizationId: ORG_ID,
    name: 'Queue Branch',
    timezone: 'Asia/Manila',
    createdBy: TEST_USER.id,
    updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalMemberships).values({
    id: MEMBER_ID,
    branchId: BRANCH_ID,
    personId: TEST_USER.id,
    displayName: 'Queue Dentist',
    role: 'dentist_owner',
    status: 'active',
    createdBy: TEST_USER.id,
    updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(persons).values({
    id: PERSON_ID,
    firstName: 'Queue',
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

  app.post(
    '/dental/appointments/:appointmentId/queue-item',
    zValidator('param', QueueItemAppointmentParams),
    zValidator('json', CreateQueueItemBody),
    createQueueItem as any,
  );
  app.get(
    '/dental/branches/:branchId/queue-board',
    zValidator('param', QueueBoardParams),
    listQueueBoard as any,
  );
  app.patch(
    '/dental/queue-items/:itemId/status',
    zValidator('param', QueueItemIdParams),
    zValidator('json', UpdateQueueItemStatusBody),
    updateQueueItemStatus as any,
  );

  return app;
}

const FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

async function seedAppointment() {
  const repo = new DentalAppointmentRepository(db);
  return repo.createOne({
    patientId: PATIENT_ID,
    dentistMemberId: MEMBER_ID,
    branchId: BRANCH_ID,
    scheduledAt: new Date(FUTURE_DATE),
    durationMinutes: 30,
    serviceType: 'Cleaning',
    createdBy: TEST_USER.id,
    updatedBy: TEST_USER.id,
  });
}

afterEach(async () => {
  await db.execute(sql`DELETE FROM dental_queue_item`);
  await db.execute(sql`DELETE FROM dental_appointment`);
});

// ---------------------------------------------------------------------------
// createQueueItem
// ---------------------------------------------------------------------------

describe('createQueueItem handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const appt = await seedAppointment();
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/appointments/${appt.id}/queue-item`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  test('returns 201 with status waiting', async () => {
    const appt = await seedAppointment();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/appointments/${appt.id}/queue-item`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.status).toBe('waiting');
    expect(body.appointmentId).toBe(appt.id);
    expect(body.patientId).toBe(PATIENT_ID);
    expect(body.branchId).toBe(BRANCH_ID);
  });

  test('returns 404 for nonexistent appointment', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/appointments/ffffffff-ffff-1000-8000-ffffffffffff/queue-item`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// listQueueBoard
// ---------------------------------------------------------------------------

describe('listQueueBoard handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/branches/${BRANCH_ID}/queue-board`);
    expect(res.status).toBe(401);
  });

  test('returns active items for branch', async () => {
    const appt = await seedAppointment();
    const queueRepo = new QueueItemRepository(db);
    await queueRepo.createOne({
      appointmentId: appt.id,
      patientId: PATIENT_ID,
      branchId: BRANCH_ID,
      status: 'waiting',
      createdBy: TEST_USER.id,
      updatedBy: TEST_USER.id,
    });

    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/branches/${BRANCH_ID}/queue-board`);
    expect(res.status).toBe(200);
    const body = await res.json() as any[];
    expect(body.length).toBe(1);
    expect(body[0].status).toBe('waiting');
  });

  test('does not return completed items', async () => {
    const appt = await seedAppointment();
    const queueRepo = new QueueItemRepository(db);
    await queueRepo.createOne({
      appointmentId: appt.id,
      patientId: PATIENT_ID,
      branchId: BRANCH_ID,
      status: 'completed',
      createdBy: TEST_USER.id,
      updatedBy: TEST_USER.id,
    });

    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/branches/${BRANCH_ID}/queue-board`);
    expect(res.status).toBe(200);
    const body = await res.json() as any[];
    expect(body.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// updateQueueItemStatus
// ---------------------------------------------------------------------------

describe('updateQueueItemStatus handler', () => {
  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/queue-items/ffffffff-ffff-1000-8000-ffffffffffff/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'called' }),
    });
    expect(res.status).toBe(401);
  });

  test('transitions waiting → called and sets calledAt', async () => {
    const appt = await seedAppointment();
    const queueRepo = new QueueItemRepository(db);
    const item = await queueRepo.createOne({
      appointmentId: appt.id,
      patientId: PATIENT_ID,
      branchId: BRANCH_ID,
      status: 'waiting',
      createdBy: TEST_USER.id,
      updatedBy: TEST_USER.id,
    });

    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/queue-items/${item.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'called' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('called');
    expect(body.calledAt).toBeTruthy();
  });

  test('rejects invalid FSM transition with 422', async () => {
    const appt = await seedAppointment();
    const queueRepo = new QueueItemRepository(db);
    const item = await queueRepo.createOne({
      appointmentId: appt.id,
      patientId: PATIENT_ID,
      branchId: BRANCH_ID,
      status: 'waiting',
      createdBy: TEST_USER.id,
      updatedBy: TEST_USER.id,
    });

    const app = buildTestApp(TEST_USER);
    // waiting → completed is not allowed (must go waiting→called→in_progress→completed)
    const res = await app.request(`/dental/queue-items/${item.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    expect(res.status).toBe(422);
  });

  test('returns 404 for nonexistent queue item', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/queue-items/ffffffff-ffff-1000-8000-ffffffffffff/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'called' }),
    });
    expect(res.status).toBe(404);
  });
});
