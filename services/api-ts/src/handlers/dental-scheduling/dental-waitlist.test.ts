/**
 * dental-waitlist handler tests (P2-15 — ASAP fill)
 *
 * Covers:
 *   POST /dental/branches/:branchId/waitlist        (createWaitlistEntry)
 *   GET  /dental/branches/:branchId/waitlist        (listWaitlist)
 *   POST /dental/waitlist/:entryId/promote          (promoteWaitlistEntry)
 *
 * Suite-unique IDs tagged 'wl1'.
 */

import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import {
  CreateWaitlistEntryParams,
  CreateWaitlistEntryBody,
  ListWaitlistParams,
  ListWaitlistQuery,
  PromoteWaitlistEntryParams,
  PromoteWaitlistEntryBody,
} from '@/generated/openapi/validators';
import { createWaitlistEntry } from './createWaitlistEntry';
import { listWaitlist } from './listWaitlist';
import { promoteWaitlistEntry } from './promoteWaitlistEntry';
import { DentalWaitlistEntryRepository } from './repos/waitlist-entry.repo';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: '00000000-0000-0000-0000-0000000000d1', email: 'waitlist@clinic.com' };
const PERSON_ID  = 'a0000000-0000-1000-8000-0000000000d1';
const PATIENT_ID = 'a0000000-0000-1000-8000-0000000000d2';
const ORG_ID     = 'f0000000-0000-1000-8000-0000000000d1';
const BRANCH_ID  = 'b0000000-0000-1000-8000-0000000000d1';
const MEMBER_ID  = 'c0000000-0000-1000-8000-0000000000d1';

