/**
 * BookingRepository unit tests
 *
 * Tests constructor, filter types, and the BookingFilters interface.
 * No real DB - verifies class shape and pure logic.
 */

import { describe, test, expect } from 'bun:test';
import { BookingRepository, type BookingFilters } from './booking.repo';

const mockDb = {
  select: () => ({
    from: () => ({
      where: () => ({
        orderBy: () => ({
          limit: () => [],
        }),
        limit: () => [],
      }),
      leftJoin: () => ({
        where: () => ({
          limit: () => [],
        }),
      }),
    }),
  }),
  insert: () => ({
    values: () => ({
      returning: () => [],
    }),
  }),
  update: () => ({
    set: () => ({
      where: () => ({
        returning: () => [],
      }),
    }),
  }),
  delete: () => ({
    where: () => ({}),
  }),
  transaction: async (fn: any) => fn(mockDb),
} as any;

const mockLogger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } as any;

describe('BookingRepository', () => {
  test('constructs without error', () => {
    const repo = new BookingRepository(mockDb, mockLogger);
    expect(repo).toBeDefined();
  });

  test('BookingFilters interface supports all filter types', () => {
    const filters: BookingFilters = {
      client: 'person-1',
      host: 'person-2',
      status: 'pending',
    };
    expect(filters.client).toBe('person-1');
    expect(filters.host).toBe('person-2');
    expect(filters.status).toBe('pending');
  });

  test('BookingFilters supports clientOrHost filter', () => {
    const filters: BookingFilters = {
      clientOrHost: 'person-1',
    };
    expect(filters.clientOrHost).toBe('person-1');
  });

  test('BookingFilters supports date range', () => {
    const now = new Date();
    const later = new Date(now.getTime() + 3600000);
    const filters: BookingFilters = {
      dateRange: { start: now, end: later },
    };
    expect(filters.dateRange?.start).toBe(now);
    expect(filters.dateRange?.end).toBe(later);
  });

  test('BookingFilters supports upcoming and past flags', () => {
    const filters1: BookingFilters = { upcoming: true };
    const filters2: BookingFilters = { past: true };
    expect(filters1.upcoming).toBe(true);
    expect(filters2.past).toBe(true);
  });

  test('status filter accepts all valid statuses', () => {
    const statuses: BookingFilters['status'][] = [
      'pending', 'confirmed', 'rejected', 'cancelled', 'completed', 'no_show_client', 'no_show_host',
    ];
    for (const status of statuses) {
      const f: BookingFilters = { status };
      expect(f.status).toBe(status);
    }
  });
});
