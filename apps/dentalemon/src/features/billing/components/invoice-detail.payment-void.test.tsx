/**
 * InvoiceDetail — per-payment void affordance (FIX-004)
 *
 * A mis-keyed payment must be correctable from the product. Backend
 * `voidDentalPayment` is owner-only (assertBranchRole(['dentist_owner'])),
 * reason-bearing, and is a SOFT-DELETE: the voided payment stays in the list as a
 * reversal row (isVoid=true) — it is never removed. The void response carries only
 * the payment row, so the component must invalidate + refetch the invoice to render
 * the restored balance (coherence oracle).
 *
 * Distinct from the whole-invoice Void footer action (voidDentalInvoice). RED-first.
 */

import { describe, test, expect, afterEach, beforeEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InvoiceDetail } from './invoice-detail';
import { useOrgContextStore } from '@/stores/org-context.store';

const MEMBER_ID = '11111111-1111-4111-8111-111111111111';

const PAYMENT = {
  id: 'pay-1',
  amountCents: 100000,
  method: 'cash',
  receiptNumber: 'R-A-0001',
  createdAt: '2024-01-12T00:00:00.000Z',
  isVoid: false,
};

function invoiceBefore(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1',
    invoiceNumber: 'INV-0001',
    status: 'partial',
    patientId: 'p-1',
    patientName: 'Juan dela Cruz',
    visitDate: '2024-01-10',
    dueDate: '2024-02-10',
    lineItems: [
      { id: 'li-1', description: 'Composite Filling', cdtCode: 'D2391', toothNumber: 16, priceCents: 250000 },
    ],
    payments: [{ ...PAYMENT }],
    subtotalCents: 250000,
    discountCents: 0,
    taxCents: 0,
    totalCents: 250000,
    paidCents: 100000,
    balanceCents: 150000,
    ...overrides,
  };
}

// After voiding the only payment: balance restored to the full total, the payment
// stays in the list flagged isVoid=true (reversal row preserved).
const invoiceAfterVoid = invoiceBefore({
  status: 'issued',
  paidCents: 0,
  balanceCents: 250000,
  payments: [{ ...PAYMENT, isVoid: true, voidedAt: '2024-01-13T00:00:00.000Z', voidReason: 'Posted in error' }],
});

function installFetch() {
  let voided = false;
  const calls: Array<{ url: string; method: string; body: any }> = [];
  const original = global.fetch;
  global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
    const url = req instanceof Request ? req.url : String(req);
    const method = (req instanceof Request ? req.method : init?.method ?? 'GET').toUpperCase();
    const raw = req instanceof Request ? await req.clone().text() : (init?.body as string | undefined);
    calls.push({ url, method, body: raw ? JSON.parse(raw) : undefined });
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    // Per-payment void (distinct from whole-invoice /void): returns the voided
    // payment row only; the restored balance comes from the GET refetch.
    if (url.includes('/payments/') && url.endsWith('/void')) {
      voided = true;
      return json({ ...PAYMENT, isVoid: true, voidedAt: '2024-01-13T00:00:00.000Z', voidReason: 'Posted in error' });
    }
    return json(voided ? invoiceAfterVoid : invoiceBefore());
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

function renderDetail(props: Partial<React.ComponentProps<typeof InvoiceDetail>> = {}) {
  const onUpdated = props.onUpdated ?? mock(() => {});
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    React.createElement(
      QueryClientProvider,
      { client: qc },
      React.createElement(InvoiceDetail, {
        invoiceId: 'inv-1',
        open: true,
        onClose: () => {},
        onUpdated,
        ...props,
      }),
    ),
  );
  return { onUpdated };
}

describe('InvoiceDetail — void a payment (owner-only)', () => {
  test('owner sees a Void action on a non-voided payment row', async () => {
    const f = installFetch();
    try {
      renderDetail();
      expect(await screen.findByTestId('void-payment-pay-1')).not.toBeNull();
    } finally {
      f.restore();
    }
  });

  test('a non-owner (associate) does NOT see the per-payment Void action', async () => {
    useOrgContextStore.setState({ role: 'dentist_associate' });
    const f = installFetch();
    try {
      renderDetail();
      // Receipt action is role-independent — its presence proves the row rendered.
      await screen.findByRole('button', { name: /receipt/i });
      expect(screen.queryByTestId('void-payment-pay-1')).toBeNull();
    } finally {
      f.restore();
    }
  });

  test('voiding a payment collects a reason, POSTs {voidReason} to the payment void route, and restores the balance', async () => {
    const user = userEvent.setup();
    const f = installFetch();
    try {
      const { onUpdated } = renderDetail();
      await user.click(await screen.findByTestId('void-payment-pay-1'));

      const reasonField = await screen.findByLabelText(/void reason/i);
      await user.type(reasonField, 'Posted in error');
      await user.click(screen.getByTestId('confirm-payment-void'));

      await waitFor(() =>
        expect(
          f.calls.some(
            (c) => c.method === 'POST' && c.url.endsWith('/invoices/inv-1/payments/pay-1/void'),
          ),
        ).toBe(true),
      );
      const post = f.calls.find((c) => c.method === 'POST' && c.url.includes('/payments/pay-1/void'))!;
      expect(post.body.voidReason).toContain('Posted in error');

      // Coherence: after the refetch the Balance Remaining is restored to the full
      // total (₱2,500.00) — the void response alone did not carry it. Scope the
      // assertion to the balance row (₱2500.00 also appears as subtotal + total).
      const balanceText = () =>
        screen.getByText('Balance Remaining').parentElement!.lastElementChild!.textContent;
      await waitFor(() => expect(balanceText()).toBe('₱2500.00'));
      // The voided payment stays in the list (soft-delete), flagged as voided.
      await waitFor(() => expect(screen.getByText(/voided/i)).not.toBeNull());
      expect((onUpdated as any).mock.calls.length).toBeGreaterThanOrEqual(1);
    } finally {
      f.restore();
    }
  });

  test('does not submit the void when the reason is empty', async () => {
    const user = userEvent.setup();
    const f = installFetch();
    try {
      renderDetail();
      await user.click(await screen.findByTestId('void-payment-pay-1'));
      await user.click(screen.getByTestId('confirm-payment-void'));

      await new Promise((r) => setTimeout(r, 80));
      expect(
        f.calls.some((c) => c.method === 'POST' && c.url.includes('/payments/pay-1/void')),
      ).toBe(false);
    } finally {
      f.restore();
    }
  });

  test('an already-voided payment shows no Void action and renders as voided', async () => {
    // Seed the GET to start in the post-void state (payment already voided).
    const original = global.fetch;
    global.fetch = mock(async () =>
      new Response(JSON.stringify(invoiceAfterVoid), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    ) as unknown as typeof fetch;
    try {
      renderDetail();
      const row = await screen.findByText('R-A-0001');
      // Voided indicator present...
      expect(screen.getByText(/voided/i)).not.toBeNull();
      // ...and no void action for an already-voided payment.
      expect(screen.queryByTestId('void-payment-pay-1')).toBeNull();
      expect(row).not.toBeNull();
    } finally {
      global.fetch = original;
    }
  });
});
