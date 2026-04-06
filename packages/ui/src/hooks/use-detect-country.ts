import { useState, useEffect } from 'react'
import type { Country } from 'react-phone-number-input'
import { detectCountry } from '@monobase/ui/lib/detect-country'

/**
 * Hook to auto-detect user's country based on browser locale and timezone
 *
 * @param opts - Options object with optional fallback country code
 * @returns Detected or fallback country code
 *
 * @example
 * ```tsx
 * const defaultCountry = useDetectCountry()
 * const customCountry = useDetectCountry({ fallback: 'US' })
 * <PhoneInput defaultCountry={defaultCountry} />
 * ```
 */
export function useDetectCountry(opts?: {
  fallback?: Country
}): Country {
  const fallback = opts?.fallback ?? 'CA'
  const [country, setCountry] = useState<Country>(() => detectCountry({ fallback }) as Country)

  useEffect(() => {
    const detected = detectCountry({ fallback }) as Country
    if (detected !== country) {
      setCountry(detected)
    }
  }, [fallback, country])

  return country
}
