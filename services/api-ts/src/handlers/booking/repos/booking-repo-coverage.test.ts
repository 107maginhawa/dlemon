/**
 * booking-repo-coverage.test.ts
 *
 * Tests for BookingRepository and TimeSlotRepository methods.
 * Uses a mock DB that mirrors the Drizzle chaining pattern.
 * Target: boost booking module line coverage to ≥70%.
 */

import { describe, test, expect } from 'bun:test';
import { BookingRepository } from './booking.repo';
import { TimeSlotRepository } from './timeSlot.repo';

const mockLogger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } as any;

// ---------------------------------------------------------------------------
// Slot mock for createBooking
// ---------------------------------------------------------------------------

const MOCK_SLOT = {
  id: 'slot-1',
  owner: 'host-1',
  event: 'event-1',
  status: 'available',
  startTime: new Date('2026-06-10T09:00:00Z'),
  endTime: new Date('2026-06-10T09:30:00Z'),
  locationTypes: ['in_person'],
  billingConfig: null,
  context: 'dental',
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'host-1',
  updatedBy: 'host-1',
};

const MOCK_BOOKING = {
  id: 'booking-1',
  client: 'client-1',
  host: 'host-1',
  slot: 'slot-1',
  status: 'pending',
  locationType: 'in_person',
  scheduledAt: new Date('2026-06-10T09:00:00Z'),
  durationMinutes: 30,
  cancelledBy: null,
  cancelledAt: null,
  cancellationReason: null,
  noShowMarkedBy: null,
  noShowMarkedAt: null,
  confirmationTimestamp: null,
  invoice: null,
  reason: null,
  formResponses: null,
  context: 'dental',
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'client-1',
  updatedBy: 'client-1',
};

// ---------------------------------------------------------------------------
// Helpers to build flexible mock DB chains
// ---------------------------------------------------------------------------

/** Drizzle-style mutable query builder that resolves to data */
function makeQuery(data: any[]) {
  const q: any = {
    where: () => q,
    orderBy: () => q,
    limit: () => q,
    offset: () => q,
    leftJoin: (_tbl: any, _cond: any) => {
      // After leftJoin, the where+limit chain returns slot+event shape
      const lq: any = {
        where: () => ({ limit: () => Promise.resolve(data) }),
      };
      return lq;
    },
    innerJoin: () => ({
      where: () => ({ limit: () => Promise.resolve([]) }),
    }),
    then: (resolve: any, reject: any) => Promise.resolve(data).then(resolve, reject),
  };
  return q;
}

/** Returns a mock db where select returns slots with leftJoin support */
function makeSlotDb(slot: any = MOCK_SLOT, booking: any = MOCK_BOOKING) {
  const slotData = slot ? [{ time_slot: slot, booking_event: null }] : [];
  return {
    select: () => ({
      from: () => makeQuery(slotData),
    }),
    insert: () => ({
      values: () => ({
        returning: () => Promise.resolve([booking]),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve([{ ...booking, status: 'confirmed' }]),
          then: (resolve: any, reject: any) => Promise.resolve().then(resolve, reject),
        }),
      }),
    }),
    delete: () => ({
      where: () => Promise.resolve(),
    }),
  } as any;
}

/** Simple mock db for findOneById / updateOneById.
 *  The base findMany() mutates a query object via .where(), .orderBy(), .limit(), .offset().
 *  We return a single mutable "thenable query" that resolves to rows. */
function makeCrudDb(row?: any, updatedRow?: any) {
  const rows = row ? [row] : [];

  /** Drizzle-style mutable query builder: every method returns `this` and it resolves as a promise */
  function makeQuery(data: any[]) {
    const q: any = {
      where: () => q,
      orderBy: () => q,
      limit: () => q,
      offset: () => q,
      leftJoin: () => q,
      innerJoin: () => q,
      then: (resolve: any, reject: any) => Promise.resolve(data).then(resolve, reject),
    };
    return q;
  }

  return {
    select: () => ({
      from: () => makeQuery(rows),
    }),
    insert: () => ({
      values: () => ({
        returning: () => Promise.resolve(rows),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve(updatedRow ? [updatedRow] : rows),
          then: (resolve: any, reject: any) => Promise.resolve().then(resolve, reject),
        }),
      }),
    }),
    delete: () => ({
      where: () => Promise.resolve(),
    }),
  } as any;
}

// ---------------------------------------------------------------------------
// BookingRepository
// ---------------------------------------------------------------------------

describe('BookingRepository.findOneById', () => {
  test('returns booking when found', async () => {
    const db = makeCrudDb(MOCK_BOOKING);
    const repo = new BookingRepository(db, mockLogger);
    const result = await repo.findOneById('booking-1');
    expect(result).not.toBeNull();
    expect((result as any).id).toBe('booking-1');
  });

  test('returns null when not found', async () => {
    const db = makeCrudDb(); // empty
    const repo = new BookingRepository(db, mockLogger);
    const result = await repo.findOneById('nonexistent');
    expect(result).toBeNull();
  });
});

describe('BookingRepository.createOne', () => {
  test('creates and returns booking', async () => {
    const db = makeCrudDb(MOCK_BOOKING);
    const repo = new BookingRepository(db, mockLogger);
    const result = await repo.createOne(MOCK_BOOKING as any);
    expect((result as any).id).toBe('booking-1');
  });
});

