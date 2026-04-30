import { describe, test, expect } from 'bun:test'
import { LANGUAGES, type Language } from './languages'

describe('Language Constants', () => {
  test('exports language options array', () => {
    expect(LANGUAGES).toBeDefined()
    expect(Array.isArray(LANGUAGES)).toBe(true)
    expect(LANGUAGES.length).toBeGreaterThan(0)
  })

  test('each language has required fields', () => {
    LANGUAGES.forEach((lang: Language) => {
      expect(lang.code).toBeDefined()
      expect(lang.name).toBeDefined()
      expect(lang.nativeName).toBeDefined()
      expect(typeof lang.code).toBe('string')
      expect(typeof lang.name).toBe('string')
      expect(typeof lang.nativeName).toBe('string')
    })
  })

  test('language codes follow ISO 639-1 standard (lowercase)', () => {
    LANGUAGES.forEach((lang: Language) => {
      expect(lang.code.length).toBe(2)
      expect(lang.code).toBe(lang.code.toLowerCase())
      expect(lang.code).toMatch(/^[a-z]{2}$/)
    })
  })

  test('includes common languages with native names', () => {
    const english = LANGUAGES.find(l => l.code === 'en')
    expect(english).toBeDefined()
    expect(english?.nativeName).toBe('English')

    const spanish = LANGUAGES.find(l => l.code === 'es')
    expect(spanish).toBeDefined()
    expect(spanish?.nativeName).toBe('Español')

    const japanese = LANGUAGES.find(l => l.code === 'ja')
    expect(japanese).toBeDefined()
    expect(japanese?.nativeName).toBe('日本語')

    const french = LANGUAGES.find(l => l.code === 'fr')
    expect(french).toBeDefined()
    expect(french?.nativeName).toBe('Français')
  })

  test('language names are proper English names, not 3-letter codes', () => {
    // Verify we're not getting ISO 639-2 codes as names
    const english = LANGUAGES.find(l => l.code === 'en')
    expect(english?.name).toBe('English')
    expect(english?.name).not.toBe('eng') // Should NOT be 3-letter code

    const spanish = LANGUAGES.find(l => l.code === 'es')
    expect(spanish?.name).toBe('Spanish')
    expect(spanish?.name).not.toBe('spa')

    const arabic = LANGUAGES.find(l => l.code === 'ar')
    expect(arabic?.name).toBe('Arabic')
    expect(arabic?.name).not.toBe('ara')

    const afar = LANGUAGES.find(l => l.code === 'aa')
    expect(afar?.name).toBe('Afar')
    expect(afar?.name).not.toBe('aar')
  })

  test('no language names are 3-letter codes', () => {
    // Ensure ALL languages have proper names, not codes
    LANGUAGES.forEach((lang: Language) => {
      // 3-letter codes are exactly 3 lowercase letters
      const is3LetterCode = /^[a-z]{3}$/.test(lang.name)
      expect(is3LetterCode).toBe(false)

      // Names should be capitalized (first letter uppercase)
      expect(lang.name[0]).toBe(lang.name[0].toUpperCase())
    })
  })

  test('no duplicate language codes', () => {
    const codes = LANGUAGES.map(l => l.code)
    const uniqueCodes = new Set(codes)
    expect(codes.length).toBe(uniqueCodes.size)
  })

  test('all languages have non-empty values', () => {
    LANGUAGES.forEach((lang: Language) => {
      expect(lang.code.trim()).toBeTruthy()
      expect(lang.name.trim()).toBeTruthy()
      expect(lang.nativeName.trim()).toBeTruthy()
    })
  })
})
