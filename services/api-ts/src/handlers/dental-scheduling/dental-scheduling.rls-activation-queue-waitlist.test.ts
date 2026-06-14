/**
 * RLS P1b activation — dental-scheduling queue + waitlist + online-booking +
 * check-in (Tier-1 activation, PR-B; PR-A covered appointment CRUD).
 *
 * Routes these handlers' armed-table payload DB access through withTenantTx so
 * the app_rls policies on dental_queue_item / dental_waitlist_entry /
 * dental_appointment_hold / dental_appointment / dental_visit (all Tier-1, armed
 * in P1a) enforce the branch scope as a DB-level second wall.
 *
 * Activation contract (locked pattern from dental_visit / dental-billing):
 *   - Entity-resolution fetch + authz (assertBranchRole/assertBranchAccess) +
 *     branch-config reads (online-booking config, working hours) + the
 *     cross-patient in-progress-visit guard + match-or-create-patient + audit +
 *     best-effort notifs stay on the bypassing db connection → exact existing
 *     403/404/409/422 behavior.
 *   - Armed-table reads/writes wrap in withTenantTx (scope = the resolved
 *     branch). Multi-table writes (promote = appointment+waitlist, online booking
 *     = appointment+hold, check-in = appointment+visit) go in ONE tx.
 *
 * RED contract — THE ROLE PROBE. Three handlers (promoteWaitlistEntry,
 * createOnlineBooking, checkInAppointment) already opened a db.transaction()
 * before this change, so a plain `spyOn(db,'transaction').toHaveBeenCalled()`
 * is confounded (already 1 call). Instead we wrap db.transaction and read
 * `current_user` from INSIDE the committed tx: withTenantTx issues
 * `SET LOCAL ROLE app_rls`, so post-activation the tx runs as `app_rls`;
 * pre-activation it runs as the superuser `postgres` (or never opens a tx at
 * all, for the queue/waitlist/hold handlers). `sawAppRls()` is therefore FALSE
 * before activation and TRUE after — a genuine RED→GREEN for all nine handlers,
 * confounders included. The happy-path 2xx + correct-branch data additionally
 * proves the scope published to withTenantTx was correct (a wrong/empty scope →
 * app_rls sees 0 rows / WITH CHECK rejects the write → the request would break).
 *
 * Runs against its own cloned DB (scripts/test-with-db.ts) carrying 0104–0106.
 */

import { describe, test, expect, beforeAll, beforeEach, spyOn } from 'bun:test';
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
import { DentalWaitlistEntryRepository } from './repos/waitlist-entry.repo';
import { createQueueItem } from './createQueueItem';
import { updateQueueItemStatus } from './updateQueueItemStatus';
import { listQueueBoard } from './listQueueBoard';
import { createWaitlistEntry } from './createWaitlistEntry';
import { listWaitlist } from './listWaitlist';
import { promoteWaitlistEntry } from './promoteWaitlistEntry';
import { createBookingHold } from './createBookingHold';
import { createOnlineBooking } from './createOnlineBooking';
import { checkInAppointment } from './checkInAppointment';
import { availabilityLimiter, bookingWriteLimiter } from './public-booking-ratelimit';
import {
  CreateQueueItemParams,
  CreateQueueItemBody,
  UpdateQueueItemStatusParams,
  UpdateQueueItemStatusBody,
  ListQueueBoardParams,
  CreateWaitlistEntryParams,
  CreateWaitlistEntryBody,
  ListWaitlistParams,
  ListWaitlistQuery,
  PromoteWaitlistEntryParams,
  PromoteWaitlistEntryBody,
  CreateBookingHoldParams,
  CreateBookingHoldBody,
  CreateOnlineBookingParams,
  CreateOnlineBookingBody,
  CheckInAppointmentParams,
} from '@/generated/openapi/validators';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// The genuine db.transaction, captured BEFORE any spyOn replaces it.
const realTransaction = db.transaction.bind(db);

