/**
 * E3: hygienist-led hygiene visits — authorization role guard, scoped by visitType.
 *
 * Product decision (ROLE_PERMISSION_MATRIX amendment): a hygienist gains clinical
 * authority ONLY on a HYGIENE-typed visit. GENERAL (dentist-led) visit gates are
 * UNCHANGED — a hygienist must never reach general-visit authority.
 *
 * This suite pins the invariant with BOTH allow and deny cases against a real DB
 * (so assertBranchRole runs against real memberships, and visit.visitType is read
 * from a real row):
 *
 *   createDentalVisit:
 *     ALLOW  hygienist + visitType=hygiene → 201
 *     DENY   hygienist + visitType=general (and default) → 403
 *     CONTROL owner + visitType=general → 201
 *
 *   checkInAppointment (creates the visit on check-in):
 *     ALLOW  hygienist + hygiene appointment → 200 (visit.visitType === 'hygiene')
 *     DENY   hygienist + general (checkup) appointment → 403
 *     CONTROL staff_full + checkup appointment → 200 (general visit, gate unchanged)
 *
 *   upsertVisitNotes:
 *     ALLOW  hygienist drafts on hygiene visit → 201
 *     DENY   hygienist drafts on general visit → 403
 *
 *   signVisitNotes:
 *     ALLOW  hygienist signs hygiene visit → 200
 *     DENY   hygienist signs general visit → 403
 *     CONTROL owner signs general visit → 200
 */

import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { sql, eq, and } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  CreateDentalVisitBody,
  UpsertVisitNotesBody,
  UpsertVisitNotesParams,
  SignVisitNotesBody,
  SignVisitNotesParams,
  CheckInAppointmentParams,
} from '@/generated/openapi/validators';

import { createDentalVisit } from './visits/createDentalVisit';
import { upsertVisitNotes } from './notes/upsertVisitNotes';
import { signVisitNotes } from './notes/signVisitNotes';
import { checkInAppointment } from '@/handlers/dental-scheduling/checkInAppointment';

const db = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test',
});

// ─── Fixed IDs (namespace: e3-hyg) ──────────────────────────────────────────
const ORG_ID     = 'd0000000-0000-1000-8000-0000000e3001';
const BRANCH_ID  = 'b0000000-0000-1000-8000-0000000e3001';
const PERSON_ID  = 'f0000000-0000-1000-8000-0000000e3001';
const PATIENT_ID = 'a0000000-0000-1000-8000-0000000e3001';

const OWNER_USER     = { id: '00000000-0000-0000-0000-e30001000000', email: 'owner.e3@clinic.com' };
const HYGIENIST_USER = { id: '00000000-0000-0000-0000-e30007000000', email: 'hygienist.e3@clinic.com' };
const STAFF_USER     = { id: '00000000-0000-0000-0000-e30005000000', email: 'staff.e3@clinic.com' };

