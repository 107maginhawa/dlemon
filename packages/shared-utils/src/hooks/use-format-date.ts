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
} from '../lib/format-date'

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
  formatDate: (date: Date | number | string | null | undefined) => string
  /** Format a date as relative time */
  formatRelativeDate: (date: Date | number | string | null | undefined, options?: FormatRelativeDateOptions) => string
  /** Current format type */
  format: DateFormat
}

export function useFormatDate(
  options: UseFormatDateOptions = {}
): UseFormatDateReturn {
  const { memoize = true, ...formatOptions } = options
  const format = formatOptions.format || 'long'

  const formatDate = useCallback(
    (date: Date | number | string | null | undefined) => {
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
    (date: Date | number | string | null | undefined, relativeOptions?: FormatRelativeDateOptions) => {
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
