/**
 * React hook for currency formatting
 * @module hooks/use-format-currency
 */

import { useMemo, useCallback } from 'react'
import {
  formatCurrency as formatCurrencyUtil,
  type FormatCurrencyOptions
} from '@monobase/ui/lib/format-currency'

/**
 * Hook options extending format currency options
 */
export interface UseFormatCurrencyOptions extends FormatCurrencyOptions {
  /** Whether to memoize the formatter (defaults to true) */
  memoize?: boolean
}

/**
 * Return type for the currency formatting hook
 */
export interface UseFormatCurrencyReturn {
  /** Format a monetary amount for display */
  formatCurrency: (amount: number) => string
}

/**
 * Hook for formatting currency values
 *
 * @param options - Formatting options
 * @returns Object with formatCurrency function
 *
 * @example
 * ```tsx
 * function PriceDisplay({ cents }: { cents: number }) {
 *   const { formatCurrency } = useFormatCurrency({ symbol: true })
 *   return <span>{formatCurrency(cents)}</span>
 * }
 * ```
 *
 * @example
 * ```tsx
 * function CustomPrice() {
 *   const { formatCurrency } = useFormatCurrency({ symbol: '€' })
 *   const [value, setValue] = useState(1500)
 *
 *   return <div>{formatCurrency(value)}</div>
 * }
 * ```
 */
export function useFormatCurrency(
  options: UseFormatCurrencyOptions = {}
): UseFormatCurrencyReturn {
  const { memoize = true, ...formatOptions } = options

  const formatCurrency = useCallback(
    (amount: number) => {
      return formatCurrencyUtil(amount, formatOptions)
    },
    memoize
      ? [
          formatOptions.locale,
          formatOptions.symbol,
          formatOptions.minimumFractionDigits,
          formatOptions.maximumFractionDigits,
        ]
      : []
  )

  return useMemo(
    () => ({
      formatCurrency,
    }),
    [formatCurrency]
  )
}