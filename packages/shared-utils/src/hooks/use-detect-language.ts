import { useState, useEffect } from 'react'
import { type Language } from '../constants/languages'
import { detectLanguage } from '../lib/detect-language'

/**
 * Hook to auto-detect user's language from browser
 *
 * @param opts - Options object with optional fallback language code
 * @returns Detected or fallback language code
 */
export function useDetectLanguage(opts?: {
  fallback?: Language['code']
}): Language['code'] {
  const [language, setLanguage] = useState<Language['code']>(() => detectLanguage(opts))

  useEffect(() => {
    const detected = detectLanguage(opts)
    if (detected !== language) {
      setLanguage(detected)
    }
  }, [opts?.fallback, language])

  return language
}
