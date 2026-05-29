/**
 * Module 4: Scheduling — FR3.10 Configurable Working Hours
 *
 * Tests:
 * - GET /dental/branches/:branchId/working-hours  — returns null when not configured
 * - PUT /dental/branches/:branchId/working-hours  — saves working hours config
 * - GET /dental/branches/:branchId/working-hours  — returns saved config
 * - PUT validation: invalid time format rejected
 * - PUT validation: non-boolean enabled rejected
 * - createAppointment: blocked when outside working hours (FR3.10)
 * - createAppointment: allowed when within working hours
 * - createAppointment: allowed when no working hours configured (no restriction)
 * - createAppointment: blocked on closed day
 */

import { describe, test, expect, afterEach } from 'bun:test';
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
import { createAppointment } from './createAppointment';
import { getWorkingHours, updateWorkingHours } from './workingHours';
import { CreateAppointmentBody } from '@/generated/openapi/validators';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: '00000000-0000-0000-0000-000000000099', email: 'test@clinic.com' };
const PERSON_ID  = 'e9000000-0000-1000-8000-000000000099';
const PATIENT_ID = 'a0000000-0000-1000-8000-000000000099';
const MEMBER_ID  = 'c0000000-0000-1000-8000-000000000099';
const ORG_ID     = 'eeeeeeee-0000-1000-8000-000000000099';
const BRANCH_ID  = 'bbbbbbbb-0000-1000-8000-000000000099';

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
      ctx.set('session', { id: 'test-session', userId: user.id });
    }
    await next();
  });

  app.get('/dental/branches/:branchId/working-hours', getWorkingHours);
  app.put('/dental/branches/:branchId/working-hours', updateWorkingHours);
  app.post('/dental/appointments', zValidator('json', CreateAppointmentBody), createAppointment as any);
  return app;
}

