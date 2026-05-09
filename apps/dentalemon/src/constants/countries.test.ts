import { describe, test, expect } from 'bun:test'
import { COUNTRIES, type Country } from './countries'

describe('Country Constants', () => {
  test('exports country options array', () => {
    expect(COUNTRIES).toBeDefined()
    expect(Array.isArray(COUNTRIES)).toBe(true)
    expect(COUNTRIES.length).toBeGreaterThan(0)
  })

  test('each country has required fields', () => {
    COUNTRIES.forEach((country: Country) => {
      expect(country.code).toBeDefined()
      expect(country.name).toBeDefined()
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
    expect(usa).toBeDefined()
    expect(usa?.name).toContain('United States')

    const uk = COUNTRIES.find(c => c.code === 'GB')
    expect(uk).toBeDefined()
    expect(uk?.name).toContain('United Kingdom')

    const canada = COUNTRIES.find(c => c.code === 'CA')
    expect(canada).toBeDefined()
    expect(canada?.name).toBe('Canada')

    const japan = COUNTRIES.find(c => c.code === 'JP')
    expect(japan).toBeDefined()
    expect(japan?.name).toBe('Japan')
  })

  test('no duplicate country codes', () => {
    const codes = COUNTRIES.map(c => c.code)
    const uniqueCodes = new Set(codes)
    expect(codes.length).toBe(uniqueCodes.size)
  })

  test('all countries have non-empty values', () => {
    COUNTRIES.forEach((country: Country) => {
      expect(country.code.trim()).toBeTruthy()
      expect(country.name.trim()).toBeTruthy()
    })
  })

  test('no lowercase country codes', () => {
    const lowercaseCodes = COUNTRIES.filter(c => c.code !== c.code.toUpperCase())
    expect(lowercaseCodes.length).toBe(0)
  })
})
