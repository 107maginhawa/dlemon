import { registerLocale, getNames, getName } from '@cospired/i18n-iso-languages'
import en from '@cospired/i18n-iso-languages/langs/en.json'

// Register the English language data
registerLocale(en)

/**
 * Language data structure
 *
 * IMPORTANT: Language codes MUST be lowercase per ISO 639-1 standard.
 * This ensures compatibility with:
 * - BCP 47 language tags (e.g., "en-US", "fr-CA")
 * - HTTP Accept-Language headers
 * - HTML lang attributes
 * - Internationalization libraries
 *
 * @example
 * { code: 'en', name: 'English', nativeName: 'English' }
 * { code: 'es', name: 'Spanish', nativeName: 'Español' }
 * { code: 'ja', name: 'Japanese', nativeName: '日本語' }
 */
export interface Language {
  /** ISO 639-1 two-letter language code (lowercase) */
  code: string
  /** English language name */
  name: string
  /** Native language name */
  nativeName: string
}

// Get all language codes with their proper English names
const englishNames = getNames('en')

export const LANGUAGES: Language[] = Object.entries(englishNames).map(([code, name]) => ({
  code,
  name: name,
  nativeName: getName(code, code) || name
}))
