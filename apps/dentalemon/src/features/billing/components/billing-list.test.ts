/**
 * BillingList component tests -- pure logic helpers
 *
 * Tests: formatInvoiceStatus, getStatusBadgeClass, formatCents,
 *        getBalanceClass, summarizeInvoices
 */

import { describe, test, expect } from 'bun:test';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InvoiceSummaryInput {
  status: string;
  totalCents: number;
  balanceCents: number;
  paidCents: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Pure logic helpers
// ---------------------------------------------------------------------------

function formatInvoiceStatus(status: string): string {
  const map: Record<string, string> = {
    draft: 'Draft',
    issued: 'Issued',
    partial: 'Partial',
    paid: 'Paid',
    overdue: 'Overdue',
    voided: 'Voided',
  };
  return map[status] ?? status;
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'draft':
      return 'bg-gray-100 text-gray-500';
    case 'issued':
      return 'bg-blue-100 text-blue-700';
    case 'partial':
      return 'bg-orange-100 text-orange-700';
    case 'paid':
      return 'bg-green-100 text-green-700';
    case 'overdue':
      return 'bg-red-100 text-red-700';
    case 'voided':
      return 'bg-gray-100 text-gray-400 line-through';
    default:
      return 'bg-gray-100 text-gray-500';
  }
}

function formatCents(cents: number): string {
  const pesos = cents / 100;
  return `\u20B1${pesos.toFixed(2)}`;
}

function getBalanceClass(balanceCents: number): string {
  return balanceCents > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold';
}

function summarizeInvoices(invoices: InvoiceSummaryInput[]): {
  totalOutstanding: number;
  collectedThisMonth: number;
  overdueAmount: number;
} {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let totalOutstanding = 0;
  let collectedThisMonth = 0;
  let overdueAmount = 0;

  for (const inv of invoices) {
    if (inv.status !== 'voided' && inv.status !== 'paid') {
      totalOutstanding += inv.balanceCents;
    }
    if (inv.status === 'overdue') {
      overdueAmount += inv.balanceCents;
    }
    const created = new Date(inv.createdAt);
    if (created.getMonth() === currentMonth && created.getFullYear() === currentYear) {
      collectedThisMonth += inv.paidCents;
    }
  }

  return { totalOutstanding, collectedThisMonth, overdueAmount };
}

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
  test('getStatusBadgeClass("paid") includes "green"', () => {
    expect(getStatusBadgeClass('paid')).toContain('green');
  });

  test('getStatusBadgeClass("overdue") includes "red"', () => {
    expect(getStatusBadgeClass('overdue')).toContain('red');
  });

  test('getStatusBadgeClass("voided") includes "gray"', () => {
    expect(getStatusBadgeClass('voided')).toContain('gray');
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
  test('getBalanceClass(1000) includes "text-red"', () => {
    expect(getBalanceClass(1000)).toContain('text-red');
  });

  test('getBalanceClass(0) includes "text-green"', () => {
    expect(getBalanceClass(0)).toContain('text-green');
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

    const invoices: InvoiceSummaryInput[] = [
      { status: 'issued', totalCents: 10000, balanceCents: 10000, paidCents: 0, createdAt: thisMonth },
      { status: 'partial', totalCents: 20000, balanceCents: 5000, paidCents: 15000, createdAt: thisMonth },
      { status: 'overdue', totalCents: 8000, balanceCents: 8000, paidCents: 0, createdAt: thisMonth },
      { status: 'paid', totalCents: 12000, balanceCents: 0, paidCents: 12000, createdAt: thisMonth },
      { status: 'voided', totalCents: 2000, balanceCents: 2000, paidCents: 0, createdAt: thisMonth },
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