// File-unique ids (own clone, distinct prefix 1be = P1b scheduling PR-B).
const USER = { id: '1be00000-0000-4000-8000-00000000a001', email: 'owner@a.com' };
const ORG = '1be00000-0000-4000-8000-00000000a002';
const BRANCH = '1be00000-0000-4000-8000-00000000a003';
const MEMBER = '1be00000-0000-4000-8000-00000000a004';
const PERSON = '1be00000-0000-4000-8000-00000000a005';
const PATIENT = '1be00000-0000-4000-8000-00000000a006';

// Working hours: Mon–Fri 09:00–17:00 UTC + online booking enabled (for the
// public hold/booking handlers, which gate on config + working hours).
const WORKING_HOURS = JSON.stringify({
  monday: { enabled: true, open: '09:00', close: '17:00' },
  tuesday: { enabled: true, open: '09:00', close: '17:00' },
  wednesday: { enabled: true, open: '09:00', close: '17:00' },
  thursday: { enabled: true, open: '09:00', close: '17:00' },
  friday: { enabled: true, open: '09:00', close: '17:00' },
  saturday: { enabled: false },
  sunday: { enabled: false },
});
const ENABLED_SETTINGS = {
  onlineBooking: {
    enabled: true,
    bookableVisitTypes: ['checkup', 'recall'],
    leadTimeMinutes: 60,
    horizonDays: 60,
    slotStepMinutes: 30,
    requirePatientAuth: false,
  },
} as any;

// A far-future weekday slot, always inside working hours / past lead-time /
// within horizon. `seq` reserves a distinct slot per call so bookings/holds
// never collide across tests.
let _slotSeq = 0;
function uniqueBookableSlot(): Date {
  const seq = _slotSeq++;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 21 + Math.floor(seq / 7) * 7);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(9 + (seq % 7), 0, 0, 0);
  return d;
}

beforeAll(async () => {
  await db.insert(dentalOrganizations).values({ id: ORG, name: '1be Clinic', tier: 'solo', ownerPersonId: USER.id, countryCode: 'PH', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH, organizationId: ORG, name: 'Main', timezone: 'UTC', workingHours: WORKING_HOURS, active: true, settings: ENABLED_SETTINGS, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER, branchId: BRANCH, personId: USER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON, firstName: 'Test', lastName: 'Patient', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT, person: PERSON, preferredBranchId: BRANCH, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
});

beforeEach(() => {
  availabilityLimiter.reset();
  bookingWriteLimiter.reset();
});

/** Seed an appointment (as superuser) in the given status at a future slot. */
async function seedAppointment(opts: { status?: string; at?: Date } = {}) {
  const [row] = await db.insert(dentalAppointments).values({
    id: crypto.randomUUID(), patientId: PATIENT, dentistMemberId: MEMBER, branchId: BRANCH,
    scheduledAt: opts.at ?? uniqueBookableSlot(), durationMinutes: 30, serviceType: 'checkup',
    status: (opts.status ?? 'scheduled') as any, walkIn: false,
    createdBy: USER.id, updatedBy: USER.id,
  }).returning();
  return row!;
}

/** Seed an active waitlist entry. */
async function seedWaitlistEntry() {
  return new DentalWaitlistEntryRepository(db).createOne({
    patientId: PATIENT, branchId: BRANCH, preferredProviderId: MEMBER,
    visitType: 'checkup', urgency: 'routine', status: 'active', notes: null,
    createdBy: USER.id, updatedBy: USER.id,
  });
}

const ve = (r: any, c: any) => { if (!r.success) return c.json({ error: 'Validation failed', issues: r.error.issues }, 400); };

/**
 * Spy on db.transaction and record whether any committed tx ran as `app_rls`
 * (the SET LOCAL ROLE that withTenantTx issues). FALSE before activation
 * (handlers either open no tx, or open one as the superuser `postgres`),
 * TRUE after — the genuine RED→GREEN signal, confounder-proof.
 */
function installRoleProbe() {
  let sawAppRls = false;
  const spy = spyOn(db, 'transaction').mockImplementation(((cb: any) =>
    realTransaction(async (tx: any) => {
      const result = await cb(tx);
      try {
        const res: any = await tx.execute(sql`SELECT current_user AS u`);
        const u = res?.rows?.[0]?.u ?? res?.[0]?.u;
        if (u === 'app_rls') sawAppRls = true;
      } catch { /* probe is best-effort */ }
      return result;
    })) as any);
  return { spy, sawAppRls: () => sawAppRls };
}

function authedApp(method: 'get' | 'post' | 'patch', path: string, ...mw: any[]) {
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
  (app as any)[method](path, ...mw);
  return app;
}

function publicApp(method: 'post', path: string, ...mw: any[]) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err.message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug() {}, info() {}, warn() {}, error() {} });
    await next();
  });
  (app as any)[method](path, ...mw);
  return app;
}

