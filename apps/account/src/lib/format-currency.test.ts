import { describe, test, expect } from 'bun:test'
import { formatCurrency } from './format-currency'

describe('formatCurrency utility', () => {
  test('formats amount without symbol', () => {
    const result = formatCurrency(1000) // 1000 cents = $10.00
    expect(result).toBe('10.00')
  })

  test('formats amount with USD symbol', () => {
    const result = formatCurrency(1000, { symbol: true })
    expect(result).toBe('$10.00')
  })

  test('formats amount with custom symbol', () => {
    const result = formatCurrency(1000, { symbol: '€' })
    expect(result).toBe('€10.00')
  })

  test('formats negative amounts', () => {
    const result = formatCurrency(-1000)
    expect(result).toBe('-10.00')
  })

  test('formats zero amount', () => {
    const result = formatCurrency(0)
    expect(result).toBe('0.00')
  })

  test('formats large amounts', () => {
    const result = formatCurrency(123456789) // $1,234,567.89
    expect(result).toContain('1,234,567.89')
  })

  test('formats with custom minimum fraction digits', () => {
    const result = formatCurrency(1000, { minimumFractionDigits: 0 })
    expect(result).toBe('10')
  })

  test('formats with custom maximum fraction digits', () => {
    const result = formatCurrency(1099, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    expect(result).toBe('11')
  })

  test('formats with custom locale', () => {
    // Different locales use different thousand separators
    const result = formatCurrency(123456789, { locale: 'de-DE' })
    // German locale uses . for thousands and , for decimals
    expect(result).toContain('1.234.567,89')
  })

  test('formats decimal amounts correctly', () => {
    const result = formatCurrency(1050) // 1050 cents = $10.50
    expect(result).toBe('10.50')
  })

  test('formats small amounts', () => {
    const result = formatCurrency(5) // 5 cents = $0.05
    expect(result).toBe('0.05')
  })

  test('handles symbol with custom fraction digits', () => {
    const result = formatCurrency(1000, {
      symbol: true,
      minimumFractionDigits: 0
    })
    expect(result).toBe('$10')
  })

  test('handles custom symbol with large amounts', () => {
    const result = formatCurrency(500000, { symbol: '£' })
    expect(result).toContain('5,000.00')
    expect(result).toContain('£')
  })
})
