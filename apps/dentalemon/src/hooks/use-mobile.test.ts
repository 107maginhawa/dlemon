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
    ;(window as any).innerWidth = originalInnerWidth
    window.matchMedia = originalMatchMedia
    cleanup()
  })

  test('returns false for desktop viewport', () => {
    ;(window as any).innerWidth = 1024

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  test('returns true for mobile viewport', () => {
    ;(window as any).innerWidth = 375

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  test('returns true at breakpoint boundary (767px)', () => {
    ;(window as any).innerWidth = 767

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  test('returns false at breakpoint boundary (768px)', () => {
    ;(window as any).innerWidth = 768

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  test('returns false for tablet viewport', () => {
    ;(window as any).innerWidth = 800

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  test('handles initial undefined state correctly', () => {
    ;(window as any).innerWidth = 1024

    const { result } = renderHook(() => useIsMobile())
    // Should return false (!!undefined = false) initially and then false for desktop
    expect(result.current).toBe(false)
  })

  test('handles edge case of 0 width', () => {
    ;(window as any).innerWidth = 0

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  test('handles very large viewport', () => {
    ;(window as any).innerWidth = 2560

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })
})