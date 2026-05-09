/**
 * Financial rounding utilities for dental billing
 *
 * Uses banker's rounding (round half to even) to avoid systematic bias
 * in aggregated financial calculations. All monetary values stored as integer cents.
 */

/**
 * Banker's rounding (round half to even)
 * When value is exactly 0.5, rounds to the nearest even number.
 */
export function bankersRound(value: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  const shifted = value * factor;
  const floor = Math.floor(shifted);
  const diff = shifted - floor;
  // If exactly 0.5, round to even; otherwise normal rounding
  if (Math.abs(diff - 0.5) < Number.EPSILON) {
    return (floor % 2 === 0 ? floor : floor + 1) / factor;
  }
  return Math.round(shifted) / factor;
}

/**
 * Format cents as Philippine Peso display string
 */
export function centsToDisplay(cents: number): string {
  return `\u20B1${(cents / 100).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

/**
 * Apply a percentage discount to a subtotal in cents.
 * @param subtotalCents - amount before discount, in cents
 * @param percentageRate - discount percentage 0-100 (e.g., 20 for 20%)
 * @returns discount amount in cents
 */
export function applyDiscountRate(subtotalCents: number, percentageRate: number): number {
  return Math.round(bankersRound(subtotalCents * percentageRate / 100, 0));
}

/**
 * Apply a tax rate to an after-discount amount in cents.
 * @param afterDiscountCents - amount after discount, in cents
 * @param taxRate - tax rate as decimal 0.0-1.0 (e.g., 0.12 for 12%)
 * @returns tax amount in cents
 */
export function applyTaxRate(afterDiscountCents: number, taxRate: number): number {
  return Math.round(bankersRound(afterDiscountCents * taxRate, 0));
}
