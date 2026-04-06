import { describe, test, expect } from 'bun:test'
import { mapApiPersonToFrontend, type Person } from './person'
import type { components } from '@monobase/api-spec/types'

type ApiPerson = components["schemas"]["Person"]

describe('mapApiPersonToFrontend', () => {
  test('converts ISO date strings to Date objects', () => {
    const apiPerson: ApiPerson = {
      id: '123',
      version: 1,
      createdAt: '2024-01-15T10:30:00Z',
      createdBy: 'user-1',
      updatedAt: '2024-01-20T15:45:00Z',
      updatedBy: 'user-2',

      firstName: 'John',
      lastName: 'Doe'
    }

    const result = mapApiPersonToFrontend(apiPerson)

    expect(result.createdAt).toBeInstanceOf(Date)
    expect(result.createdAt.toISOString()).toBe('2024-01-15T10:30:00.000Z')

    expect(result.updatedAt).toBeInstanceOf(Date)
    expect(result.updatedAt.toISOString()).toBe('2024-01-20T15:45:00.000Z')


  })

  test('maps all required fields correctly', () => {
    const apiPerson: ApiPerson = {
      id: 'person-123',
      version: 5,
      createdAt: '2024-01-01T00:00:00Z',
      createdBy: 'system',
      updatedAt: '2024-01-15T00:00:00Z',
      updatedBy: 'user-1',

      firstName: 'Jane',
      lastName: 'Smith'
    }

    const result = mapApiPersonToFrontend(apiPerson)

    expect(result.id).toBe('person-123')
    expect(result.version).toBe(5)
    expect(result.createdBy).toBe('system')
    expect(result.updatedBy).toBe('user-1')

    expect(result.firstName).toBe('Jane')
    expect(result.lastName).toBe('Smith')
  })

  test('handles optional fields with undefined values', () => {
    const apiPerson: ApiPerson = {
      id: '123',
      version: 1,
      createdAt: '2024-01-01T00:00:00Z',
      createdBy: 'user-1',
      updatedAt: '2024-01-01T00:00:00Z',
      updatedBy: 'user-1',

      firstName: 'John',
      lastName: 'Doe',
      // Optional fields omitted
    }

    const result = mapApiPersonToFrontend(apiPerson)

    expect(result.middleName).toBeUndefined()
    expect(result.dateOfBirth).toBeUndefined()
    expect(result.gender).toBeUndefined()
    expect(result.avatar).toBeUndefined()
    expect(result.contactInfo).toBeUndefined()
    expect(result.primaryAddress).toBeUndefined()
    expect(result.languagesSpoken).toBeUndefined()
    expect(result.timezone).toBeUndefined()
  })

  test('handles optional fields with values', () => {
    const apiPerson: ApiPerson = {
      id: '123',
      version: 1,
      createdAt: '2024-01-01T00:00:00Z',
      createdBy: 'user-1',
      updatedAt: '2024-01-01T00:00:00Z',
      updatedBy: 'user-1',

      firstName: 'John',
      lastName: 'Doe',
      middleName: 'Robert',
      gender: 'male',
      timezone: 'America/New_York'
    }

    const result = mapApiPersonToFrontend(apiPerson)

    expect(result.middleName).toBe('Robert')
    expect(result.gender).toBe('male')
    expect(result.timezone).toBe('America/New_York')
  })

  test('converts dateOfBirth to Date object when present', () => {
    const apiPerson: ApiPerson = {
      id: '123',
      version: 1,
      createdAt: '2024-01-01T00:00:00Z',
      createdBy: 'user-1',
      updatedAt: '2024-01-01T00:00:00Z',
      updatedBy: 'user-1',

      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '1990-05-15'
    }

    const result = mapApiPersonToFrontend(apiPerson)

    expect(result.dateOfBirth).toBeInstanceOf(Date)
    // Note: Date constructor with YYYY-MM-DD creates UTC midnight
    expect(result.dateOfBirth?.toISOString()).toContain('1990-05-15')
  })

  test('preserves avatar object structure', () => {
    const apiPerson: ApiPerson = {
      id: '123',
      version: 1,
      createdAt: '2024-01-01T00:00:00Z',
      createdBy: 'user-1',
      updatedAt: '2024-01-01T00:00:00Z',
      updatedBy: 'user-1',

      firstName: 'John',
      lastName: 'Doe',
      avatar: {
        file: 'avatar-123.jpg',
        url: 'https://cdn.example.com/avatars/avatar-123.jpg'
      }
    }

    const result = mapApiPersonToFrontend(apiPerson)

    expect(result.avatar).toEqual({
      file: 'avatar-123.jpg',
      url: 'https://cdn.example.com/avatars/avatar-123.jpg'
    })
  })

  test('preserves contactInfo object structure', () => {
    const apiPerson: ApiPerson = {
      id: '123',
      version: 1,
      createdAt: '2024-01-01T00:00:00Z',
      createdBy: 'user-1',
      updatedAt: '2024-01-01T00:00:00Z',
      updatedBy: 'user-1',

      firstName: 'John',
      lastName: 'Doe',
      contactInfo: {
        email: 'john@example.com',
        phone: '+1-555-1234'
      }
    }

    const result = mapApiPersonToFrontend(apiPerson)

    expect(result.contactInfo).toEqual({
      email: 'john@example.com',
      phone: '+1-555-1234'
    })
  })

  test('preserves primaryAddress object structure', () => {
    const apiPerson: ApiPerson = {
      id: '123',
      version: 1,
      createdAt: '2024-01-01T00:00:00Z',
      createdBy: 'user-1',
      updatedAt: '2024-01-01T00:00:00Z',
      updatedBy: 'user-1',

      firstName: 'John',
      lastName: 'Doe',
      primaryAddress: {
        street1: '123 Main St',
        street2: 'Apt 4B',
        city: 'Boston',
        state: 'MA',
        postalCode: '02101',
        country: 'US'
      }
    }

    const result = mapApiPersonToFrontend(apiPerson)

    expect(result.primaryAddress).toEqual({
      street1: '123 Main St',
      street2: 'Apt 4B',
      city: 'Boston',
      state: 'MA',
      postalCode: '02101',
      country: 'US'
    })
  })

  test('preserves languagesSpoken array', () => {
    const apiPerson: ApiPerson = {
      id: '123',
      version: 1,
      createdAt: '2024-01-01T00:00:00Z',
      createdBy: 'user-1',
      updatedAt: '2024-01-01T00:00:00Z',
      updatedBy: 'user-1',

      firstName: 'John',
      lastName: 'Doe',
      languagesSpoken: ['en', 'es', 'fr']
    }

    const result = mapApiPersonToFrontend(apiPerson)

    expect(result.languagesSpoken).toEqual(['en', 'es', 'fr'])
    expect(Array.isArray(result.languagesSpoken)).toBe(true)
  })

  test('handles complete person profile', () => {
    const apiPerson: ApiPerson = {
      id: 'person-456',
      version: 10,
      createdAt: '2023-06-01T08:00:00Z',
      createdBy: 'onboarding-system',
      updatedAt: '2024-01-15T14:30:00Z',
      updatedBy: 'person-456',

      firstName: 'Maria',
      lastName: 'Garcia',
      middleName: 'Elena',
      dateOfBirth: '1985-03-22',
      gender: 'female',
      avatar: {
        file: 'maria-avatar.jpg',
        url: 'https://cdn.example.com/avatars/maria-avatar.jpg'
      },
      contactInfo: {
        email: 'maria@example.com',
        phone: '+1-555-9876'
      },
      primaryAddress: {
        street1: '456 Oak Avenue',
        street2: 'Suite 200',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94102',
        country: 'US'
      },
      languagesSpoken: ['en', 'es'],
      timezone: 'America/Los_Angeles'
    }

    const result = mapApiPersonToFrontend(apiPerson)

    // Verify all fields are correctly mapped
    expect(result.id).toBe('person-456')
    expect(result.version).toBe(10)
    expect(result.firstName).toBe('Maria')
    expect(result.lastName).toBe('Garcia')
    expect(result.middleName).toBe('Elena')
    expect(result.gender).toBe('female')
    expect(result.timezone).toBe('America/Los_Angeles')

    // Verify dates
    expect(result.createdAt).toBeInstanceOf(Date)
    expect(result.updatedAt).toBeInstanceOf(Date)
    expect(result.dateOfBirth).toBeInstanceOf(Date)

    // Verify nested objects
    expect(result.avatar?.url).toBe('https://cdn.example.com/avatars/maria-avatar.jpg')
    expect(result.contactInfo?.email).toBe('maria@example.com')
    expect(result.primaryAddress?.city).toBe('San Francisco')
    expect(result.languagesSpoken).toEqual(['en', 'es'])
  })

  test('handles empty createdBy and updatedBy', () => {
    const apiPerson: ApiPerson = {
      id: '123',
      version: 1,
      createdAt: '2024-01-01T00:00:00Z',
      createdBy: undefined,
      updatedAt: '2024-01-01T00:00:00Z',
      updatedBy: undefined,

      firstName: 'John',
      lastName: 'Doe'
    }

    const result = mapApiPersonToFrontend(apiPerson)

    // Should default to empty string when undefined
    expect(result.createdBy).toBe('')
    expect(result.updatedBy).toBe('')
  })
})
