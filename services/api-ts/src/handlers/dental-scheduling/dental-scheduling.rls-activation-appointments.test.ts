/**
 * RLS P1b activation — dental-scheduling appointment CRUD (Tier-1 activation).
 *
 * Routes the appointment list/create/update/cancel/confirm handlers' payload DB
 * access through withTenantTx so the app_rls policy on dental_appointment
 * (Tier-1, armed in P1a) enforces the branch scope as a DB-level second wall.
 *
 * Activation contract (locked pattern from dental_visit / dental-billing):
 *   - Entity-resolution fetch + authz (assertBranchRole/assertBranchAccess) +
 *     working-hours config reads + audit + best-effort notifs/events stay on the
 *     bypassing db connection → exact existing 403/404/409/422 behavior.
 *   - Armed-table reads/writes wrap in withTenantTx (scope = the resolved
 *     branch). createAppointment wraps the overlap-check read + the insert.
 *     updateAppointment wraps each status/field write via a runScoped helper.
 *   - Single-resource by-PK GET (getAppointment) gets NO wrap — control test.
 *
 * RED-first: each activated handler must OPEN a tenant transaction (a
 * db.transaction() call; logAuditEvent is a plain insert). No scheduling handler
 * opened a tx before activation, so the routing assertion FAILS pre-change.
 *
 * Runs against its own cloned DB (scripts/test-with-db.ts) carrying 0104–0106.
 */

import { describe, test, expect, beforeAll, afterEach, spyOn } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { dentalAppointments } from './repos/dental-appointment.schema';
import { createAppointment } from './createAppointment';
import { listAppointments } from './listAppointments';
import { getAppointment } from './getAppointment';
import { updateAppointment } from './updateAppointment';
import { cancelAppointment } from './cancelAppointment';
import { confirmAppointment } from './confirmAppointment';
import {
  CreateAppointmentBody,
  ListAppointmentsQuery,
  GetAppointmentParams,
  UpdateAppointmentBody,
  UpdateAppointmentParams,
  CancelAppointmentParams,
  ConfirmAppointmentParams,
} from '@/generated/openapi/validators';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// File-unique ids (own clone, distinct prefix 1bd = P1b scheduling).
const USER = { id: '1bd00000-0000-4000-8000-00000000a001', email: 'owner@a.com' };
const ORG = '1bd00000-0000-4000-8000-00000000a002';
const BRANCH = '1bd00000-0000-4000-8000-00000000a003';
const MEMBER = '1bd00000-0000-4000-8000-00000000a004';
const PERSON = '1bd00000-0000-4000-8000-00000000a005';
const PATIENT = '1bd00000-0000-4000-8000-00000000a006';

// A fixed future weekday window (branch has no workingHours config → the
// working-hours gate is skipped, so any in-future time is accepted).
const START = new Date('2030-03-06T03:00:00.000Z');
const END = new Date('2030-03-06T03:30:00.000Z');

beforeAll(async () => {
  await db.insert(dentalOrganizations).values({ id: ORG, name: '1bd Clinic A', tier: 'solo', ownerPersonId: USER.id, countryCode: 'PH', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH, organizationId: ORG, name: 'Main', timezone: 'Asia/Manila', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER, branchId: BRANCH, personId: USER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON, firstName: 'Test', lastName: 'Patient', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT, person: PERSON, preferredBranchId: BRANCH, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`DELETE FROM dental_appointment WHERE branch_id = ${BRANCH}`);
});

/** Seed an appointment (as superuser) in the given status at an offset minute. */
async function seedAppointment(opts: { status?: string; minuteOffset?: number } = {}) {
  const at = new Date(START.getTime() + (opts.minuteOffset ?? 0) * 60_000);
  const [row] = await db.insert(dentalAppointments).values({
    id: crypto.randomUUID(), patientId: PATIENT, dentistMemberId: MEMBER, branchId: BRANCH,
    scheduledAt: at, durationMinutes: 30, serviceType: 'checkup',
    status: (opts.status ?? 'scheduled') as any, walkIn: false,
    createdBy: USER.id, updatedBy: USER.id,
  }).returning();
  return row!;
}

const ve = (r: any, c: any) => { if (!r.success) return c.json({ error: 'Validation failed', issues: r.error.issues }, 400); };

function buildApp() {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err.message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug() {}, info() {}, warn() {}, error() {} });
    ctx.set('user', USER);
    ctx.set('session', { id: 's', userId: USER.id });
    ctx.set('requestId', 'test-req');
    await next();
  });
  app.post('/dental/appointments', zValidator('json', CreateAppointmentBody, ve), createAppointment as any);
  app.get('/dental/appointments', zValidator('query', ListAppointmentsQuery, ve), listAppointments as any);
  app.get('/dental/appointments/:appointmentId', zValidator('param', GetAppointmentParams, ve), getAppointment as any);
  app.patch('/dental/appointments/:appointmentId', zValidator('param', UpdateAppointmentParams, ve), zValidator('json', UpdateAppointmentBody, ve), updateAppointment as any);
  app.delete('/dental/appointments/:appointmentId', zValidator('param', CancelAppointmentParams, ve), cancelAppointment as any);
  app.post('/dental/appointments/:appointmentId/confirm', zValidator('param', ConfirmAppointmentParams, ve), confirmAppointment as any);
  return app;
}

