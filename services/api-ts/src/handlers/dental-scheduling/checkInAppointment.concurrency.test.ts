/**
 * checkInAppointment.concurrency.test.ts — two check-ins, one patient, two visits.
 *
 * checkInAppointment's EC7 guard (findInProgressVisitByPatient) reads on db BEFORE the tx.
 * Under READ COMMITTED two concurrent check-ins for the SAME patient (two appointments)
 * both read "no in-progress visit" and both createVisit(status='draft'). The unique index
 * dental_visit_active_patient_unique only fires WHERE status='active', NOT the 'draft' a
 * fresh check-in creates — so nothing stops two in-progress visits for one patient
 * (violating EC7: max one active visit).
 *
 * Fix: inside the commit tx take a patient-scoped pg_advisory_xact_lock(2001,…) and
 * re-assert the in-progress-visit guard under it; the loser re-reads the winner's committed
 * draft visit and throws CHECKIN_ACTIVE_VISIT.
 *
 * RED-proof: without the lock+re-check a round races → two draft visits, both 200. GREEN:
 * exactly one in-progress visit, one 200 + one 409 CHECKIN_ACTIVE_VISIT.
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
import { DentalAppointmentRepository } from './repos/dental-appointment.repo';
import { checkInAppointment } from './checkInAppointment';
import { CheckInAppointmentParams } from '@/generated/openapi/validators';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique tag: 114.
const USER = { id: '00000000-0000-4000-8000-000000114001', email: 'owner@checkinrace.com' };
const ORG = 'ea000000-0000-4000-8000-000000114001';
const BRANCH = 'ba000000-0000-4000-8000-000000114001';
const MEMBER = 'ca000000-0000-4000-8000-000000114001';

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE dental_queue_item, dental_visit, dental_appointment, patient, person CASCADE`);
});

async function ensureOrg() {
  await db.insert(dentalOrganizations).values({ id: ORG, name: 'CheckInRace', tier: 'solo', ownerPersonId: USER.id, countryCode: 'PH', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH, organizationId: ORG, name: 'Main', timezone: 'Asia/Manila', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER, branchId: BRANCH, personId: USER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
}

async function seedPatientWithTwoAppointments(): Promise<{ patientId: string; appt1: string; appt2: string }> {
  await ensureOrg();
  const personId = crypto.randomUUID();
  const patientId = crypto.randomUUID();
  await db.insert(persons).values({ id: personId, firstName: 'CheckIn', lastName: 'Race', createdBy: USER.id, updatedBy: USER.id });
  await db.insert(patients).values({ id: patientId, person: personId, preferredBranchId: BRANCH, createdBy: USER.id, updatedBy: USER.id });
  const repo = new DentalAppointmentRepository(db);
  const base = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const a1 = await repo.createOne({ patientId, dentistMemberId: MEMBER, branchId: BRANCH, scheduledAt: new Date(base), durationMinutes: 30, serviceType: 'Cleaning' });
  const a2 = await repo.createOne({ patientId, dentistMemberId: MEMBER, branchId: BRANCH, scheduledAt: new Date(base + 60 * 60 * 1000), durationMinutes: 30, serviceType: 'Cleaning' });
  return { patientId, appt1: a1.id, appt2: a2.id };
}

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
    ctx.set('session', { id: 'sess', userId: USER.id });
    await next();
  });
  app.post('/dental/appointments/:appointmentId/check-in', zValidator('param', CheckInAppointmentParams), checkInAppointment as any);
  return app;
}

function checkIn(appointmentId: string) {
  return buildApp().request(`/dental/appointments/${appointmentId}/check-in`, { method: 'POST' });
}

async function inProgressVisitCount(patientId: string): Promise<number> {
  const r = await db.execute(sql`SELECT COUNT(*)::int AS n FROM dental_visit WHERE patient_id = ${patientId} AND status IN ('draft','active')`);
  return Number(((r as any).rows?.[0] ?? (r as any)[0]).n);
}

describe('checkInAppointment — concurrent check-ins cannot open two visits for one patient', () => {
  test('two simultaneous check-ins (same patient, two appointments) → exactly one visit, one 200 + one 409', async () => {
    const ROUNDS = 6;
    for (let i = 0; i < ROUNDS; i++) {
      const { patientId, appt1, appt2 } = await seedPatientWithTwoAppointments();

      const [a, b] = await Promise.all([checkIn(appt1), checkIn(appt2)]);
      const statuses = [a.status, b.status];

      const visits = await inProgressVisitCount(patientId);
      // EC7 invariant: at most one in-progress visit per patient.
      expect(visits, `round ${i}: exactly one in-progress visit per patient (visits=${visits} statuses=${statuses})`).toBe(1);

      const winners = [a, b].filter((r) => r.status === 200);
      expect(winners.length, `round ${i}: exactly one check-in may succeed (statuses ${statuses})`).toBe(1);
      const loser = [a, b].find((r) => r.status !== 200)!;
      expect(loser.status, `round ${i}: the loser must be 409`).toBe(409);
      const loserBody = (await loser.json()) as { code?: string };
      expect(loserBody.code, `round ${i}: loser must be CHECKIN_ACTIVE_VISIT`).toBe('CHECKIN_ACTIVE_VISIT');

      await db.execute(sql`TRUNCATE TABLE dental_queue_item, dental_visit, dental_appointment, patient, person CASCADE`);
    }
  });
});