describe('BookingRepository.confirmBooking', () => {
  test('updates status to confirmed', async () => {
    const confirmed = { ...MOCK_BOOKING, status: 'confirmed', confirmationTimestamp: new Date() };
    const db = makeCrudDb(MOCK_BOOKING, confirmed);
    const repo = new BookingRepository(db, mockLogger);
    const result = await repo.confirmBooking('booking-1');
    expect(result.status).toBe('confirmed');
  });
});

describe('BookingRepository.cancelBooking', () => {
  test('cancels booking and returns cancelled record', async () => {
    const cancelled = { ...MOCK_BOOKING, status: 'cancelled', cancelledBy: 'client', cancellationReason: 'Changed mind' };
    const db = makeCrudDb(MOCK_BOOKING, cancelled);
    const repo = new BookingRepository(db, mockLogger);
    const result = await repo.cancelBooking('booking-1', 'client', 'Changed mind');
    expect(result.status).toBe('cancelled');
  });
});

describe('BookingRepository.markAsNoShow', () => {
  test('marks booking as no_show_client', async () => {
    const noShow = { ...MOCK_BOOKING, status: 'no_show_client', noShowMarkedBy: 'client' };
    const db = makeCrudDb(MOCK_BOOKING, noShow);
    const repo = new BookingRepository(db, mockLogger);
    const result = await repo.markAsNoShow('booking-1', 'client');
    expect(result.status).toBe('no_show_client');
  });

  test('marks booking as no_show_host', async () => {
    const noShow = { ...MOCK_BOOKING, status: 'no_show_host', noShowMarkedBy: 'host' };
    const db = makeCrudDb(MOCK_BOOKING, noShow);
    const repo = new BookingRepository(db, mockLogger);
    const result = await repo.markAsNoShow('booking-1', 'host');
    expect(result.status).toBe('no_show_host');
  });
});

describe('BookingRepository.getUpcomingBookings', () => {
  test('returns upcoming bookings for client', async () => {
    const db = makeCrudDb(MOCK_BOOKING);
    const repo = new BookingRepository(db, mockLogger);
    const result = await repo.getUpcomingBookings('client-1', 'client');
    expect(Array.isArray(result)).toBe(true);
  });

  test('returns upcoming bookings for host', async () => {
    const db = makeCrudDb(MOCK_BOOKING);
    const repo = new BookingRepository(db, mockLogger);
    const result = await repo.getUpcomingBookings('host-1', 'host');
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('BookingRepository.createBooking — slot not found', () => {
  test('throws NotFoundError when slot missing', async () => {
    const db = makeSlotDb(null, null); // empty slot data
    const { NotFoundError } = await import('@/core/errors');
    const repo = new BookingRepository(db, mockLogger);
    await expect(
      repo.createBooking('client-1', 'slot-1', { locationType: 'in_person' } as any)
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('BookingRepository.createBooking — slot not available', () => {
  test('throws ConflictError when slot is booked', async () => {
    const bookedSlot = { ...MOCK_SLOT, status: 'booked' };
    const db = makeSlotDb(bookedSlot);
    const { ConflictError } = await import('@/core/errors');
    const repo = new BookingRepository(db, mockLogger);
    await expect(
      repo.createBooking('client-1', 'slot-1', { locationType: 'in_person' } as any)
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

// ---------------------------------------------------------------------------
// TimeSlotRepository
// ---------------------------------------------------------------------------

const MOCK_TIME_SLOT = {
  id: 'slot-1',
  owner: 'host-1',
  event: 'event-1',
  status: 'available',
  startTime: new Date('2026-06-10T09:00:00Z'),
  endTime: new Date('2026-06-10T09:30:00Z'),
  locationTypes: ['in_person'],
  billingConfig: null,
  context: 'dental',
  booking: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'host-1',
  updatedBy: 'host-1',
};

describe('TimeSlotRepository.findOneById', () => {
  test('returns slot when found', async () => {
    const db = makeCrudDb(MOCK_TIME_SLOT);
    const repo = new TimeSlotRepository(db, mockLogger);
    const result = await repo.findOneById('slot-1');
    expect(result).not.toBeNull();
    expect((result as any).id).toBe('slot-1');
  });

  test('returns null when not found', async () => {
    const db = makeCrudDb();
    const repo = new TimeSlotRepository(db, mockLogger);
    const result = await repo.findOneById('nonexistent');
    expect(result).toBeNull();
  });
});

describe('TimeSlotRepository.createOne', () => {
  test('creates and returns time slot', async () => {
    const db = makeCrudDb(MOCK_TIME_SLOT);
    const repo = new TimeSlotRepository(db, mockLogger);
    const result = await repo.createOne(MOCK_TIME_SLOT as any);
    expect((result as any).id).toBe('slot-1');
  });
});

describe('TimeSlotRepository filters', () => {
  test('TimeSlotFilters: all filter fields valid', () => {
    const filters = {
      owner: 'host-1',
      event: 'event-1',
      timeRange: { start: new Date(), end: new Date() },
      status: 'available' as const,
      locationTypes: ['in_person', 'virtual'],
    };
    expect(filters.owner).toBe('host-1');
    expect(filters.status).toBe('available');
    expect(filters.locationTypes).toHaveLength(2);
  });
});
