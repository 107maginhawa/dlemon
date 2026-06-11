/**
 * InvoiceDetail — receipt wiring (AHA FIX-007, verification follow-up).
 *
 * Pins the per-payment-row "Receipt" action: clicking a specific row must open
 * the receipt for THAT row's paymentId (not the first row, not the receipt
 * number, not the invoice id). This is the click→open→right-paymentId plumbing
 * the fixture-mocked payment-receipt test cannot cover — without it a row→id
 * regression would silently open the wrong receipt.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InvoiceDetail } from './invoice-detail';

const INVOICE = {
  id: 'inv-77',
  invoiceNumber: 'INV-0077',
  status: 'partial',
  patientId: 'p-1',
  patientName: 'Juan dela Cruz',
  visitDate: '2024-01-10',
  dueDate: '2024-02-10',
  lineItems: [{ id: 'li-1', description: 'Composite Filling', cdtCode: 'D2391', toothNumber: 16, priceCents: 250000 }],
  payments: [
    { id: 'pay-AAA', receiptNumber: 'RCT-AAA', method: 'cash', amountCents: 100000, createdAt: '2024-01-11T09:00:00Z' },
    { id: 'pay-BBB', receiptNumber: 'RCT-BBB', method: 'card', amountCents: 50000, createdAt: '2024-01-12T09:00:00Z' },
  ],
  subtotalCents: 250000,
  discountCents: 0,
  taxCents: 0,
  totalCents: 250000,
  balanceCents: 100000,
};

function installFetch() {
  const receiptUrls: string[] = [];
  const original = global.fetch;
  global.fetch = mock(async (req: Request | string | URL) => {
    const url = req instanceof Request ? req.url : String(req);
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    if (url.includes('/receipt')) {
      receiptUrls.push(url);
      return json({
        receiptNumber: 'RCT-BBB', isVoid: false, voidedAt: null, voidReason: null,
        payment: { id: 'pay-BBB', amountCents: 50000, method: 'card', recordedAt: '2024-01-12T09:00:00Z', notes: null },
        invoice: { id: 'inv-77', invoiceNumber: 'INV-0077', totalCents: 250000, paidCents: 150000, balanceCents: 100000, status: 'partial' },
        patient: { id: 'p-1', name: 'Juan dela Cruz' },
        generatedAt: '2024-01-13T09:00:00Z',
      });
    }
    return json(INVOICE);
  }) as unknown as typeof fetch;
  return { receiptUrls, restore: () => { global.fetch = original; } };
}

afterEach(cleanup);

function renderDetail() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    React.createElement(QueryClientProvider, { client: qc },
      React.createElement(InvoiceDetail, { invoiceId: 'inv-77', open: true, onClose: () => {} })),
  );
}

describe('InvoiceDetail — receipt action opens the clicked row', () => {
  test("clicking the second payment row's Receipt fetches THAT row's paymentId", async () => {
    const user = userEvent.setup();
    const f = installFetch();
    try {
      renderDetail();
      // Wait for the payments table to render both rows.
      await screen.findByText('RCT-BBB');
      const receiptButtons = screen.getAllByRole('button', { name: /^receipt$/i });
      expect(receiptButtons.length).toBe(2);

      await user.click(receiptButtons[1]); // second row = pay-BBB

      await waitFor(() => expect(f.receiptUrls.length).toBe(1));
      expect(f.receiptUrls[0]).toContain('/invoices/inv-77/payments/pay-BBB/receipt');
      // Not the first row's id.
      expect(f.receiptUrls[0]).not.toContain('pay-AAA');
    } finally {
      f.restore();
    }
  });
});
