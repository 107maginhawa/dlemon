import { describe, test, expect } from 'bun:test'
import { COUNTRIES, type Country } from './countries'

describe('Country Constants', () => {
  test('exports country options array', () => {
    expect(COUNTRIES).not.toBeUndefined()
    expect(Array.isArray(COUNTRIES)).toBe(true)
    expect(COUNTRIES.length).toBeGreaterThan(0)
  })

  test('each country has required fields', () => {
    COUNTRIES.forEach((country: Country) => {
      expect(country.code).not.toBeUndefined()
      expect(country.name).not.toBeUndefined()
      expect(typeof country.code).toBe('string')
      expect(typeof country.name).toBe('string')
    })
  })

  test('country codes follow ISO 3166-1 alpha-2 standard (uppercase)', () => {
    COUNTRIES.forEach((country: Country) => {
      expect(country.code.length).toBe(2)
      expect(country.code).toBe(country.code.toUpperCase())
      expect(country.code).toMatch(/^[A-Z]{2}$/)
    })
  })

  test('includes common countries', () => {
    const usa = COUNTRIES.find(c => c.code === 'US')
    expect(usa).not.toBeUndefined()
    expect(usa?.name).toContain('United States')

    const uk = COUNTRIES.find(c => c.code === 'GB')
    expect(uk).not.toBeUndefined()
    expect(uk?.name).toContain('United Kingdom')

    const canada = COUNTRIES.find(c => c.code === 'CA')
    expect(canada).not.toBeUndefined()
    expect(canada?.name).toBe('Canada')

    const japan = COUNTRIES.find(c => c.code === 'JP')
    expect(japan).not.toBeUndefined()
    expect(japan?.name).toBe('Japan')
  })

  test('no duplicate country codes', () => {
    const codes = COUNTRIES.map(c => c.code)
    const uniqueCodes = new Set(codes)
    expect(codes.length).toBe(uniqueCodes.size)
  })

  test('all countries have non-empty values', () => {
    COUNTRIES.forEach((country: Country) => {
      expect(country.code.trim().length).toBeGreaterThan(0)
      expect(country.name.trim().length).toBeGreaterThan(0)
    })
  })

  test('no lowercase country codes', () => {
    const lowercaseCodes = COUNTRIES.filter(c => c.code !== c.code.toUpperCase())
    expect(lowercaseCodes.length).toBe(0)
  })
})
