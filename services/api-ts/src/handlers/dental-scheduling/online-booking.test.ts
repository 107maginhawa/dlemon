/**
 * P1-25 online / self-service booking — DB-bound handler tests.
 *
 * Wires the public handlers through a Hono app with the same zValidator
 * middleware the generated routes use, against the real test DB (per-file clone).
 * Covers: config, availability (subtracts appointments + holds), hold lifecycle,
 * commit happy-path, hard double-book block, non-bookable visit type, outside
 * working hours, requirePatientAuth gate, match-or-create, concurrency, lookup,
 * and the check-in → draft visit flow for an online booking.
 */

import { describe, test, expect, beforeAll, beforeEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import {
  GetPublicBookingConfigParams,
  GetPublicAvailabilityParams,
  GetPublicAvailabilityQuery,
  CreateBookingHoldParams,
  CreateBookingHoldBody,
  CreateOnlineBookingParams,
  CreateOnlineBookingBody,
  GetOnlineBookingParams,
  CheckInAppointmentParams,
} from '@/generated/openapi/validators';

import { getPublicBookingConfig } from './getPublicBookingConfig';
import { getPublicAvailability } from './getPublicAvailability';
import { createBookingHold } from './createBookingHold';
import { createOnlineBooking } from './createOnlineBooking';
import { getOnlineBooking } from './getOnlineBooking';
import { checkInAppointment } from './checkInAppointment';
import { DentalAppointmentRepository } from './repos/dental-appointment.repo';
import { AppointmentHoldRepository } from './repos/appointment-hold.repo';
import { availabilityLimiter, bookingWriteLimiter } from './public-booking-ratelimit';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique ids (tag b25) to avoid cross-suite collisions on the membership
// partial-unique (person_id, branch_id) index.
const ORG_ID = 'f0000000-0000-1000-8000-0000000b2500';
const BRANCH_ID = '7b000000-0000-4000-8000-000000b25001';
const BRANCH_DISABLED_ID = '7b000000-0000-4000-8000-000000b25002';
const BRANCH_AUTH_ID = '7b000000-0000-4000-8000-000000b25003';
const PROVIDER_ID = '7c000000-0000-4000-8000-000000b25001';
const PROVIDER_PERSON_ID = 'e0000000-0000-1000-8000-000000b25001';
const OWNER_PERSON_ID = 'e0000000-0000-1000-8000-000000b25009';

// Working hours: Mon–Fri 09:00–17:00 UTC.
const WORKING_HOURS = JSON.stringify({
  monday: { enabled: true, open: '09:00', close: '17:00' },
  tuesday: { enabled: true, open: '09:00', close: '17:00' },
  wednesday: { enabled: true, open: '09:00', close: '17:00' },
  thursday: { enabled: true, open: '09:00', close: '17:00' },
  friday: { enabled: true, open: '09:00', close: '17:00' },
  saturday: { enabled: false },
  sunday: { enabled: false },
});

// onlineBooking lives inside the settings JSONB blob (not on the typed
// BranchSettings interface) — cast to satisfy the column type in the test seed.
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

// Pick a far-future weekday (a Monday) at the given hour UTC so it is always
// inside working hours, past lead-time, and within horizon. `weekOffset` lets
// each test reserve a distinct week so cross-test bookings/holds never collide
// (the suite has no per-test DB cleanup — distinct slots keep tests independent).
function bookableMondayAt(hourUtc: number, weekOffset = 0): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 14 + weekOffset * 7);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d;
}

// Monotonic distinct-slot allocator: each call returns a slot no other call has
// returned, spread across weeks/hours within 09:00–16:00.
let _slotSeq = 0;
function uniqueBookableSlot(): Date {
  const seq = _slotSeq++;
  const hour = 9 + (seq % 7); // 09..15
  const week = Math.floor(seq / 7);
  return bookableMondayAt(hour, week);
}

// Hono app with the same AppError → status mapping the real server uses, plus a
// no-op logger + injected database. Handlers throw AppError; onError maps them.
const minimalApp = () => {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String((err as Error).message) }, 500);
  });
  app.use('*', async (c, next) => {
    (c as any).set('database', db);
    (c as any).set('logger', { debug() {}, info() {}, warn() {}, error() {} });
    await next();
  });
  return app;
};