describe('RLS P1b — dental-scheduling appointment CRUD routes through withTenantTx (activation)', () => {
  test('createAppointment opens a tenant tx and writes the appointment', async () => {
    const txSpy = spyOn(db, 'transaction');
    try {
      const res = await buildApp().request('/dental/appointments', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ patientId: PATIENT, branchId: BRANCH, providerId: MEMBER, startAt: START.toISOString(), endAt: END.toISOString(), visitType: 'checkup' }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.branchId).toBe(BRANCH);         // CORRECT SCOPE (WITH CHECK passed)
      expect(txSpy).toHaveBeenCalled();           // ROUTING (RED before activation)
    } finally {
      txSpy.mockRestore();
    }
  });

  test('listAppointments opens a tenant tx and returns the branch appointment', async () => {
    const appt = await seedAppointment();
    const txSpy = spyOn(db, 'transaction');
    try {
      const res = await buildApp().request('/dental/appointments?branchId=' + BRANCH + '&date_from=2030-03-06&date_to=2030-03-06');
      expect(res.status).toBe(200);
      const body = await res.json() as any[];
      expect(body.map((a) => a.id)).toContain(appt.id);
      expect(txSpy).toHaveBeenCalled();
    } finally {
      txSpy.mockRestore();
    }
  });

  test('getAppointment (by-PK GET) does NOT open a tenant tx', async () => {
    const appt = await seedAppointment();
    const txSpy = spyOn(db, 'transaction');
    try {
      const res = await buildApp().request(`/dental/appointments/${appt.id}`);
      expect(res.status).toBe(200);
      expect(txSpy).not.toHaveBeenCalled();
    } finally {
      txSpy.mockRestore();
    }
  });

  test('updateAppointment (field update) opens a tenant tx and writes the patch', async () => {
    const appt = await seedAppointment();
    const txSpy = spyOn(db, 'transaction');
    try {
      const res = await buildApp().request(`/dental/appointments/${appt.id}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ notes: 'Bring X-rays' }),
      });
      expect(res.status).toBe(200);
      expect(txSpy).toHaveBeenCalled();
    } finally {
      txSpy.mockRestore();
    }
  });

  test('updateAppointment (status→confirmed) opens a tenant tx', async () => {
    const appt = await seedAppointment({ status: 'scheduled' });
    const txSpy = spyOn(db, 'transaction');
    try {
      const res = await buildApp().request(`/dental/appointments/${appt.id}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'confirmed' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.status).toBe('confirmed');
      expect(txSpy).toHaveBeenCalled();
    } finally {
      txSpy.mockRestore();
    }
  });

  test('confirmAppointment opens a tenant tx and confirms', async () => {
    const appt = await seedAppointment({ status: 'scheduled' });
    const txSpy = spyOn(db, 'transaction');
    try {
      const res = await buildApp().request(`/dental/appointments/${appt.id}/confirm`, { method: 'POST' });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.status).toBe('confirmed');
      expect(txSpy).toHaveBeenCalled();
    } finally {
      txSpy.mockRestore();
    }
  });

  test('cancelAppointment opens a tenant tx and cancels', async () => {
    const appt = await seedAppointment({ status: 'scheduled' });
    const txSpy = spyOn(db, 'transaction');
    try {
      const res = await buildApp().request(`/dental/appointments/${appt.id}?reason=Patient%20rescheduled`, { method: 'DELETE' });
      expect(res.status).toBe(204);
      expect(txSpy).toHaveBeenCalled();
    } finally {
      txSpy.mockRestore();
    }
  });
});