async function seedBranch(workingHoursJson?: string | null) {
  await db.insert(dentalOrganizations).values({
    id: ORG_ID,
    name: 'Test Clinic',
    tier: 'solo',
    ownerPersonId: TEST_USER.id,
    countryCode: 'PH',
    createdBy: TEST_USER.id,
    updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  const [branch] = await db.insert(dentalBranches).values({
    id: BRANCH_ID,
    organizationId: ORG_ID,
    name: 'Main Branch',
    timezone: 'Asia/Manila',
    workingHours: workingHoursJson ?? null,
    createdBy: TEST_USER.id,
    updatedBy: TEST_USER.id,
  }).onConflictDoUpdate({
    target: dentalBranches.id,
    set: { workingHours: workingHoursJson ?? null, updatedBy: TEST_USER.id },
  }).returning();

  // Seed membership with explicit MEMBER_ID so the appointment FK (dentistMemberId)
  // resolves. personId = TEST_USER.id so assertBranchAccess still passes.
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

  // Seed person + patient so the appointment FK (patientId) resolves.
  // patient/person rows are NOT included in afterEach TRUNCATE, so
  // onConflictDoNothing keeps them alive across tests in this file.
  await db.insert(persons).values({
    id: PERSON_ID,
    firstName: 'Working',
    lastName: 'HoursPatient',
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

  return branch!;
}

afterEach(async () => {
  await db.execute(sql`
    TRUNCATE dental_appointment, dental_membership, dental_branch, dental_organization
    RESTART IDENTITY CASCADE
  `);
});

// ---------------------------------------------------------------------------
// Working Hours GET/PUT
// ---------------------------------------------------------------------------

describe('GET working hours', () => {
  test('returns null when not configured', async () => {
    await seedBranch(null);
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/branches/${BRANCH_ID}/working-hours`, { method: 'GET' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.workingHours).toBeNull();
  });

  test('404 for unknown branch', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/branches/ffffffff-ffff-1000-8000-ffffffffffff/working-hours`, { method: 'GET' });
    expect(res.status).toBe(404);
  });

  test('401 without auth', async () => {
    await seedBranch(null);
    const app = buildTestApp(); // no user
    const res = await app.request(`/dental/branches/${BRANCH_ID}/working-hours`, { method: 'GET' });
    expect(res.status).toBe(401);
  });

  test('403 when user has no membership in branch', async () => {
    await seedBranch(null);
    const OTHER_USER = { id: '00000000-0000-0000-0000-000000000077', email: 'outsider@clinic.com' };
    const app = buildTestApp(OTHER_USER); // not seeded as member
    const res = await app.request(`/dental/branches/${BRANCH_ID}/working-hours`, { method: 'GET' });
    expect(res.status).toBe(403);
  });
});

describe('PUT working hours (FR3.10)', () => {
  const validHours = {
    monday:    { enabled: true,  open: '09:00', close: '18:00' },
    tuesday:   { enabled: true,  open: '09:00', close: '18:00' },
    wednesday: { enabled: true,  open: '09:00', close: '18:00' },
    thursday:  { enabled: true,  open: '09:00', close: '18:00' },
    friday:    { enabled: true,  open: '09:00', close: '18:00' },
    saturday:  { enabled: true,  open: '09:00', close: '13:00' },
    sunday:    { enabled: false },
  };

  test('saves working hours and returns them', async () => {
    await seedBranch(null);
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/branches/${BRANCH_ID}/working-hours`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workingHours: validHours }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.workingHours.monday.open).toBe('09:00');
    expect(body.workingHours.sunday.enabled).toBe(false);
  });

  test('GET returns saved config after PUT', async () => {
    await seedBranch(null);
    const app = buildTestApp(TEST_USER);
    await app.request(`/dental/branches/${BRANCH_ID}/working-hours`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workingHours: validHours }),
    });
    const res = await app.request(`/dental/branches/${BRANCH_ID}/working-hours`, { method: 'GET' });
    const body = await res.json() as any;
    expect(body.workingHours.friday.close).toBe('18:00');
  });

  test('400 for invalid time format', async () => {
    await seedBranch(null);
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/branches/${BRANCH_ID}/working-hours`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workingHours: { monday: { enabled: true, open: '9:00', close: '18:00' } }, // missing leading zero
      }),
    });
    expect(res.status).toBe(400);
  });

  test('400 when workingHours missing', async () => {
    await seedBranch(null);
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/branches/${BRANCH_ID}/working-hours`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  test('403 when user has no membership in branch (PUT)', async () => {
    await seedBranch(null);
    const OTHER_USER = { id: '00000000-0000-0000-0000-000000000077', email: 'outsider@clinic.com' };
    const app = buildTestApp(OTHER_USER);
    const res = await app.request(`/dental/branches/${BRANCH_ID}/working-hours`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workingHours: validHours }),
    });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// createAppointment with working hours validation (FR3.10)
// ---------------------------------------------------------------------------

describe('createAppointment working hours enforcement (FR3.10)', () => {
  // Times expressed in UTC but representing Asia/Manila (UTC+8) local times
  // Monday 2026-03-02: 10:00 Manila = 02:00 UTC
  const mondayAt10 = '2026-03-02T02:00:00.000Z'; // Monday 10:00 Manila (within 09:00-18:00)
  const mondayAt17 = '2026-03-02T09:00:00.000Z'; // Monday 17:00 Manila — 60-min appt ends 18:00, exactly at close
  const mondayAt17_30 = '2026-03-02T09:30:00.000Z'; // Monday 17:30 Manila — ends 18:30, outside close
  const sundayAt10 = '2026-03-08T02:00:00.000Z'; // Sunday 10:00 Manila — closed

  const workingHours = {
    monday:    { enabled: true,  open: '09:00', close: '18:00' },
    tuesday:   { enabled: true,  open: '09:00', close: '18:00' },
    wednesday: { enabled: true,  open: '09:00', close: '18:00' },
    thursday:  { enabled: true,  open: '09:00', close: '18:00' },
    friday:    { enabled: true,  open: '09:00', close: '18:00' },
    saturday:  { enabled: false },
    sunday:    { enabled: false },
  };

  function apptBody(scheduledAt: string, durationMinutes = 60) {
    const endAt = new Date(new Date(scheduledAt).getTime() + durationMinutes * 60 * 1000).toISOString();
    return JSON.stringify({
      patientId: PATIENT_ID,
      providerId: MEMBER_ID,
      branchId: BRANCH_ID,
      startAt: scheduledAt,
      endAt,
      visitType: 'checkup',
    });
  }

  test('allowed when no working hours configured', async () => {
    await seedBranch(null); // no restriction
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: apptBody(mondayAt10),
    });
    expect(res.status).toBe(201);
  });

  test('allowed when within working hours', async () => {
    await seedBranch(JSON.stringify(workingHours));
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: apptBody(mondayAt10, 60),
    });
    expect(res.status).toBe(201);
  });

  test('blocked when appointment end exceeds working hours close', async () => {
    await seedBranch(JSON.stringify(workingHours));
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: apptBody(mondayAt17_30, 60), // ends at 18:30, closes at 18:00
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('OUTSIDE_WORKING_HOURS');
  });

  test('blocked on closed day (sunday)', async () => {
    await seedBranch(JSON.stringify(workingHours));
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: apptBody(sundayAt10, 60),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('OUTSIDE_WORKING_HOURS');
  });

  test('allowed exactly at close boundary', async () => {
    await seedBranch(JSON.stringify(workingHours));
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: apptBody(mondayAt17, 60), // 17:00 Manila + 60min = 18:00 Manila, exactly at close
    });
    expect(res.status).toBe(201);
  });

  test('timezone: blocked when UTC time falls within hours but Manila local time is outside', async () => {
    // Branch timezone: Asia/Manila (UTC+8)
    // Working hours: 09:00-18:00 Manila
    // A UTC time of 11:00 UTC = 19:00 Manila (outside hours, but within UTC business hours)
    await seedBranch(JSON.stringify(workingHours));
    const app = buildTestApp(TEST_USER);

    // Monday 2026-03-02 11:00 UTC = 19:00 Manila — outside business hours
    const outsideInManila = '2026-03-02T11:00:00.000Z';
    const res = await app.request('/dental/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: apptBody(outsideInManila, 60),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('OUTSIDE_WORKING_HOURS');
  });
});