beforeAll(async () => {
  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Booking Clinic', tier: 'solo', ownerPersonId: OWNER_PERSON_ID,
    countryCode: 'PH', createdBy: OWNER_PERSON_ID, updatedBy: OWNER_PERSON_ID,
  }).onConflictDoNothing();

  await db.insert(persons).values({
    id: PROVIDER_PERSON_ID, firstName: 'Dr', lastName: 'Bookable',
    createdBy: OWNER_PERSON_ID, updatedBy: OWNER_PERSON_ID,
  }).onConflictDoNothing();

  await db.insert(dentalBranches).values([
    {
      id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch', timezone: 'UTC',
      workingHours: WORKING_HOURS, active: true, settings: ENABLED_SETTINGS,
      createdBy: OWNER_PERSON_ID, updatedBy: OWNER_PERSON_ID,
    },
    {
      id: BRANCH_DISABLED_ID, organizationId: ORG_ID, name: 'Disabled Branch', timezone: 'UTC',
      workingHours: WORKING_HOURS, active: true, settings: { onlineBooking: { enabled: false } } as any,
      createdBy: OWNER_PERSON_ID, updatedBy: OWNER_PERSON_ID,
    },
    {
      // Online booking enabled but gated to verified patients (requirePatientAuth=true):
      // a prospect (unauthenticated) commit must be rejected with PATIENT_AUTH_REQUIRED.
      id: BRANCH_AUTH_ID, organizationId: ORG_ID, name: 'Auth-Required Branch', timezone: 'UTC',
      workingHours: WORKING_HOURS, active: true,
      settings: {
        onlineBooking: {
          enabled: true, bookableVisitTypes: ['checkup', 'recall'],
          leadTimeMinutes: 60, horizonDays: 60, slotStepMinutes: 30, requirePatientAuth: true,
        },
      } as any,
      createdBy: OWNER_PERSON_ID, updatedBy: OWNER_PERSON_ID,
    },
  ]).onConflictDoNothing();

  await db.insert(dentalMemberships).values({
    id: PROVIDER_ID, branchId: BRANCH_ID, personId: PROVIDER_PERSON_ID,
    displayName: 'Dr. Bookable', role: 'dentist_owner', status: 'active',
    createdBy: OWNER_PERSON_ID, updatedBy: OWNER_PERSON_ID,
  }).onConflictDoNothing();
});

beforeEach(() => {
  availabilityLimiter.reset();
  bookingWriteLimiter.reset();
});

// Build apps that mirror generated route wiring (param/query/json validators).
function configApp() {
  const app = minimalApp();
  app.use('*', async (c, next) => { (c as any).set('database', db); await next(); });
  app.get('/dental/public/branches/:branchId/booking-config',
    zValidator('param', GetPublicBookingConfigParams), getPublicBookingConfig as any);
  return app;
}
function availabilityApp() {
  const app = minimalApp();
  app.use('*', async (c, next) => { (c as any).set('database', db); await next(); });
  app.get('/dental/public/branches/:branchId/availability',
    zValidator('param', GetPublicAvailabilityParams),
    zValidator('query', GetPublicAvailabilityQuery), getPublicAvailability as any);
  return app;
}
function holdApp() {
  const app = minimalApp();
  app.use('*', async (c, next) => { (c as any).set('database', db); await next(); });
  app.post('/dental/public/branches/:branchId/holds',
    zValidator('param', CreateBookingHoldParams),
    zValidator('json', CreateBookingHoldBody), createBookingHold as any);
  return app;
}
function bookingApp() {
  const app = minimalApp();
  app.use('*', async (c, next) => { (c as any).set('database', db); await next(); });
  app.post('/dental/public/branches/:branchId/bookings',
    zValidator('param', CreateOnlineBookingParams),
    zValidator('json', CreateOnlineBookingBody), createOnlineBooking as any);
  return app;
}
function lookupApp() {
  const app = minimalApp();
  app.use('*', async (c, next) => { (c as any).set('database', db); await next(); });
  app.get('/dental/public/bookings/:confirmationCode',
    zValidator('param', GetOnlineBookingParams), getOnlineBooking as any);
  return app;
}

