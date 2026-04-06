import { useState, useEffect } from 'react'
import { type Timezone } from '@monobase/ui/constants/timezones'
import { detectTimezone } from '@monobase/ui/lib/detect-timezone'

/**
 * Hook to auto-detect user's timezone from browser
 *
 * @param opts - Options object with optional fallback timezone code
 * @returns Detected or fallback timezone code
 *
 * @example
 * ```tsx
 * const timezone = useDetectTimezone()
 * const customTimezone = useDetectTimezone({ fallback: 'UTC' })
 * ```
 */
export function useDetectTimezone(opts?: {
  fallback?: Timezone['code']
}): Timezone['code'] {
  const [timezone, setTimezone] = useState<Timezone['code']>(() => detectTimezone(opts))

  useEffect(() => {
    const detected = detectTimezone(opts)
    if (detected !== timezone) {
      setTimezone(detected)
    }
  }, [opts?.fallback, timezone])

  return timezone
}
