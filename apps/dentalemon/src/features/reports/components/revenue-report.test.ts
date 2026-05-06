import { describe, test, expect } from 'bun:test';

interface Invoice {
  id: string;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  status: string;
  createdAt: string;
}

interface LineItem {
  cdtCode: string;
  description: string;
  amountCents: number;
}

interface Payment {
  method: string;
  amountCents: number;
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const yearOpts: Intl.DateTimeFormatOptions = { ...opts, year: 'numeric' };
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', yearOpts)}`;
}

function calcRevenueSummary(invoices: Invoice[]) {
  const totalBilled = invoices.reduce((sum, i) => sum + i.totalCents, 0);
  const totalCollected = invoices.reduce((sum, i) => sum + i.paidCents, 0);
  const totalOutstanding = invoices.reduce((sum, i) => sum + i.balanceCents, 0);
  const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;
  return { totalBilled, totalCollected, totalOutstanding, collectionRate };
}

function groupRevenueByDay(invoices: Invoice[]) {
  const map = new Map<string, { billed: number; collected: number }>();
  for (const inv of invoices) {
    const date = inv.createdAt.slice(0, 10);
    const existing = map.get(date) ?? { billed: 0, collected: 0 };
    existing.billed += inv.totalCents;
    existing.collected += inv.paidCents;
    map.set(date, existing);
  }
  return Array.from(map.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function getTopTreatments(lineItems: LineItem[], limit = 5) {
  const map = new Map<string, { description: string; count: number; revenue: number }>();
  for (const item of lineItems) {
    const existing = map.get(item.cdtCode) ?? { description: item.description, count: 0, revenue: 0 };
    existing.count += 1;
    existing.revenue += item.amountCents;
    map.set(item.cdtCode, existing);
  }
  return Array.from(map.entries())
    .map(([cdtCode, data]) => ({ cdtCode, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

function groupByPaymentMethod(payments: Payment[]) {
  const map = new Map<string, { total: number; count: number }>();
  for (const p of payments) {
    const existing = map.get(p.method) ?? { total: 0, count: 0 };
    existing.total += p.amountCents;
    existing.count += 1;
    map.set(p.method, existing);
  }
  return Array.from(map.entries()).map(([method, data]) => ({ method, ...data }));
}

function formatCSVRow(values: string[]): string {
  return values.map(v => {
    if (v.includes(',') || v.includes('"') || v.includes('\n')) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  }).join(',');
}

describe('Revenue Report — formatDateRange', () => {
  test('formats same month range', () => {
    const result = formatDateRange('2026-01-01', '2026-01-31');
    expect(result).toContain('Jan');
    expect(result).toContain('31');
  });

  test('formats cross-month range', () => {
    const result = formatDateRange('2026-01-15', '2026-02-15');
    expect(result).toContain('Jan');
    expect(result).toContain('Feb');
  });
});

describe('Revenue Report — calcRevenueSummary', () => {
  test('empty array returns zeros', () => {
    const result = calcRevenueSummary([]);
    expect(result.totalBilled).toBe(0);
    expect(result.totalCollected).toBe(0);
    expect(result.totalOutstanding).toBe(0);
    expect(result.collectionRate).toBe(0);
  });

  test('sums correctly and calculates collection rate', () => {
    const invoices: Invoice[] = [
      { id: '1', totalCents: 10000, paidCents: 10000, balanceCents: 0, status: 'paid', createdAt: '2026-01-01' },
      { id: '2', totalCents: 5000, paidCents: 2000, balanceCents: 3000, status: 'partial', createdAt: '2026-01-02' },
    ];
    const result = calcRevenueSummary(invoices);
    expect(result.totalBilled).toBe(15000);
    expect(result.totalCollected).toBe(12000);
    expect(result.totalOutstanding).toBe(3000);
    expect(result.collectionRate).toBe(80);
  });
});

describe('Revenue Report — groupRevenueByDay', () => {
  test('groups invoices by date', () => {
    const invoices: Invoice[] = [
      { id: '1', totalCents: 5000, paidCents: 5000, balanceCents: 0, status: 'paid', createdAt: '2026-01-01T10:00:00Z' },
      { id: '2', totalCents: 3000, paidCents: 1000, balanceCents: 2000, status: 'partial', createdAt: '2026-01-01T14:00:00Z' },
      { id: '3', totalCents: 7000, paidCents: 7000, balanceCents: 0, status: 'paid', createdAt: '2026-01-02T09:00:00Z' },
    ];
    const result = groupRevenueByDay(invoices);
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2026-01-01');
    expect(result[0].billed).toBe(8000);
  });

  test('sorts chronologically', () => {
    const invoices: Invoice[] = [
      { id: '1', totalCents: 1000, paidCents: 0, balanceCents: 1000, status: 'issued', createdAt: '2026-01-03T10:00:00Z' },
      { id: '2', totalCents: 2000, paidCents: 0, balanceCents: 2000, status: 'issued', createdAt: '2026-01-01T10:00:00Z' },
    ];
    const result = groupRevenueByDay(invoices);
    expect(result[0].date).toBe('2026-01-01');
  });
});

describe('Revenue Report — getTopTreatments', () => {
  test('returns sorted by revenue desc', () => {
    const items: LineItem[] = [
      { cdtCode: 'D0120', description: 'Exam', amountCents: 3000 },
      { cdtCode: 'D2710', description: 'Crown', amountCents: 30000 },
      { cdtCode: 'D1110', description: 'Prophy', amountCents: 5000 },
    ];
    const result = getTopTreatments(items);
    expect(result[0].cdtCode).toBe('D2710');
  });

  test('aggregates same cdtCode', () => {
    const items: LineItem[] = [
      { cdtCode: 'D2391', description: 'Composite', amountCents: 5000 },
      { cdtCode: 'D2391', description: 'Composite', amountCents: 5000 },
    ];
    const result = getTopTreatments(items);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(2);
    expect(result[0].revenue).toBe(10000);
  });

  test('limits to top N', () => {
    const items: LineItem[] = Array.from({ length: 10 }, (_, i) => ({
      cdtCode: `D${i}`, description: `Tx ${i}`, amountCents: (i + 1) * 1000,
    }));
    expect(getTopTreatments(items, 3)).toHaveLength(3);
  });
});

describe('Revenue Report — groupByPaymentMethod', () => {
  test('groups by method with count', () => {
    const payments: Payment[] = [
      { method: 'cash', amountCents: 5000 },
      { method: 'card', amountCents: 3000 },
      { method: 'cash', amountCents: 2000 },
    ];
    const result = groupByPaymentMethod(payments);
    const cash = result.find(r => r.method === 'cash');
    expect(cash?.total).toBe(7000);
    expect(cash?.count).toBe(2);
  });
});

describe('Revenue Report — formatCSVRow', () => {
  test('simple values', () => expect(formatCSVRow(['a', 'b', 'c'])).toBe('a,b,c'));
  test('commas in values', () => expect(formatCSVRow(['hello, world', 'test'])).toBe('"hello, world",test'));
  test('empty values', () => expect(formatCSVRow(['', 'test', ''])).toBe(',test,'));
});

// ---------------------------------------------------------------------------
// Invoice detail helpers (RPT-01, RPT-02)
// ---------------------------------------------------------------------------

const INVOICE_STATUSES = ['draft', 'issued', 'partial', 'paid', 'overdue', 'voided'] as const;
type InvoiceStatus = typeof INVOICE_STATUSES[number];

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  issued: 'Issued',
  partial: 'Partial',
  paid: 'Paid',
  overdue: 'Overdue',
  voided: 'Voided',
};

function formatInvoiceStatus(status: InvoiceStatus): string {
  return STATUS_LABELS[status];
}

function sumPayments(payments: Payment[]): number {
  return payments.reduce((sum, p) => sum + p.amountCents, 0);
}

function sortPaymentsByDate(payments: Array<Payment & { createdAt: string }>): Array<Payment & { createdAt: string }> {
  return [...payments].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function calcInvoiceBalance(totalCents: number, payments: Payment[]): number {
  const paid = sumPayments(payments);
  return Math.max(0, totalCents - paid);
}

describe('Revenue Report — formatInvoiceStatus (RPT-02)', () => {
  test.each(INVOICE_STATUSES)('formats %s', (status) => {
    expect(formatInvoiceStatus(status)).toBeTruthy();
    expect(typeof formatInvoiceStatus(status)).toBe('string');
  });

  test('paid returns Paid', () => expect(formatInvoiceStatus('paid')).toBe('Paid'));
  test('partial returns Partial', () => expect(formatInvoiceStatus('partial')).toBe('Partial'));
  test('overdue returns Overdue', () => expect(formatInvoiceStatus('overdue')).toBe('Overdue'));
});

describe('Revenue Report — sumPayments (RPT-02)', () => {
  test('empty returns 0', () => {
    expect(sumPayments([])).toBe(0);
  });

  test('sums multiple payments', () => {
    const payments: Payment[] = [
      { method: 'cash', amountCents: 3000 },
      { method: 'card', amountCents: 2000 },
    ];
    expect(sumPayments(payments)).toBe(5000);
  });
});

describe('Revenue Report — sortPaymentsByDate (RPT-02)', () => {
  test('sorts ascending', () => {
    const payments = [
      { method: 'cash', amountCents: 1000, createdAt: '2026-01-03T10:00:00Z' },
      { method: 'card', amountCents: 2000, createdAt: '2026-01-01T10:00:00Z' },
    ];
    const sorted = sortPaymentsByDate(payments);
    expect(sorted[0].createdAt).toBe('2026-01-01T10:00:00Z');
    expect(sorted[1].createdAt).toBe('2026-01-03T10:00:00Z');
  });

  test('does not mutate original', () => {
    const payments = [
      { method: 'cash', amountCents: 1000, createdAt: '2026-01-02T10:00:00Z' },
      { method: 'card', amountCents: 2000, createdAt: '2026-01-01T10:00:00Z' },
    ];
    const copy = [...payments];
    sortPaymentsByDate(payments);
    expect(payments[0].createdAt).toBe(copy[0].createdAt);
  });
});

describe('Revenue Report — calcInvoiceBalance (RPT-02)', () => {
  test('zero payments returns full total', () => {
    expect(calcInvoiceBalance(10000, [])).toBe(10000);
  });

  test('fully paid returns 0', () => {
    const payments: Payment[] = [{ method: 'cash', amountCents: 10000 }];
    expect(calcInvoiceBalance(10000, payments)).toBe(0);
  });

  test('partial payment returns remainder', () => {
    const payments: Payment[] = [{ method: 'cash', amountCents: 4000 }];
    expect(calcInvoiceBalance(10000, payments)).toBe(6000);
  });

  test('overpayment clamps to 0', () => {
    const payments: Payment[] = [{ method: 'cash', amountCents: 12000 }];
    expect(calcInvoiceBalance(10000, payments)).toBe(0);
  });
});