const dateKey = (d: Date) => d.toISOString().slice(0, 10);

async function safeReq(app: Hono, req: Request): Promise<Response> {
  try {
    return await app.fetch(req);
  } catch (err) {
    if (err instanceof AppError) {
      return new Response(JSON.stringify({ error: err.message, code: err.code }), {
        status: err.statusCode, headers: { 'content-type': 'application/json' },
      });
    }
    throw err;
  }
}

describe('GET booking-config', () => {
  test('returns enabled policy + providers for an enabled branch', async () => {
    const app = configApp();
    const res = await safeReq(app, new Request(`http://x/dental/public/branches/${BRANCH_ID}/booking-config`));
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.enabled).toBe(true);
    expect(body.bookableVisitTypes).toContain('checkup');
    expect(body.providers.some((p: any) => p.providerId === PROVIDER_ID)).toBe(true);
    // PII-free: no patient fields.
    expect(JSON.stringify(body)).not.toContain('patient');
  });

  test('404 for unknown branch', async () => {
    const app = configApp();
    const res = await safeReq(app, new Request(`http://x/dental/public/branches/7b000000-0000-4000-8000-0000000000ff/booking-config`));
    expect(res.status).toBe(404);
  });
});

describe('GET availability', () => {
  test('returns open checkup slots inside working hours, PII-free', async () => {
    const app = availabilityApp();
    const day = uniqueBookableSlot();
    const res = await safeReq(app, new Request(
      `http://x/dental/public/branches/${BRANCH_ID}/availability?visitType=checkup&date_from=${dateKey(day)}&date_to=${dateKey(day)}&providerId=${PROVIDER_ID}`,
    ));
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.slots.length).toBeGreaterThan(0);
    expect(body.slots[0]).toHaveProperty('startAt');
    expect(body.slots[0]).toHaveProperty('providerId', PROVIDER_ID);
    expect(JSON.stringify(body)).not.toContain('patientId');
  });

  test('rejects a non-bookable visit type (400)', async () => {
    const app = availabilityApp();
    const day = uniqueBookableSlot();
    const res = await safeReq(app, new Request(
      `http://x/dental/public/branches/${BRANCH_ID}/availability?visitType=emergency&date_from=${dateKey(day)}&date_to=${dateKey(day)}`,
    ));
    expect(res.status).toBe(400);
  });

  test('availability subtracts an existing appointment', async () => {
    const app = availabilityApp();
    const day = uniqueBookableSlot();
    // Book a staff appointment at 11:00 for the provider.
    const apptRepo = new DentalAppointmentRepository(db);
    const patientPersonId = crypto.randomUUID();
    await db.insert(persons).values({ id: patientPersonId, firstName: 'P', createdBy: OWNER_PERSON_ID, updatedBy: OWNER_PERSON_ID });
    const { patients } = await import('@/handlers/patient/repos/patient.schema');
    const [pat] = await db.insert(patients).values({ person: patientPersonId, preferredBranchId: BRANCH_ID, createdBy: OWNER_PERSON_ID, updatedBy: OWNER_PERSON_ID }).returning();
    await apptRepo.createOne({
      patientId: pat!.id, dentistMemberId: PROVIDER_ID, branchId: BRANCH_ID,
      scheduledAt: day, durationMinutes: 30, serviceType: 'checkup', status: 'scheduled',
      createdBy: OWNER_PERSON_ID, updatedBy: OWNER_PERSON_ID,
    });
    const res = await safeReq(app, new Request(
      `http://x/dental/public/branches/${BRANCH_ID}/availability?visitType=checkup&date_from=${dateKey(day)}&date_to=${dateKey(day)}&providerId=${PROVIDER_ID}`,
    ));
    const body = await res.json() as any;
    expect(body.slots.find((s: any) => s.startAt === day.toISOString())).toBeUndefined();
  });

  test('availability excludes an actively-held slot but includes it after expiry', async () => {
    const day = uniqueBookableSlot();
    const holdRepo = new AppointmentHoldRepository(db);
    // Active hold at 14:00.
    await holdRepo.createOne({
      branchId: BRANCH_ID, providerId: PROVIDER_ID, startAt: day, durationMinutes: 30,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), sessionToken: crypto.randomUUID(),
      createdBy: OWNER_PERSON_ID, updatedBy: OWNER_PERSON_ID,
    });
    const app = availabilityApp();
    const held = await (await safeReq(app, new Request(
      `http://x/dental/public/branches/${BRANCH_ID}/availability?visitType=checkup&date_from=${dateKey(day)}&date_to=${dateKey(day)}&providerId=${PROVIDER_ID}`,
    ))).json() as any;
    expect(held.slots.find((s: any) => s.startAt === day.toISOString())).toBeUndefined();

    // Expired hold (separate slot) is ignored.
    const day2 = uniqueBookableSlot();
    await holdRepo.createOne({
      branchId: BRANCH_ID, providerId: PROVIDER_ID, startAt: day2, durationMinutes: 30,
      expiresAt: new Date(Date.now() - 1000), sessionToken: crypto.randomUUID(),
      createdBy: OWNER_PERSON_ID, updatedBy: OWNER_PERSON_ID,
    });
    const after = await (await safeReq(app, new Request(
      `http://x/dental/public/branches/${BRANCH_ID}/availability?visitType=checkup&date_from=${dateKey(day2)}&date_to=${dateKey(day2)}&providerId=${PROVIDER_ID}`,
    ))).json() as any;
    expect(after.slots.find((s: any) => s.startAt === day2.toISOString())).toBeDefined();
  });
});

