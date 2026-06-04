/**
 * Pure helpers for the AR aging / collections view (P2-14).
 *
 * Kept side-effect-free so they can be unit-tested without a DOM or network.
 * Money is integer cents; display uses ₱ / en-PH.
 */

import type { ArAgingPatientRow, ArAgingSummary, PatientStatement } from '@monobase/sdk-ts/generated';

// Cause-fix (oli QA_ESCAPES §6): these were hand-rolled duplicates of the
// generated SDK rows (field-for-field identical, live-confirmed 2026-06-04).
// Alias to the SDK types so there is a single source of truth and they cannot
// silently drift from the backend contract.
export type AgingRow = ArAgingPatientRow;
export type AgingSummary = ArAgingSummary;

export const AGING_BUCKETS = [
  { key: 'currentCents', label: 'Current', sublabel: '0–30 days' },
  { key: 'days30Cents', label: '31–60', sublabel: '31–60 days' },
  { key: 'days60Cents', label: '61–90', sublabel: '61–90 days' },
  { key: 'days90PlusCents', label: '90+', sublabel: '90+ days' },
] as const;

/** Format integer cents as a Philippine Peso string (matches invoice-detail). */
export function formatCents(cents: number): string {
  return `₱${(cents / 100).toFixed(2)}`;
}

/**
 * Risk tier for a patient's oldest outstanding invoice. Drives the row accent
 * so the collections worklist visually escalates aging debt.
 *   - 'ok'     : <= 30 days
 *   - 'watch'  : 31–60
 *   - 'warn'   : 61–90
 *   - 'severe' : 90+
 */
export function agingRisk(oldestInvoiceDays: number): 'ok' | 'watch' | 'warn' | 'severe' {
  if (oldestInvoiceDays <= 30) return 'ok';
  if (oldestInvoiceDays <= 60) return 'watch';
  if (oldestInvoiceDays <= 90) return 'warn';
  return 'severe';
}

export function agingRiskClass(risk: ReturnType<typeof agingRisk>): string {
  switch (risk) {
    case 'severe':
      return 'text-red-700';
    case 'warn':
      return 'text-orange-700';
    case 'watch':
      return 'text-amber-700';
    default:
      return 'text-muted-foreground';
  }
}

/** Percentage (0–100, rounded) a bucket contributes to total outstanding. */
export function bucketPct(bucketCents: number, totalCents: number): number {
  if (totalCents <= 0) return 0;
  return Math.round((bucketCents / totalCents) * 100);
}

// The batch endpoint returns PatientStatement rows (a superset of the columns
// the worklist displays). Alias rather than re-declare a divergent subset.
export type StatementRow = PatientStatement;

/** One-line summary of a completed batch run for a toast / banner. */
export function summarizeBatch(count: number, totalBalanceCents: number): string {
  const label = count === 1 ? 'statement' : 'statements';
  return `Generated ${count} ${label} · ${formatCents(totalBalanceCents)} outstanding`;
}
