/**
 * Date formatting utilities
 * @module lib/format-date
 */

import { format as dateFnsFormat, formatDistance, formatRelative } from 'date-fns'

/**
 * Predefined date format types
 */
export type DateFormat =
  | 'short' // 10/5/23
  | 'medium' // Oct 5, 2023
  | 'long' // October 5, 2023
  | 'full' // Thursday, October 5, 2023
  | 'time' // 3:30 PM
  | 'datetime' // Oct 5, 2023, 3:30 PM
  | 'date' // 2023-10-05 (ISO 8601 date-only for API)
  | 'iso' // 2023-10-05T15:30:00.000Z
  | string // Custom format string for date-fns

/**
 * Date formatting options
 */
export interface FormatDateOptions {
  /** Predefined format type or custom date-fns format string */
  format?: DateFormat
  /** Locale for formatting (defaults to en-US) */
  locale?: string
}

/**
 * Options for formatting relative dates
 */
export interface FormatRelativeDateOptions {
  /** Format style: 'long' (default) or 'short' */
  style?: 'long' | 'short'
  /** Locale for formatting (defaults to en-US) */
  locale?: string
  /** Add "ago" suffix (defaults to true) */
  addSuffix?: boolean
}

/**
 * Default date formatting options
 */
const DEFAULT_OPTIONS: FormatDateOptions = {
  format: 'long',
  locale: 'en-US',
}

/**
 * Predefined format names without string type
 */
type PredefinedFormat = 'short' | 'medium' | 'long' | 'full' | 'time' | 'datetime' | 'date' | 'iso'

/**
 * Map predefined formats to date-fns format strings
 */
const FORMAT_MAP: Record<PredefinedFormat, string> = {
  short: 'M/d/yy',
  medium: 'MMM d, yyyy',
  long: 'MMMM d, yyyy',
  full: 'EEEE, MMMM d, yyyy',
  time: 'h:mm a',
  datetime: 'MMM d, yyyy, h:mm a',
  date: 'yyyy-MM-dd',
  iso: "yyyy-MM-dd'T'HH:mm:ss.SSSxxx",
}

export function formatDate(
  date: Date | number | string | null | undefined,
  options: FormatDateOptions = {}
): string {
  if (date == null) return ''
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const dateObj = typeof date === 'object' ? date : new Date(date)

  if (isNaN(dateObj.getTime())) {
    return 'Invalid date'
  }

  if (opts.format === 'iso') {
    return dateObj.toISOString()
  }

  const formatString = FORMAT_MAP[opts.format as PredefinedFormat] || opts.format || FORMAT_MAP.long

  try {
    return dateFnsFormat(dateObj, formatString)
  } catch (error) {
    return dateFnsFormat(dateObj, FORMAT_MAP.long)
  }
}

export function formatRelativeDate(
  date: Date | number | string | null | undefined,
  options: FormatRelativeDateOptions = {}
): string {
  if (date == null) return ''
  const {
    style = 'long',
    locale = 'en-US',
    addSuffix = true
  } = options

  const dateObj = typeof date === 'object' ? date : new Date(date)
  const now = new Date()

  if (isNaN(dateObj.getTime())) {
    return 'Invalid date'
  }

  if (style === 'short') {
    const diffInSeconds = Math.round((dateObj.getTime() - now.getTime()) / 1000)
    const absDiff = Math.abs(diffInSeconds)
    const isPast = diffInSeconds < 0

    let value: number
    let unit: string

    if (absDiff < 60) {
      value = absDiff
      unit = 's'
    } else if (absDiff < 3600) {
      value = Math.floor(absDiff / 60)
      unit = 'm'
    } else if (absDiff < 86400) {
      value = Math.floor(absDiff / 3600)
      unit = 'h'
    } else if (absDiff < 604800) {
      value = Math.floor(absDiff / 86400)
      unit = 'd'
    } else if (absDiff < 2592000) {
      value = Math.floor(absDiff / 604800)
      unit = 'w'
    } else if (absDiff < 31536000) {
      value = Math.floor(absDiff / 2592000)
      unit = 'mo'
    } else {
      value = Math.floor(absDiff / 31536000)
      unit = 'y'
    }

    const formatted = `${value}${unit}`
    if (addSuffix) {
      return isPast ? `${formatted} ago` : `in ${formatted}`
    }
    return formatted
  } else {
    return formatDistance(dateObj, now, { addSuffix })
  }
}
