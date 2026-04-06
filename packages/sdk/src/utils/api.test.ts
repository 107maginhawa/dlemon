import { describe, test, expect } from 'bun:test'
import {
  mapPaginatedResponse,
  normalizeStringField,
  sanitizeObject,
} from './api'
import type { PaginatedResponse } from '../api'

describe('mapPaginatedResponse', () => {
  test('maps data correctly using mapper function', () => {
    const apiResponse: PaginatedResponse<{ id: number; name: string }> = {
      data: [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ],
      pagination: {
        offset: 0,
        limit: 10,
        count: 2,
        totalCount: 2,
        totalPages: 1,
        currentPage: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      }
    }

    const mapper = (item: { id: number; name: string }) => ({
      id: item.id.toString(),
      displayName: item.name.toUpperCase()
    })

    const result = mapPaginatedResponse(apiResponse, mapper)

    expect(result.data).toEqual([
      { id: '1', displayName: 'ALICE' },
      { id: '2', displayName: 'BOB' }
    ])
  })

  test('preserves pagination metadata', () => {
    const apiResponse: PaginatedResponse<number> = {
      data: [1, 2, 3],
      pagination: {
        offset: 10,
        limit: 20,
        count: 3,
        totalCount: 100,
        totalPages: 5,
        currentPage: 1,
        hasNextPage: true,
        hasPreviousPage: false,
      }
    }

    const result = mapPaginatedResponse(apiResponse, (x: number) => x * 2)

    expect(result.pagination).toEqual({
      offset: 10,
      limit: 20,
      count: 3,
      totalCount: 100,
      totalPages: 5,
      currentPage: 1,
      hasNextPage: true,
      hasPreviousPage: false,
    })
  })

  test('handles empty arrays', () => {
    const apiResponse: PaginatedResponse<string> = {
      data: [],
      pagination: {
        offset: 0,
        limit: 10,
        count: 0,
        totalCount: 0,
        totalPages: 0,
        currentPage: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      }
    }

    const result = mapPaginatedResponse(apiResponse, (x: string) => x.toUpperCase())

    expect(result.data).toEqual([])
    expect(result.pagination.totalCount).toBe(0)
  })
})

describe('normalizeStringField', () => {
  test('trims whitespace', () => {
    expect(normalizeStringField('  hello  ')).toBe('hello')
    expect(normalizeStringField('\t\nworld\n\t')).toBe('world')
    expect(normalizeStringField(' test ')).toBe('test')
  })

  test('converts empty strings to undefined', () => {
    expect(normalizeStringField('')).toBeUndefined()
    expect(normalizeStringField('   ')).toBeUndefined()
    expect(normalizeStringField('\t\n')).toBeUndefined()
  })

  test('returns undefined for non-strings', () => {
    expect(normalizeStringField(undefined)).toBeUndefined()
  })

  test('preserves non-empty trimmed strings', () => {
    expect(normalizeStringField('hello')).toBe('hello')
    expect(normalizeStringField('Hello World')).toBe('Hello World')
    expect(normalizeStringField('123')).toBe('123')
  })
})

describe('sanitizeObject', () => {
  test('omits undefined values', () => {
    const data = {
      name: 'John',
      age: undefined,
      email: 'john@example.com'
    }

    const result = sanitizeObject(data, {})

    expect(result).toEqual({
      name: 'John',
      email: 'john@example.com'
    })
    expect('age' in result).toBe(false)
  })

  test('handles nullable fields - sends null for empty values', () => {
    const data = {
      firstName: 'John',
      lastName: null,
      middleName: ''
    }

    const result = sanitizeObject(data, {
      nullable: ['lastName', 'middleName']
    })

    expect(result).toEqual({
      firstName: 'John',
      lastName: null,
      middleName: null
    })
  })

  test('handles non-nullable fields - omits empty values', () => {
    const data = {
      firstName: 'John',
      lastName: null,
      middleName: ''
    }

    const result = sanitizeObject(data, {
      nullable: [] // Neither field is nullable
    })

    expect(result).toEqual({
      firstName: 'John'
    })
    expect('lastName' in result).toBe(false)
    expect('middleName' in result).toBe(false)
  })

  test('normalizes string fields', () => {
    const data = {
      name: '  John Doe  ',
      email: ' test@example.com ',
      bio: '   '
    }

    const result = sanitizeObject(data, {})

    expect(result).toEqual({
      name: 'John Doe',
      email: 'test@example.com'
    })
    expect('bio' in result).toBe(false) // Empty after trimming
  })

  test('recursively processes nested objects', () => {
    const data = {
      name: 'John',
      address: {
        street: '123 Main St',
        city: '  Boston  ',
        zip: ''
      }
    }

    const result = sanitizeObject(data, {
      nullable: ['address.zip']
    })

    expect(result).toEqual({
      name: 'John',
      address: {
        street: '123 Main St',
        city: 'Boston',
        zip: null
      }
    })
  })

  test('supports dot notation for nested nullables', () => {
    const data = {
      contactInfo: {
        email: '',
        phone: '555-1234'
      }
    }

    const result = sanitizeObject(data, {
      nullable: ['contactInfo.email']
    })

    expect(result).toEqual({
      contactInfo: {
        email: null,
        phone: '555-1234'
      }
    })
  })

  test('handles empty nested objects based on nullable config', () => {
    const data = {
      name: 'John',
      address: {}
    }

    // When parent object is nullable
    const resultNullable = sanitizeObject(data, {
      nullable: ['address']
    })

    expect(resultNullable).toEqual({
      name: 'John',
      address: null
    })

    // When parent object is not nullable
    const resultNonNullable = sanitizeObject(data, {
      nullable: []
    })

    expect(resultNonNullable).toEqual({
      name: 'John'
    })
    expect('address' in resultNonNullable).toBe(false)
  })

  test('preserves arrays', () => {
    const data = {
      name: 'John',
      languages: ['en', 'es', 'fr']
    }

    const result = sanitizeObject(data, {})

    expect(result).toEqual({
      name: 'John',
      languages: ['en', 'es', 'fr']
    })
  })

  test('handles complex nested structures', () => {
    const data = {
      firstName: 'John',
      lastName: '  Doe  ',
      middleName: '',
      contactInfo: {
        email: 'john@example.com',
        phone: ''
      },
      address: {
        street1: '123 Main St',
        street2: '',
        city: '  Boston  ',
        state: null
      }
    }

    const result = sanitizeObject(data, {
      nullable: ['middleName', 'contactInfo.phone', 'address.street2', 'address.state']
    })

    expect(result).toEqual({
      firstName: 'John',
      lastName: 'Doe',
      middleName: null,
      contactInfo: {
        email: 'john@example.com',
        phone: null
      },
      address: {
        street1: '123 Main St',
        street2: null,
        city: 'Boston',
        state: null
      }
    })
  })

  test('omits nested objects that become empty after sanitization', () => {
    const data = {
      name: 'John',
      metadata: {
        note1: '',
        note2: '  '
      }
    }

    // Without marking metadata as nullable
    const result = sanitizeObject(data, {})

    expect(result).toEqual({
      name: 'John'
    })
    expect('metadata' in result).toBe(false)
  })
})
