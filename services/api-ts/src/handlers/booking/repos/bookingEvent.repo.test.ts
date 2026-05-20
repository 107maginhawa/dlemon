/**
 * BookingEventRepository unit tests
 *
 * Tests constructor and filter interface.
 */

import { describe, test, expect } from 'bun:test';
import { BookingEventRepository, type BookingEventFilters } from './bookingEvent.repo';

const mockDb = {
  select: () => ({
    from: () => ({
      where: () => ({
        orderBy: () => ({
          limit: () => [],
        }),
        limit: () => [],
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
} as any;

const mockLogger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } as any;

describe('BookingEventRepository', () => {
  test('constructs without error', () => {
    const repo = new BookingEventRepository(mockDb, mockLogger);
    expect(repo).not.toBeNull();
  });

  test('BookingEventFilters supports owner filter', () => {
    const filters: BookingEventFilters = { owner: 'person-1' };
    expect(filters.owner).toBe('person-1');
  });

  test('BookingEventFilters supports status filter', () => {
    const validStatuses: BookingEventFilters['status'][] = ['draft', 'active', 'paused', 'archived'];
    for (const status of validStatuses) {
      const f: BookingEventFilters = { status };
      expect(f.status).toBe(status);
    }
  });

  test('BookingEventFilters supports context filter', () => {
    const filters: BookingEventFilters = { context: 'dental-visit' };
    expect(filters.context).toBe('dental-visit');
  });

  test('BookingEventFilters supports text search', () => {
    const filters: BookingEventFilters = { q: 'consultation' };
    expect(filters.q).toBe('consultation');
  });

  test('BookingEventFilters supports tag filtering', () => {
    const filters: BookingEventFilters = {
      tagsOr: ['dental', 'consultation'],
      tagsAnd: ['premium'],
    };
    expect(filters.tagsOr).toEqual(['dental', 'consultation']);
    expect(filters.tagsAnd).toEqual(['premium']);
  });

  test('BookingEventFilters supports effective date filter', () => {
    const filters: BookingEventFilters = { effectiveDate: '2026-05-01' };
    expect(filters.effectiveDate).toBe('2026-05-01');
  });
});
