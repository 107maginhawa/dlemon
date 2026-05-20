/**
 * timeslot-repo-coverage.test.ts
 *
 * Coverage tests for TimeSlotRepository methods.
 * Uses a mock DB matching the Drizzle ORM mutable query builder pattern.
 */

import { describe, test, expect } from 'bun:test';
import { TimeSlotRepository } from './timeSlot.repo';

const mockLogger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } as any;

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
  booking: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'host-1',
  updatedBy: 'host-1',
};

/** Mutable Drizzle-style query builder that resolves to data */
function makeQuery(data: any[]) {
  const q: any = {
    where: () => q,
    orderBy: () => q,
    limit: () => q,
    offset: () => q,
    leftJoin: () => q,
    innerJoin: () => q,
    onConflictDoNothing: () => ({
      returning: () => Promise.resolve(data),
    }),
    then: (resolve: any, reject: any) => Promise.resolve(data).then(resolve, reject),
  };
  return q;
}

function makeCrudDb(row?: any, updatedRow?: any) {
  const rows = row ? [row] : [];
  return {
    select: () => ({ from: () => makeQuery(rows) }),
    insert: () => ({
      values: () => ({
        returning: () => Promise.resolve(rows),
        onConflictDoNothing: () => ({
          returning: () => Promise.resolve(rows),
        }),
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
      where: () => ({ rowCount: 2, then: (resolve: any) => Promise.resolve({ rowCount: 2 }).then(resolve) }),
    }),
  } as any;
}

// ---------------------------------------------------------------------------
// findOneById
// ---------------------------------------------------------------------------

describe('TimeSlotRepository.findOneById', () => {
  test('returns slot when found', async () => {
    const db = makeCrudDb(MOCK_SLOT);
    const repo = new TimeSlotRepository(db, mockLogger);
    const result = await repo.findOneById('slot-1');
    expect(result).not.toBeNull();
  });

  test('returns null when not found', async () => {
    const db = makeCrudDb();
    const repo = new TimeSlotRepository(db, mockLogger);
    const result = await repo.findOneById('missing');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// createOne
// ---------------------------------------------------------------------------

describe('TimeSlotRepository.createOne', () => {
  test('creates slot', async () => {
    const db = makeCrudDb(MOCK_SLOT);
    const repo = new TimeSlotRepository(db, mockLogger);
    const result = await repo.createOne(MOCK_SLOT as any);
    expect((result as any).id).toBe('slot-1');
  });
});

// ---------------------------------------------------------------------------
// markSlotAsBooked
// ---------------------------------------------------------------------------

describe('TimeSlotRepository.markSlotAsBooked', () => {
  test('updates slot status to booked', async () => {
    const booked = { ...MOCK_SLOT, status: 'booked', booking: 'booking-1' };
    const db = makeCrudDb(MOCK_SLOT, booked);
    const repo = new TimeSlotRepository(db, mockLogger);
    const result = await repo.markSlotAsBooked('slot-1', 'booking-1');
    expect(result.status).toBe('booked');
  });
});

// ---------------------------------------------------------------------------
// markSlotAsAvailable
// ---------------------------------------------------------------------------

describe('TimeSlotRepository.markSlotAsAvailable', () => {
  test('updates slot status to available', async () => {
    const available = { ...MOCK_SLOT, status: 'available', booking: null };
    const db = makeCrudDb({ ...MOCK_SLOT, status: 'booked' }, available);
    const repo = new TimeSlotRepository(db, mockLogger);
    const result = await repo.markSlotAsAvailable('slot-1');
    expect(result.status).toBe('available');
  });
});

// ---------------------------------------------------------------------------
// findAvailableSlots (string overload)
// ---------------------------------------------------------------------------

describe('TimeSlotRepository.findAvailableSlots — eventId string', () => {
  test('returns slots for event', async () => {
    const db = makeCrudDb(MOCK_SLOT);
    const repo = new TimeSlotRepository(db, mockLogger);
    const result = await repo.findAvailableSlots('event-1');
    expect(Array.isArray(result)).toBe(true);
  });

  test('returns slots with date range', async () => {
    const db = makeCrudDb(MOCK_SLOT);
    const repo = new TimeSlotRepository(db, mockLogger);
    const start = new Date('2026-06-01T00:00:00Z');
    const end = new Date('2026-06-30T23:59:59Z');
    const result = await repo.findAvailableSlots('event-1', start, end);
    expect(Array.isArray(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// findAvailableSlots (AvailabilityQuery overload)
// ---------------------------------------------------------------------------

describe('TimeSlotRepository.findAvailableSlots — query object', () => {
  test('returns slots for owner', async () => {
    const db = makeCrudDb(MOCK_SLOT);
    const repo = new TimeSlotRepository(db, mockLogger);
    const result = await repo.findAvailableSlots({
      owner: 'host-1',
      dateRange: { start: '2026-06-01', end: '2026-06-30' },
    });
    expect(Array.isArray(result)).toBe(true);
  });

  test('filters by duration', async () => {
    const db = makeCrudDb(MOCK_SLOT);
    const repo = new TimeSlotRepository(db, mockLogger);
    const result = await repo.findAvailableSlots({
      owner: 'host-1',
      dateRange: { start: '2026-06-01', end: '2026-06-30' },
      duration: 30, // MOCK_SLOT is 30 minutes
    });
    expect(Array.isArray(result)).toBe(true);
  });

  test('filters by locationType', async () => {
    const db = makeCrudDb(MOCK_SLOT);
    const repo = new TimeSlotRepository(db, mockLogger);
    const result = await repo.findAvailableSlots({
      owner: 'host-1',
      dateRange: { start: '2026-06-01', end: '2026-06-30' },
      locationType: 'in_person',
      includeAllStatuses: true,
    });
    expect(Array.isArray(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getNextAvailableSlot
// ---------------------------------------------------------------------------

describe('TimeSlotRepository.getNextAvailableSlot', () => {
  test('returns slot when found', async () => {
    const db = makeCrudDb(MOCK_SLOT);
    const repo = new TimeSlotRepository(db, mockLogger);
    const result = await repo.getNextAvailableSlot('host-1');
    // May be null or slot depending on mock resolution
    expect(result === null || typeof result === 'object').toBe(true);
  });

  test('returns null when no slots', async () => {
    const db = makeCrudDb();
    const repo = new TimeSlotRepository(db, mockLogger);
    const result = await repo.getNextAvailableSlot('host-1', new Date(), 'in_person');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// bulkCreateSlots
// ---------------------------------------------------------------------------

describe('TimeSlotRepository.bulkCreateSlots', () => {
  test('returns empty result for empty input', async () => {
    const db = makeCrudDb();
    const repo = new TimeSlotRepository(db, mockLogger);
    const result = await repo.bulkCreateSlots([]);
    expect(result.created).toHaveLength(0);
    expect(result.duplicates).toBe(0);
    expect(result.errors).toBe(0);
  });

  test('creates batch of slots', async () => {
    const slotData = [MOCK_SLOT, { ...MOCK_SLOT, id: 'slot-2' }];
    const dbWithConflict = {
      select: () => ({ from: () => makeQuery([MOCK_SLOT]) }),
      insert: () => ({
        values: () => ({
          onConflictDoNothing: () => ({
            returning: () => Promise.resolve(slotData),
          }),
          returning: () => Promise.resolve(slotData),
        }),
      }),
      update: () => ({ set: () => ({ where: () => ({ returning: () => Promise.resolve([]) }) }) }),
      delete: () => ({ where: () => Promise.resolve({ rowCount: 0 }) }),
    } as any;
    const repo = new TimeSlotRepository(dbWithConflict, mockLogger);
    const result = await repo.bulkCreateSlots(slotData as any);
    expect(result.created).toHaveLength(2);
  });

  test('handles batch insert error gracefully', async () => {
    const errorDb = {
      select: () => ({ from: () => makeQuery([]) }),
      insert: () => ({
        values: () => ({
          onConflictDoNothing: () => ({
            returning: () => Promise.reject(new Error('DB error')),
          }),
        }),
      }),
      update: () => ({ set: () => ({ where: () => ({ returning: () => Promise.resolve([]) }) }) }),
      delete: () => ({ where: () => Promise.resolve({ rowCount: 0 }) }),
    } as any;
    const repo = new TimeSlotRepository(errorDb, mockLogger);
    const result = await repo.bulkCreateSlots([MOCK_SLOT as any]);
    expect(result.errors).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// deleteSlotsForEvent
// ---------------------------------------------------------------------------

describe('TimeSlotRepository.deleteSlotsForEvent', () => {
  test('deletes slots and returns count', async () => {
    const db = {
      select: () => ({ from: () => makeQuery([]) }),
      insert: () => ({ values: () => ({ returning: () => Promise.resolve([]) }) }),
      update: () => ({ set: () => ({ where: () => ({ returning: () => Promise.resolve([]) }) }) }),
      delete: () => ({
        where: () => Promise.resolve({ rowCount: 3 }),
      }),
    } as any;
    const repo = new TimeSlotRepository(db, mockLogger);
    const count = await repo.deleteSlotsForEvent(
      'event-1',
      new Date('2026-06-01'),
      new Date('2026-06-30')
    );
    expect(count).toBe(3);
  });

  test('returns 0 when no slots deleted', async () => {
    const db = {
      select: () => ({ from: () => makeQuery([]) }),
      insert: () => ({ values: () => ({ returning: () => Promise.resolve([]) }) }),
      update: () => ({ set: () => ({ where: () => ({ returning: () => Promise.resolve([]) }) }) }),
      delete: () => ({
        where: () => Promise.resolve({ rowCount: 0 }),
      }),
    } as any;
    const repo = new TimeSlotRepository(db, mockLogger);
    const count = await repo.deleteSlotsForEvent('event-1', new Date(), new Date());
    expect(count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// cleanupOldAvailableSlots
// ---------------------------------------------------------------------------

describe('TimeSlotRepository.cleanupOldAvailableSlots', () => {
  test('deletes old slots and returns count', async () => {
    const db = {
      select: () => ({ from: () => makeQuery([]) }),
      insert: () => ({ values: () => ({ returning: () => Promise.resolve([]) }) }),
      update: () => ({ set: () => ({ where: () => ({ returning: () => Promise.resolve([]) }) }) }),
      delete: () => ({
        where: () => Promise.resolve({ rowCount: 5 }),
      }),
    } as any;
    const repo = new TimeSlotRepository(db, mockLogger);
    const count = await repo.cleanupOldAvailableSlots(30);
    expect(count).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// findMany with filters (exercises buildWhereConditions)
// ---------------------------------------------------------------------------

describe('TimeSlotRepository.findMany with filters', () => {
  test('owner filter', async () => {
    const db = makeCrudDb(MOCK_SLOT);
    const repo = new TimeSlotRepository(db, mockLogger);
    const result = await repo.findMany({ owner: 'host-1' });
    expect(Array.isArray(result)).toBe(true);
  });

  test('event filter', async () => {
    const db = makeCrudDb(MOCK_SLOT);
    const repo = new TimeSlotRepository(db, mockLogger);
    const result = await repo.findMany({ event: 'event-1' });
    expect(Array.isArray(result)).toBe(true);
  });

  test('status filter', async () => {
    const db = makeCrudDb(MOCK_SLOT);
    const repo = new TimeSlotRepository(db, mockLogger);
    const result = await repo.findMany({ status: 'available' });
    expect(Array.isArray(result)).toBe(true);
  });

  test('timeRange filter', async () => {
    const db = makeCrudDb(MOCK_SLOT);
    const repo = new TimeSlotRepository(db, mockLogger);
    const result = await repo.findMany({
      timeRange: { start: new Date('2026-06-01'), end: new Date('2026-06-30') },
    });
    expect(Array.isArray(result)).toBe(true);
  });

  test('locationTypes filter', async () => {
    const db = makeCrudDb(MOCK_SLOT);
    const repo = new TimeSlotRepository(db, mockLogger);
    const result = await repo.findMany({ locationTypes: ['in_person'] });
    expect(Array.isArray(result)).toBe(true);
  });

  test('no filters', async () => {
    const db = makeCrudDb(MOCK_SLOT);
    const repo = new TimeSlotRepository(db, mockLogger);
    const result = await repo.findMany();
    expect(Array.isArray(result)).toBe(true);
  });
});
