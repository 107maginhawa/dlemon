/**
 * InvoiceDetail — per-payment refund affordance (BR-053, Phase 4.2b).
 *
 * Refund is owner-only (same gate as void), reason-required, with an optional
 * "book as patient credit" toggle. Distinct from void: it POSTs to the
 * payment-rooted /payments/:id/refund route with {amountCents, reason,
 * bookAsCredit}.
 */
import { describe, test, expect, afterEach, beforeEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InvoiceDetail } from './invoice-detail';
import { useOrgContextStore } from '@/stores/org-context.store';

const MEMBER_ID = '11111111-1111-4111-8111-111111111111';

const PAYMENT = { id: 'pay-1', amountCents: 100000, method: 'cash', receiptNumber: 'R-A-0001', createdAt: '2024-01-12T00:00:00.000Z', isVoid: false };

function invoiceBefore() {
  return {
    id: 'inv-1', invoiceNumber: 'INV-0001', status: 'partial', patientId: 'p-1', patientName: 'Juan dela Cruz',
    visitDate: '2024-01-10', dueDate: '2024-02-10',
    lineItems: [{ id: 'li-1', description: 'Composite Filling', cdtCode: 'D2391', toothNumber: 16, priceCents: 250000 }],
    payments: [{ ...PAYMENT }],
    subtotalCents: 250000, discountCents: 0, taxCents: 0, totalCents: 250000, paidCents: 100000, balanceCents: 150000,
  };
}

function installFetch() {
  const calls: Array<{ url: string; method: string; body?: Record<string, unknown> }> = [];
  const original = global.fetch;
  global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
    const url = req instanceof Request ? req.url : String(req);
    const method = (req instanceof Request ? req.method : init?.method ?? 'GET').toUpperCase();
    const raw = req instanceof Request ? await req.clone().text() : (init?.body as string | undefined);
    calls.push({ url, method, body: raw ? JSON.parse(raw) : undefined });
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    if (url.includes('/payments/') && url.endsWith('/refund')) {
      return json({ refundId: 'rf-1', paymentId: 'pay-1', invoiceId: 'inv-1', amountCents: 50000, invoiceBalanceCents: 200000, invoiceStatus: 'partial', bookedAsCredit: false, creditBalanceCents: 0 });
    }
    return json(invoiceBefore());
  }) as unknown as typeof fetch;
  return { calls, restore: () => { global.fetch = original; } };
}

beforeEach(() => { useOrgContextStore.setState({ memberId: MEMBER_ID, branchId: 'b-1', orgId: 'o-1', role: 'dentist_owner' }); });
afterEach(() => { cleanup(); useOrgContextStore.setState({ memberId: null, branchId: null, orgId: null, role: null }); });

function renderDetail() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(React.createElement(QueryClientProvider, { client: qc },
    React.createElement(InvoiceDetail, { invoiceId: 'inv-1', open: true, onClose: () => {} })));
}

describe('InvoiceDetail — refund a payment (owner-only)', () => {
  test('owner sees a Refund action on a non-voided payment', async () => {
    const f = installFetch();
    try {
      renderDetail();
      expect(await screen.findByTestId('refund-payment-pay-1')).not.toBeNull();
    } finally { f.restore(); }
  });

  test('a non-owner (associate) does NOT see the Refund action', async () => {
    useOrgContextStore.setState({ role: 'dentist_associate' });
    const f = installFetch();
    try {
      renderDetail();
      await screen.findByRole('button', { name: /receipt/i });
      expect(screen.queryByTestId('refund-payment-pay-1')).toBeNull();
    } finally { f.restore(); }
  });

  test('refund collects amount + reason + credit toggle and POSTs to the refund route', async () => {
    const user = userEvent.setup();
    const f = installFetch();
    try {
      renderDetail();
      await user.click(await screen.findByTestId('refund-payment-pay-1'));

      const amount = await screen.findByTestId('refund-amount');
      await user.clear(amount);
      await user.type(amount, '500');
      await user.type(screen.getByTestId('refund-reason'), 'Treatment cancelled');
      await user.click(screen.getByTestId('refund-as-credit'));
      await user.click(screen.getByTestId('confirm-payment-refund'));

      await waitFor(() => expect(f.calls.some((c) => c.method === 'POST' && c.url.endsWith('/payments/pay-1/refund'))).toBe(true));
      const post = f.calls.find((c) => c.method === 'POST' && c.url.includes('/payments/pay-1/refund'))!;
      const body = post.body as { amountCents: number; reason: string; bookAsCredit: boolean };
      expect(body.amountCents).toBe(50000);
      expect(body.reason).toContain('Treatment cancelled');
      expect(body.bookAsCredit).toBe(true);
    } finally { f.restore(); }
  });

  test('does not submit the refund when the reason is empty', async () => {
    const user = userEvent.setup();
    const f = installFetch();
    try {
      renderDetail();
      await user.click(await screen.findByTestId('refund-payment-pay-1'));
      // amount is prefilled; clear the reason path by leaving it empty.
      await user.click(screen.getByTestId('confirm-payment-refund'));
      await new Promise((r) => setTimeout(r, 80));
      expect(f.calls.some((c) => c.method === 'POST' && c.url.includes('/payments/pay-1/refund'))).toBe(false);
    } finally { f.restore(); }
  });
});
