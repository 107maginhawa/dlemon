/**
 * InvoiceDetail — OR receipt-series pre-fill + auto-advance (recorder model)
 *
 * The Receipt # field pre-fills from the branch's saved `receiptNumberNext`, and a
 * successful record advances that series (incrementReceiptNumber) via a settings PUT.
 * Drives the SHIPPED component against mocked GET settings + POST payment + PUT settings.
 */
import { describe, test, expect, afterEach, beforeEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InvoiceDetail } from './invoice-detail';
import { useOrgContextStore } from '@/stores/org-context.store';

const MEMBER_ID = '11111111-1111-4111-8111-111111111111';

function issuedInvoice() {
  return {
    id: 'inv-1', invoiceNumber: 'INV-0001', status: 'issued',
    patientId: 'p-1', patientName: 'Juan dela Cruz', visitDate: '2024-01-10', dueDate: '2024-02-10',
    lineItems: [{ id: 'li-1', description: 'Composite Filling', cdtCode: 'D2391', toothNumber: 16, priceCents: 250000 }],
    payments: [], subtotalCents: 250000, discountCents: 0, taxCents: 0, totalCents: 250000, paidCents: 0, balanceCents: 250000,
  };
}

function installFetch() {
  const calls: Array<{ url: string; method: string; body: any }> = [];
  const original = global.fetch;
  global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
    const url = req instanceof Request ? req.url : String(req);
    const method = (req instanceof Request ? req.method : init?.method ?? 'GET').toUpperCase();
    const raw = req instanceof Request ? await req.clone().text() : (init?.body as string | undefined);
    calls.push({ url, method, body: raw ? JSON.parse(raw) : undefined });
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    // Branch settings: envelope shape { branchId, settings: {...} } (toSettings reads .settings)
    if (url.includes('/branches/') && url.includes('/settings')) {
      return json({ branchId: 'b-1', settings: { receiptNumberNext: 'OR-000042' } });
    }
    if (url.includes('/payments') && method === 'POST') return json({ id: 'pmt-1', receiptNumber: 'OR-000042' });
    return json(issuedInvoice());
  }) as unknown as typeof fetch;
  return { calls, restore: () => { global.fetch = original; } };
}

beforeEach(() => {
  useOrgContextStore.setState({ memberId: MEMBER_ID, branchId: 'b-1', orgId: 'o-1', role: 'dentist_owner' });
});
afterEach(() => {
  cleanup();
  useOrgContextStore.setState({ memberId: null, branchId: null, orgId: null, role: null });
});

function renderDetail() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    React.createElement(
      QueryClientProvider,
      { client: qc },
      React.createElement(InvoiceDetail, { invoiceId: 'inv-1', open: true, openToPayment: true, onClose: () => {} }),
    ),
  );
}

describe('InvoiceDetail — OR receipt-series', () => {
  test('pre-fills Receipt # from branch settings and advances it on record', async () => {
    const user = userEvent.setup();
    const f = installFetch();
    try {
      renderDetail();

      // Pre-fill: the saved next OR seeds the field (no typing).
      const receipt = (await screen.findByLabelText(/Receipt/i)) as HTMLInputElement;
      await waitFor(() => expect(receipt.value).toBe('OR-000042'));

      // Record the payment.
      fireEvent.change(screen.getByLabelText(/Amount/i), { target: { value: '2500' } });
      await user.click(screen.getByRole('button', { name: /^record$/i }));

      // Payment POST carries the pre-filled OR.
      await waitFor(() =>
        expect(f.calls.some((c) => c.method === 'POST' && c.url.includes('/payments') && c.body?.receiptNumber === 'OR-000042')).toBe(true),
      );

      // Series advances in place: settings PUT writes the next number.
      await waitFor(() => {
        const put = f.calls.find((c) => c.method === 'PUT' && c.url.includes('/settings'));
        expect(put?.body?.receiptNumberNext).toBe('OR-000043');
      });
    } finally {
      f.restore();
    }
  });
});
