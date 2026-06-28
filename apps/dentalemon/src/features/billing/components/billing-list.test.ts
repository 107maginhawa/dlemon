/**
 * BillingList component tests -- pure logic helpers
 *
 * Tests: formatInvoiceStatus, getStatusBadgeClass, formatCents,
 *        getBalanceClass, summarizeInvoices
 *
 * Imports directly from the real component to prevent test-impl drift.
 */

import { describe, test, expect } from 'bun:test';
import {
  formatInvoiceStatus,
  getStatusBadgeClass,
  formatCents,
  getBalanceClass,
  summarizeInvoices,
} from './billing-list';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BillingList -- formatInvoiceStatus', () => {
  test('formatInvoiceStatus("draft") === "Draft"', () => {
    expect(formatInvoiceStatus('draft')).toBe('Draft');
  });

  test('formatInvoiceStatus("issued") === "Issued"', () => {
    expect(formatInvoiceStatus('issued')).toBe('Issued');
  });

  test('formatInvoiceStatus("partial") === "Partial"', () => {
    expect(formatInvoiceStatus('partial')).toBe('Partial');
  });

  test('formatInvoiceStatus("paid") === "Paid"', () => {
    expect(formatInvoiceStatus('paid')).toBe('Paid');
  });

  test('formatInvoiceStatus("overdue") === "Overdue"', () => {
    expect(formatInvoiceStatus('overdue')).toBe('Overdue');
  });

  test('formatInvoiceStatus("voided") === "Voided"', () => {
    expect(formatInvoiceStatus('voided')).toBe('Voided');
  });
});

describe('BillingList -- getStatusBadgeClass', () => {
  test('getStatusBadgeClass("paid") includes "success"', () => {
    expect(getStatusBadgeClass('paid')).toContain('success');
  });

  test('getStatusBadgeClass("overdue") includes "destructive"', () => {
    expect(getStatusBadgeClass('overdue')).toContain('destructive');
  });

  test('getStatusBadgeClass("voided") includes "muted"', () => {
    expect(getStatusBadgeClass('voided')).toContain('muted');
  });
});

describe('BillingList -- formatCents', () => {
  test('formatCents(15000) === "₱150.00"', () => {
    expect(formatCents(15000)).toBe('\u20B1150.00');
  });

  test('formatCents(0) === "₱0.00"', () => {
    expect(formatCents(0)).toBe('\u20B10.00');
  });
});

describe('BillingList -- getBalanceClass', () => {
  test('getBalanceClass(1000) is neutral ink (red is reserved for the Overdue badge)', () => {
    expect(getBalanceClass(1000)).toContain('text-foreground');
    expect(getBalanceClass(1000)).not.toContain('text-destructive');
  });

  test('getBalanceClass(0) includes "text-success"', () => {
    expect(getBalanceClass(0)).toContain('text-success');
  });
});

describe('BillingList -- summarizeInvoices', () => {
  test('summarizeInvoices([]) returns zeros', () => {
    const result = summarizeInvoices([]);
    expect(result.totalOutstanding).toBe(0);
    expect(result.collectedThisMonth).toBe(0);
    expect(result.overdueAmount).toBe(0);
  });

  test('summarizeInvoices sums outstanding correctly', () => {
    const now = new Date();
    const thisMonth = now.toISOString();

    const invoices = [
      { status: 'issued' as const, totalCents: 10000, balanceCents: 10000, paidCents: 0, createdAt: thisMonth },
      { status: 'partial' as const, totalCents: 20000, balanceCents: 5000, paidCents: 15000, createdAt: thisMonth },
      { status: 'overdue' as const, totalCents: 8000, balanceCents: 8000, paidCents: 0, createdAt: thisMonth },
      { status: 'paid' as const, totalCents: 12000, balanceCents: 0, paidCents: 12000, createdAt: thisMonth },
      { status: 'voided' as const, totalCents: 2000, balanceCents: 2000, paidCents: 0, createdAt: thisMonth },
    ];

    const result = summarizeInvoices(invoices);
    // outstanding = issued(10000) + partial(5000) + overdue(8000) = 23000
    expect(result.totalOutstanding).toBe(23000);
    // overdue = 8000
    expect(result.overdueAmount).toBe(8000);
    // collected this month = 0 + 15000 + 0 + 12000 + 0 = 27000
    expect(result.collectedThisMonth).toBe(27000);
  });
});
