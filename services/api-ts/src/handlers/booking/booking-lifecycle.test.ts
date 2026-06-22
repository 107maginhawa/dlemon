/**
 * booking-lifecycle.test.ts
 *
 * Generic booking module — status-transition FSM + slot-release side effects,
 * driven against a REAL seeded host / time-slot / booking (booking.repo.test.ts
 * uses a MOCK db and the existing booking-coverage.test.ts stops at the 404/403
 * gates because nothing is seeded). The ledger flagged these as uncovered:
 *   - markNoShowBooking: exclusivity (NO_SHOW_ALREADY_MARKED), confirmed-only
 *     status guard (INVALID_STATUS_FOR_NO_SHOW), timing (NO_SHOW_TOO_EARLY),
 *     and the positive transition.
 *   - rejectBooking: pending-only guard (INVALID_STATUS_TRANSITION) + the
 *     positive transition that releases the slot back to 'available'.
 *   - cancelBooking: the positive transition + slot release.
 *
 * Pattern: openTestTx (real Postgres, auto-rollback) + a thin Hono mount that
 * drives each handler through the real generated zValidator (param + body), so
 * the handler runs its real ownership/status/timing logic and real repo writes.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { openTestTx } from '@/core/test-tx';
import { AppError } from '@/core/errors';
import type { Logger } from '@/types/logger';
// The three booking-action ops share an identical param ({booking: uuid}) and
// body (BookingActionRequest) schema — reuse one pair to drive the real
// generated validators (same ones production mounts) in front of each handler.
import { MarkNoShowBookingParams, MarkNoShowBookingBody } from '@/generated/openapi/validators';
import { persons } from '@/handlers/person/repos/person.schema';
import { bookingEvents, timeSlots, bookings } from './repos/booking.schema';

const noop = () => {};
const logger = { debug: noop, info: noop, warn: noop, error: noop } as unknown as Logger;

// Namespace: bl (booking-lifecycle)
const HOST_ID    = 'b1000000-0000-4000-8000-000000000001';
const CLIENT_ID  = 'b1000000-0000-4000-8000-000000000002';
const STRANGER_ID = 'b1000000-0000-4000-8000-000000000003';
const EVENT_ID   = 'b1000000-0000-4000-8000-000000000010';
const SLOT_ID    = 'b1000000-0000-4000-8000-000000000020';
const BOOKING_ID = 'b1000000-0000-4000-8000-000000000030';

const HOST    = { id: HOST_ID, email: 'host@bl.test', role: 'user' };
const CLIENT  = { id: CLIENT_ID, email: 'client@bl.test', role: 'user' };
const STRANGER = { id: STRANGER_ID, email: 'stranger@bl.test', role: 'user' };

let db: NodePgDatabase;
let teardown: () => Promise<void>;

beforeEach(async () => {
  const tx = await openTestTx();
  db = tx.db;
  teardown = tx.rollback;

  await db.insert(persons).values([
    { id: HOST_ID, firstName: 'Host', lastName: 'Provider' },
    { id: CLIENT_ID, firstName: 'Client', lastName: 'Patient' },
    { id: STRANGER_ID, firstName: 'Stran', lastName: 'Ger' },
  ]).onConflictDoNothing();

  await db.insert(bookingEvents).values({
    id: EVENT_ID,
    owner: HOST_ID,
    title: 'Consultation',
    dailyConfigs: [] as never,
  } as never);

  // Slot inserted first (circular FK: booking.slot → slot, slot.booking → booking).
  await db.insert(timeSlots).values({
    id: SLOT_ID,
    owner: HOST_ID,
    event: EVENT_ID,
    startTime: new Date('2026-03-01T09:00:00Z'),
    endTime: new Date('2026-03-01T09:30:00Z'),
    locationTypes: ['in-person'] as never,
    status: 'booked',
  } as never);
});

afterEach(() => teardown());

// Seed a booking in a given status, scheduled `minutesAgo` minutes in the past,
// and link the slot to it. Returns nothing; tests read back via the db.
async function seedBooking(status: string, minutesAgo = 30) {
  const scheduledAt = new Date(Date.now() - minutesAgo * 60_000);
  await db.insert(bookings).values({
    id: BOOKING_ID,
    client: CLIENT_ID,
    host: HOST_ID,
    slot: SLOT_ID,
    locationType: 'in-person',
    status: status as never,
    scheduledAt,
    durationMinutes: 30,
  } as never);
  await db.update(timeSlots).set({ booking: BOOKING_ID }).where(eq(timeSlots.id, SLOT_ID));
}

// Handler mount through the real generated validators (zValidator), so the
// param/body traverse the same validation production runs. Context deps
// (db/logger/notifs/ws/user) are injected by a leading middleware.
function mount(
  handler: any,
  user: { id: string; email: string; role: string } | undefined,
  validJson: Record<string, unknown> = {},
) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String((err as Error).message) }, 500);
  });
  app.use('*', async (c: any, next) => {
    c.set('database', db);
    c.set('logger', logger);
    c.set('auth', { api: { getSession: async () => null } });
    c.set('notifs', { createNotification: async () => ({}) });
    c.set('ws', { publishToUser: async () => {} });
    if (user) {
      c.set('user', user);
      c.set('session', { id: 'sess-bl', user });
    }
    await next();
  });
  app.post(
    '/booking/bookings/:booking/action',
    zValidator('param', MarkNoShowBookingParams),
    zValidator('json', MarkNoShowBookingBody),
    handler,
  );
  return { app, body: validJson };
}

const fire = ({ app, body }: { app: Hono; body: Record<string, unknown> }) =>
  app.request(`/booking/bookings/${BOOKING_ID}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

async function slotStatus() {
  const [s] = await db
    .select({ status: timeSlots.status, booking: timeSlots.booking })
    .from(timeSlots)
    .where(eq(timeSlots.id, SLOT_ID));
  return s!;
}

// ─────────────────────────────────────────────────────────────────────────────
// markNoShowBooking
// ─────────────────────────────────────────────────────────────────────────────

describe('markNoShowBooking — confirmed-only + exclusivity + timing', () => {
  test('host marks a confirmed booking 30min past → 200, status no_show_host, marker stamped', async () => {
    await seedBooking('confirmed', 30);
    const { markNoShowBooking } = await import('./markNoShowBooking');
    const res = await fire(mount(markNoShowBooking, HOST, { reason: 'No-show' }));
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string; noShowMarkedBy: string; noShowMarkedAt: string };
    expect(body.status).toBe('no_show_host');
    expect(body.noShowMarkedBy).toBe('host');
    expect(body.noShowMarkedAt).not.toBeNull();
  });

  test('marking no-show on an already-no-show booking → 422 NO_SHOW_ALREADY_MARKED (exclusivity)', async () => {
    await seedBooking('no_show_host', 30);
    const { markNoShowBooking } = await import('./markNoShowBooking');
    const res = await fire(mount(markNoShowBooking, HOST, { reason: 'No-show' }));
    expect(res.status).toBe(422);
    expect((await res.json() as { code: string }).code).toBe('NO_SHOW_ALREADY_MARKED');
  });

  test('marking no-show on a pending (not confirmed) booking → 422 INVALID_STATUS_FOR_NO_SHOW', async () => {
    await seedBooking('pending', 30);
    const { markNoShowBooking } = await import('./markNoShowBooking');
    const res = await fire(mount(markNoShowBooking, HOST, { reason: 'No-show' }));
    expect(res.status).toBe(422);
    expect((await res.json() as { code: string }).code).toBe('INVALID_STATUS_FOR_NO_SHOW');
  });

  test('host marks before the 10-minute grace window → 422 NO_SHOW_TOO_EARLY', async () => {
    await seedBooking('confirmed', 2); // only 2 min past; host needs 10
    const { markNoShowBooking } = await import('./markNoShowBooking');
    const res = await fire(mount(markNoShowBooking, HOST, { reason: 'No-show' }));
    expect(res.status).toBe(422);
    expect((await res.json() as { code: string }).code).toBe('NO_SHOW_TOO_EARLY');
  });

  test('a stranger (neither client nor host) cannot mark no-show → 403 FORBIDDEN', async () => {
    await seedBooking('confirmed', 30);
    const { markNoShowBooking } = await import('./markNoShowBooking');
    const res = await fire(mount(markNoShowBooking, STRANGER, { reason: 'No-show' }));
    expect(res.status).toBe(403);
    expect((await res.json() as { code: string }).code).toBe('FORBIDDEN');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// rejectBooking — pending-only + slot release
// ─────────────────────────────────────────────────────────────────────────────

describe('rejectBooking — pending-only transition + slot release', () => {
  test('host rejects a pending booking → 200 rejected AND the slot is released to available', async () => {
    await seedBooking('pending', 30);
    expect((await slotStatus()).status).toBe('booked');

    const { rejectBooking } = await import('./rejectBooking');
    const res = await fire(mount(rejectBooking, HOST, { reason: 'No availability' }));
    expect(res.status).toBe(200);
    expect((await res.json() as { status: string }).status).toBe('rejected');

    // Slot freed: status back to available, booking link cleared.
    const slot = await slotStatus();
    expect(slot.status).toBe('available');
    expect(slot.booking).toBeNull();
  });

  test('rejecting a confirmed (non-pending) booking → 422 INVALID_STATUS_TRANSITION (slot untouched)', async () => {
    await seedBooking('confirmed', 30);
    const { rejectBooking } = await import('./rejectBooking');
    const res = await fire(mount(rejectBooking, HOST, { reason: 'too late' }));
    expect(res.status).toBe(422);
    expect((await res.json() as { code: string }).code).toBe('INVALID_STATUS_TRANSITION');
    // Guard fired before any write — slot remains booked.
    expect((await slotStatus()).status).toBe('booked');
  });

  test('the client (not the host) cannot reject → 403 FORBIDDEN', async () => {
    await seedBooking('pending', 30);
    const { rejectBooking } = await import('./rejectBooking');
    const res = await fire(mount(rejectBooking, CLIENT, { reason: 'nope' }));
    expect(res.status).toBe(403);
    expect((await res.json() as { code: string }).code).toBe('FORBIDDEN');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cancelBooking — slot release on mutual cancellation
// ─────────────────────────────────────────────────────────────────────────────

describe('cancelBooking — transition + slot release', () => {
  test('the client cancels a confirmed booking → 200 cancelled AND the slot is released', async () => {
    await seedBooking('confirmed', 30);
    const { cancelBooking } = await import('./cancelBooking');
    const res = await fire(mount(cancelBooking, CLIENT, { reason: 'Feeling better' }));
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string; cancelledBy: string };
    expect(body.status).toBe('cancelled');
    expect(body.cancelledBy).toBe('client');

    const slot = await slotStatus();
    expect(slot.status).toBe('available');
    expect(slot.booking).toBeNull();
  });
});
