import { type Timezone } from '@monobase/ui/constants/timezones'

/**
 * Detect user's timezone from browser
 */
export function detectTimezone(opts?: {
  fallback?: Timezone['code']
}): Timezone['code'] {
  const fallback = opts?.fallback ?? 'America/New_York'
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    return timeZone || fallback
  } catch (error) {
    console.warn('Failed to detect timezone:', error)
    return fallback
  }
}
