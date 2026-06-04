/**
 * confirmAppointmentByToken (public token-confirm) tests — P1-24, plan §4 Slice A.
 *
 * Real DB. Verifies:
 *   - valid token + scheduled → confirmed (confirmedVia='link'), token cleared
 *   - replay with the same token → 404 (single-use)
 *   - unknown token → 404
 *   - staff confirm (repo.confirm) records confirmedVia='staff'
 */

import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { sql, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { DentalAppointmentRepository } from './repos/dental-appointment.repo';
import { dentalAppointments } from './repos/dental-appointment.schema';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { ConfirmAppointmentByTokenParams } from '@/generated/openapi/validators';
import { confirmAppointmentByToken } from './confirmAppointmentByToken';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const ACTOR = '00000000-0000-1000-8000-0000000000e1';
const PERSON_ID = 'a0000000-0000-1000-8000-0000000000e1';
const PATIENT_ID = 'a0000000-0000-1000-8000-0000000000e2';
const ORG_ID = 'f0000000-0000-1000-8000-0000000000e1';
const BRANCH_ID = 'b0000000-0000-1000-8000-0000000000e1';
const MEMBER_ID = 'c0000000-0000-1000-8000-0000000000e1';
const KNOWN_TOKEN = 'd0000000-0000-4000-8000-0000000000e9';
const UNKNOWN_TOKEN = 'd0000000-0000-4000-8000-0000000000ee';

beforeAll(async () => {
  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Token Test Clinic', tier: 'solo', ownerPersonId: ACTOR,
    countryCode: 'PH', createdBy: ACTOR, updatedBy: ACTOR,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Token Branch', timezone: 'Asia/Manila',
    createdBy: ACTOR, updatedBy: ACTOR,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: MEMBER_ID, branchId: BRANCH_ID, personId: ACTOR, displayName: 'Token Dentist',
    role: 'dentist_owner', status: 'active', createdBy: ACTOR, updatedBy: ACTOR,
  }).onConflictDoNothing();
  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'Token', lastName: 'Patient', createdBy: ACTOR, updatedBy: ACTOR,
  }).onConflictDoNothing();
  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: ACTOR, updatedBy: ACTOR,
  }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`DELETE FROM dental_appointment WHERE branch_id = ${BRANCH_ID}`);
});

function buildApp() {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug() {}, info() {}, warn() {}, error() {} });
    await next();
  });
  app.post('/dental/public/appointments/:appointmentId/confirm/:token',
    zValidator('param', ConfirmAppointmentByTokenParams),
    confirmAppointmentByToken as any,
  );
  return app;
}

async function seedScheduledWithToken(token: string | null) {
  const repo = new DentalAppointmentRepository(db);
  const appt = await repo.createOne({
    patientId: PATIENT_ID,
    dentistMemberId: MEMBER_ID,
    branchId: BRANCH_ID,
    scheduledAt: new Date(Date.now() + 48 * 3_600_000),
    durationMinutes: 30,
    serviceType: 'Cleaning',
  });
  if (token) {
    await db.update(dentalAppointments).set({ confirmationToken: token }).where(eq(dentalAppointments.id, appt.id));
  }
  return appt;
}

describe('confirmAppointmentByToken (P1-24)', () => {
  test('valid token + scheduled → 200 confirmed, confirmedVia=link, token cleared', async () => {
    const appt = await seedScheduledWithToken(KNOWN_TOKEN);
    const app = buildApp();
    const res = await app.request(`/dental/public/appointments/${appt.id}/confirm/${KNOWN_TOKEN}`, { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('confirmed');

    const [row] = await db.select().from(dentalAppointments).where(eq(dentalAppointments.id, appt.id)); if (!row) throw new Error('row missing');
    expect(row.confirmedVia).toBe('link');
    expect(row.confirmationToken).toBeNull(); // single-use
  });

  test('replay with the same token → 404 (single-use)', async () => {
    const appt = await seedScheduledWithToken(KNOWN_TOKEN);
    const app = buildApp();
    const first = await app.request(`/dental/public/appointments/${appt.id}/confirm/${KNOWN_TOKEN}`, { method: 'POST' });
    expect(first.status).toBe(200);
    const replay = await app.request(`/dental/public/appointments/${appt.id}/confirm/${KNOWN_TOKEN}`, { method: 'POST' });
    expect(replay.status).toBe(404);
  });

  test('unknown token → 404', async () => {
    const appt = await seedScheduledWithToken(KNOWN_TOKEN);
    const app = buildApp();
    const res = await app.request(`/dental/public/appointments/${appt.id}/confirm/${UNKNOWN_TOKEN}`, { method: 'POST' });
    expect(res.status).toBe(404);
  });

  test('staff confirm via repo.confirm records confirmedVia=staff', async () => {
    const appt = await seedScheduledWithToken(null);
    const repo = new DentalAppointmentRepository(db);
    const confirmed = await repo.confirm(appt.id, ACTOR, 'staff');
    expect(confirmed?.status).toBe('confirmed');
    expect(confirmed?.confirmedVia).toBe('staff');
  });
});