const OWNER_MEMBER_ID     = 'c0000000-0000-1000-8000-e30001000000';
const HYGIENIST_MEMBER_ID = 'c0000000-0000-1000-8000-e30007000000';
const STAFF_MEMBER_ID     = 'c0000000-0000-1000-8000-e30005000000';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches }      = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships }   = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons }             = await import('@/handlers/person/repos/person.schema');
  const { patients }            = await import('@/handlers/patient/repos/patient.schema');

  for (const userId of [OWNER_USER.id, HYGIENIST_USER.id, STAFF_USER.id]) {
    await db.delete(dentalMemberships).where(
      and(eq(dentalMemberships.personId, userId), eq(dentalMemberships.branchId, BRANCH_ID)),
    );
  }

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'E3 Hygiene Clinic', tier: 'solo',
    ownerPersonId: OWNER_USER.id,
    countryCode: 'PH', createdBy: OWNER_USER.id, updatedBy: OWNER_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch',
    timezone: 'Asia/Manila', createdBy: OWNER_USER.id, updatedBy: OWNER_USER.id,
  }).onConflictDoNothing();

  const memberValues = [
    { id: OWNER_MEMBER_ID,     personId: OWNER_USER.id,     role: 'dentist_owner' },
    { id: HYGIENIST_MEMBER_ID, personId: HYGIENIST_USER.id, role: 'hygienist'     },
    { id: STAFF_MEMBER_ID,     personId: STAFF_USER.id,     role: 'staff_full'    },
  ] as const;

  for (const m of memberValues) {
    await db.insert(dentalMemberships as any).values({
      id: m.id, branchId: BRANCH_ID, personId: m.personId,
      displayName: m.role, role: m.role, status: 'active',
      pinFailedAttempts: 0,
      createdBy: OWNER_USER.id, updatedBy: OWNER_USER.id,
    }).onConflictDoNothing();
  }

  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'E3', lastName: 'Patient',
    createdBy: OWNER_USER.id, updatedBy: OWNER_USER.id,
  }).onConflictDoNothing();

  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID,
    createdBy: OWNER_USER.id, updatedBy: OWNER_USER.id,
  }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE dental_appointment CASCADE`);
  await db.execute(sql`TRUNCATE TABLE dental_visit CASCADE`);
});

// ─── Helpers ────────────────────────────────────────────────────────────────

const ve = (result: any, c: any) => {
  if (!result.success)
    return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
};

function buildApp(user?: { id: string; email: string }) {
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
      ctx.set('session', { id: 'test-session' });
    }
    await next();
  });

  app.post('/dental/visits', zValidator('json', CreateDentalVisitBody, ve), createDentalVisit as any);
  app.post('/dental/visits/:visitId/notes',
    zValidator('param', UpsertVisitNotesParams, ve),
    zValidator('json', UpsertVisitNotesBody, ve),
    upsertVisitNotes as any,
  );
  app.post('/dental/visits/:visitId/notes/sign',
    zValidator('param', SignVisitNotesParams, ve),
    zValidator('json', SignVisitNotesBody, ve),
    signVisitNotes as any,
  );
  app.post('/dental/appointments/:appointmentId/check-in',
    zValidator('param', CheckInAppointmentParams, ve),
    checkInAppointment as any,
  );

  return app;
}

async function seedVisit(visitType: 'general' | 'hygiene', status = 'active') {
  const { dentalVisits } = await import('./repos/visit.schema');
  const [visit] = await db.insert(dentalVisits).values({
    id: crypto.randomUUID(), patientId: PATIENT_ID, branchId: BRANCH_ID,
    dentistMemberId: visitType === 'hygiene' ? HYGIENIST_MEMBER_ID : OWNER_MEMBER_ID,
    status: status as any, visitType,
    ...(status === 'active' ? { activatedAt: new Date() } : {}),
    createdBy: OWNER_USER.id, updatedBy: OWNER_USER.id,
  }).returning();
  return visit!;
}

async function seedNote(visitId: string, authorMemberId = OWNER_MEMBER_ID) {
  const { visitNotes } = await import('./repos/treatment.schema');
  const [note] = await db.insert(visitNotes).values({
    id: crypto.randomUUID(), visitId, authorMemberId,
    subjective: 'S', objective: 'O', assessment: 'A', plan: 'P',
    createdBy: OWNER_USER.id, updatedBy: OWNER_USER.id,
  }).returning();
  return note!;
}

async function seedAppointment(serviceType: string, providerMemberId: string) {
  const { dentalAppointments } = await import('@/handlers/dental-scheduling/repos/dental-appointment.schema');
  const [appt] = await db.insert(dentalAppointments).values({
    id: crypto.randomUUID(), patientId: PATIENT_ID, branchId: BRANCH_ID,
    dentistMemberId: providerMemberId, scheduledAt: new Date(), durationMinutes: 30,
    serviceType, status: 'scheduled',
    createdBy: OWNER_USER.id, updatedBy: OWNER_USER.id,
  }).returning();
  return appt!;
}

function createVisitBody(visitType?: 'general' | 'hygiene') {
  return JSON.stringify({
    patientId: PATIENT_ID, branchId: BRANCH_ID,
    dentistMemberId: visitType === 'hygiene' ? HYGIENIST_MEMBER_ID : OWNER_MEMBER_ID,
    ...(visitType ? { visitType } : {}),
  });
}

function notesBody(visitId: string) {
  return JSON.stringify({ visitId, subjective: 'Recall prophy', objective: 'BOP 8%' });
}

// =============================================================================
// createDentalVisit — visitType-scoped creation
// =============================================================================

describe('createDentalVisit — hygienist hygiene-visit scope', () => {
  test('201 — hygienist CAN create a hygiene-typed visit', async () => {
    const app = buildApp(HYGIENIST_USER);
    const res = await app.request('/dental/visits', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: createVisitBody('hygiene'),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.visitType).toBe('hygiene');
  });

  test('403 — hygienist CANNOT create a general visit (explicit)', async () => {
    const app = buildApp(HYGIENIST_USER);
    const res = await app.request('/dental/visits', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: createVisitBody('general'),
    });
    expect(res.status).toBe(403);
  });

  test('403 — hygienist CANNOT create a visit with no visitType (defaults to general)', async () => {
    const app = buildApp(HYGIENIST_USER);
    const res = await app.request('/dental/visits', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: createVisitBody(),
    });
    expect(res.status).toBe(403);
  });

  test('201 — owner CAN create a general visit (gate unchanged); persists visitType=general', async () => {
    const app = buildApp(OWNER_USER);
    const res = await app.request('/dental/visits', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: createVisitBody('general'),
    });
    expect(res.status).toBe(201);
    expect((await res.json() as any).visitType).toBe('general');
  });

  test('201 — owner CAN create a hygiene visit too (hygiene authority is not hygienist-exclusive)', async () => {
    const app = buildApp(OWNER_USER);
    const res = await app.request('/dental/visits', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: createVisitBody('hygiene'),
    });
    expect(res.status).toBe(201);
  });
});

// =============================================================================
// checkInAppointment — hygiene-ness derived from appointment.serviceType
// =============================================================================

describe('checkInAppointment — hygienist hygiene-appointment scope', () => {
  test('200 — hygienist CAN check in a hygiene appointment → hygiene visit', async () => {
    const app = buildApp(HYGIENIST_USER);
    const appt = await seedAppointment('hygiene', HYGIENIST_MEMBER_ID);
    const res = await app.request(`/dental/appointments/${appt.id}/check-in`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    // Verify the created visit is hygiene-typed AND the provider-of-record is the
    // hygienist's own membership id (the appointment was booked with the hygienist
    // as provider — E3 allows the hygienist as the hygiene visit's dentistMemberId).
    const { VisitRepository } = await import('./repos/visit.repo');
    const visit = await new VisitRepository(db).findOneById(body.visitId);
    expect(visit?.visitType).toBe('hygiene');
    expect(visit?.dentistMemberId).toBe(HYGIENIST_MEMBER_ID);
  });

  test('403 — hygienist CANNOT check in a general (checkup) appointment', async () => {
    const app = buildApp(HYGIENIST_USER);
    const appt = await seedAppointment('checkup', HYGIENIST_MEMBER_ID);
    const res = await app.request(`/dental/appointments/${appt.id}/check-in`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(403);
  });

  test('200 — staff_full CAN still check in a checkup appointment → general visit (gate unchanged)', async () => {
    const app = buildApp(STAFF_USER);
    const appt = await seedAppointment('checkup', OWNER_MEMBER_ID);
    const res = await app.request(`/dental/appointments/${appt.id}/check-in`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const { VisitRepository } = await import('./repos/visit.repo');
    const visit = await new VisitRepository(db).findOneById(body.visitId);
    expect(visit?.visitType).toBe('general');
  });
});

// =============================================================================
// upsertVisitNotes — draft scope by visitType
// =============================================================================

describe('upsertVisitNotes — hygienist draft scope', () => {
  test('201 — hygienist CAN draft notes on a hygiene visit', async () => {
    const app = buildApp(HYGIENIST_USER);
    const visit = await seedVisit('hygiene', 'active');
    const res = await app.request(`/dental/visits/${visit.id}/notes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: notesBody(visit.id),
    });
    expect(res.status).toBe(201);
  });

  test('403 — hygienist CANNOT draft notes on a general visit', async () => {
    const app = buildApp(HYGIENIST_USER);
    const visit = await seedVisit('general', 'active');
    const res = await app.request(`/dental/visits/${visit.id}/notes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: notesBody(visit.id),
    });
    expect(res.status).toBe(403);
  });
});

// =============================================================================
// signVisitNotes — sign scope by visitType
// =============================================================================

describe('signVisitNotes — hygienist sign scope', () => {
  test('200 — hygienist CAN sign a hygiene visit note', async () => {
    const app = buildApp(HYGIENIST_USER);
    const visit = await seedVisit('hygiene', 'active');
    await seedNote(visit.id, HYGIENIST_MEMBER_ID);
    const res = await app.request(`/dental/visits/${visit.id}/notes/sign`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
  });

  test('403 — hygienist CANNOT sign a general visit note', async () => {
    const app = buildApp(HYGIENIST_USER);
    const visit = await seedVisit('general', 'active');
    await seedNote(visit.id);
    const res = await app.request(`/dental/visits/${visit.id}/notes/sign`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    });
    expect(res.status).toBe(403);
  });

  test('200 — owner CAN still sign a general visit note (gate unchanged)', async () => {
    const app = buildApp(OWNER_USER);
    const visit = await seedVisit('general', 'active');
    await seedNote(visit.id);
    const res = await app.request(`/dental/visits/${visit.id}/notes/sign`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
  });
});