describe('RLS P1b — dental-scheduling queue/waitlist/booking/check-in route through withTenantTx (activation)', () => {
  test('createQueueItem opens an app_rls tenant tx and writes the queue item', async () => {
    const appt = await seedAppointment();
    const { sawAppRls } = installRoleProbe();
    try {
      const app = authedApp('post', '/dental/appointments/:appointmentId/queue-item',
        zValidator('param', CreateQueueItemParams, ve), zValidator('json', CreateQueueItemBody, ve), createQueueItem as any);
      const res = await app.request(`/dental/appointments/${appt.id}/queue-item`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ notes: 'walk-in' }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.branchId).toBe(BRANCH);   // correct scope (WITH CHECK passed)
      expect(sawAppRls()).toBe(true);        // ROUTING under app_rls (RED before)
    } finally {
      spyOn(db, 'transaction').mockRestore();
    }
  });

  test('updateQueueItemStatus opens an app_rls tenant tx and writes the patch', async () => {
    const appt = await seedAppointment();
    const item = await new (await import('./repos/queue-item.repo')).QueueItemRepository(db).createOne({
      appointmentId: appt.id, patientId: PATIENT, branchId: BRANCH, status: 'waiting',
      notes: null, createdBy: USER.id, updatedBy: USER.id,
    });
    const { sawAppRls } = installRoleProbe();
    try {
      const app = authedApp('patch', '/dental/queue-items/:itemId/status',
        zValidator('param', UpdateQueueItemStatusParams, ve), zValidator('json', UpdateQueueItemStatusBody, ve), updateQueueItemStatus as any);
      const res = await app.request(`/dental/queue-items/${item.id}/status`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'called' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.status).toBe('called');
      expect(sawAppRls()).toBe(true);
    } finally {
      spyOn(db, 'transaction').mockRestore();
    }
  });

  test('listQueueBoard opens an app_rls tenant tx and returns the branch board', async () => {
    const appt = await seedAppointment();
    const item = await new (await import('./repos/queue-item.repo')).QueueItemRepository(db).createOne({
      appointmentId: appt.id, patientId: PATIENT, branchId: BRANCH, status: 'waiting',
      notes: null, createdBy: USER.id, updatedBy: USER.id,
    });
    const { sawAppRls } = installRoleProbe();
    try {
      const app = authedApp('get', '/dental/branches/:branchId/queue-board',
        zValidator('param', ListQueueBoardParams, ve), listQueueBoard as any);
      const res = await app.request(`/dental/branches/${BRANCH}/queue-board`);
      expect(res.status).toBe(200);
      const body = await res.json() as any[];
      expect(body.map((q) => q.id)).toContain(item.id);
      expect(sawAppRls()).toBe(true);
    } finally {
      spyOn(db, 'transaction').mockRestore();
    }
  });

  test('createWaitlistEntry opens an app_rls tenant tx and writes the entry', async () => {
    const { sawAppRls } = installRoleProbe();
    try {
      const app = authedApp('post', '/dental/branches/:branchId/waitlist',
        zValidator('param', CreateWaitlistEntryParams, ve), zValidator('json', CreateWaitlistEntryBody, ve), createWaitlistEntry as any);
      const res = await app.request(`/dental/branches/${BRANCH}/waitlist`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ patientId: PATIENT, preferredProviderId: MEMBER, visitType: 'checkup', urgency: 'routine' }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.branchId).toBe(BRANCH);
      expect(sawAppRls()).toBe(true);
    } finally {
      spyOn(db, 'transaction').mockRestore();
    }
  });

  test('listWaitlist opens an app_rls tenant tx and returns the branch waitlist', async () => {
    const entry = await seedWaitlistEntry();
    const { sawAppRls } = installRoleProbe();
    try {
      const app = authedApp('get', '/dental/branches/:branchId/waitlist',
        zValidator('param', ListWaitlistParams, ve), zValidator('query', ListWaitlistQuery, ve), listWaitlist as any);
      const res = await app.request(`/dental/branches/${BRANCH}/waitlist`);
      expect(res.status).toBe(200);
      const body = await res.json() as any[];
      expect(body.map((w) => w.id)).toContain(entry.id);
      expect(sawAppRls()).toBe(true);
    } finally {
      spyOn(db, 'transaction').mockRestore();
    }
  });

  test('createBookingHold opens an app_rls tenant tx and returns a session token', async () => {
    const slot = uniqueBookableSlot();
    const { sawAppRls } = installRoleProbe();
    try {
      const app = publicApp('post', '/dental/public/branches/:branchId/holds',
        zValidator('param', CreateBookingHoldParams, ve), zValidator('json', CreateBookingHoldBody, ve), createBookingHold as any);
      const res = await app.request(`/dental/public/branches/${BRANCH}/holds`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ providerId: MEMBER, startAt: slot.toISOString(), visitType: 'checkup' }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.sessionToken).toBeTruthy();
      expect(sawAppRls()).toBe(true);
    } finally {
      spyOn(db, 'transaction').mockRestore();
    }
  });

  // ----- internal-tx confounders: promote / online-booking / check-in -----

  test('promoteWaitlistEntry runs its appointment+waitlist write as app_rls', async () => {
    const entry = await seedWaitlistEntry();
    const slot = uniqueBookableSlot();
    const { sawAppRls } = installRoleProbe();
    try {
      const app = authedApp('post', '/dental/waitlist/:entryId/promote',
        zValidator('param', PromoteWaitlistEntryParams, ve), zValidator('json', PromoteWaitlistEntryBody, ve), promoteWaitlistEntry as any);
      const res = await app.request(`/dental/waitlist/${entry.id}/promote`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ startAt: slot.toISOString(), endAt: new Date(slot.getTime() + 30 * 60_000).toISOString() }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.entry.status).toBe('scheduled');
      expect(body.appointment.branchId).toBe(BRANCH);   // correct scope
      expect(sawAppRls()).toBe(true);                    // tx now runs as app_rls (confounded RED)
    } finally {
      spyOn(db, 'transaction').mockRestore();
    }
  });

  test('createOnlineBooking runs its commit tx as app_rls', async () => {
    const slot = uniqueBookableSlot();
    const { sawAppRls } = installRoleProbe();
    try {
      const app = publicApp('post', '/dental/public/branches/:branchId/bookings',
        zValidator('param', CreateOnlineBookingParams, ve), zValidator('json', CreateOnlineBookingBody, ve), createOnlineBooking as any);
      const res = await app.request(`/dental/public/branches/${BRANCH}/bookings`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ providerId: MEMBER, startAt: slot.toISOString(), visitType: 'checkup', firstName: 'Online', lastName: 'Booker' }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.status).toBe('scheduled');
      expect(body.branchId).toBe(BRANCH);
      expect(sawAppRls()).toBe(true);
    } finally {
      spyOn(db, 'transaction').mockRestore();
    }
  });

  test('checkInAppointment runs its check-in+visit-create tx as app_rls', async () => {
    const appt = await seedAppointment({ status: 'scheduled' });
    const { sawAppRls } = installRoleProbe();
    try {
      const app = authedApp('post', '/dental/appointments/:appointmentId/check-in',
        zValidator('param', CheckInAppointmentParams, ve), checkInAppointment as any);
      const res = await app.request(`/dental/appointments/${appt.id}/check-in`, { method: 'POST' });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.visitId).toBeTruthy();
      expect(body.appointment.status).toBe('checked_in');
      expect(sawAppRls()).toBe(true);
    } finally {
      spyOn(db, 'transaction').mockRestore();
    }
  });
});
