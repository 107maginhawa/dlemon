/**
 * React hook for date formatting
 * @module hooks/use-format-date
 */

import { useMemo, useCallback } from 'react'
import {
  formatDate as formatDateUtil,
  formatRelativeDate as formatRelativeDateUtil,
  type FormatDateOptions,
  type FormatRelativeDateOptions,
  type DateFormat
} from '@monobase/ui/lib/format-date'

/**
 * Hook options extending format date options
 */
export interface UseFormatDateOptions extends FormatDateOptions {
  /** Whether to memoize the formatter (defaults to true) */
  memoize?: boolean
}

/**
 * Return type for the date formatting hook
 */
export interface UseFormatDateReturn {
  /** Format a date for display */
  formatDate: (date: Date | number | string) => string
  /** Format a date as relative time */
  formatRelativeDate: (date: Date | number | string, options?: FormatRelativeDateOptions) => string
  /** Current format type */
  format: DateFormat
}

/**
 * Hook for formatting date values
 *
 * @param options - Formatting options
 * @returns Object with date formatting utilities
 *
 * @example
 * ```tsx
 * function DateDisplay({ date }: { date: Date }) {
 *   const { formatDate } = useFormatDate()
 *   return <span>{formatDate(date)}</span>
 * }
 * ```
 *
 * @example
 * ```tsx
 * function RelativeTime({ timestamp }: { timestamp: number }) {
 *   const { formatRelativeDate } = useFormatDate()
 *   return <time>{formatRelativeDate(timestamp)}</time>
 * }
 * ```
 *
 * @example
 * ```tsx
 * function ShortRelativeTime({ date }: { date: Date }) {
 *   const { formatRelativeDate } = useFormatDate()
 *   return <time>{formatRelativeDate(date, { style: 'short' })}</time>
 * }
 * ```
 */
export function useFormatDate(
  options: UseFormatDateOptions = {}
): UseFormatDateReturn {
  const { memoize = true, ...formatOptions } = options
  const format = formatOptions.format || 'long'

  const formatDate = useCallback(
    (date: Date | number | string) => {
      return formatDateUtil(date, formatOptions)
    },
    memoize
      ? [
          formatOptions.format,
          formatOptions.locale,
        ]
      : []
  )

  const formatRelativeDate = useCallback(
    (date: Date | number | string, relativeOptions?: FormatRelativeDateOptions) => {
      return formatRelativeDateUtil(date, {
        locale: formatOptions.locale,
        ...relativeOptions
      })
    },
    memoize ? [formatOptions.locale] : []
  )

  return useMemo(
    () => ({
      formatDate,
      formatRelativeDate,
      format,
    }),
    [formatDate, formatRelativeDate, format]
  )
}