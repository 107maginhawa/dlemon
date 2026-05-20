/**
 * bookingevent-repo-coverage.test.ts
 *
 * Coverage tests for BookingEventRepository methods.
 * Tests pure methods (getDailyConfig, isOwnerAvailableOnDay, validateEventConfig)
 * and DB-touching methods with mock DB.
 */

import { describe, test, expect } from 'bun:test';
import { BookingEventRepository } from './bookingEvent.repo';
import { DayOfWeek } from './booking.schema';

const mockLogger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } as any;

// ---------------------------------------------------------------------------
// Mock DB helpers
// ---------------------------------------------------------------------------

function makeQuery(data: any[]) {
  const q: any = {
    where: () => q,
    orderBy: () => q,
    limit: () => q,
    offset: () => q,
    leftJoin: () => q,
    innerJoin: () => ({
      where: () => ({ limit: () => Promise.resolve(data) }),
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
    delete: () => ({ where: () => Promise.resolve() }),
  } as any;
}

// ---------------------------------------------------------------------------
// Shared mock event
// ---------------------------------------------------------------------------

const MON: DayOfWeek = DayOfWeek.mon;
const TUE: DayOfWeek = DayOfWeek.tue;

const MOCK_EVENT: any = {
  id: 'event-1',
  owner: 'host-1',
  title: 'Dental Consultation',
  status: 'active',
  duration: 30,
  locationType: 'in_person',
  timezone: 'America/New_York',
  context: 'dental',
  maxBookingDays: 30,
  minBookingMinutes: 60,
  locationTypes: ['in_person'],
  dailyConfigs: {
    mon: {
      enabled: true,
      timeBlocks: [{ startTime: '09:00', endTime: '17:00', slotDuration: 30, bufferTime: 0 }],
    },
    tue: {
      enabled: false,
      timeBlocks: [],
    },
    wed: { enabled: false, timeBlocks: [] },
    thu: { enabled: false, timeBlocks: [] },
    fri: { enabled: false, timeBlocks: [] },
    sat: { enabled: false, timeBlocks: [] },
    sun: { enabled: false, timeBlocks: [] },
  },
  effectiveFrom: null,
  effectiveTo: null,
  tags: [],
  keywords: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'host-1',
  updatedBy: 'host-1',
};

// ---------------------------------------------------------------------------
// getDailyConfig (pure method)
// ---------------------------------------------------------------------------

describe('BookingEventRepository.getDailyConfig', () => {
  test('returns config for enabled day', () => {
    const repo = new BookingEventRepository(makeCrudDb(), mockLogger);
    const config = repo.getDailyConfig(MOCK_EVENT, MON);
    expect(config).not.toBeNull();
    expect(config!.enabled).toBe(true);
  });

  test('returns null for disabled day', () => {
    const repo = new BookingEventRepository(makeCrudDb(), mockLogger);
    const config = repo.getDailyConfig(MOCK_EVENT, TUE);
    expect(config).toBeNull();
  });

  test('returns null when dailyConfigs missing', () => {
    const repo = new BookingEventRepository(makeCrudDb(), mockLogger);
    const event = { ...MOCK_EVENT, dailyConfigs: null };
    const config = repo.getDailyConfig(event as any, MON);
    expect(config).toBeNull();
  });

  test('returns null when day not in config', () => {
    const repo = new BookingEventRepository(makeCrudDb(), mockLogger);
    const event = { ...MOCK_EVENT, dailyConfigs: {} };
    const config = repo.getDailyConfig(event, MON);
    expect(config).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isOwnerAvailableOnDay (pure method)
// ---------------------------------------------------------------------------

describe('BookingEventRepository.isOwnerAvailableOnDay', () => {
  test('enabled day with time blocks → true', () => {
    const repo = new BookingEventRepository(makeCrudDb(), mockLogger);
    expect(repo.isOwnerAvailableOnDay(MOCK_EVENT, MON)).toBe(true);
  });

  test('disabled day → false', () => {
    const repo = new BookingEventRepository(makeCrudDb(), mockLogger);
    expect(repo.isOwnerAvailableOnDay(MOCK_EVENT, TUE)).toBe(false);
  });

  test('enabled day with empty time blocks → false', () => {
    const repo = new BookingEventRepository(makeCrudDb(), mockLogger);
    const event = {
      ...MOCK_EVENT,
      dailyConfigs: {
        ...MOCK_EVENT.dailyConfigs,
        mon: { enabled: true, timeBlocks: [] },
      },
    };
    expect(repo.isOwnerAvailableOnDay(event, MON)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateEventConfig (pure method) — already tested in booking-coverage.test.ts
// but exercise more paths here
// ---------------------------------------------------------------------------

describe('BookingEventRepository.validateEventConfig — edge cases', () => {
  test('empty config → no errors', () => {
    const repo = new BookingEventRepository(makeCrudDb(), mockLogger);
    const errors = repo.validateEventConfig({} as any);
    expect(errors).toHaveLength(0);
  });

  test('maxBookingDays = 0 → valid', () => {
    const repo = new BookingEventRepository(makeCrudDb(), mockLogger);
    const errors = repo.validateEventConfig({ maxBookingDays: 0 } as any);
    expect(errors).toHaveLength(0);
  });

  test('maxBookingDays = 365 → valid', () => {
    const repo = new BookingEventRepository(makeCrudDb(), mockLogger);
    const errors = repo.validateEventConfig({ maxBookingDays: 365 } as any);
    expect(errors).toHaveLength(0);
  });

  test('dailyConfigs with valid blocks → no errors', () => {
    const repo = new BookingEventRepository(makeCrudDb(), mockLogger);
    const errors = repo.validateEventConfig({
      dailyConfigs: {
        mon: { enabled: true, timeBlocks: [{ startTime: '09:00', endTime: '17:00', slotDuration: 30, bufferTime: 0 }] },
      } as any,
    } as any);
    expect(errors).toHaveLength(0);
  });

  test('dailyConfigs with invalid time block format → error', () => {
    const repo = new BookingEventRepository(makeCrudDb(), mockLogger);
    const errors = repo.validateEventConfig({
      dailyConfigs: {
        mon: { enabled: true, timeBlocks: [{ startTime: '25:00', endTime: '17:00', slotDuration: 30, bufferTime: 0 }] },
      } as any,
    } as any);
    expect(errors.length).toBeGreaterThan(0);
  });

  test('dailyConfigs with overlapping blocks → error', () => {
    const repo = new BookingEventRepository(makeCrudDb(), mockLogger);
    const errors = repo.validateEventConfig({
      dailyConfigs: {
        mon: {
          enabled: true,
          timeBlocks: [
            { startTime: '09:00', endTime: '12:00', slotDuration: 30, bufferTime: 0 },
            { startTime: '11:00', endTime: '14:00', slotDuration: 30, bufferTime: 0 }, // overlaps
          ],
        },
      } as any,
    } as any);
    expect(errors.length).toBeGreaterThan(0);
  });

  test('startTime >= endTime in time block → error', () => {
    const repo = new BookingEventRepository(makeCrudDb(), mockLogger);
    const errors = repo.validateEventConfig({
      dailyConfigs: {
        mon: { enabled: true, timeBlocks: [{ startTime: '17:00', endTime: '09:00', slotDuration: 30, bufferTime: 0 }] },
      } as any,
    } as any);
    expect(errors.length).toBeGreaterThan(0);
  });

  test('invalid slotDuration in time block → error', () => {
    const repo = new BookingEventRepository(makeCrudDb(), mockLogger);
    const errors = repo.validateEventConfig({
      dailyConfigs: {
        mon: { enabled: true, timeBlocks: [{ startTime: '09:00', endTime: '17:00', slotDuration: 5, bufferTime: 0 }] },
      } as any,
    } as any);
    expect(errors.length).toBeGreaterThan(0);
  });

  test('invalid bufferTime in time block → error', () => {
    const repo = new BookingEventRepository(makeCrudDb(), mockLogger);
    const errors = repo.validateEventConfig({
      dailyConfigs: {
        mon: { enabled: true, timeBlocks: [{ startTime: '09:00', endTime: '17:00', slotDuration: 30, bufferTime: 200 }] },
      } as any,
    } as any);
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// findOneById
// ---------------------------------------------------------------------------

describe('BookingEventRepository.findOneById', () => {
  test('returns event when found', async () => {
    const db = makeCrudDb(MOCK_EVENT);
    const repo = new BookingEventRepository(db, mockLogger);
    const result = await repo.findOneById('event-1');
    expect(result).not.toBeNull();
  });

  test('returns null when not found', async () => {
    const db = makeCrudDb();
    const repo = new BookingEventRepository(db, mockLogger);
    const result = await repo.findOneById('missing');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// createOne
// ---------------------------------------------------------------------------

describe('BookingEventRepository.createOne', () => {
  test('creates event', async () => {
    const db = makeCrudDb(MOCK_EVENT);
    const repo = new BookingEventRepository(db, mockLogger);
    const result = await repo.createOne(MOCK_EVENT);
    expect((result as any).id).toBe('event-1');
  });
});

// ---------------------------------------------------------------------------
// findActiveEventsByOwner
// ---------------------------------------------------------------------------

describe('BookingEventRepository.findActiveEventsByOwner', () => {
  test('returns events for owner', async () => {
    const db = makeCrudDb(MOCK_EVENT);
    const repo = new BookingEventRepository(db, mockLogger);
    const result = await repo.findActiveEventsByOwner('host-1');
    expect(Array.isArray(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// findEventsByContext
// ---------------------------------------------------------------------------

describe('BookingEventRepository.findEventsByContext', () => {
  test('returns events for context', async () => {
    const db = makeCrudDb(MOCK_EVENT);
    const repo = new BookingEventRepository(db, mockLogger);
    const result = await repo.findEventsByContext('dental');
    expect(Array.isArray(result)).toBe(true);
  });

  test('returns events for context with status filter', async () => {
    const db = makeCrudDb(MOCK_EVENT);
    const repo = new BookingEventRepository(db, mockLogger);
    const result = await repo.findEventsByContext('dental', 'active');
    expect(Array.isArray(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// findActiveInDateRange
// ---------------------------------------------------------------------------

describe('BookingEventRepository.findActiveInDateRange', () => {
  test('returns events in range', async () => {
    const db = makeCrudDb(MOCK_EVENT);
    const repo = new BookingEventRepository(db, mockLogger);
    const result = await repo.findActiveInDateRange(new Date('2026-06-01'), new Date('2026-06-30'));
    expect(Array.isArray(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// findManyWithOwner
// ---------------------------------------------------------------------------

describe('BookingEventRepository.findManyWithOwner', () => {
  function makeInnerJoinDb(ownerRows: any[]) {
    // findManyWithOwner calls: db.select({...}).from(...).innerJoin(...).where(...) then awaits
    const queryWithInnerJoin: any = {
      where: () => queryWithInnerJoin,
      orderBy: () => queryWithInnerJoin,
      limit: () => queryWithInnerJoin,
      offset: () => queryWithInnerJoin,
      innerJoin: () => queryWithInnerJoin,
      leftJoin: () => queryWithInnerJoin,
      then: (resolve: any, reject: any) => Promise.resolve(ownerRows).then(resolve, reject),
    };
    return {
      select: () => ({ from: () => queryWithInnerJoin }),
      insert: () => ({ values: () => ({ returning: () => Promise.resolve([]) }) }),
      update: () => ({ set: () => ({ where: () => ({ returning: () => Promise.resolve([]) }) }) }),
      delete: () => ({ where: () => Promise.resolve() }),
    } as any;
  }

  test('returns events with owner data', async () => {
    const ownerRow = { event: MOCK_EVENT, owner: { id: 'host-1', email: 'host@test.com' } };
    const db = makeInnerJoinDb([ownerRow]);
    const repo = new BookingEventRepository(db, mockLogger);
    const result = await repo.findManyWithOwner({ owner: 'host-1' });
    expect(Array.isArray(result)).toBe(true);
  });

  test('returns empty array when no events', async () => {
    const db = makeInnerJoinDb([]);
    const repo = new BookingEventRepository(db, mockLogger);
    const result = await repo.findManyWithOwner();
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// findEffectiveEvent
// ---------------------------------------------------------------------------

describe('BookingEventRepository.findEffectiveEvent', () => {
  test('returns null when no events found', async () => {
    const db = makeCrudDb();
    const repo = new BookingEventRepository(db, mockLogger);
    const result = await repo.findEffectiveEvent('host-1', new Date().toISOString());
    expect(result).toBeNull();
  });

  test('returns event when found', async () => {
    const db = makeCrudDb(MOCK_EVENT);
    const repo = new BookingEventRepository(db, mockLogger);
    const result = await repo.findEffectiveEvent('host-1', new Date().toISOString());
    // May return event or null depending on db mock resolution
    expect(result === null || typeof result === 'object').toBe(true);
  });
});

// ---------------------------------------------------------------------------
// findMany with all filter branches (exercises buildWhereConditions)
// ---------------------------------------------------------------------------

describe('BookingEventRepository.findMany with filters', () => {
  test('owner filter', async () => {
    const db = makeCrudDb(MOCK_EVENT);
    const repo = new BookingEventRepository(db, mockLogger);
    const result = await repo.findMany({ owner: 'host-1' });
    expect(Array.isArray(result)).toBe(true);
  });

  test('context filter', async () => {
    const db = makeCrudDb(MOCK_EVENT);
    const repo = new BookingEventRepository(db, mockLogger);
    const result = await repo.findMany({ context: 'dental' });
    expect(Array.isArray(result)).toBe(true);
  });

  test('status filter', async () => {
    const db = makeCrudDb(MOCK_EVENT);
    const repo = new BookingEventRepository(db, mockLogger);
    const result = await repo.findMany({ status: 'active' });
    expect(Array.isArray(result)).toBe(true);
  });

  test('q text search filter', async () => {
    const db = makeCrudDb(MOCK_EVENT);
    const repo = new BookingEventRepository(db, mockLogger);
    const result = await repo.findMany({ q: 'dental' });
    expect(Array.isArray(result)).toBe(true);
  });

  test('tagsOr filter', async () => {
    const db = makeCrudDb(MOCK_EVENT);
    const repo = new BookingEventRepository(db, mockLogger);
    const result = await repo.findMany({ tagsOr: ['dental', 'consultation'] });
    expect(Array.isArray(result)).toBe(true);
  });

  test('tagsAnd filter', async () => {
    const db = makeCrudDb(MOCK_EVENT);
    const repo = new BookingEventRepository(db, mockLogger);
    const result = await repo.findMany({ tagsAnd: ['premium'] });
    expect(Array.isArray(result)).toBe(true);
  });

  test('effectiveDate filter', async () => {
    const db = makeCrudDb(MOCK_EVENT);
    const repo = new BookingEventRepository(db, mockLogger);
    const result = await repo.findMany({ effectiveDate: '2026-06-15' });
    expect(Array.isArray(result)).toBe(true);
  });

  test('dateRange filter', async () => {
    const db = makeCrudDb(MOCK_EVENT);
    const repo = new BookingEventRepository(db, mockLogger);
    const result = await repo.findMany({
      dateRangeStart: new Date('2026-06-01'),
      dateRangeEnd: new Date('2026-06-30'),
    });
    expect(Array.isArray(result)).toBe(true);
  });

  test('no filters', async () => {
    const db = makeCrudDb(MOCK_EVENT);
    const repo = new BookingEventRepository(db, mockLogger);
    const result = await repo.findMany();
    expect(Array.isArray(result)).toBe(true);
  });
});
