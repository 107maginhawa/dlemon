import { describe, test, expect } from 'bun:test'
import { renderHook } from '@testing-library/react'
import { useFormatCurrency } from './use-format-currency'

describe('useFormatCurrency hook', () => {
  test('returns formatCurrency function', () => {
    const { result } = renderHook(() => useFormatCurrency())

    expect(result.current.formatCurrency).toBeDefined()
    expect(typeof result.current.formatCurrency).toBe('function')
  })

  test('formats currency with default options', () => {
    const { result } = renderHook(() => useFormatCurrency())

    const formatted = result.current.formatCurrency(1000) // 1000 cents = $10.00
    expect(formatted).toBe('10.00')
  })

  test('formats currency with USD symbol', () => {
    const { result } = renderHook(() => useFormatCurrency({ symbol: true }))

    const formatted = result.current.formatCurrency(1000)
    expect(formatted).toBe('$10.00')
  })

  test('formats currency with custom symbol', () => {
    const { result } = renderHook(() => useFormatCurrency({ symbol: '€' }))

    const formatted = result.current.formatCurrency(1000)
    expect(formatted).toBe('€10.00')
  })

  test('formats with custom fraction digits', () => {
    const { result } = renderHook(() =>
      useFormatCurrency({ minimumFractionDigits: 0, maximumFractionDigits: 0 })
    )

    const formatted = result.current.formatCurrency(1000)
    expect(formatted).toBe('10')
  })

  test('formats with custom locale', () => {
    const { result } = renderHook(() => useFormatCurrency({ locale: 'de-DE' }))

    const formatted = result.current.formatCurrency(123456789)
    // German locale uses . for thousands and , for decimals
    expect(formatted).toContain('1.234.567,89')
  })

  test('handles negative amounts', () => {
    const { result } = renderHook(() => useFormatCurrency())

    const formatted = result.current.formatCurrency(-1000)
    expect(formatted).toBe('-10.00')
  })

  test('handles zero amount', () => {
    const { result } = renderHook(() => useFormatCurrency())

    const formatted = result.current.formatCurrency(0)
    expect(formatted).toBe('0.00')
  })

  test('memoizes formatter by default', () => {
    const { result, rerender } = renderHook(() => useFormatCurrency({ symbol: true }))

    const firstFormatter = result.current.formatCurrency
    rerender()
    const secondFormatter = result.current.formatCurrency

    // Should be the same reference due to memoization
    expect(firstFormatter).toBe(secondFormatter)
  })

  test('respects memoize option when false', () => {
    const { result } = renderHook(() => useFormatCurrency({ memoize: false }))

    // Function should still work even without memoization
    const formatted = result.current.formatCurrency(1000)
    expect(formatted).toBe('10.00')
  })
})
