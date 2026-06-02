/**
 * AR aging + statement compute helpers (pure functions, no DB access).
 *
 * P2-14: accounts-receivable aging buckets and patient billing statements.
 *
 * Aging buckets the *outstanding balance* of each non-voided invoice by the
 * age (in whole days) of its due date — falling back to issue date, then
 * created date — relative to an `asOf` instant:
 *   - current    : 0–30 days
 *   - days30      : 31–60 days
 *   - days60      : 61–90 days
 *   - days90Plus  : 91+ days
 *
 * All money is integer cents (₱ / en-PH at the display layer).
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type AgingBucket = 'current' | 'days30' | 'days60' | 'days90Plus';

/** Minimal invoice shape needed for aging/statement math. */
export interface AgingInvoice {
  balanceCents: number;
  status: string;
  dueDate?: Date | null;
  issuedAt?: Date | null;
  createdAt: Date;
  // Statement-only fields (optional for aging).
  totalCents?: number;
  paidCents?: number;
  discountCents?: number;
}

export interface ArAgingPatientRow {
  patientId: string;
  patientName: string;
  currentCents: number;
  days30Cents: number;
  days60Cents: number;
  days90PlusCents: number;
  totalOutstandingCents: number;
  oldestInvoiceDays: number;
}

export interface ArAgingSummary {
  currentCents: number;
  days30Cents: number;
  days60Cents: number;
  days90PlusCents: number;
  totalOutstandingCents: number;
  patientCount: number;
}

export interface PatientStatement {
  patientId: string;
  patientName: string;
  statementNumber: string;
  asOf: string;
  totalChargedCents: number;
  totalPaidCents: number;
  totalDiscountCents: number;
  balanceCents: number;
  invoiceCount: number;
  oldestUnpaidInvoiceDays: number;
}

/**
 * Age in whole days of an invoice relative to `asOf`. Uses dueDate when
 * present, else issuedAt, else createdAt. Negative ages (future-dated due
 * dates) clamp to 0 so they land in the `current` bucket.
 */
export function invoiceAgeDays(
  inv: Pick<AgingInvoice, 'dueDate' | 'issuedAt' | 'createdAt'>,
  asOf: Date,
): number {
  const ref = inv.dueDate ?? inv.issuedAt ?? inv.createdAt;
  const diffMs = asOf.getTime() - new Date(ref).getTime();
  const days = Math.floor(diffMs / MS_PER_DAY);
  return days < 0 ? 0 : days;
}

/** Map an age in days to its aging bucket. */
export function bucketForAge(ageDays: number): AgingBucket {
  if (ageDays <= 30) return 'current';
  if (ageDays <= 60) return 'days30';
  if (ageDays <= 90) return 'days60';
  return 'days90Plus';
}

function isOutstanding(inv: AgingInvoice): boolean {
  return inv.status !== 'voided' && inv.balanceCents > 0;
}

/**
 * Aggregate one patient's outstanding invoices into aging buckets.
 */
export function computePatientAging(
  patientId: string,
  patientName: string,
  invoices: AgingInvoice[],
  asOf: Date,
): ArAgingPatientRow {
  const row: ArAgingPatientRow = {
    patientId,
    patientName,
    currentCents: 0,
    days30Cents: 0,
    days60Cents: 0,
    days90PlusCents: 0,
    totalOutstandingCents: 0,
    oldestInvoiceDays: 0,
  };

  for (const inv of invoices) {
    if (!isOutstanding(inv)) continue;
    const age = invoiceAgeDays(inv, asOf);
    const bucket = bucketForAge(age);
    if (bucket === 'current') row.currentCents += inv.balanceCents;
    else if (bucket === 'days30') row.days30Cents += inv.balanceCents;
    else if (bucket === 'days60') row.days60Cents += inv.balanceCents;
    else row.days90PlusCents += inv.balanceCents;
    row.totalOutstandingCents += inv.balanceCents;
    if (age > row.oldestInvoiceDays) row.oldestInvoiceDays = age;
  }

  return row;
}

/** Practice-wide aging totals across all patient rows. */
export function computeAgingSummary(rows: ArAgingPatientRow[]): ArAgingSummary {
  const summary: ArAgingSummary = {
    currentCents: 0,
    days30Cents: 0,
    days60Cents: 0,
    days90PlusCents: 0,
    totalOutstandingCents: 0,
    patientCount: rows.length,
  };
  for (const r of rows) {
    summary.currentCents += r.currentCents;
    summary.days30Cents += r.days30Cents;
    summary.days60Cents += r.days60Cents;
    summary.days90PlusCents += r.days90PlusCents;
    summary.totalOutstandingCents += r.totalOutstandingCents;
  }
  return summary;
}

/**
 * Build a single patient billing statement summarizing charges, payments,
 * discounts, and the resulting balance for all non-voided invoices.
 */
export function computePatientStatement(
  patientId: string,
  patientName: string,
  statementNumber: string,
  invoices: AgingInvoice[],
  asOf: Date,
): PatientStatement {
  let totalChargedCents = 0;
  let totalPaidCents = 0;
  let totalDiscountCents = 0;
  let balanceCents = 0;
  let invoiceCount = 0;
  let oldestUnpaidInvoiceDays = 0;

  for (const inv of invoices) {
    if (inv.status === 'voided') continue;
    invoiceCount += 1;
    totalChargedCents += inv.totalCents ?? 0;
    totalPaidCents += inv.paidCents ?? 0;
    totalDiscountCents += inv.discountCents ?? 0;
    balanceCents += inv.balanceCents;
    if (inv.balanceCents > 0) {
      const age = invoiceAgeDays(inv, asOf);
      if (age > oldestUnpaidInvoiceDays) oldestUnpaidInvoiceDays = age;
    }
  }

  return {
    patientId,
    patientName,
    statementNumber,
    asOf: asOf.toISOString(),
    totalChargedCents,
    totalPaidCents,
    totalDiscountCents,
    balanceCents,
    invoiceCount,
    oldestUnpaidInvoiceDays,
  };
}