describe('POST holds', () => {
  test('creates a hold and returns a session token', async () => {
    const app = holdApp();
    const day = uniqueBookableSlot();
    const res = await safeReq(app, new Request(`http://x/dental/public/branches/${BRANCH_ID}/holds`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerId: PROVIDER_ID, startAt: day.toISOString(), visitType: 'checkup' }),
    }));
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.sessionToken).toBeTruthy();
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  test('rejects a slot outside working hours (422)', async () => {
    const app = holdApp();
    const day = bookableMondayAt(20, 1); // 20:00 — after 17:00 close
    const res = await safeReq(app, new Request(`http://x/dental/public/branches/${BRANCH_ID}/holds`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerId: PROVIDER_ID, startAt: day.toISOString(), visitType: 'checkup' }),
    }));
    expect(res.status).toBe(422);
  });

  test('second hold on the same slot conflicts (409)', async () => {
    const app = holdApp();
    const day = uniqueBookableSlot();
    const first = await safeReq(app, new Request(`http://x/dental/public/branches/${BRANCH_ID}/holds`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerId: PROVIDER_ID, startAt: day.toISOString(), visitType: 'checkup' }),
    }));
    expect(first.status).toBe(201);
    const second = await safeReq(app, new Request(`http://x/dental/public/branches/${BRANCH_ID}/holds`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerId: PROVIDER_ID, startAt: day.toISOString(), visitType: 'checkup' }),
    }));
    expect(second.status).toBe(409);
  });
});

