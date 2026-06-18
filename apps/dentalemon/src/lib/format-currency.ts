/**
 * Shared currency formatter for the Philippines market.
 *
 * All monetary display in the app must go through these helpers.
 * Never use 'en-US' / 'USD' for currency formatting — the app is ₱ / en-PH.
 *
 * Usage:
 *   import { formatCurrency, formatCents } from '@/lib/format-currency';
 *
 *   formatCurrency(150)     // "₱150.00"  (amount already in pesos)
 *   formatCents(15000)      // "₱150.00"  (amount in centavos ÷ 100)
 */

import { CURRENCY_SYMBOL, APP_LOCALE } from '@/constants/brand';

/**
 * Format a peso amount (already in pesos/PHP, not centavos).
 *
 * @param amount - Amount in pesos (e.g. 150.00)
 * @returns Formatted string e.g. "₱150.00"
 */
export function formatCurrency(amount: number): string {
  // Use toLocaleString for reliable en-PH formatting, then ensure our symbol.
  const formatted = amount.toLocaleString(APP_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${CURRENCY_SYMBOL}${formatted}`;
}

/**
 * Format an amount stored in centavos (integer) to a display peso string.
 *
 * @param cents - Amount in centavos (e.g. 15000 = ₱150.00)
 * @returns Formatted string e.g. "₱150.00"
 */
export function formatCents(cents: number): string {
  return formatCurrency(cents / 100);
}
