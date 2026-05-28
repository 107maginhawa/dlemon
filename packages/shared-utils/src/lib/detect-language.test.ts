import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { detectLanguage } from './detect-language'

describe('detectLanguage', () => {
  let originalNavigator: any

  beforeEach(() => {
    originalNavigator = global.navigator
    // @ts-ignore
    global.navigator = {
      language: undefined,
      languages: undefined
    }
  })

  afterEach(() => {
    global.navigator = originalNavigator
  })

  test('returns default fallback when no language available', () => {
    const result = detectLanguage()
    expect(result).toBe('en') // default fallback
  })

  test('uses custom fallback when provided', () => {
    const result = detectLanguage({ fallback: 'fr' })
    expect(result).toBe('fr')
  })

  test('detects language from navigator.language', () => {
    // @ts-ignore
    global.navigator = {
      language: 'fr-FR',
      languages: undefined
    }
    const result = detectLanguage()
    expect(result).toBe('fr')
  })

  test('detects language from navigator.languages', () => {
    // @ts-ignore
    global.navigator = {
      language: undefined,
      languages: ['es-ES', 'en-US']
    }
    const result = detectLanguage()
    expect(result).toBe('es')
  })

  test('extracts language code from locale string', () => {
    // @ts-ignore
    global.navigator = {
      language: 'zh-CN',
      languages: undefined
    }
    const result = detectLanguage()
    expect(result).toBe('zh')
  })

  test('handles language code without country', () => {
    // @ts-ignore
    global.navigator = {
      language: 'en',
      languages: undefined
    }
    const result = detectLanguage()
    expect(result).toBe('en')
  })

  test('converts language code to lowercase', () => {
    // @ts-ignore
    global.navigator = {
      language: 'FR-fr',
      languages: undefined
    }
    const result = detectLanguage()
    expect(result).toBe('fr')
  })

  test('returns fallback for invalid language codes', () => {
    // @ts-ignore
    global.navigator = {
      language: 'xx-XX', // Invalid language
      languages: undefined
    }
    const result = detectLanguage({ fallback: 'en' })
    expect(result).toBe('en')
  })

  test('handles error gracefully and returns fallback', () => {
    // @ts-ignore
    global.navigator = {
      get language() {
        throw new Error('Access denied')
      }
    }
    const result = detectLanguage({ fallback: 'de' })
    expect(result).toBe('de')
  })

  test('handles complex locale strings', () => {
    // @ts-ignore
    global.navigator = {
      language: 'zh-Hans-CN',
      languages: undefined
    }
    const result = detectLanguage()
    expect(result).toBe('zh')
  })

  test('prefers first language in languages array', () => {
    // @ts-ignore
    global.navigator = {
      language: 'en-US',
      languages: ['fr-FR', 'en-US', 'es-ES']
    }
    const result = detectLanguage()
    expect(result).toBe('fr')
  })
})