import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { detectCountry } from './detect-country'

// Bun's global.navigator is readonly — use Object.defineProperty to mock it
function mockNavigator(value: any) {
  Object.defineProperty(global, 'navigator', { value, configurable: true, writable: true })
}

describe('detectCountry', () => {
  let originalNavigator: any

  beforeEach(() => {
    originalNavigator = global.navigator
    mockNavigator({ language: undefined, languages: undefined })
  })

  afterEach(() => {
    mockNavigator(originalNavigator)
  })

  test('returns fallback when no locale or timezone available', () => {
    const result = detectCountry()
    expect(result).toBe('CA') // default fallback
  })

  test('uses custom fallback when provided', () => {
    const result = detectCountry({ fallback: 'US' })
    expect(result).toBe('US')
  })

  test('detects country from navigator.language with country code', () => {
    mockNavigator({ language: 'en-US', languages: undefined })
    const result = detectCountry()
    expect(result).toBe('US')
  })

  test('detects country from navigator.languages', () => {
    mockNavigator({ language: undefined, languages: ['fr-FR', 'en-US'] })
    const result = detectCountry()
    expect(result).toBe('FR')
  })

  test('handles locale without country code', () => {
    mockNavigator({ language: 'en', languages: undefined })
    const result = detectCountry()
    expect(result).toBeTruthy()
  })

  test('converts country code to uppercase', () => {
    mockNavigator({ language: 'en-gb', languages: undefined })
    const result = detectCountry()
    expect(result).toBe('GB')
  })

  test('handles multiple locales in languages array', () => {
    mockNavigator({ language: undefined, languages: ['zh-CN', 'en-US', 'es-ES'] })
    const result = detectCountry()
    expect(result).toBe('CN')
  })

  test('handles error gracefully and returns fallback', () => {
    mockNavigator({
      get language() { throw new Error('Access denied') }
    })
    const result = detectCountry({ fallback: 'AU' })
    expect(result).toBe('AU')
  })

  test('handles complex locale strings', () => {
    mockNavigator({ language: 'zh-Hans-CN', languages: undefined })
    const result = detectCountry()
    expect(result).toBe('CN')
  })
})
