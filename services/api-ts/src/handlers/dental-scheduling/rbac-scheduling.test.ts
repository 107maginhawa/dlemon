/**
 * RBAC HTTP enforcement tests — dental-scheduling
 *
 * Proves that write routes on /dental/appointments reject under-privileged
 * roles (read_only) with 403, while an allowed role (staff_scheduling)
 * is not blocked at the role gate.
 *
 * Routes covered:
 *   POST   /dental/appointments              (assertBranchRole: write roles)
 *   DELETE /dental/appointments/:id         (assertBranchRole: write roles)
 *   PATCH  /dental/appointments/:id         (assertBranchRole: write roles)
 *   POST   /dental/appointments/:id/check-in (assertBranchRole: check-in roles)
 *
 * Pattern: mirrors rbac-http.test.ts — real DB, real Hono, afterEach TRUNCATE.
 * UUID prefix sc to avoid collisions.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';

import {
  CreateAppointmentBody,
  CancelAppointmentParams,
  UpdateAppointmentParams,
  UpdateAppointmentBody,
  CheckInAppointmentParams,
} from '@/generated/openapi/validators';

import { createAppointment } from './createAppointment';
import { cancelAppointment } from './cancelAppointment';
import { updateAppointment } from './updateAppointment';
import { checkInAppointment } from './checkInAppointment';
import { DentalAppointmentRepository } from './repos/dental-appointment.repo';

// ---------------------------------------------------------------------------
// DB
// ---------------------------------------------------------------------------

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// ---------------------------------------------------------------------------
// Fixed identities (prefix sc to avoid collisions)
// ---------------------------------------------------------------------------

// UUID prefix: ac (0xac = valid hex) + numeric suffix to avoid collisions with other test files
const USER_OWNER    = { id: 'ac100000-0000-4000-8000-000000000001', email: 'owner@sch-rbac.test' };
const USER_READONLY = { id: 'ac100000-0000-4000-8000-000000000002', email: 'readonly@sch-rbac.test' };
const USER_SCHED    = { id: 'ac100000-0000-4000-8000-000000000003', email: 'sched@sch-rbac.test' };
const USER_ASSOC    = { id: 'ac100000-0000-4000-8000-000000000004', email: 'assoc@sch-rbac.test' };
// Non-dental user: authenticated but has NO branch membership at all
const USER_NO_MEMBERSHIP = { id: 'ac100000-0000-4000-8000-000000000099', email: 'nomember@sch-rbac.test' };

const BRANCH_ID         = 'ac400000-0000-4000-8000-000000000001';
const ORG_ID            = 'ac500000-0000-4000-8000-000000000001';
const PATIENT_ID        = 'ac300000-0000-4000-8000-000000000001';
const PATIENT_PERSON_ID = 'ac200000-0000-4000-8000-000000000004';

// Member IDs (used as dentistMemberId in appointments)
const MEMBER_OWNER    = 'ac600000-0000-4000-8000-000000000001';
const MEMBER_READONLY = 'ac600000-0000-4000-8000-000000000002';
const MEMBER_SCHED    = 'ac600000-0000-4000-8000-000000000003';
const MEMBER_ASSOC    = 'ac600000-0000-4000-8000-000000000004';

// ---------------------------------------------------------------------------
// Hono app factory
// ---------------------------------------------------------------------------

const validationErrorHandler = (result: any, c: any) => {
  if (!result.success) return c.json({ error: 'Validation failed', issues: result.error.issues }, 400);
};

function makeApp(user: { id: string; email: string }) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: 'Internal server error' }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    ctx.set('user', user);
    ctx.set('session', { id: 'sch-rbac-session', userId: user.id });
    await next();
  });

  app.post(
    '/dental/appointments',
    zValidator('json', CreateAppointmentBody, validationErrorHandler),
    createAppointment as any,
  );
  app.delete(
    '/dental/appointments/:appointmentId',
    zValidator('param', CancelAppointmentParams, validationErrorHandler),
    cancelAppointment as any,
  );
  app.patch(
    '/dental/appointments/:appointmentId',
    zValidator('param', UpdateAppointmentParams, validationErrorHandler),
    zValidator('json', UpdateAppointmentBody, validationErrorHandler),
    updateAppointment as any,
  );
  app.post(
    '/dental/appointments/:appointmentId/check-in',
    zValidator('param', CheckInAppointmentParams, validationErrorHandler),
    checkInAppointment as any,
  );

  return app;
}

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

afterEach(async () => {
  await db.execute(sql`
    TRUNCATE TABLE
      dental_appointment,
      patient,
      person,
      dental_membership,
      dental_branch,
      dental_organization
    CASCADE
  `);
});

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

async function ensureOrg() {
  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'SCH RBAC Clinic', ownerPersonId: USER_OWNER.id,
    tier: 'solo', countryCode: 'PH', createdBy: USER_OWNER.id, updatedBy: USER_OWNER.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch',
    timezone: 'Asia/Manila', createdBy: USER_OWNER.id, updatedBy: USER_OWNER.id,
  }).onConflictDoNothing();

  for (const [userId, memberId, role] of [
    [USER_OWNER.id,    MEMBER_OWNER,    'dentist_owner'],
    [USER_READONLY.id, MEMBER_READONLY, 'read_only'],
    [USER_SCHED.id,    MEMBER_SCHED,    'staff_scheduling'],
    [USER_ASSOC.id,    MEMBER_ASSOC,    'dentist_associate'],
  ] as const) {
    await db.insert(dentalMemberships).values({
      id: memberId, branchId: BRANCH_ID, personId: userId,
      displayName: `SCH ${role}`, role, status: 'active',
      createdBy: USER_OWNER.id, updatedBy: USER_OWNER.id,
    }).onConflictDoNothing();
  }

  // Patient
  await db.insert(persons).values({
    id: PATIENT_PERSON_ID, firstName: 'SCH', lastName: 'Patient',
    createdBy: USER_OWNER.id, updatedBy: USER_OWNER.id,
  }).onConflictDoNothing();
  await db.insert(patients).values({
    id: PATIENT_ID, person: PATIENT_PERSON_ID, preferredBranchId: BRANCH_ID,
    createdBy: USER_OWNER.id, updatedBy: USER_OWNER.id,
  }).onConflictDoNothing();
}

// Seed a scheduled appointment for use in cancel/update/check-in tests
async function seedScheduledAppointment() {
  await ensureOrg();
  const repo = new DentalAppointmentRepository(db);
  return repo.createOne({
    patientId: PATIENT_ID,
    dentistMemberId: MEMBER_OWNER,
    branchId: BRANCH_ID,
    scheduledAt: new Date(Date.now() + 86_400_000), // tomorrow
    durationMinutes: 30,
    serviceType: 'checkup',
    operatoryId: null,
    walkIn: false,
    notes: null,
    createdBy: USER_OWNER.id,
    updatedBy: USER_OWNER.id,
  });
}

// ---------------------------------------------------------------------------
// EM-SCH-001 — POST /dental/appointments: read_only blocked
// ---------------------------------------------------------------------------

describe('RBAC — POST appointment: read_only blocked [EM-SCH-001]', () => {
  test('read_only member POST appointment → 403', async () => {
    await ensureOrg();
    const app = makeApp(USER_READONLY);
    const res = await app.request(
      '/dental/appointments',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: PATIENT_ID,
          providerId: MEMBER_OWNER,
          branchId: BRANCH_ID,
          startAt: new Date(Date.now() + 86_400_000).toISOString(),
          endAt: new Date(Date.now() + 86_400_000 + 30 * 60 * 1000).toISOString(),
          visitType: 'checkup',
          walkIn: false,
        }),
      },
    );
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.error).toMatch(/access/i);
  });

  test('staff_scheduling member POST appointment → not 403 (role gate passes) [EM-SCH-001]', async () => {
    await ensureOrg();
    const app = makeApp(USER_SCHED);
    const res = await app.request(
      '/dental/appointments',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: PATIENT_ID,
          providerId: MEMBER_OWNER,
          branchId: BRANCH_ID,
          startAt: new Date(Date.now() + 86_400_000).toISOString(),
          endAt: new Date(Date.now() + 86_400_000 + 30 * 60 * 1000).toISOString(),
          visitType: 'checkup',
          walkIn: false,
        }),
      },
    );
    // staff_scheduling is allowed through the role gate; may succeed or hit a business rule, never 403
    expect(res.status).not.toBe(403);
  });
});

// ---------------------------------------------------------------------------
// EM-SCH-001 — DELETE /dental/appointments/:id: read_only blocked
// ---------------------------------------------------------------------------

describe('RBAC — DELETE appointment: read_only blocked [EM-SCH-001]', () => {
  test('read_only member cancel appointment → 403', async () => {
    const appt = await seedScheduledAppointment();
    const app = makeApp(USER_READONLY);
    const res = await app.request(
      `/dental/appointments/${appt.id}?reason=${encodeURIComponent('test cancel')}`,
      {
        method: 'DELETE',
      },
    );
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// EM-SCH-001 — PATCH /dental/appointments/:id: read_only blocked
// ---------------------------------------------------------------------------

describe('RBAC — PATCH appointment: read_only blocked [EM-SCH-001]', () => {
  test('read_only member update appointment → 403', async () => {
    const appt = await seedScheduledAppointment();
    const app = makeApp(USER_READONLY);
    const res = await app.request(
      `/dental/appointments/${appt.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'updated notes' }),
      },
    );
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// EM-SCH-001 — POST /dental/appointments/:id/check-in: read_only blocked
// ---------------------------------------------------------------------------

describe('RBAC — POST check-in: read_only blocked [EM-SCH-001]', () => {
  test('read_only member check-in appointment → 403', async () => {
    const appt = await seedScheduledAppointment();
    const app = makeApp(USER_READONLY);
    const res = await app.request(
      `/dental/appointments/${appt.id}/check-in`,
      { method: 'POST' },
    );
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// EM-SCH-001 — check-in role exclusion: staff_scheduling NOT allowed
// (checkInAppointment allows dentist_owner / dentist_associate / staff_full only)
// ---------------------------------------------------------------------------

describe('RBAC — POST check-in: staff_scheduling excluded, capable roles allowed [EM-SCH-001]', () => {
  test('staff_scheduling member check-in → 403 (not a check-in-capable role)', async () => {
    const appt = await seedScheduledAppointment();
    const app = makeApp(USER_SCHED);
    const res = await app.request(`/dental/appointments/${appt.id}/check-in`, { method: 'POST' });
    expect(res.status).toBe(403);
  });

  test('dentist_associate member check-in → not 403 (capable role passes gate)', async () => {
    const appt = await seedScheduledAppointment();
    const app = makeApp(USER_ASSOC);
    const res = await app.request(`/dental/appointments/${appt.id}/check-in`, { method: 'POST' });
    expect(res.status).not.toBe(403);
  });
});

// ---------------------------------------------------------------------------
// EM-SCH-001 — cancel role exclusion: staff_scheduling AND dentist_associate
// NOT allowed (cancelAppointment allows dentist_owner / staff_full only)
// ---------------------------------------------------------------------------

describe('RBAC — DELETE appointment: scheduling/associate excluded, owner allowed [EM-SCH-001]', () => {
  test('staff_scheduling member cancel → 403 (cancel is owner/staff_full only)', async () => {
    const appt = await seedScheduledAppointment();
    const app = makeApp(USER_SCHED);
    const res = await app.request(
      `/dental/appointments/${appt.id}?reason=${encodeURIComponent('scheduling tries to cancel')}`,
      { method: 'DELETE' },
    );
    expect(res.status).toBe(403);
  });

  test('dentist_associate member cancel → 403 (cancel is owner/staff_full only)', async () => {
    const appt = await seedScheduledAppointment();
    const app = makeApp(USER_ASSOC);
    const res = await app.request(
      `/dental/appointments/${appt.id}?reason=${encodeURIComponent('associate tries to cancel')}`,
      { method: 'DELETE' },
    );
    expect(res.status).toBe(403);
  });

  test('dentist_owner member cancel → not 403 (role gate passes)', async () => {
    const appt = await seedScheduledAppointment();
    const app = makeApp(USER_OWNER);
    const res = await app.request(
      `/dental/appointments/${appt.id}?reason=${encodeURIComponent('owner cancels appointment')}`,
      { method: 'DELETE' },
    );
    expect(res.status).not.toBe(403);
  });
});

// ---------------------------------------------------------------------------
// EM-SCH-001 — PATCH-cancel bypass: cancelling via PATCH {status:'cancelled'}
// must honour the SAME narrow cancel permission as DELETE (owner/staff_full only).
// Regression: the broad write-role gate let staff_scheduling/dentist_associate
// cancel through PATCH, bypassing the dedicated cancel-role restriction.
// ---------------------------------------------------------------------------

describe('RBAC — PATCH {status:cancelled}: scheduling/associate excluded (parity with DELETE) [EM-SCH-001]', () => {
  test('staff_scheduling PATCH status=cancelled → 403 (cancel is owner/staff_full only)', async () => {
    const appt = await seedScheduledAppointment();
    const app = makeApp(USER_SCHED);
    const res = await app.request(`/dental/appointments/${appt.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled', cancellationReason: 'sched tries PATCH-cancel' }),
    });
    expect(res.status).toBe(403);
  });

  test('dentist_associate PATCH status=cancelled → 403 (cancel is owner/staff_full only)', async () => {
    const appt = await seedScheduledAppointment();
    const app = makeApp(USER_ASSOC);
    const res = await app.request(`/dental/appointments/${appt.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled', cancellationReason: 'assoc tries PATCH-cancel' }),
    });
    expect(res.status).toBe(403);
  });

  test('dentist_owner PATCH status=cancelled → not 403 (role gate passes)', async () => {
    const appt = await seedScheduledAppointment();
    const app = makeApp(USER_OWNER);
    const res = await app.request(`/dental/appointments/${appt.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled', cancellationReason: 'owner cancels via PATCH' }),
    });
    expect(res.status).not.toBe(403);
  });
});

// ---------------------------------------------------------------------------
// EM-SCH-001 — non-dental-role user (no branch membership) cannot book
// ---------------------------------------------------------------------------

describe('RBAC — POST appointment: user with no branch membership blocked [EM-SCH-001]', () => {
  test('authenticated user with no dental branch membership POST appointment → 403', async () => {
    await ensureOrg();
    const app = makeApp(USER_NO_MEMBERSHIP);
    const res = await app.request(
      '/dental/appointments',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: PATIENT_ID,
          providerId: MEMBER_OWNER,
          branchId: BRANCH_ID,
          startAt: new Date(Date.now() + 86_400_000).toISOString(),
          endAt: new Date(Date.now() + 86_400_000 + 30 * 60 * 1000).toISOString(),
          visitType: 'checkup',
          walkIn: false,
        }),
      },
    );
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.error).toMatch(/access/i);
  });
});
