/**
 * revenue-report.render.test.tsx — G-13
 *
 * Proves the report's headline "Collected" derives from the server collections
 * summary (payment-date based, the same source the dashboard MoneyPanel uses) and
 * NOT from summing invoice.paidCents over invoices created in the window — the two
 * disagree when an invoice is created one month and paid the next.
 */

import { describe, test, expect, afterEach, beforeEach, mock } from 'bun:test';
import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { RevenueReport } from './revenue-report';
import { useOrgContextStore } from '@/stores/org-context.store';
import { makeWrapper } from '@/test-utils';

const originalFetch = global.fetch;

// Invoices created in-window with a LIFETIME paidCents that must NOT be used as the
// headline "Collected" (the old, drifting basis).
const INVOICE = {
  id: 'inv-1', invoiceNumber: 'INV-001', patientId: 'p1', patientName: 'A',
  totalCents: 100000, paidCents: 99999, balanceCents: 1,
  status: 'issued', createdAt: '2026-06-15T00:00:00Z',
};

// The SERVER's payment-date collected total for the window (the SoT).
const SERVER_COLLECTED = 4242;

let qc: QueryClient;
beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  useOrgContextStore.setState({ branchId: 'branch-1' });
  global.fetch = mock(async (req: Request | string | URL) => {
    const url = req instanceof Request ? req.url : String(req);
    const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (url.includes('/collections/summary')) {
      return json({
        period: { from: '2026-06-01', to: '2026-06-30' },
        totalCollectedCents: SERVER_COLLECTED,
        totalBilledCents: 0, totalOutstandingCents: 0, invoiceCount: 1, overdueCount: 0, paymentCount: 1,
        collectionsByMethod: { cash: SERVER_COLLECTED },
        dailyCollections: [{ date: '2026-06-15', collectedCents: SERVER_COLLECTED }],
      });
    }
    if (url.includes('/dental/billing/invoices') || url.includes('/invoices')) {
      return json({ data: [INVOICE] });
    }
    return json({ data: [] });
  }) as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
  global.fetch = originalFetch;
  qc.clear();
  useOrgContextStore.setState({ branchId: null });
});

describe('RevenueReport — Collected sourcing (G-13)', () => {
  test('headline "Collected" shows the SERVER total, not the invoice paidCents sum', async () => {
    render(React.createElement(RevenueReport, { branchId: 'branch-1' }), { wrapper: makeWrapper(qc) });

    // The headline "Collected" KPI = the server total (₱42.42), NOT the invoice
    // lifetime-paid sum (₱999.99, which still legitimately shows in the per-invoice
    // Paid column — it's the invoice's own paid amount, not the report's metric).
    await waitFor(() => expect(screen.getByTestId('revenue-collected').textContent).toContain('42.42'));
    expect(screen.getByTestId('revenue-collected').textContent).not.toContain('999.99');
  });
});
