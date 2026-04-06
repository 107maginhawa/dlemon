import { describe, test, expect } from 'bun:test'
import {
  personalInfoSchema,
  addressSchema,
  optionalAddressSchema,
  contactInfoSchema,
  preferencesSchema
} from './schemas'

describe('Person Schemas', () => {
  describe('personalInfoSchema', () => {
    test('validates valid personal info', () => {
      const validData = {
        firstName: 'John',
        lastName: 'Doe',
        middleName: 'Michael',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'male',
      }
      const result = personalInfoSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    test('requires firstName and lastName', () => {
      const invalidData = {
        dateOfBirth: new Date('1990-01-01'),
      }
      const result = personalInfoSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some(issue => issue.path[0] === 'firstName')).toBe(true)
        expect(result.error.issues.some(issue => issue.path[0] === 'lastName')).toBe(true)
      }
    })

    test('validates name length constraints', () => {
      const longName = 'a'.repeat(51)
      const invalidData = {
        firstName: longName,
        lastName: longName,
        dateOfBirth: new Date('1990-01-01'),
      }
      const result = personalInfoSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    test('validates date of birth range', () => {
      const veryOldDate = new Date('1800-01-01') // Over 150 years ago
      const invalidData = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: veryOldDate,
      }
      const result = personalInfoSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    test('accepts valid gender options', () => {
      const genders = ['male', 'female', 'non-binary', 'other', 'prefer-not-to-say']
      genders.forEach(gender => {
        const data = {
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: new Date('1990-01-01'),
          gender,
        }
        const result = personalInfoSchema.safeParse(data)
        expect(result.success).toBe(true)
      })
    })

    test('allows optional middleName', () => {
      const data = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: new Date('1990-01-01'),
      }
      const result = personalInfoSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    test('allows empty string for optional fields', () => {
      const data = {
        firstName: 'John',
        lastName: 'Doe',
        middleName: '',
        dateOfBirth: new Date('1990-01-01'),
        gender: '',
      }
      const result = personalInfoSchema.safeParse(data)
      expect(result.success).toBe(true)
    })
  })

  describe('addressSchema', () => {
    test('validates valid address', () => {
      const validAddress = {
        street1: '123 Main St',
        street2: 'Apt 4B',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        country: 'US',
      }
      const result = addressSchema.safeParse(validAddress)
      expect(result.success).toBe(true)
    })

    test('requires all mandatory fields', () => {
      const invalidAddress = {
        street2: 'Apt 4B',
      }
      const result = addressSchema.safeParse(invalidAddress)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some(issue => issue.path[0] === 'street1')).toBe(true)
        expect(result.error.issues.some(issue => issue.path[0] === 'city')).toBe(true)
        expect(result.error.issues.some(issue => issue.path[0] === 'state')).toBe(true)
        expect(result.error.issues.some(issue => issue.path[0] === 'postalCode')).toBe(true)
        expect(result.error.issues.some(issue => issue.path[0] === 'country')).toBe(true)
      }
    })

    test('validates country code length', () => {
      const invalidAddress = {
        street1: '123 Main St',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        country: 'USA', // Should be 2 letters
      }
      const result = addressSchema.safeParse(invalidAddress)
      expect(result.success).toBe(false)
    })

    test('allows optional street2', () => {
      const validAddress = {
        street1: '123 Main St',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        country: 'US',
      }
      const result = addressSchema.safeParse(validAddress)
      expect(result.success).toBe(true)
    })
  })

  describe('optionalAddressSchema', () => {
    test('allows all fields to be optional', () => {
      const emptyAddress = {}
      const result = optionalAddressSchema.safeParse(emptyAddress)
      expect(result.success).toBe(true)
    })

    test('validates partial address', () => {
      const partialAddress = {
        city: 'New York',
        state: 'NY',
      }
      const result = optionalAddressSchema.safeParse(partialAddress)
      expect(result.success).toBe(true)
    })

    test('validates country code when provided', () => {
      const invalidAddress = {
        country: 'USA', // Should be 2 letters
      }
      const result = optionalAddressSchema.safeParse(invalidAddress)
      expect(result.success).toBe(false)
    })

    test('allows empty strings for all fields', () => {
      const emptyStringAddress = {
        street1: '',
        street2: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
      }
      const result = optionalAddressSchema.safeParse(emptyStringAddress)
      expect(result.success).toBe(true)
    })
  })

  describe('contactInfoSchema', () => {
    test('validates valid email', () => {
      const validContact = {
        email: 'john@example.com',
      }
      const result = contactInfoSchema.safeParse(validContact)
      expect(result.success).toBe(true)
    })

    test('rejects invalid email', () => {
      const invalidContact = {
        email: 'not-an-email',
      }
      const result = contactInfoSchema.safeParse(invalidContact)
      expect(result.success).toBe(false)
    })

    test('validates valid phone number', () => {
      const validContact = {
        phone: '+12133734253',
      }
      const result = contactInfoSchema.safeParse(validContact)
      expect(result.success).toBe(true)
    })

    test('allows both fields to be optional', () => {
      const emptyContact = {}
      const result = contactInfoSchema.safeParse(emptyContact)
      expect(result.success).toBe(true)
    })

    test('validates both email and phone together', () => {
      const validContact = {
        email: 'john@example.com',
        phone: '+12133734253',
      }
      const result = contactInfoSchema.safeParse(validContact)
      expect(result.success).toBe(true)
    })
  })

  describe('preferencesSchema', () => {
    test('validates valid preferences', () => {
      const validPreferences = {
        languagesSpoken: ['en', 'fr'],
        timezone: 'America/New_York',
      }
      const result = preferencesSchema.safeParse(validPreferences)
      expect(result.success).toBe(true)
    })

    test('requires at least one language', () => {
      const invalidPreferences = {
        languagesSpoken: [],
        timezone: 'America/New_York',
      }
      const result = preferencesSchema.safeParse(invalidPreferences)
      expect(result.success).toBe(false)
    })

    test('requires timezone', () => {
      const invalidPreferences = {
        languagesSpoken: ['en'],
        timezone: '',
      }
      const result = preferencesSchema.safeParse(invalidPreferences)
      expect(result.success).toBe(false)
    })

    test('accepts multiple languages', () => {
      const validPreferences = {
        languagesSpoken: ['en', 'fr', 'es', 'de', 'zh'],
        timezone: 'Europe/London',
      }
      const result = preferencesSchema.safeParse(validPreferences)
      expect(result.success).toBe(true)
    })
  })
})