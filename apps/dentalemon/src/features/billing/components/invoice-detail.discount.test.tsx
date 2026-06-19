/**
 * InvoiceDetail — apply-discount affordance (FIX-003)
 *
 * The owner must be able to apply a PWD/Senior/manual discount from the product.
 * Backend `applyDentalDiscount` is owner-only (assertBranchRole(['dentist_owner'])),
 * reason-required, and takes a percentageRate (0–100 PERCENTAGE, not cents). It
 * returns the full updated invoice, so after the mutation the rendered totals must
 * agree with the server response (coherence oracle).
 *
 * These render the SHIPPED InvoiceDetail and drive the discount flow RED-first:
 * the affordance must exist, be owner-gated, reason+rate-validated, and re-render
 * coherent totals.
 */

import { describe, test, expect, afterEach, beforeEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InvoiceDetail } from './invoice-detail';
import { useOrgContextStore } from '@/stores/org-context.store';

const MEMBER_ID = '11111111-1111-4111-8111-111111111111';

function baseInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1',
    invoiceNumber: 'INV-0001',
    status: 'issued',
    patientId: 'p-1',
    patientName: 'Juan dela Cruz',
    visitDate: '2024-01-10',
    dueDate: '2024-02-10',
    lineItems: [
      { id: 'li-1', description: 'Composite Filling', cdtCode: 'D2391', toothNumber: 16, priceCents: 250000 },
    ],
    payments: [],
    subtotalCents: 250000,
    discountCents: 0,
    taxCents: 0,
    totalCents: 250000,
    paidCents: 0,
    balanceCents: 250000,
    ...overrides,
  };
}

// 10% of ₱2,500.00 subtotal = ₱250.00 discount → total/balance ₱2,250.00.
const discountedInvoice = baseInvoice({ discountCents: 25000, totalCents: 225000, balanceCents: 225000 });

function installFetch() {
  let applied = false;
  const calls: Array<{ url: string; method: string; body: any }> = [];
  const original = global.fetch;
  global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
    const url = req instanceof Request ? req.url : String(req);
    const method = (req instanceof Request ? req.method : init?.method ?? 'GET').toUpperCase();
    const raw = req instanceof Request ? await req.clone().text() : (init?.body as string | undefined);
    calls.push({ url, method, body: raw ? JSON.parse(raw) : undefined });
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    // applyDentalDiscount returns the full updated invoice; subsequent GET refetch
    // reflects the discount (the component invalidates + refetches the enriched GET).
    if (url.endsWith('/discount')) { applied = true; return json(discountedInvoice); }
    return json(applied ? discountedInvoice : baseInvoice());
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

describe('InvoiceDetail — apply discount (owner-only)', () => {
  test('owner sees the Apply Discount affordance', async () => {
    const f = installFetch();
    try {
      renderDetail();
      expect(await screen.findByRole('button', { name: /apply discount/i })).not.toBeNull();
    } finally {
      f.restore();
    }
  });

  test('a non-owner (associate) does NOT see Apply Discount', async () => {
    useOrgContextStore.setState({ role: 'dentist_associate' });
    const f = installFetch();
    try {
      renderDetail();
      // Record Payment is role-independent for an issued invoice — use it as the
      // "invoice loaded" signal, then assert the owner-only discount is absent.
      await screen.findByRole('button', { name: /record payment/i });
      expect(screen.queryByRole('button', { name: /apply discount/i })).toBeNull();
    } finally {
      f.restore();
    }
  });

  test('blocks submit with an error when the reason is empty', async () => {
    const user = userEvent.setup();
    const f = installFetch();
    try {
      renderDetail();
      await user.click(await screen.findByRole('button', { name: /apply discount/i }));
      // fireEvent.change sets the controlled number input atomically — userEvent.type
      // char-by-char races the controlled re-render and can transiently misread the rate.
      fireEvent.change(screen.getByLabelText(/discount %/i), { target: { value: '10' } });
      await user.click(screen.getByRole('button', { name: /^apply$/i }));

      expect(screen.getByText(/discount reason is required/i)).not.toBeNull();
      expect(f.calls.some((c) => c.method === 'POST' && c.url.endsWith('/discount'))).toBe(false);
    } finally {
      f.restore();
    }
  });

  test('blocks submit when the rate is out of the 0–100 range', async () => {
    const user = userEvent.setup();
    const f = installFetch();
    try {
      renderDetail();
      await user.click(await screen.findByRole('button', { name: /apply discount/i }));
      fireEvent.change(screen.getByLabelText(/discount %/i), { target: { value: '150' } });
      await user.type(screen.getByLabelText(/discount reason/i), 'Senior citizen discount');
      await user.click(screen.getByRole('button', { name: /^apply$/i }));

      expect(screen.getByText(/at most 100 percent/i)).not.toBeNull();
      expect(f.calls.some((c) => c.method === 'POST' && c.url.endsWith('/discount'))).toBe(false);
    } finally {
      f.restore();
    }
  });

  test('applies a 10% discount: POST /discount with {reason, percentageRate} and totals re-render coherently', async () => {
    const user = userEvent.setup();
    const f = installFetch();
    try {
      const { onUpdated } = renderDetail();
      await user.click(await screen.findByRole('button', { name: /apply discount/i }));
      fireEvent.change(screen.getByLabelText(/discount %/i), { target: { value: '10' } });
      await user.type(screen.getByLabelText(/discount reason/i), 'Senior citizen discount');
      await user.click(screen.getByRole('button', { name: /^apply$/i }));

      await waitFor(() =>
        expect(f.calls.some((c) => c.method === 'POST' && c.url.endsWith('/invoices/inv-1/discount'))).toBe(true),
      );
      const post = f.calls.find((c) => c.method === 'POST' && c.url.endsWith('/discount'))!;
      // The wire takes a 0–100 PERCENTAGE, not cents or a fraction.
      expect(post.body.percentageRate).toBe(10);
      expect(post.body.reason).toContain('Senior');

      // Coherence: after the refetch the rendered Discount + Total reflect the
      // server response (₱250.00 off → ₱2,250.00 total), not an optimistic guess.
      await waitFor(() => expect(screen.getByText('-₱250.00')).not.toBeNull());
      await waitFor(() => expect(screen.getAllByText('₱2,250.00').length).toBeGreaterThan(0));
      expect((onUpdated as any).mock.calls.length).toBeGreaterThanOrEqual(1);
    } finally {
      f.restore();
    }
  });
});
