import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { detectTimezone } from './detect-timezone'

describe('detectTimezone', () => {
  let originalIntl: any

  beforeEach(() => {
    originalIntl = global.Intl
  })

  afterEach(() => {
    global.Intl = originalIntl
  })

  test('returns default fallback when Intl is not available', () => {
    // @ts-ignore
    global.Intl = undefined
    const result = detectTimezone()
    expect(result).toBe('America/New_York') // default fallback
  })

  test('uses custom fallback when provided', () => {
    // @ts-ignore
    global.Intl = undefined
    const result = detectTimezone({ fallback: 'Europe/London' })
    expect(result).toBe('Europe/London')
  })

  test('detects timezone from Intl.DateTimeFormat', () => {
    // @ts-ignore
    global.Intl = {
      DateTimeFormat: function() {
        return {
          resolvedOptions: () => ({
            timeZone: 'Asia/Tokyo'
          })
        }
      }
    }
    const result = detectTimezone()
    expect(result).toBe('Asia/Tokyo')
  })

  test('handles different timezone formats', () => {
    const timezones = [
      'America/New_York',
      'Europe/Paris',
      'Asia/Shanghai',
      'Australia/Sydney',
      'Africa/Cairo',
      'UTC'
    ]

    timezones.forEach(tz => {
      // @ts-ignore
      global.Intl = {
        DateTimeFormat: function() {
          return {
            resolvedOptions: () => ({
              timeZone: tz
            })
          }
        }
      }
      const result = detectTimezone()
      expect(result).toBe(tz)
    })
  })

  test('handles error gracefully and returns fallback', () => {
    // @ts-ignore
    global.Intl = {
      DateTimeFormat: function() {
        throw new Error('DateTimeFormat not supported')
      }
    }
    const result = detectTimezone({ fallback: 'America/Los_Angeles' })
    expect(result).toBe('America/Los_Angeles')
  })

  test('handles missing resolvedOptions method', () => {
    // @ts-ignore
    global.Intl = {
      DateTimeFormat: function() {
        return {} // No resolvedOptions method
      }
    }
    const result = detectTimezone()
    expect(result).toBe('America/New_York')
  })

  test('handles null timeZone in resolvedOptions', () => {
    // @ts-ignore
    global.Intl = {
      DateTimeFormat: function() {
        return {
          resolvedOptions: () => ({
            timeZone: null
          })
        }
      }
    }
    const result = detectTimezone({ fallback: 'Europe/Berlin' })
    expect(result).toBe('Europe/Berlin')
  })
})