describe('POST bookings (commit)', () => {
  test('happy path: creates a scheduled online appointment + confirmation code', async () => {
    const app = bookingApp();
    const day = uniqueBookableSlot();
    const res = await safeReq(app, new Request(`http://x/dental/public/branches/${BRANCH_ID}/bookings`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        providerId: PROVIDER_ID, startAt: day.toISOString(), visitType: 'checkup',
        firstName: 'Jordan', lastName: 'Rivera', email: 'jordan.book@example.com', phone: '+15550000001',
      }),
    }));
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.confirmationCode).toBeTruthy();
    expect(body.status).toBe('scheduled');

    const appt = await new DentalAppointmentRepository(db).findOneById(body.appointmentId);
    expect(appt?.source).toBe('online');
    expect(appt?.confirmationState).toBe('pending');
  });

  test('hard double-book block: second commit for same slot returns 409', async () => {
    const app = bookingApp();
    const day = uniqueBookableSlot();
    const mk = () => safeReq(app, new Request(`http://x/dental/public/branches/${BRANCH_ID}/bookings`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerId: PROVIDER_ID, startAt: day.toISOString(), visitType: 'checkup', firstName: 'A' }),
    }));
    const first = await mk();
    expect(first.status).toBe(201);
    const second = await mk();
    expect(second.status).toBe(409);
  });

  test('rejects a non-bookable visit type (emergency) with 422', async () => {
    const app = bookingApp();
    const day = uniqueBookableSlot();
    const res = await safeReq(app, new Request(`http://x/dental/public/branches/${BRANCH_ID}/bookings`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerId: PROVIDER_ID, startAt: day.toISOString(), visitType: 'emergency', firstName: 'A' }),
    }));
    expect(res.status).toBe(422);
  });

  test('rejects a slot outside working hours (422)', async () => {
    const app = bookingApp();
    const day = bookableMondayAt(21, 2);
    const res = await safeReq(app, new Request(`http://x/dental/public/branches/${BRANCH_ID}/bookings`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerId: PROVIDER_ID, startAt: day.toISOString(), visitType: 'checkup', firstName: 'A' }),
    }));
    expect(res.status).toBe(422);
  });

  test('booking is disabled for a branch with enabled:false (422)', async () => {
    const app = bookingApp();
    const day = uniqueBookableSlot();
    const res = await safeReq(app, new Request(`http://x/dental/public/branches/${BRANCH_DISABLED_ID}/bookings`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerId: PROVIDER_ID, startAt: day.toISOString(), visitType: 'checkup', firstName: 'A' }),
    }));
    expect(res.status).toBe(422);
  });

  test('match-or-create: same email reuses the existing patient', async () => {
    const app = bookingApp();
    const { patients } = await import('@/handlers/patient/repos/patient.schema');
    const email = 'repeat.booker@example.com';
    const d1 = uniqueBookableSlot();
    await safeReq(app, new Request(`http://x/dental/public/branches/${BRANCH_ID}/bookings`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerId: PROVIDER_ID, startAt: d1.toISOString(), visitType: 'checkup', firstName: 'Repeat', email }),
    }));
    const before = await db.select({ c: sql<number>`count(*)` }).from(patients).where(sql`${patients.preferredBranchId} = ${BRANCH_ID}`);
    const d2 = uniqueBookableSlot();
    await safeReq(app, new Request(`http://x/dental/public/branches/${BRANCH_ID}/bookings`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerId: PROVIDER_ID, startAt: d2.toISOString(), visitType: 'checkup', firstName: 'Repeat', email }),
    }));
    const after = await db.select({ c: sql<number>`count(*)` }).from(patients).where(sql`${patients.preferredBranchId} = ${BRANCH_ID}`);
    expect(Number(after[0]!.c)).toBe(Number(before[0]!.c)); // no new patient created
  });

  test('concurrency: two simultaneous commits for the same slot → exactly one 201', async () => {
    const app = bookingApp();
    const day = uniqueBookableSlot();
    const mk = () => safeReq(app, new Request(`http://x/dental/public/branches/${BRANCH_ID}/bookings`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerId: PROVIDER_ID, startAt: day.toISOString(), visitType: 'checkup', firstName: 'Race' }),
    }));
    const [a, b] = await Promise.all([mk(), mk()]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);
  });

  test('requirePatientAuth=true rejects a prospect commit (422 PATIENT_AUTH_REQUIRED)', async () => {
    const app = bookingApp();
    const day = uniqueBookableSlot();
    const res = await safeReq(app, new Request(`http://x/dental/public/branches/${BRANCH_AUTH_ID}/bookings`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerId: PROVIDER_ID, startAt: day.toISOString(), visitType: 'checkup', firstName: 'Prospect' }),
    }));
    expect(res.status).toBe(422);
    expect((await res.json() as any).code).toBe('PATIENT_AUTH_REQUIRED');
  });

  test('an active competing hold (different session) blocks the commit (409 SLOT_HELD)', async () => {
    // Distinct from the SLOT_TAKEN double-book path: here nobody has committed an
    // appointment yet — another prospect just holds the slot. A commit that does not
    // carry that hold's token must be rejected with SLOT_HELD (not SLOT_TAKEN).
    const hold = holdApp();
    const booking = bookingApp();
    const day = uniqueBookableSlot();
    const held = await safeReq(hold, new Request(`http://x/dental/public/branches/${BRANCH_ID}/holds`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerId: PROVIDER_ID, startAt: day.toISOString(), visitType: 'checkup' }),
    }));
    expect(held.status).toBe(201);
    // Commit WITHOUT the hold's sessionToken → the active hold is not the caller's
    // own, so it blocks.
    const res = await safeReq(booking, new Request(`http://x/dental/public/branches/${BRANCH_ID}/bookings`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerId: PROVIDER_ID, startAt: day.toISOString(), visitType: 'checkup', firstName: 'Gatecrasher' }),
    }));
    expect(res.status).toBe(409);
    expect((await res.json() as any).code).toBe('SLOT_HELD');
  });

  test('the holder can commit their own held slot (own hold ignored by token)', async () => {
    const hold = holdApp();
    const booking = bookingApp();
    const day = uniqueBookableSlot();
    const held = await safeReq(hold, new Request(`http://x/dental/public/branches/${BRANCH_ID}/holds`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerId: PROVIDER_ID, startAt: day.toISOString(), visitType: 'checkup' }),
    }));
    const { sessionToken } = await held.json() as any;
    expect(sessionToken).toBeTruthy();
    const res = await safeReq(booking, new Request(`http://x/dental/public/branches/${BRANCH_ID}/bookings`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerId: PROVIDER_ID, startAt: day.toISOString(), visitType: 'checkup', firstName: 'Holder', sessionToken }),
    }));
    expect(res.status).toBe(201);
  });
});

