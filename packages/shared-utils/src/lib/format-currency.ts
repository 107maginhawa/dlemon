/**
 * Currency formatting utilities
 * @module lib/format-currency
 */

/**
 * Currency formatting options
 */
export interface FormatCurrencyOptions {
  /** Locale for formatting (defaults to en-US) */
  locale?: string
  /**
   * Whether to show currency symbol
   * - false: no symbol (default)
   * - true: show USD symbol ($)
   * - string: custom symbol to use
   */
  symbol?: boolean | string
  /** Minimum fraction digits (defaults to 2) */
  minimumFractionDigits?: number
  /** Maximum fraction digits (defaults to 2) */
  maximumFractionDigits?: number
}

/**
 * Default currency formatting options
 */
const DEFAULT_OPTIONS: Required<Omit<FormatCurrencyOptions, 'symbol'>> & { symbol: boolean | string } = {
  locale: 'en-US',
  symbol: false,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}

export function formatCurrency(
  amount: number,
  options: FormatCurrencyOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // Convert from cents to dollars
  const value = amount / 100

  if (opts.symbol === false) {
    return new Intl.NumberFormat(opts.locale, {
      minimumFractionDigits: opts.minimumFractionDigits,
      maximumFractionDigits: opts.maximumFractionDigits,
    }).format(value)
  } else if (opts.symbol === true) {
    return new Intl.NumberFormat(opts.locale, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: opts.minimumFractionDigits,
      maximumFractionDigits: opts.maximumFractionDigits,
    }).format(value)
  } else if (typeof opts.symbol === 'string') {
    const formatted = new Intl.NumberFormat(opts.locale, {
      minimumFractionDigits: opts.minimumFractionDigits,
      maximumFractionDigits: opts.maximumFractionDigits,
    }).format(value)
    return `${opts.symbol}${formatted}`
  }

  return new Intl.NumberFormat(opts.locale, {
    minimumFractionDigits: opts.minimumFractionDigits,
    maximumFractionDigits: opts.maximumFractionDigits,
  }).format(value)
}
