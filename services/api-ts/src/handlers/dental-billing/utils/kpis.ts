/**
 * Billing KPI computation (Phase 3.1) — pure, point-in-time analytics over a
 * branch's non-voided invoices. No persistence; derived from current invoice
 * financials. DSO is the standard approximation (AR / average daily billing).
 */

import { invoiceAgeDays, bucketForAge, type AgingInvoice } from './aging';

export interface KpiInvoice {
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  status: string;
  dueDate: Date | null;
  issuedAt: Date | null;
  createdAt: Date;
}

export interface BillingKpis {
  outstandingArCents: number;
  writeOffCents: number;
  billedTotalCents: number;
  collectedTotalCents: number;
  collectionRate: number;
  dsoDays: number;
  agingSeries: Array<{ bucket: string; amountCents: number }>;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const AGING_BUCKETS = ['current', 'days30', 'days60', 'days90Plus'] as const;

/** Compute the billing dashboard KPIs from non-voided invoices as of `asOf`. */
export function computeBillingKpis(invoices: KpiInvoice[], asOf: Date): BillingKpis {
  let outstandingArCents = 0;
  let writeOffCents = 0;
  let billedTotalCents = 0;
  let collectedTotalCents = 0;
  let earliestIssued = asOf.getTime();
  const aging: Record<string, number> = { current: 0, days30: 0, days60: 0, days90Plus: 0 };

  for (const inv of invoices) {
    if (inv.status === 'voided') continue; // defensive; facade already excludes
    billedTotalCents += inv.totalCents;
    collectedTotalCents += inv.paidCents;

    if (inv.status === 'uncollectible') {
      // Written off — removed from active AR.
      writeOffCents += inv.balanceCents;
      continue;
    }

    // Active receivable.
    outstandingArCents += inv.balanceCents;
    if (inv.balanceCents > 0) {
      const age = invoiceAgeDays(inv as AgingInvoice, asOf);
      const bucket = bucketForAge(age);
      aging[bucket] = (aging[bucket] ?? 0) + inv.balanceCents;
    }
    const issued = (inv.issuedAt ?? inv.createdAt).getTime();
    if (issued < earliestIssued) earliestIssued = issued;
  }

  const collectionRate = billedTotalCents > 0
    ? Number((collectedTotalCents / billedTotalCents).toFixed(4))
    : 0;

  // DSO ≈ AR / average daily billing over the active span.
  const spanDays = Math.max(1, Math.floor((asOf.getTime() - earliestIssued) / MS_PER_DAY));
  const avgDailyBilling = billedTotalCents / spanDays;
  const dsoDays = avgDailyBilling > 0 ? Math.round(outstandingArCents / avgDailyBilling) : 0;

  return {
    outstandingArCents,
    writeOffCents,
    billedTotalCents,
    collectedTotalCents,
    collectionRate,
    dsoDays,
    agingSeries: AGING_BUCKETS.map((bucket) => ({ bucket, amountCents: aging[bucket]! })),
  };
}