describe('GET booking lookup + check-in flow', () => {
  test('lookup by confirmation code returns a PII-minimal view', async () => {
    const book = bookingApp();
    const day = uniqueBookableSlot();
    const created = await (await safeReq(book, new Request(`http://x/dental/public/branches/${BRANCH_ID}/bookings`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerId: PROVIDER_ID, startAt: day.toISOString(), visitType: 'checkup', firstName: 'Look', lastName: 'Up' }),
    }))).json() as any;

    const app = lookupApp();
    const res = await safeReq(app, new Request(`http://x/dental/public/bookings/${created.confirmationCode}`));
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.branchName).toBe('Main Branch');
    expect(body.confirmationState).toBe('pending');
    expect(JSON.stringify(body)).not.toContain('Look Up'); // no patient name leak
  });

  test('an online booking can be checked in by staff → draft visit', async () => {
    const book = bookingApp();
    const day = uniqueBookableSlot();
    const created = await (await safeReq(book, new Request(`http://x/dental/public/branches/${BRANCH_ID}/bookings`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerId: PROVIDER_ID, startAt: day.toISOString(), visitType: 'checkup', firstName: 'Checkin' }),
    }))).json() as any;

    // Staff check-in: build an app that injects an owner user + database.
    const app = minimalApp();
    app.use('*', async (c, next) => {
      (c as any).set('database', db);
      (c as any).set('user', { id: OWNER_PERSON_ID, email: 'owner@clinic.com' });
      await next();
    });
    app.post('/dental/appointments/:appointmentId/check-in',
      zValidator('param', CheckInAppointmentParams), checkInAppointment as any);

    // Owner needs a check-in-capable role; the provider membership IS the owner's
    // (PROVIDER_PERSON_ID). Re-point a membership for OWNER_PERSON_ID.
    await db.insert(dentalMemberships).values({
      id: crypto.randomUUID(), branchId: BRANCH_ID, personId: OWNER_PERSON_ID,
      displayName: 'Owner', role: 'dentist_owner', status: 'active',
      createdBy: OWNER_PERSON_ID, updatedBy: OWNER_PERSON_ID,
    }).onConflictDoNothing();

    const res = await safeReq(app, new Request(`http://x/dental/appointments/${created.appointmentId}/check-in`, { method: 'POST' }));
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.visitId).toBeTruthy();
    expect(body.appointment.status).toBe('checked_in');
  });
});
