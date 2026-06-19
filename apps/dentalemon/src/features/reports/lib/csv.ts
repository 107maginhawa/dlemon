/**
 * CSV serialization helpers for report exports.
 */

/**
 * Format a centavos integer as a plain decimal-peso string for a CSV cell.
 *
 * ISSUE-021: report CSVs exported raw centavos (₱279,420.00 → "27942000"), so an
 * accountant opening the file read every money column 100× too large. CSV money
 * cells must be decimal pesos with NO currency symbol and NO thousands commas
 * (a comma would split the cell across columns), so spreadsheets parse them as
 * numbers. Display formatting (₱ + grouping) stays in the report's formatCents.
 */
export function csvAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}
