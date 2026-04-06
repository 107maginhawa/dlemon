import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { renderHook, cleanup } from '@testing-library/react'
import { useDetectLanguage } from './use-detect-language'
import type { Language } from '@monobase/ui/constants/languages'

describe('useDetectLanguage', () => {
  let originalNavigator: Navigator

  beforeEach(() => {
    // Store original navigator
    originalNavigator = global.navigator
  })

  afterEach(() => {
    // Restore original navigator
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true
    })
    cleanup()
  })

  test('returns detected language from browser', () => {
    // Mock English language
    Object.defineProperty(global, 'navigator', {
      value: {
        ...originalNavigator,
        language: 'en-US',
        languages: ['en-US', 'en']
      },
      writable: true,
      configurable: true
    })

    const { result } = renderHook(() => useDetectLanguage())
    expect(result.current).toBe('en')
  })

  test('returns French for French locale', () => {
    Object.defineProperty(global, 'navigator', {
      value: {
        ...originalNavigator,
        language: 'fr-FR',
        languages: ['fr-FR', 'fr']
      },
      writable: true,
      configurable: true
    })

    const { result } = renderHook(() => useDetectLanguage())
    expect(result.current).toBe('fr')
  })

  test('returns Spanish for Spanish locale', () => {
    Object.defineProperty(global, 'navigator', {
      value: {
        ...originalNavigator,
        language: 'es-ES',
        languages: ['es-ES', 'es']
      },
      writable: true,
      configurable: true
    })

    const { result } = renderHook(() => useDetectLanguage())
    expect(result.current).toBe('es')
  })

  test('returns German for German locale', () => {
    Object.defineProperty(global, 'navigator', {
      value: {
        ...originalNavigator,
        language: 'de-DE',
        languages: ['de-DE', 'de']
      },
      writable: true,
      configurable: true
    })

    const { result } = renderHook(() => useDetectLanguage())
    expect(result.current).toBe('de')
  })

  test('returns Chinese for Chinese locale', () => {
    Object.defineProperty(global, 'navigator', {
      value: {
        ...originalNavigator,
        language: 'zh-CN',
        languages: ['zh-CN', 'zh']
      },
      writable: true,
      configurable: true
    })

    const { result } = renderHook(() => useDetectLanguage())
    expect(result.current).toBe('zh')
  })

  test('returns Japanese for Japanese locale', () => {
    Object.defineProperty(global, 'navigator', {
      value: {
        ...originalNavigator,
        language: 'ja-JP',
        languages: ['ja-JP', 'ja']
      },
      writable: true,
      configurable: true
    })

    const { result } = renderHook(() => useDetectLanguage())
    expect(result.current).toBe('ja')
  })

  test('returns fallback when specified', () => {
    // Mock a locale that might not be in the supported languages list
    Object.defineProperty(global, 'navigator', {
      value: {
        ...originalNavigator,
        language: 'xx-XX',
        languages: ['xx-XX']
      },
      writable: true,
      configurable: true
    })

    const { result } = renderHook(() =>
      useDetectLanguage({ fallback: 'fr' as Language['code'] })
    )
    expect(result.current).toBe('fr')
  })

  test('returns English as default fallback when no fallback specified', () => {
    // Mock unavailable language
    Object.defineProperty(global, 'navigator', {
      value: {
        ...originalNavigator,
        language: 'xx-XX',
        languages: ['xx-XX']
      },
      writable: true,
      configurable: true
    })

    const { result } = renderHook(() => useDetectLanguage())
    expect(result.current).toBe('en') // Default fallback
  })

  test('handles locale with region correctly', () => {
    Object.defineProperty(global, 'navigator', {
      value: {
        ...originalNavigator,
        language: 'en-GB',
        languages: ['en-GB', 'en']
      },
      writable: true,
      configurable: true
    })

    const { result } = renderHook(() => useDetectLanguage())
    expect(result.current).toBe('en')
  })

  test('handles locale with script tag', () => {
    Object.defineProperty(global, 'navigator', {
      value: {
        ...originalNavigator,
        language: 'zh-Hans-CN',
        languages: ['zh-Hans-CN', 'zh-CN', 'zh']
      },
      writable: true,
      configurable: true
    })

    const { result } = renderHook(() => useDetectLanguage())
    expect(result.current).toBe('zh')
  })

  test('persists language value across re-renders', () => {
    Object.defineProperty(global, 'navigator', {
      value: {
        ...originalNavigator,
        language: 'en-US',
        languages: ['en-US']
      },
      writable: true,
      configurable: true
    })

    const { result, rerender } = renderHook(() => useDetectLanguage())
    const firstValue = result.current
    expect(firstValue).toBe('en')

    rerender()
    expect(result.current).toBe(firstValue)
  })

  test('updates when fallback changes', () => {
    Object.defineProperty(global, 'navigator', {
      value: {
        ...originalNavigator,
        language: 'xx-XX',
        languages: ['xx-XX']
      },
      writable: true,
      configurable: true
    })

    const { result, rerender } = renderHook(
      ({ fallback }) => useDetectLanguage({ fallback }),
      { initialProps: { fallback: 'en' as Language['code'] } }
    )

    expect(result.current).toBe('en')

    rerender({ fallback: 'fr' as Language['code'] })
    expect(result.current).toBe('fr')
  })

  test('handles Portuguese Brazilian locale', () => {
    Object.defineProperty(global, 'navigator', {
      value: {
        ...originalNavigator,
        language: 'pt-BR',
        languages: ['pt-BR', 'pt']
      },
      writable: true,
      configurable: true
    })

    const { result } = renderHook(() => useDetectLanguage())
    expect(result.current).toBe('pt')
  })

  test('handles Korean locale', () => {
    Object.defineProperty(global, 'navigator', {
      value: {
        ...originalNavigator,
        language: 'ko-KR',
        languages: ['ko-KR', 'ko']
      },
      writable: true,
      configurable: true
    })

    const { result } = renderHook(() => useDetectLanguage())
    expect(result.current).toBe('ko')
  })

  test('handles Italian locale', () => {
    Object.defineProperty(global, 'navigator', {
      value: {
        ...originalNavigator,
        language: 'it-IT',
        languages: ['it-IT', 'it']
      },
      writable: true,
      configurable: true
    })

    const { result } = renderHook(() => useDetectLanguage())
    expect(result.current).toBe('it')
  })

  test('handles multiple languages in navigator.languages', () => {
    Object.defineProperty(global, 'navigator', {
      value: {
        ...originalNavigator,
        language: 'es-MX',
        languages: ['es-MX', 'es', 'en-US', 'en']
      },
      writable: true,
      configurable: true
    })

    const { result } = renderHook(() => useDetectLanguage())
    expect(result.current).toBe('es') // Should pick first language
  })

  test('handles missing navigator.languages gracefully', () => {
    Object.defineProperty(global, 'navigator', {
      value: {
        ...originalNavigator,
        language: 'fr-CA',
        languages: undefined
      },
      writable: true,
      configurable: true
    })

    const { result } = renderHook(() => useDetectLanguage())
    expect(result.current).toBe('fr')
  })
})