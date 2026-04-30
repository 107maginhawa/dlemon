import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { renderHook, cleanup } from '@testing-library/react'
import { useIsMobile } from './use-mobile'

describe('useIsMobile', () => {
  let originalInnerWidth: number
  let originalMatchMedia: typeof window.matchMedia

  beforeEach(() => {
    // Store original values
    originalInnerWidth = window.innerWidth
    originalMatchMedia = window.matchMedia

    // Mock matchMedia
    const listeners: Array<(e: MediaQueryListEvent) => void> = []
    const mockMediaQueryList = {
      matches: false,
      media: '',
      onchange: null,
      addEventListener: (event: string, handler: (e: MediaQueryListEvent) => void) => {
        if (event === 'change') {
          listeners.push(handler)
        }
      },
      removeEventListener: (event: string, handler: (e: MediaQueryListEvent) => void) => {
        if (event === 'change') {
          const index = listeners.indexOf(handler)
          if (index !== -1) {
            listeners.splice(index, 1)
          }
        }
      },
      dispatchEvent: () => true
    }

    window.matchMedia = (query: string): MediaQueryList => {
      mockMediaQueryList.media = query
      mockMediaQueryList.matches = window.innerWidth < 768
      return mockMediaQueryList as MediaQueryList
    }
  })

  afterEach(() => {
    // Restore original values
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth
    })
    window.matchMedia = originalMatchMedia
    cleanup()
  })

  test('returns false for desktop viewport', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024
    })

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  test('returns true for mobile viewport', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375
    })

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  test('returns true at breakpoint boundary (767px)', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 767
    })

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  test('returns false at breakpoint boundary (768px)', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 768
    })

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  test('returns false for tablet viewport', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 800
    })

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  test('handles initial undefined state correctly', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024
    })

    const { result } = renderHook(() => useIsMobile())
    // Should return false (!!undefined = false) initially and then false for desktop
    expect(result.current).toBe(false)
  })

  test('handles edge case of 0 width', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 0
    })

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  test('handles very large viewport', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 2560
    })

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })
})