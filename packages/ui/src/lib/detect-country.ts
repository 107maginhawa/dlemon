import { getTimeZones } from '@vvo/tzdb'
import { type Country } from '@monobase/ui/constants/countries'
import { detectTimezone } from './detect-timezone'

/**
 * Detect user's country from browser
 */
export function detectCountry(opts?: {
  fallback?: Country['code']
}): Country['code'] {
  const fallback = opts?.fallback ?? 'CA'
  try {
    // Try to get from locale
    const locale = navigator.language || navigator.languages?.[0]
    if (locale) {
      const parts = locale.split('-')
      if (parts.length > 1) {
        // Take the last part that matches a country code pattern (2 uppercase letters)
        // This handles both simple (en-US) and complex (zh-Hans-CN) locale strings
        const countryCode = parts[parts.length - 1]!.toUpperCase()
        if (countryCode.length === 2 && /^[A-Z]{2}$/.test(countryCode)) {
          return countryCode
        }
      }
    }

    // Try to get from timezone using tzdb
    const timezone = detectTimezone()
    const tzData = getTimeZones().find(tz => tz.name === timezone)
    return tzData?.countryCode || fallback
  } catch (error) {
    console.warn('Failed to detect country:', error)
    return fallback
  }
}
