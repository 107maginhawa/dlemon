/**
 * computeBillingKpis (Phase 3.1) — pure KPI math.
 */
import { describe, test, expect } from 'bun:test';
import { computeBillingKpis, type KpiInvoice } from './kpis';

const DAY = 24 * 60 * 60 * 1000;
const asOf = new Date('2026-06-19T00:00:00Z');

function inv(p: Partial<KpiInvoice>): KpiInvoice {
  return {
    totalCents: 0, paidCents: 0, balanceCents: 0, status: 'issued',
    dueDate: null, issuedAt: new Date(asOf.getTime() - 30 * DAY), createdAt: new Date(asOf.getTime() - 30 * DAY),
    ...p,
  };
}

describe('computeBillingKpis', () => {
  test('aggregates AR, billed, collected, and collection rate (uncollectible excluded from AR)', () => {
    const k = computeBillingKpis([
      inv({ totalCents: 10000, paidCents: 4000, balanceCents: 6000, status: 'partial' }),
      inv({ totalCents: 5000, paidCents: 5000, balanceCents: 0, status: 'paid' }),
      inv({ totalCents: 3000, paidCents: 0, balanceCents: 3000, status: 'uncollectible' }),
    ], asOf);

    expect(k.billedTotalCents).toBe(18000);      // 10000 + 5000 + 3000
    expect(k.collectedTotalCents).toBe(9000);    // 4000 + 5000 + 0
    expect(k.outstandingArCents).toBe(6000);     // active AR only (uncollectible excluded)
    expect(k.writeOffCents).toBe(3000);          // the uncollectible balance
    expect(k.collectionRate).toBeCloseTo(0.5, 4); // 9000 / 18000
  });

  test('buckets active AR into the aging series by age past due', () => {
    const k = computeBillingKpis([
      inv({ balanceCents: 1000, status: 'overdue', dueDate: new Date(asOf.getTime() - 10 * DAY) }),  // current (<=30)
      inv({ balanceCents: 2000, status: 'overdue', dueDate: new Date(asOf.getTime() - 45 * DAY) }),  // days30
      inv({ balanceCents: 4000, status: 'overdue', dueDate: new Date(asOf.getTime() - 120 * DAY) }), // days90Plus
    ], asOf);

    const byBucket = Object.fromEntries(k.agingSeries.map((p) => [p.bucket, p.amountCents]));
    expect(byBucket['current']).toBe(1000);
    expect(byBucket['days30']).toBe(2000);
    expect(byBucket['days60']).toBe(0);
    expect(byBucket['days90Plus']).toBe(4000);
  });

  test('DSO ≈ AR / average daily billing over the active span', () => {
    // One invoice issued 100 days ago, billed 10000, 6000 still outstanding.
    const k = computeBillingKpis([
      inv({ totalCents: 10000, paidCents: 4000, balanceCents: 6000, status: 'partial',
        issuedAt: new Date(asOf.getTime() - 100 * DAY), createdAt: new Date(asOf.getTime() - 100 * DAY) }),
    ], asOf);
    // avgDaily = 10000/100 = 100/day; DSO = 6000/100 = 60.
    expect(k.dsoDays).toBe(60);
  });

  test('empty / all-zero input yields zeros, not NaN', () => {
    const k = computeBillingKpis([], asOf);
    expect(k.collectionRate).toBe(0);
    expect(k.dsoDays).toBe(0);
    expect(k.outstandingArCents).toBe(0);
    expect(k.agingSeries).toHaveLength(4);
  });
});
