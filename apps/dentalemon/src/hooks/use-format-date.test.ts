import { describe, test, expect } from 'bun:test'
import { renderHook } from '@testing-library/react'
import { useFormatDate } from './use-format-date'

describe('useFormatDate hook', () => {
  const testDate = new Date('2023-10-05T15:30:00.000Z')

  test('returns date formatting functions', () => {
    const { result } = renderHook(() => useFormatDate())

    expect(result.current.formatDate).toBeDefined()
    expect(typeof result.current.formatDate).toBe('function')
    expect(result.current.formatRelativeDate).toBeDefined()
    expect(typeof result.current.formatRelativeDate).toBe('function')
    expect(result.current.format).toBeDefined()
  })

  test('returns default format value', () => {
    const { result } = renderHook(() => useFormatDate())

    expect(result.current.format).toBe('long')
  })

  test('returns custom format value', () => {
    const { result } = renderHook(() => useFormatDate({ format: 'short' }))

    expect(result.current.format).toBe('short')
  })

  test('formats date with default long format', () => {
    const { result } = renderHook(() => useFormatDate())

    const formatted = result.current.formatDate(testDate)
    expect(formatted).toBe('October 5, 2023')
  })

  test('formats date with short format', () => {
    const { result } = renderHook(() => useFormatDate({ format: 'short' }))

    const formatted = result.current.formatDate(testDate)
    expect(formatted).toBe('10/5/23')
  })

  test('formats date with medium format', () => {
    const { result } = renderHook(() => useFormatDate({ format: 'medium' }))

    const formatted = result.current.formatDate(testDate)
    expect(formatted).toBe('Oct 5, 2023')
  })

  test('formats date with date format', () => {
    const { result } = renderHook(() => useFormatDate({ format: 'date' }))

    const formatted = result.current.formatDate(testDate)
    expect(formatted).toBe('2023-10-05')
  })

  test('formats relative date with long style', () => {
    const { result } = renderHook(() => useFormatDate())
    const pastDate = new Date(Date.now() - 3600000) // 1 hour ago

    const formatted = result.current.formatRelativeDate(pastDate)
    expect(formatted).toContain('hour')
    expect(formatted).toContain('ago')
  })

  test('formats relative date with short style', () => {
    const { result } = renderHook(() => useFormatDate())
    const pastDate = new Date(Date.now() - 3600000) // 1 hour ago

    const formatted = result.current.formatRelativeDate(pastDate, { style: 'short' })
    expect(formatted).toMatch(/\d+h ago/)
  })

  test('formats relative date without suffix', () => {
    const { result } = renderHook(() => useFormatDate())
    const pastDate = new Date(Date.now() - 3600000) // 1 hour ago

    const formatted = result.current.formatRelativeDate(pastDate, {
      style: 'short',
      addSuffix: false
    })
    expect(formatted).toMatch(/\d+h/)
    expect(formatted).not.toContain('ago')
  })

  test('handles timestamp input', () => {
    const { result } = renderHook(() => useFormatDate({ format: 'short' }))

    const formatted = result.current.formatDate(testDate.getTime())
    expect(formatted).toBe('10/5/23')
  })

  test('handles ISO string input', () => {
    const { result } = renderHook(() => useFormatDate({ format: 'short' }))

    const formatted = result.current.formatDate('2023-10-05T15:30:00.000Z')
    expect(formatted).toBe('10/5/23')
  })

  test('handles invalid dates', () => {
    const { result } = renderHook(() => useFormatDate())

    const formatted = result.current.formatDate('invalid-date')
    expect(formatted).toBe('Invalid date')
  })

  test('memoizes formatter by default', () => {
    const { result, rerender } = renderHook(() => useFormatDate({ format: 'short' }))

    const firstFormatter = result.current.formatDate
    rerender()
    const secondFormatter = result.current.formatDate

    // Should be the same reference due to memoization
    expect(firstFormatter).toBe(secondFormatter)
  })

  test('respects memoize option when false', () => {
    const { result } = renderHook(() => useFormatDate({ memoize: false }))

    // Function should still work even without memoization
    const formatted = result.current.formatDate(testDate)
    expect(formatted).toBe('October 5, 2023')
  })

  test('uses custom locale for relative dates', () => {
    const { result } = renderHook(() => useFormatDate({ locale: 'en-US' }))
    const pastDate = new Date(Date.now() - 3600000)

    const formatted = result.current.formatRelativeDate(pastDate)
    // Should work with locale option
    expect(formatted).toContain('ago')
  })
})
