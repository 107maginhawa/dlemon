/**
 * PersonRepository unit tests
 *
 * Tests constructor, filter interface, and the PersonFilters type.
 */

import { describe, test, expect } from 'bun:test';
import { PersonRepository, type PersonFilters } from './person.repo';

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

describe('PersonRepository', () => {
  test('constructs without error', () => {
    const repo = new PersonRepository(mockDb, mockLogger);
    expect(repo).not.toBeNull();
  });

  test('PersonFilters supports firstName filter', () => {
    const filters: PersonFilters = { firstName: 'John' };
    expect(filters.firstName).toBe('John');
  });

  test('PersonFilters supports lastName filter', () => {
    const filters: PersonFilters = { lastName: 'Doe' };
    expect(filters.lastName).toBe('Doe');
  });

  test('PersonFilters supports general search query', () => {
    const filters: PersonFilters = { q: 'john doe' };
    expect(filters.q).toBe('john doe');
  });

  test('PersonFilters supports combined filters', () => {
    const filters: PersonFilters = { firstName: 'John', lastName: 'Doe', q: 'john' };
    expect(filters.firstName).toBe('John');
    expect(filters.lastName).toBe('Doe');
    expect(filters.q).toBe('john');
  });

  test('PersonFilters are all optional', () => {
    const filters: PersonFilters = {};
    expect(filters.firstName).toBeUndefined();
    expect(filters.lastName).toBeUndefined();
    expect(filters.q).toBeUndefined();
  });
});
