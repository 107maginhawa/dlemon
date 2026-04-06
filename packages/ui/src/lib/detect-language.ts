import { LANGUAGES, type Language } from '@monobase/ui/constants/languages'

/**
 * Detect user's language from browser
 */
export function detectLanguage(opts?: {
  fallback?: Language['code']
}): Language['code'] {
  const fallback = opts?.fallback ?? 'en'
  try {
    const browserLang = navigator.languages?.[0] || navigator.language
    if (!browserLang) return fallback

    // Extract language code (e.g., 'en' from 'en-US')
    const langCode = browserLang.split('-')[0]!.toLowerCase()

    // Validate against available languages
    const isValid = LANGUAGES.some(lang => lang.code === langCode)
    return isValid ? langCode : fallback
  } catch (error) {
    console.warn('Failed to detect language:', error)
    return fallback
  }
}
