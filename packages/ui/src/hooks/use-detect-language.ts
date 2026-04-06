import { useState, useEffect } from 'react'
import { type Language } from '@monobase/ui/constants/languages'
import { detectLanguage } from '@monobase/ui/lib/detect-language'

/**
 * Hook to auto-detect user's language from browser
 *
 * @param opts - Options object with optional fallback language code
 * @returns Detected or fallback language code
 *
 * @example
 * ```tsx
 * const language = useDetectLanguage()
 * const customLanguage = useDetectLanguage({ fallback: 'fr' })
 * ```
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