beforeAll(async () => {
  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Waitlist Clinic', tier: 'solo', ownerPersonId: TEST_USER.id,
    countryCode: 'PH', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Waitlist Branch', timezone: 'Asia/Manila',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.execute(sql`DELETE FROM dental_membership WHERE branch_id = ${BRANCH_ID} AND person_id = ${TEST_USER.id} AND id != ${MEMBER_ID}`);
  await db.insert(dentalMemberships).values({
    id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id, displayName: 'Waitlist Dentist',
    role: 'dentist_owner', status: 'active', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'Waitlist', lastName: 'Patient', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(patients).values({
    // preferredBranchId is REQUIRED for a waitlistable patient: createWaitlistEntry
    // now asserts the caller belongs to the patient's branch (P1-6 branch-link fix).
    id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`DELETE FROM dental_waitlist_entry WHERE branch_id = ${BRANCH_ID}`);
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
  app.post('/dental/branches/:branchId/waitlist',
    zValidator('param', CreateWaitlistEntryParams),
    zValidator('json', CreateWaitlistEntryBody),
    createWaitlistEntry as any,
  );
  app.get('/dental/branches/:branchId/waitlist',
    zValidator('param', ListWaitlistParams),
    zValidator('query', ListWaitlistQuery),
    listWaitlist as any,
  );
  app.post('/dental/waitlist/:entryId/promote',
    zValidator('param', PromoteWaitlistEntryParams),
    zValidator('json', PromoteWaitlistEntryBody),
    promoteWaitlistEntry as any,
  );
  return app;
}

function futureSlot(offsetDays = 3) {
  const start = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  start.setUTCHours(10, 0, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

async function seedEntry(overrides: Record<string, unknown> = {}) {
  const repo = new DentalWaitlistEntryRepository(db);
  return repo.createOne({
    patientId: PATIENT_ID,
    branchId: BRANCH_ID,
    preferredProviderId: MEMBER_ID,
    visitType: 'checkup',
    urgency: 'asap',
    status: 'active',
    createdBy: TEST_USER.id,
    updatedBy: TEST_USER.id,
    ...overrides,
  } as any);
}

// ---------------------------------------------------------------------------
// createWaitlistEntry
// ---------------------------------------------------------------------------

describe('createWaitlistEntry handler', () => {
  test('401 when unauthenticated', async () => {
    const app = buildApp(undefined);
    const res = await app.request(`/dental/branches/${BRANCH_ID}/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID }),
    });
    expect(res.status).toBe(401);
  });

  test('201 creates an active entry', async () => {
    const app = buildApp(TEST_USER);
    const res = await app.request(`/dental/branches/${BRANCH_ID}/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, urgency: 'asap', visitType: 'checkup', preferredProviderId: MEMBER_ID }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.status).toBe('active');
    expect(body.patientId).toBe(PATIENT_ID);
    expect(body.branchId).toBe(BRANCH_ID);
    expect(body.urgency).toBe('asap');
  });
});

// ---------------------------------------------------------------------------
// listWaitlist
// ---------------------------------------------------------------------------

describe('listWaitlist handler', () => {
  test('401 when unauthenticated', async () => {
    const app = buildApp(undefined);
    const res = await app.request(`/dental/branches/${BRANCH_ID}/waitlist`);
    expect(res.status).toBe(401);
  });

  test('defaults to active entries only', async () => {
    await seedEntry();
    await seedEntry({ status: 'cancelled' });
    const app = buildApp(TEST_USER);
    const res = await app.request(`/dental/branches/${BRANCH_ID}/waitlist`);
    expect(res.status).toBe(200);
    const body = await res.json() as any[];
    expect(body.length).toBe(1);
    expect(body[0].status).toBe('active');
  });

  test('?status=cancelled returns cancelled entries', async () => {
    await seedEntry();
    await seedEntry({ status: 'cancelled' });
    const app = buildApp(TEST_USER);
    const res = await app.request(`/dental/branches/${BRANCH_ID}/waitlist?status=cancelled`);
    expect(res.status).toBe(200);
    const body = await res.json() as any[];
    expect(body.length).toBe(1);
    expect(body[0].status).toBe('cancelled');
  });
});

// ---------------------------------------------------------------------------
// promoteWaitlistEntry
// ---------------------------------------------------------------------------

describe('promoteWaitlistEntry handler', () => {
  test('201 books an appointment and marks the entry scheduled', async () => {
    const entry = await seedEntry();
    const app = buildApp(TEST_USER);
    const { startAt, endAt } = futureSlot();
    const res = await app.request(`/dental/waitlist/${entry.id}/promote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startAt, endAt }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.entry.status).toBe('scheduled');
    expect(body.appointment.id).toBeTruthy();
    expect(body.appointment.status).toBe('scheduled');
    expect(body.entry.promotedAppointmentId).toBe(body.appointment.id);
    expect(body.appointment.startAt).toBeTruthy();
  });

  test('404 for a nonexistent entry', async () => {
    const app = buildApp(TEST_USER);
    const { startAt, endAt } = futureSlot();
    const res = await app.request(`/dental/waitlist/ffffffff-ffff-4000-8000-ffffffffffff/promote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startAt, endAt }),
    });
    expect(res.status).toBe(404);
  });

  test('rejects promoting an already-scheduled entry', async () => {
    const entry = await seedEntry({ status: 'scheduled' });
    const app = buildApp(TEST_USER);
    const { startAt, endAt } = futureSlot();
    const res = await app.request(`/dental/waitlist/${entry.id}/promote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startAt, endAt }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    const body = await res.json() as any;
    expect(body.code).toBe('WAITLIST_ENTRY_NOT_ACTIVE');
  });

  test('requires a provider when the entry has no preferred provider', async () => {
    const entry = await seedEntry({ preferredProviderId: null });
    const app = buildApp(TEST_USER);
    const { startAt, endAt } = futureSlot();
    const res = await app.request(`/dental/waitlist/${entry.id}/promote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startAt, endAt }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('rejects endAt <= startAt', async () => {
    const entry = await seedEntry();
    const app = buildApp(TEST_USER);
    const { startAt } = futureSlot();
    const res = await app.request(`/dental/waitlist/${entry.id}/promote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startAt, endAt: startAt }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
