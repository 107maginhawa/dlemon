import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { renderHook, cleanup } from '@testing-library/react'
import { useDetectTimezone } from './use-detect-timezone'
import type { Timezone } from '@monobase/ui/constants/timezones'

describe('useDetectTimezone', () => {
  let originalIntl: typeof Intl

  beforeEach(() => {
    // Store original Intl
    originalIntl = global.Intl
  })

  afterEach(() => {
    // Restore original Intl
    Object.defineProperty(global, 'Intl', {
      value: originalIntl,
      writable: true,
      configurable: true
    })
    cleanup()
  })

  test('returns detected timezone from browser', () => {
    // Mock New York timezone
    Object.defineProperty(global, 'Intl', {
      value: {
        ...originalIntl,
        DateTimeFormat: function() {
          return {
            resolvedOptions: () => ({ timeZone: 'America/New_York' })
          }
        }
      },
      writable: true,
      configurable: true
    })

    const { result } = renderHook(() => useDetectTimezone())
    expect(result.current).toBe('America/New_York')
  })

  test('returns London timezone', () => {
    Object.defineProperty(global, 'Intl', {
      value: {
        ...originalIntl,
        DateTimeFormat: function() {
          return {
            resolvedOptions: () => ({ timeZone: 'Europe/London' })
          }
        }
      },
      writable: true,
      configurable: true
    })

    const { result } = renderHook(() => useDetectTimezone())
    expect(result.current).toBe('Europe/London')
  })

  test('returns Tokyo timezone', () => {
    Object.defineProperty(global, 'Intl', {
      value: {
        ...originalIntl,
        DateTimeFormat: function() {
          return {
            resolvedOptions: () => ({ timeZone: 'Asia/Tokyo' })
          }
        }
      },
      writable: true,
      configurable: true
    })

    const { result } = renderHook(() => useDetectTimezone())
    expect(result.current).toBe('Asia/Tokyo')
  })

  test('returns Sydney timezone', () => {
    Object.defineProperty(global, 'Intl', {
      value: {
        ...originalIntl,
        DateTimeFormat: function() {
          return {
            resolvedOptions: () => ({ timeZone: 'Australia/Sydney' })
          }
        }
      },
      writable: true,
      configurable: true
    })

    const { result } = renderHook(() => useDetectTimezone())
    expect(result.current).toBe('Australia/Sydney')
  })

  test('returns UTC timezone', () => {
    Object.defineProperty(global, 'Intl', {
      value: {
        ...originalIntl,
        DateTimeFormat: function() {
          return {
            resolvedOptions: () => ({ timeZone: 'UTC' })
          }
        }
      },
      writable: true,
      configurable: true
    })

    const { result } = renderHook(() => useDetectTimezone())
    expect(result.current).toBe('UTC')
  })

  test('returns fallback when specified', () => {
    // Mock an error or unsupported timezone
    Object.defineProperty(global, 'Intl', {
      value: {
        ...originalIntl,
        DateTimeFormat: function() {
          return {
            resolvedOptions: () => {
              throw new Error('Timezone not supported')
            }
          }
        }
      },
      writable: true,
      configurable: true
    })

    const { result } = renderHook(() =>
      useDetectTimezone({ fallback: 'America/Los_Angeles' as Timezone['code'] })
    )
    expect(result.current).toBe('America/Los_Angeles')
  })

  test('returns UTC as default fallback when no fallback specified', () => {
    // Mock an error
    Object.defineProperty(global, 'Intl', {
      value: {
        ...originalIntl,
        DateTimeFormat: function() {
          return {
            resolvedOptions: () => {
              throw new Error('Timezone not supported')
            }
          }
        }
      },
      writable: true,
      configurable: true
    })

    const { result } = renderHook(() => useDetectTimezone())
    expect(result.current).toBe('America/New_York') // Default fallback
  })

  test('handles various US timezones', () => {
    const usTimezones = [
      'America/Chicago',
      'America/Denver',
      'America/Phoenix',
      'America/Anchorage',
      'Pacific/Honolulu'
    ]

    usTimezones.forEach(tz => {
      Object.defineProperty(global, 'Intl', {
        value: {
          ...originalIntl,
          DateTimeFormat: function() {
            return {
              resolvedOptions: () => ({ timeZone: tz })
            }
          }
        },
        writable: true,
        configurable: true
      })

      const { result } = renderHook(() => useDetectTimezone())
      expect(result.current).toBe(tz)
      cleanup()
    })
  })

  test('handles various European timezones', () => {
    const europeanTimezones = [
      'Europe/Paris',
      'Europe/Berlin',
      'Europe/Rome',
      'Europe/Madrid',
      'Europe/Amsterdam'
    ]

    europeanTimezones.forEach(tz => {
      Object.defineProperty(global, 'Intl', {
        value: {
          ...originalIntl,
          DateTimeFormat: function() {
            return {
              resolvedOptions: () => ({ timeZone: tz })
            }
          }
        },
        writable: true,
        configurable: true
      })

      const { result } = renderHook(() => useDetectTimezone())
      expect(result.current).toBe(tz)
      cleanup()
    })
  })

  test('handles Asian timezones', () => {
    const asianTimezones = [
      'Asia/Shanghai',
      'Asia/Hong_Kong',
      'Asia/Singapore',
      'Asia/Seoul',
      'Asia/Kolkata'
    ]

    asianTimezones.forEach(tz => {
      Object.defineProperty(global, 'Intl', {
        value: {
          ...originalIntl,
          DateTimeFormat: function() {
            return {
              resolvedOptions: () => ({ timeZone: tz })
            }
          }
        },
        writable: true,
        configurable: true
      })

      const { result } = renderHook(() => useDetectTimezone())
      expect(result.current).toBe(tz)
      cleanup()
    })
  })

  test('persists timezone value across re-renders', () => {
    Object.defineProperty(global, 'Intl', {
      value: {
        ...originalIntl,
        DateTimeFormat: function() {
          return {
            resolvedOptions: () => ({ timeZone: 'America/New_York' })
          }
        }
      },
      writable: true,
      configurable: true
    })

    const { result, rerender } = renderHook(() => useDetectTimezone())
    const firstValue = result.current
    expect(firstValue).toBe('America/New_York')

    rerender()
    expect(result.current).toBe(firstValue)
  })

  test('updates when fallback changes', () => {
    // Mock error to force fallback usage
    Object.defineProperty(global, 'Intl', {
      value: {
        ...originalIntl,
        DateTimeFormat: function() {
          return {
            resolvedOptions: () => {
              throw new Error('Timezone not supported')
            }
          }
        }
      },
      writable: true,
      configurable: true
    })

    const { result, rerender } = renderHook(
      ({ fallback }) => useDetectTimezone({ fallback }),
      { initialProps: { fallback: 'America/New_York' as Timezone['code'] } }
    )

    expect(result.current).toBe('America/New_York')

    rerender({ fallback: 'Europe/London' as Timezone['code'] })
    expect(result.current).toBe('Europe/London')
  })

  test('handles Canadian timezones', () => {
    const canadianTimezones = [
      'America/Toronto',
      'America/Vancouver',
      'America/Edmonton',
      'America/Winnipeg',
      'America/Halifax'
    ]

    canadianTimezones.forEach(tz => {
      Object.defineProperty(global, 'Intl', {
        value: {
          ...originalIntl,
          DateTimeFormat: function() {
            return {
              resolvedOptions: () => ({ timeZone: tz })
            }
          }
        },
        writable: true,
        configurable: true
      })

      const { result } = renderHook(() => useDetectTimezone())
      expect(result.current).toBe(tz)
      cleanup()
    })
  })

  test('handles missing Intl.DateTimeFormat gracefully', () => {
    // Mock missing DateTimeFormat
    Object.defineProperty(global, 'Intl', {
      value: {
        ...originalIntl,
        DateTimeFormat: undefined
      },
      writable: true,
      configurable: true
    })

    const { result } = renderHook(() =>
      useDetectTimezone({ fallback: 'America/Chicago' as Timezone['code'] })
    )
    expect(result.current).toBe('America/Chicago')
  })
})