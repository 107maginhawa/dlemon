import { describe, test, expect } from 'bun:test'
import { formatDate, formatRelativeDate } from './format-date'

describe('formatDate utility', () => {
  const testDate = new Date('2023-10-05T15:30:00.000Z')

  test('formats with default long format', () => {
    const result = formatDate(testDate)
    expect(result).toBe('October 5, 2023')
  })

  test('formats with short format', () => {
    const result = formatDate(testDate, { format: 'short' })
    expect(result).toBe('10/5/23')
  })

  test('formats with medium format', () => {
    const result = formatDate(testDate, { format: 'medium' })
    expect(result).toBe('Oct 5, 2023')
  })

  test('formats with full format', () => {
    const result = formatDate(testDate, { format: 'full' })
    expect(result).toBe('Thursday, October 5, 2023')
  })

  test('formats with time format', () => {
    const result = formatDate(testDate, { format: 'time' })
    // Time will depend on timezone, just check it contains time elements
    expect(result).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/i)
  })

  test('formats with datetime format', () => {
    const result = formatDate(testDate, { format: 'datetime' })
    expect(result).toContain('Oct 5, 2023')
    expect(result).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/i)
  })

  test('formats with date format (ISO 8601 date-only)', () => {
    const result = formatDate(testDate, { format: 'date' })
    expect(result).toBe('2023-10-05')
  })

  test('formats with iso format', () => {
    const result = formatDate(testDate, { format: 'iso' })
    expect(result).toBe('2023-10-05T15:30:00.000Z')
  })

  test('formats with custom format string', () => {
    const result = formatDate(testDate, { format: 'yyyy-MM-dd' })
    expect(result).toBe('2023-10-05')
  })

  test('handles timestamp input', () => {
    const result = formatDate(testDate.getTime(), { format: 'short' })
    expect(result).toBe('10/5/23')
  })

  test('handles ISO string input', () => {
    const result = formatDate('2023-10-05T15:30:00.000Z', { format: 'short' })
    expect(result).toBe('10/5/23')
  })

  test('handles invalid dates', () => {
    const result = formatDate('invalid-date')
    expect(result).toBe('Invalid date')
  })

  test('handles invalid format strings gracefully', () => {
    // Should fallback to long format
    const result = formatDate(testDate, { format: 'invalid-format-xyz' as any })
    expect(result).toBe('October 5, 2023')
  })
})

describe('formatRelativeDate utility', () => {
  test('formats past dates with long style', () => {
    const pastDate = new Date(Date.now() - 3600000) // 1 hour ago
    const result = formatRelativeDate(pastDate)
    expect(result).toContain('hour')
    expect(result).toContain('ago')
  })

  test('formats future dates with long style', () => {
    const futureDate = new Date(Date.now() + 86400000) // 1 day from now
    const result = formatRelativeDate(futureDate)
    expect(result).toContain('day')
  })

  test('formats with short style - seconds', () => {
    const date = new Date(Date.now() - 30000) // 30 seconds ago
    const result = formatRelativeDate(date, { style: 'short' })
    expect(result).toMatch(/\d+s ago/)
  })

  test('formats with short style - minutes', () => {
    const date = new Date(Date.now() - 300000) // 5 minutes ago
    const result = formatRelativeDate(date, { style: 'short' })
    expect(result).toMatch(/\d+m ago/)
  })

  test('formats with short style - hours', () => {
    const date = new Date(Date.now() - 7200000) // 2 hours ago
    const result = formatRelativeDate(date, { style: 'short' })
    expect(result).toMatch(/\d+h ago/)
  })

  test('formats with short style - days', () => {
    const date = new Date(Date.now() - 172800000) // 2 days ago
    const result = formatRelativeDate(date, { style: 'short' })
    expect(result).toMatch(/\d+d ago/)
  })

  test('formats with short style - future', () => {
    const date = new Date(Date.now() + 3600000) // 1 hour from now
    const result = formatRelativeDate(date, { style: 'short' })
    expect(result).toMatch(/in \d+h/)
  })

  test('formats without suffix', () => {
    const date = new Date(Date.now() - 3600000) // 1 hour ago
    const result = formatRelativeDate(date, { style: 'short', addSuffix: false })
    expect(result).toMatch(/\d+h/)
    expect(result).not.toContain('ago')
  })

  test('handles invalid dates', () => {
    const result = formatRelativeDate('invalid-date')
    expect(result).toBe('Invalid date')
  })

  test('handles timestamp input', () => {
    const timestamp = Date.now() - 3600000
    const result = formatRelativeDate(timestamp, { style: 'short' })
    expect(result).toMatch(/\d+h ago/)
  })

  test('handles ISO string input', () => {
    const isoString = new Date(Date.now() - 3600000).toISOString()
    const result = formatRelativeDate(isoString, { style: 'short' })
    expect(result).toMatch(/\d+h ago/)
  })
})
