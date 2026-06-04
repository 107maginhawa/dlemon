/**
 * Unit tests for AR aging + statement compute helpers (pure, no DB).
 *
 * P2-14: bucket each outstanding invoice's balance into
 * current / 30 / 60 / 90+ by the age in days of its due date (falling back
 * to issue/created date) relative to an `asOf` instant.
 */

import { describe, test, expect } from 'bun:test';
import {
  invoiceAgeDays,
  bucketForAge,
  computePatientAging,
  computeAgingSummary,
  computePatientStatement,
  type AgingInvoice,
} from './aging';

const ASOF = new Date('2026-06-02T12:00:00Z');

function daysAgo(n: number): Date {
  return new Date(ASOF.getTime() - n * 24 * 60 * 60 * 1000);
}

describe('invoiceAgeDays', () => {
  test('uses dueDate when present', () => {
    expect(invoiceAgeDays({ dueDate: daysAgo(45), issuedAt: daysAgo(60), createdAt: daysAgo(60) }, ASOF)).toBe(45);
  });

  test('falls back to issuedAt when no dueDate', () => {
    expect(invoiceAgeDays({ dueDate: null, issuedAt: daysAgo(20), createdAt: daysAgo(90) }, ASOF)).toBe(20);
  });

  test('falls back to createdAt when neither dueDate nor issuedAt', () => {
    expect(invoiceAgeDays({ dueDate: null, issuedAt: null, createdAt: daysAgo(5) }, ASOF)).toBe(5);
  });

  test('clamps negative age (future due date) to 0', () => {
    expect(invoiceAgeDays({ dueDate: daysAgo(-10), issuedAt: null, createdAt: ASOF }, ASOF)).toBe(0);
  });
});

describe('bucketForAge', () => {
  test('0-30 days inclusive is current', () => {
    expect(bucketForAge(0)).toBe('current');
    expect(bucketForAge(30)).toBe('current');
  });
  test('31-60 is days30', () => {
    expect(bucketForAge(31)).toBe('days30');
    expect(bucketForAge(60)).toBe('days30');
  });
  test('61-90 is days60', () => {
    expect(bucketForAge(61)).toBe('days60');
    expect(bucketForAge(90)).toBe('days60');
  });
  test('91+ is days90Plus', () => {
    expect(bucketForAge(91)).toBe('days90Plus');
    expect(bucketForAge(400)).toBe('days90Plus');
  });
});

describe('computePatientAging', () => {
  test('buckets balances by invoice age and reports oldest', () => {
    const invoices: AgingInvoice[] = [
      { balanceCents: 1000, status: 'issued', dueDate: daysAgo(5), issuedAt: daysAgo(5), createdAt: daysAgo(5) },
      { balanceCents: 2000, status: 'overdue', dueDate: daysAgo(45), issuedAt: daysAgo(50), createdAt: daysAgo(50) },
      { balanceCents: 3000, status: 'overdue', dueDate: daysAgo(75), issuedAt: daysAgo(80), createdAt: daysAgo(80) },
      { balanceCents: 4000, status: 'overdue', dueDate: daysAgo(120), issuedAt: daysAgo(125), createdAt: daysAgo(125) },
    ];
    const row = computePatientAging('p1', 'Ana Cruz', invoices, ASOF);
    expect(row.currentCents).toBe(1000);
    expect(row.days30Cents).toBe(2000);
    expect(row.days60Cents).toBe(3000);
    expect(row.days90PlusCents).toBe(4000);
    expect(row.totalOutstandingCents).toBe(10000);
    expect(row.oldestInvoiceDays).toBe(120);
  });

  test('excludes voided invoices and zero balances', () => {
    const invoices: AgingInvoice[] = [
      { balanceCents: 5000, status: 'voided', dueDate: daysAgo(100), issuedAt: daysAgo(100), createdAt: daysAgo(100) },
      { balanceCents: 0, status: 'paid', dueDate: daysAgo(10), issuedAt: daysAgo(10), createdAt: daysAgo(10) },
      { balanceCents: 1500, status: 'partial', dueDate: daysAgo(10), issuedAt: daysAgo(10), createdAt: daysAgo(10) },
    ];
    const row = computePatientAging('p1', 'Ana Cruz', invoices, ASOF);
    expect(row.totalOutstandingCents).toBe(1500);
    expect(row.currentCents).toBe(1500);
    expect(row.days90PlusCents).toBe(0);
  });

  test('zero outstanding produces an all-zero row', () => {
    const row = computePatientAging('p1', 'Ana Cruz', [], ASOF);
    expect(row.totalOutstandingCents).toBe(0);
    expect(row.oldestInvoiceDays).toBe(0);
  });
});

describe('computeAgingSummary', () => {
  test('sums buckets across patient rows', () => {
    const rows = [
      computePatientAging('p1', 'A', [{ balanceCents: 1000, status: 'issued', dueDate: daysAgo(5), issuedAt: daysAgo(5), createdAt: daysAgo(5) }], ASOF),
      computePatientAging('p2', 'B', [{ balanceCents: 4000, status: 'overdue', dueDate: daysAgo(120), issuedAt: daysAgo(120), createdAt: daysAgo(120) }], ASOF),
    ];
    const summary = computeAgingSummary(rows);
    expect(summary.currentCents).toBe(1000);
    expect(summary.days90PlusCents).toBe(4000);
    expect(summary.totalOutstandingCents).toBe(5000);
    expect(summary.patientCount).toBe(2);
  });
});

describe('computePatientStatement', () => {
  test('summarizes charges, payments, discount, balance', () => {
    const invoices: AgingInvoice[] = [
      { balanceCents: 2000, status: 'partial', totalCents: 5000, paidCents: 3000, discountCents: 500, dueDate: daysAgo(40), issuedAt: daysAgo(45), createdAt: daysAgo(45) },
      { balanceCents: 1000, status: 'issued', totalCents: 1000, paidCents: 0, discountCents: 0, dueDate: daysAgo(5), issuedAt: daysAgo(5), createdAt: daysAgo(5) },
    ];
    const stmt = computePatientStatement('p1', 'Ana Cruz', 'STMT-2026-0001', invoices, ASOF);
    expect(stmt.totalChargedCents).toBe(6000);
    expect(stmt.totalPaidCents).toBe(3000);
    expect(stmt.totalDiscountCents).toBe(500);
    expect(stmt.balanceCents).toBe(3000);
    expect(stmt.invoiceCount).toBe(2);
    expect(stmt.oldestUnpaidInvoiceDays).toBe(40);
  });

  test('voided invoices excluded from statement totals', () => {
    const invoices: AgingInvoice[] = [
      { balanceCents: 9999, status: 'voided', totalCents: 9999, paidCents: 0, discountCents: 0, dueDate: daysAgo(200), issuedAt: daysAgo(200), createdAt: daysAgo(200) },
    ];
    const stmt = computePatientStatement('p1', 'Ana Cruz', 'STMT-2026-0001', invoices, ASOF);
    expect(stmt.totalChargedCents).toBe(0);
    expect(stmt.balanceCents).toBe(0);
    expect(stmt.oldestUnpaidInvoiceDays).toBe(0);
  });
});
