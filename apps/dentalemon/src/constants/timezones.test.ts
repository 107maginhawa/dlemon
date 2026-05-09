import { describe, test, expect } from 'bun:test'
import { TIMEZONES, type Timezone } from './timezones'

describe('Timezone Constants', () => {
  test('exports timezone options array', () => {
    expect(TIMEZONES).toBeDefined()
    expect(Array.isArray(TIMEZONES)).toBe(true)
    expect(TIMEZONES.length).toBeGreaterThan(0)
  })

  test('each timezone has required fields', () => {
    TIMEZONES.forEach((tz: Timezone) => {
      expect(tz.code).toBeDefined()
      expect(tz.name).toBeDefined()
      expect(tz.offset).toBeDefined()
      expect(tz.group).toBeDefined()
      expect(tz.mainCities).toBeDefined()
      expect(typeof tz.code).toBe('string')
      expect(typeof tz.name).toBe('string')
      expect(typeof tz.offset).toBe('string')
      expect(typeof tz.group).toBe('string')
      expect(Array.isArray(tz.mainCities)).toBe(true)
    })
  })

  test('timezone codes follow IANA format (Area/Location)', () => {
    TIMEZONES.forEach((tz: Timezone) => {
      // IANA format: Area/Location (e.g., America/New_York)
      // Should contain at least one slash
      expect(tz.code).toContain('/')

      // Should not be all lowercase (IANA uses proper casing)
      expect(tz.code).not.toBe(tz.code.toLowerCase())

      // Common pattern: starts with capital letter, contains underscore or slash
      expect(tz.code).toMatch(/^[A-Z][a-zA-Z_\/]+/)
    })
  })

  test('offset format is correct (UTC±X or UTC±X:XX)', () => {
    TIMEZONES.forEach((tz: Timezone) => {
      // Should match UTC+9, UTC-5, UTC+5:30, UTC-3:30, etc.
      expect(tz.offset).toMatch(/^UTC[+-]\d{1,2}(:\d{2})?$/)
    })
  })

  test('includes common timezones', () => {
    const newYork = TIMEZONES.find(tz => tz.code === 'America/New_York')
    expect(newYork).toBeDefined()
    expect(newYork?.offset).toMatch(/UTC[+-]\d/)
    expect(newYork?.group).toContain('America')

    const london = TIMEZONES.find(tz => tz.code === 'Europe/London')
    expect(london).toBeDefined()
    expect(london?.group).toContain('Europe')

    const tokyo = TIMEZONES.find(tz => tz.code === 'Asia/Tokyo')
    expect(tokyo).toBeDefined()
    expect(tokyo?.group).toContain('Asia')
  })

  test('no duplicate timezone codes', () => {
    const codes = TIMEZONES.map(tz => tz.code)
    const uniqueCodes = new Set(codes)
    expect(codes.length).toBe(uniqueCodes.size)
  })

  test('all timezones have non-empty values', () => {
    TIMEZONES.forEach((tz: Timezone) => {
      expect(tz.code.trim()).toBeTruthy()
      expect(tz.name.trim()).toBeTruthy()
      expect(tz.offset.trim()).toBeTruthy()
      expect(tz.group.trim()).toBeTruthy()
    })
  })

  test('no lowercase IANA timezone codes', () => {
    const lowercaseTimezones = TIMEZONES.filter(tz =>
      tz.code === tz.code.toLowerCase()
    )
    expect(lowercaseTimezones.length).toBe(0)
  })

  test('groups are properly capitalized', () => {
    TIMEZONES.forEach((tz: Timezone) => {
      // Group should start with capital letter
      expect(tz.group[0]).toBe(tz.group[0]?.toUpperCase())
    })
  })

  test('major cities are included in mainCities for searchability', () => {
    // Test Asia/Manila specifically - should include Manila and other cities
    const manila = TIMEZONES.find(tz => tz.code === 'Asia/Manila')
    expect(manila).toBeDefined()
    expect(manila?.mainCities).toContain('Manila')
    expect(manila?.mainCities).toContain('Quezon City')
    expect(manila?.mainCities.length).toBeGreaterThan(1)

    // Test Asia/Tokyo - should have major cities
    const tokyo = TIMEZONES.find(tz => tz.code === 'Asia/Tokyo')
    expect(tokyo).toBeDefined()
    expect(tokyo?.mainCities.length).toBeGreaterThan(0)

    // Test America/New_York - should have major cities
    const newYork = TIMEZONES.find(tz => tz.code === 'America/New_York')
    expect(newYork).toBeDefined()
    expect(newYork?.mainCities.length).toBeGreaterThan(0)
  })

  test('mainCities enables fuzzy search for all listed cities', () => {
    // Manila should be searchable even though Quezon City is displayed first
    const manila = TIMEZONES.find(tz => tz.code === 'Asia/Manila')
    expect(manila?.mainCities).toBeDefined()

    // All cities should be in the array for keyword search
    manila?.mainCities.forEach(city => {
      expect(city).toBeTruthy()
      expect(typeof city).toBe('string')
    })
  })
})
